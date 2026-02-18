import React, { useState, useEffect, useRef } from 'react';
import { addDoc, collection, serverTimestamp, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { CollectionName, WorkLocation, TimeEntry } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  Clock, MapPin, ShieldCheck, Loader2, Camera, AlertTriangle, CheckCircle2, 
  Navigation, History, RotateCcw, Calendar
} from 'lucide-react';

const Ponto: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'register' | 'history'>('register');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Register Flow State
  const [status, setStatus] = useState<'idle' | 'checking_geo' | 'camera_active' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [allowedLocations, setAllowedLocations] = useState<WorkLocation[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [detectedLocation, setDetectedLocation] = useState<WorkLocation | null>(null);
  const [actionType, setActionType] = useState<string>(''); // entry, exit, etc.
  
  // History State
  const [history, setHistory] = useState<TimeEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [todaysEntries, setTodaysEntries] = useState<TimeEntry[]>([]);

  // Camera Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);

  // Clock Ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Initial Load: Locations & History
  useEffect(() => {
    if (!currentUser) return;

    // Load Locations
    const fetchAllowedLocations = async () => {
      if (!userProfile?.allowedLocationIds || userProfile.allowedLocationIds.length === 0) {
          // If admin/master, fetch all active locations or just proceed if bypassing is needed
          if (userProfile?.role === 'admin') {
             const allLocs = await getDocs(query(collection(db, CollectionName.WORK_LOCATIONS)));
             setAllowedLocations(allLocs.docs.map(d => ({id:d.id, ...d.data()} as WorkLocation)));
          }
          return;
      }
      
      const locs: WorkLocation[] = [];
      const querySnapshot = await getDocs(collection(db, CollectionName.WORK_LOCATIONS));
      
      querySnapshot.forEach((doc) => {
        if (userProfile.allowedLocationIds?.includes(doc.id)) {
          locs.push({ id: doc.id, ...doc.data() } as WorkLocation);
        }
      });
      setAllowedLocations(locs);
    };

    // Load Recent History
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const today = new Date();
        today.setHours(0,0,0,0);

        const q = query(
          collection(db, CollectionName.TIME_ENTRIES),
          where('userId', '==', currentUser.uid),
          orderBy('timestamp', 'desc'),
          limit(20)
        );
        
        const snapshot = await getDocs(q);
        const entries = snapshot.docs.map(d => ({id: d.id, ...d.data()} as TimeEntry));
        setHistory(entries);
        setTodaysEntries(entries.filter(e => e.timestamp.toDate() >= today));
      } catch (err) {
        console.error("Error fetching history", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchAllowedLocations();
    fetchHistory();
  }, [currentUser, userProfile, status]); // Re-fetch history after success

  // Helper: Haversine Distance
  const getDistanceFromLatLonInM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth Radius km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; 
    return d * 1000; // Meters
  };

  const deg2rad = (deg: number) => deg * (Math.PI/180);

  // 2. Start Process: Geo Check
  const handleStartRegister = (type: string) => {
    if (!currentUser) return;
    
    // Simple logic to prevent double entry/exit spam (optional, good UX)
    if (type === 'entry' && todaysEntries.length > 0 && todaysEntries[0].type === 'entry') {
        if (!window.confirm("Você já registrou uma entrada hoje sem saída. Deseja registrar outra entrada?")) return;
    }

    setActionType(type);
    setStatus('checking_geo');
    setErrorMessage('');

    if (!navigator.geolocation) {
      setErrorMessage("Seu navegador não suporta geolocalização.");
      setStatus('error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        setCurrentLocation({ lat: userLat, lng: userLng });

        // Bypass for Admin/Master if configured, otherwise strict check
        if (userProfile?.role === 'admin' && allowedLocations.length === 0) {
            setDetectedLocation({ name: 'Acesso Remoto Admin' } as WorkLocation);
            startCamera();
            return;
        }

        let foundLocation: WorkLocation | null = null;
        
        if (allowedLocations.length === 0) {
           setErrorMessage("Você não tem locais de trabalho vinculados. Contate o RH.");
           setStatus('error');
           return;
        }

        for (const loc of allowedLocations) {
          const distance = getDistanceFromLatLonInM(userLat, userLng, loc.latitude, loc.longitude);
          if (distance <= loc.radius) {
            foundLocation = loc;
            break;
          }
        }

        if (foundLocation) {
          setDetectedLocation(foundLocation);
          startCamera();
        } else {
          setErrorMessage("Você está fora do perímetro permitido.");
          setStatus('error');
        }
      },
      (error) => {
        setErrorMessage("Erro ao obter GPS. Permita o acesso à localização.");
        setStatus('error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // 3. Camera Handling
  const startCamera = async () => {
    setStatus('camera_active');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setErrorMessage("Erro ao acessar câmera. Permita o uso da câmera.");
      setStatus('error');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        // Draw image
        context.drawImage(videoRef.current, 0, 0, 640, 480);
        
        // Add timestamp overlay to image for security
        context.font = "20px Arial";
        context.fillStyle = "white";
        context.fillText(new Date().toLocaleString(), 10, 470);

        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
        setPhotoData(dataUrl);
        
        // Stop stream
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
        
        submitPonto(dataUrl);
      }
    }
  };

  // 4. Final Submission
  const submitPonto = async (photoBase64: string) => {
    if (!currentUser) return;
    setStatus('uploading');

    try {
      // A. Upload Selfie
      const storageRef = ref(storage, `time_clock/${currentUser.uid}/${Date.now()}.jpg`);
      await uploadString(storageRef, photoBase64, 'data_url');
      const photoUrl = await getDownloadURL(storageRef);

      // B. Save to Firestore
      await addDoc(collection(db, CollectionName.TIME_ENTRIES), {
        userId: currentUser.uid,
        type: actionType,
        timestamp: serverTimestamp(),
        locationId: detectedLocation?.id || 'unknown',
        location: currentLocation,
        photoEvidenceUrl: photoUrl,
        userAgent: navigator.userAgent,
        isManual: false
      });

      setStatus('success');
      setTimeout(() => {
        setStatus('idle');
        setPhotoData(null);
        setDetectedLocation(null);
        setActiveTab('history'); // Auto switch to history to show entry
      }, 3000);

    } catch (error) {
      console.error(error);
      setErrorMessage("Erro ao salvar registro na nuvem.");
      setStatus('error');
    }
  };

  const reset = () => {
    setStatus('idle');
    setErrorMessage('');
    setPhotoData(null);
  };

  // --- RENDER HELPERS ---
  const getBadgeColor = (type: string) => {
      switch(type) {
          case 'entry': return 'bg-green-100 text-green-700 border-green-200';
          case 'exit': return 'bg-red-100 text-red-700 border-red-200';
          default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      }
  };

  const getLabel = (type: string) => {
      switch(type) {
          case 'entry': return 'Entrada';
          case 'exit': return 'Saída';
          case 'lunch_start': return 'Início Almoço';
          case 'lunch_end': return 'Fim Almoço';
          default: return type;
      }
  };

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 bg-green-50 rounded-2xl border border-green-200 animate-in fade-in zoom-in duration-300">
        <CheckCircle2 className="w-24 h-24 text-green-600 mb-4" />
        <h2 className="text-3xl font-bold text-green-800">Ponto Registrado!</h2>
        <p className="text-green-700 mt-2 text-lg">Local: {detectedLocation?.name || 'Local Identificado'}</p>
        <p className="text-green-600 font-mono mt-1">{currentTime.toLocaleTimeString()}</p>
      </div>
    );
  }

  if (status === 'camera_active' || status === 'uploading') {
    return (
      <div className="max-w-md mx-auto bg-black rounded-2xl overflow-hidden shadow-2xl relative">
        <video ref={videoRef} autoPlay playsInline className="w-full h-[500px] object-cover" />
        <canvas ref={canvasRef} width="640" height="480" className="hidden" />
        
        <div className="absolute top-4 left-0 right-0 text-center">
             <span className="bg-black/60 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                Posicione seu rosto
             </span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 to-transparent flex flex-col items-center gap-4">
          <p className="text-white font-medium text-sm flex items-center gap-2">
            <MapPin size={16} className="text-green-400" />
            {detectedLocation?.name}
          </p>
          
          {status === 'uploading' ? (
             <div className="flex items-center gap-3 text-white px-6 py-3 bg-white/10 rounded-full backdrop-blur"><Loader2 className="animate-spin"/> Enviando dados...</div>
          ) : (
            <button 
                onClick={capturePhoto} 
                className="w-20 h-20 rounded-full bg-white border-4 border-gray-300 flex items-center justify-center hover:scale-105 transition-transform shadow-lg active:scale-95"
            >
               <div className="w-16 h-16 rounded-full bg-brand-600 border-2 border-white"></div>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* TABS */}
      <div className="flex p-1 bg-gray-200 rounded-xl">
         <button 
           onClick={() => setActiveTab('register')}
           className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'register' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
         >
            <Clock size={18} /> Registrar Ponto
         </button>
         <button 
           onClick={() => setActiveTab('history')}
           className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
         >
            <History size={18} /> Meu Histórico
         </button>
      </div>

      {activeTab === 'register' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 relative overflow-hidden text-center">
            
            {/* Error Overlay */}
            {status === 'error' && (
            <div className="absolute inset-0 bg-white/95 z-20 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
                <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Não foi possível registrar</h3>
                <p className="text-red-600 font-medium mb-6 max-w-xs mx-auto">{errorMessage}</p>
                <button onClick={reset} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-800 font-bold flex items-center gap-2 transition-colors">
                    <RotateCcw size={18} /> Tentar Novamente
                </button>
            </div>
            )}

            {/* Loading Overlay */}
            {status === 'checking_geo' && (
            <div className="absolute inset-0 bg-white/90 z-20 flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-brand-600 animate-spin mb-4" />
                <p className="text-brand-800 font-bold text-lg">Validando Geolocalização...</p>
                <p className="text-gray-400 text-sm mt-2">Aguarde a precisão do GPS</p>
            </div>
            )}

            {/* CLOCK DISPLAY */}
            <div className="mb-10">
                <div className="text-7xl font-bold text-gray-900 tabular-nums tracking-tighter">
                    {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
                <div className="text-brand-600 font-medium mt-2 flex items-center justify-center gap-2">
                    <Calendar size={16} />
                    {currentTime.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
            </div>

            {/* ACTION BUTTONS GRID */}
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleStartRegister('entry')} className="p-6 rounded-2xl bg-green-50 border-2 border-green-100 text-green-700 hover:bg-green-100 hover:border-green-300 transition-all active:scale-95 flex flex-col items-center">
                    <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center mb-3 text-green-700"><Clock size={24}/></div>
                    <span className="font-bold text-lg">Entrada</span>
                </button>
                <button onClick={() => handleStartRegister('lunch_start')} className="p-6 rounded-2xl bg-yellow-50 border-2 border-yellow-100 text-yellow-700 hover:bg-yellow-100 hover:border-yellow-300 transition-all active:scale-95 flex flex-col items-center">
                    <div className="w-12 h-12 bg-yellow-200 rounded-full flex items-center justify-center mb-3 text-yellow-700"><Clock size={24}/></div>
                    <span className="font-bold text-lg">Saída Almoço</span>
                </button>
                <button onClick={() => handleStartRegister('lunch_end')} className="p-6 rounded-2xl bg-yellow-50 border-2 border-yellow-100 text-yellow-700 hover:bg-yellow-100 hover:border-yellow-300 transition-all active:scale-95 flex flex-col items-center">
                    <div className="w-12 h-12 bg-yellow-200 rounded-full flex items-center justify-center mb-3 text-yellow-700"><Clock size={24}/></div>
                    <span className="font-bold text-lg">Volta Almoço</span>
                </button>
                <button onClick={() => handleStartRegister('exit')} className="p-6 rounded-2xl bg-red-50 border-2 border-red-100 text-red-700 hover:bg-red-100 hover:border-red-300 transition-all active:scale-95 flex flex-col items-center">
                    <div className="w-12 h-12 bg-red-200 rounded-full flex items-center justify-center mb-3 text-red-700"><Clock size={24}/></div>
                    <span className="font-bold text-lg">Saída</span>
                </button>
            </div>

            <div className="mt-8 flex items-center justify-center text-xs text-gray-400 gap-3 border-t border-gray-100 pt-4">
                <span className="flex items-center gap-1"><Navigation size={12} /> Localização Obrigatória</span>
                <span className="flex items-center gap-1"><ShieldCheck size={12} /> Foto Obrigatória</span>
            </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                 <h3 className="font-bold text-gray-700">Últimos Registros</h3>
                 <span className="text-xs text-gray-500">Exibindo últimos 20</span>
             </div>
             
             {loadingHistory ? (
                 <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-brand-600"/></div>
             ) : (
                 <div className="divide-y divide-gray-100">
                     {history.length === 0 && <p className="p-8 text-center text-gray-400 italic">Nenhum registro encontrado.</p>}
                     {history.map(entry => (
                         <div key={entry.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                             <div className="flex items-center gap-4">
                                 <div className={`w-2 h-10 rounded-full ${entry.type === 'entry' ? 'bg-green-500' : entry.type === 'exit' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                                 <div>
                                     <p className="font-bold text-gray-900 flex items-center gap-2">
                                         {getLabel(entry.type)}
                                         {entry.isManual && <span className="text-[10px] bg-gray-200 text-gray-600 px-1 rounded uppercase">Manual</span>}
                                         {entry.forcedClose && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded uppercase">Fechamento Forçado</span>}
                                     </p>
                                     <p className="text-xs text-gray-500">
                                         {entry.timestamp.toDate().toLocaleDateString()} • {entry.timestamp.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                     </p>
                                 </div>
                             </div>
                             
                             <div className="flex items-center gap-2">
                                 {entry.photoEvidenceUrl && (
                                     <a href={entry.photoEvidenceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                                         <Camera size={12} /> Ver Foto
                                     </a>
                                 )}
                             </div>
                         </div>
                     ))}
                 </div>
             )}
        </div>
      )}

    </div>
  );
};

export default Ponto;