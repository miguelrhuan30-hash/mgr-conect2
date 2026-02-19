import React, { useState, useEffect, useRef } from 'react';
import { addDoc, collection, serverTimestamp, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { CollectionName, WorkLocation, TimeEntry } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { GoogleGenAI } from "@google/genai";
import { 
  Clock, MapPin, ShieldCheck, Loader2, AlertTriangle, 
  History, RotateCcw, Calendar, ScanFace, Camera, Lock 
} from 'lucide-react';

const Ponto: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'register' | 'history'>('register');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Register Flow State
  const [status, setStatus] = useState<'idle' | 'validating' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Location State
  const [allowedLocations, setAllowedLocations] = useState<WorkLocation[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [detectedLocation, setDetectedLocation] = useState<WorkLocation | null>(null);
  
  // History State
  const [history, setHistory] = useState<TimeEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [todaysEntries, setTodaysEntries] = useState<TimeEntry[]>([]);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clock Ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Initial Load: Locations & History
  useEffect(() => {
    if (!currentUser) return;

    const initData = async () => {
      // B. Load Locations
      loadLocations();

      // C. Load History
      fetchHistory();

      // Start Camera
      startCamera();
    };

    initData();

    return () => stopCamera();
  }, [currentUser, userProfile]);

  const loadLocations = async () => {
    if (!userProfile) return;
    
    // Admin bypass or load assigned locations
    if (userProfile.role === 'admin' && (!userProfile.allowedLocationIds || userProfile.allowedLocationIds.length === 0)) {
        const allLocs = await getDocs(query(collection(db, CollectionName.WORK_LOCATIONS)));
        setAllowedLocations(allLocs.docs.map(d => ({id:d.id, ...d.data()} as WorkLocation)));
    } else if (userProfile.allowedLocationIds && userProfile.allowedLocationIds.length > 0) {
        const locs: WorkLocation[] = [];
        const querySnapshot = await getDocs(collection(db, CollectionName.WORK_LOCATIONS));
        querySnapshot.forEach((doc) => {
          if (userProfile.allowedLocationIds?.includes(doc.id)) {
            locs.push({ id: doc.id, ...doc.data() } as WorkLocation);
          }
        });
        setAllowedLocations(locs);
    }
    
    // Trigger Geo Check
    checkGeolocation();
  };

  const checkGeolocation = () => {
     if (!navigator.geolocation) {
         setErrorMessage("Geolocalização não suportada pelo navegador.");
         return;
     }
     navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });

        // Admin Bypass (Global)
        if (userProfile?.role === 'admin' && (!userProfile.allowedLocationIds || userProfile.allowedLocationIds.length === 0)) {
             setDetectedLocation({ name: 'Acesso Admin (Global)' } as WorkLocation);
             return;
        }
      }, 
      (err) => console.error("GPS Error", err),
      { enableHighAccuracy: true }
    );
  };

  // Ensure detectedLocation updates when locations or currentPos changes
  useEffect(() => {
    if (currentLocation && allowedLocations.length > 0) {
       const found = allowedLocations.find(loc => {
          const dist = getDistanceFromLatLonInM(currentLocation.lat, currentLocation.lng, loc.latitude, loc.longitude);
          return dist <= loc.radius;
       });
       setDetectedLocation(found || null);
    }
  }, [currentLocation, allowedLocations]);

  const getDistanceFromLatLonInM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI/180);
    const dLon = (lon2 - lon1) * (Math.PI/180);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c * 1000;
  };

  const fetchHistory = async () => {
    if (!currentUser) return;
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

  // 2. Camera Logic
  const startCamera = async () => {
    setErrorMessage('');
    
    try {
      // Fix: Wait 150ms to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: { ideal: "user" }, 
          width: { ideal: 480 }, 
          height: { ideal: 480 } 
        } 
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => console.error("Erro no play:", e)); 
        };
      }
    } catch (err: any) {
      console.error("Camera Error:", err);
      alert("Câmera bloqueada. Verifique as permissões do navegador.");
      const errorName = err.name || 'UnknownError';
      setErrorMessage(`Câmera bloqueada ou indisponível (${errorName}). Verifique as permissões.`);
      setStatus('error');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // 3. Register Action (GEMINI VALIDATION)
  const handleRegister = async (type: string) => {
    if (!currentUser || !videoRef.current) return;

    // A. Security Checks
    if (!streamRef.current || !streamRef.current.active) {
        setErrorMessage("Câmera desconectada. Recarregue a página.");
        setStatus('error');
        return;
    }

    if (!userProfile?.photoURL) {
        alert("BLOQUEIO DE SEGURANÇA: Foto de perfil não cadastrada. Atualize seu perfil.");
        return;
    }
    if (!detectedLocation && userProfile?.role !== 'admin') {
        alert("Você está fora do perímetro permitido.");
        return;
    }
    
    if (type === 'entry' && todaysEntries.length > 0 && todaysEntries[0].type === 'entry') {
        if (!window.confirm("Você já tem uma entrada aberta. Registrar nova entrada?")) return;
    }

    setStatus('validating');
    
    try {
        // B. Capture Frame
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas context failed");
        
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);
        
        // Anti-spoofing Timestamp
        ctx.font = "20px Arial";
        ctx.fillStyle = "white";
        ctx.shadowColor = "black";
        ctx.shadowBlur = 4;
        ctx.fillText(new Date().toLocaleString(), 10, 470);

        const photoBase64 = canvas.toDataURL('image/jpeg', 0.85);
        
        // C. GEMINI VALIDATION
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Fetch Stored Profile Image
        const refImageResp = await fetch(userProfile.photoURL);
        const refBlob = await refImageResp.blob();
        const refBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(refBlob);
        });

        const currentData = photoBase64.split(',')[1];
        const refData = refBase64.split(',')[1];

        // Call Gemini
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: {
              parts: [
                 { inlineData: { mimeType: 'image/jpeg', data: currentData } },
                 { inlineData: { mimeType: 'image/jpeg', data: refData } },
                 { text: "Analyze these two faces. Are they the same person? Reply with strictly valid JSON: { \"match\": boolean, \"confidence\": number } where confidence is 0.0 to 1.0." }
              ]
            },
            config: {
                responseMimeType: "application/json"
            }
        });

        const result = JSON.parse(response.text);
        console.log("Gemini Verification Result:", result);

        if (!result.match || result.confidence < 0.7) {
            setErrorMessage(`Reconhecimento Facial Falhou. Identidade não confirmada.`);
            setStatus('error');
            return;
        }

        // E. Save Data
        setStatus('uploading');
        
        const storageRef = ref(storage, `time_clock/${currentUser.uid}/${Date.now()}.jpg`);
        await uploadString(storageRef, photoBase64, 'data_url');
        const photoUrl = await getDownloadURL(storageRef);

        await addDoc(collection(db, CollectionName.TIME_ENTRIES), {
            userId: currentUser.uid,
            type: type,
            timestamp: serverTimestamp(),
            locationId: detectedLocation?.id || 'unknown',
            location: currentLocation,
            photoEvidenceUrl: photoUrl,
            userAgent: navigator.userAgent,
            isManual: false,
            biometricVerified: true // Proven by Gemini
        });

        setStatus('success');
        setTimeout(() => {
            setStatus('idle');
            setErrorMessage('');
            setActiveTab('history');
            fetchHistory();
        }, 3000);

    } catch (error) {
        console.error("Register Error:", error);
        setErrorMessage("Erro técnico ao registrar ponto.");
        setStatus('error');
    }
  };

  const reset = () => {
    setStatus('idle');
    setErrorMessage('');
    setTimeout(() => startCamera(), 100);
  };

  // --- RENDER ---

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 bg-green-50 rounded-2xl border border-green-200 animate-in fade-in zoom-in">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <ScanFace className="w-12 h-12 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-green-800">Ponto Registrado!</h2>
        <p className="text-green-700 mt-2">Identidade confirmada via Gemini AI.</p>
        <div className="mt-6 flex flex-col items-center gap-2 text-sm text-gray-600">
           <span className="flex items-center gap-2"><MapPin size={14} /> {detectedLocation?.name || 'Local Detectado'}</span>
           <span className="flex items-center gap-2"><Clock size={14} /> {currentTime.toLocaleTimeString()}</span>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 bg-red-50 rounded-2xl border border-red-200 animate-in fade-in">
        <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-12 h-12 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-red-800 text-center">Registro Bloqueado</h2>
        <p className="text-red-700 mt-2 text-center max-w-sm font-medium leading-relaxed">{errorMessage}</p>
        <button 
           onClick={reset}
           className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 shadow-lg"
        >
            <RotateCcw size={16} /> Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      <div className="flex items-center justify-between">
         <div>
            <h1 className="text-2xl font-bold text-gray-900">Registro de Ponto</h1>
            <p className="text-gray-500 text-sm">Controle de jornada com validação facial via Gemini AI.</p>
         </div>
         {status === 'validating' && (
             <div className="flex items-center gap-2 text-brand-600 bg-brand-50 px-3 py-1 rounded-full text-xs font-bold animate-pulse border border-brand-200">
                 <Loader2 size={14} className="animate-spin" /> Verificando Identidade...
             </div>
         )}
      </div>

      <div className="flex p-1 bg-gray-200 rounded-xl">
         <button 
           onClick={() => setActiveTab('register')}
           className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'register' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
         >
            <ScanFace size={18} /> Biometria Facial
         </button>
         <button 
           onClick={() => setActiveTab('history')}
           className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
         >
            <History size={18} /> Histórico
         </button>
      </div>

      {activeTab === 'register' && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="bg-black rounded-2xl overflow-hidden shadow-lg relative h-[400px] flex items-center justify-center group">
                 <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    onLoadedMetadata={() => {
                        videoRef.current?.play().catch(e => console.error("Play error:", e));
                    }}
                    className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]" 
                 />
                 <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-500/80 text-white backdrop-blur-md shadow-sm">
                        Posicione seu Rosto
                    </span>
                 </div>
            </div>

            <div className="flex flex-col justify-between h-[400px]">
                
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex-1 mb-4 flex flex-col items-center justify-center text-center">
                    <div className="text-5xl font-bold text-gray-900 tabular-nums tracking-tighter mb-2">
                        {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                    <div className="text-brand-600 font-medium flex items-center gap-2 text-sm mb-6">
                        <Calendar size={14} />
                        {currentTime.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>

                    <div className="w-full bg-gray-50 rounded-lg p-3 border border-gray-100 mb-2">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span className="flex items-center gap-1"><MapPin size={12}/> Localização</span>
                            <span className={detectedLocation ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
                                {detectedLocation ? 'Permitido' : 'Proibido'}
                            </span>
                        </div>
                        <p className="text-sm font-bold text-gray-800 truncate">
                            {detectedLocation?.name || 'Local Desconhecido'}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => handleRegister('entry')}
                        disabled={!detectedLocation || status !== 'idle'}
                        className="p-4 rounded-xl bg-green-50 border-2 border-green-100 hover:bg-green-100 hover:border-green-300 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
                    >
                        <Clock className="text-green-600" size={24} />
                        <span className="font-bold text-green-800">Entrada</span>
                    </button>
                    
                    <button 
                        onClick={() => handleRegister('exit')}
                        disabled={!detectedLocation || status !== 'idle'}
                        className="p-4 rounded-xl bg-red-50 border-2 border-red-100 hover:bg-red-100 hover:border-red-300 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
                    >
                        <Clock className="text-red-600" size={24} />
                        <span className="font-bold text-red-800">Saída</span>
                    </button>

                    <button 
                        onClick={() => handleRegister('lunch_start')}
                        disabled={!detectedLocation || status !== 'idle'}
                        className="p-3 rounded-xl bg-yellow-50 border border-yellow-100 hover:bg-yellow-100 transition-all disabled:opacity-50 text-xs font-bold text-yellow-800"
                    >
                        Início Almoço
                    </button>
                    
                    <button 
                        onClick={() => handleRegister('lunch_end')}
                        disabled={!detectedLocation || status !== 'idle'}
                        className="p-3 rounded-xl bg-yellow-50 border border-yellow-100 hover:bg-yellow-100 transition-all disabled:opacity-50 text-xs font-bold text-yellow-800"
                    >
                        Fim Almoço
                    </button>
                </div>

            </div>
         </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                 <h3 className="font-bold text-gray-700">Últimos Registros</h3>
                 <span className="text-xs text-gray-500">Últimos 20</span>
             </div>
             
             {loadingHistory ? (
                 <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-brand-600"/></div>
             ) : (
                 <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                     {history.length === 0 && <p className="p-8 text-center text-gray-400 italic">Nenhum registro encontrado.</p>}
                     {history.map(entry => (
                         <div key={entry.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                             <div className="flex items-center gap-4">
                                 <div className={`w-2 h-10 rounded-full ${entry.type === 'entry' ? 'bg-green-500' : entry.type === 'exit' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                                 <div>
                                     <p className="font-bold text-gray-900 flex items-center gap-2">
                                         {entry.type === 'entry' ? 'Entrada' : entry.type === 'exit' ? 'Saída' : 'Intervalo'}
                                         {entry.biometricVerified && <ShieldCheck size={14} className="text-green-500" title="Verificado por IA" />}
                                     </p>
                                     <p className="text-xs text-gray-500">
                                         {entry.timestamp.toDate().toLocaleDateString()} • {entry.timestamp.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                     </p>
                                 </div>
                             </div>
                             
                             <div className="flex items-center gap-2">
                                 {entry.photoEvidenceUrl && (
                                     <a href={entry.photoEvidenceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline flex items-center gap-1 bg-brand-50 px-2 py-1 rounded">
                                         <Camera size={12} /> Foto
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