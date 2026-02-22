import React, { useState, useEffect, useRef } from 'react';
import { addDoc, collection, serverTimestamp, getDocs, query, where, orderBy, limit, Timestamp, onSnapshot } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { CollectionName, WorkLocation, TimeEntry } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { GoogleGenAI } from "@google/genai";
import { 
  Clock, MapPin, ShieldCheck, Loader2, AlertTriangle, 
  History, ScanFace, Camera, Coffee, LogOut, LogIn, CheckCircle2 
} from 'lucide-react';

// Tipos de Ação do Ponto
type ActionType = 'entry' | 'lunch_start' | 'lunch_end' | 'exit';

interface ActionState {
  type: ActionType;
  label: string;
  icon: React.ElementType;
  colorClass: string;
  description: string;
}

const Ponto: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'register' | 'history'>('register');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Logic State
  const [loadingData, setLoadingData] = useState(true);
  const [processing, setProcessing] = useState(false); // UI Overlay state
  const [processMessage, setProcessMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Data State
  const [allowedLocations, setAllowedLocations] = useState<WorkLocation[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [detectedLocation, setDetectedLocation] = useState<WorkLocation | null>(null);
  const [history, setHistory] = useState<TimeEntry[]>([]);
  const [lastEntry, setLastEntry] = useState<TimeEntry | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- CLOCK TICKER ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- INITIAL DATA LOAD ---
  useEffect(() => {
    if (!currentUser) return;

    const initData = async () => {
      setLoadingData(true);
      await loadLocations();
      // History is now loaded via real-time listener below
    };

    initData();
  }, [currentUser]);

  // --- CAMERA LIFECYCLE (PROBLEM 5 FIX) ---
  useEffect(() => {
    if (activeTab === 'register' && !processing && !successMessage) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [activeTab, processing, successMessage]);

  // --- GEOLOCATION LOGIC ---
  const loadLocations = async () => {
    if (!userProfile) return;
    
    // Admin bypass or load assigned locations
    let locs: WorkLocation[] = [];
    if (userProfile.role === 'admin' && (!userProfile.allowedLocationIds || userProfile.allowedLocationIds.length === 0)) {
        const allLocs = await getDocs(query(collection(db, CollectionName.WORK_LOCATIONS)));
        locs = allLocs.docs.map(d => ({id:d.id, ...(d.data() as any)} as WorkLocation));
    } else if (userProfile.allowedLocationIds && userProfile.allowedLocationIds.length > 0) {
        const querySnapshot = await getDocs(collection(db, CollectionName.WORK_LOCATIONS));
        querySnapshot.forEach((doc) => {
          if (userProfile.allowedLocationIds?.includes(doc.id)) {
            locs.push({ id: doc.id, ...(doc.data() as any) } as WorkLocation);
          }
        });
    }
    setAllowedLocations(locs);
    checkGeolocation(locs);
  };

  const checkGeolocation = (locs: WorkLocation[]) => {
     if (!navigator.geolocation) return;
     
     navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });

        // Admin Global Bypass
        if (userProfile?.role === 'admin' && (!userProfile.allowedLocationIds || userProfile.allowedLocationIds.length === 0)) {
             setDetectedLocation({ name: 'Acesso Admin (Global)' } as WorkLocation);
             return;
        }

        // Distance Check
        const found = locs.find(loc => {
          const dist = getDistanceFromLatLonInM(latitude, longitude, loc.latitude, loc.longitude);
          return dist <= loc.radius;
        });
        setDetectedLocation(found || null);
      }, 
      (err) => console.error("GPS Error", err),
      { enableHighAccuracy: true }
    );
  };

  const getDistanceFromLatLonInM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI/180);
    const dLon = (lon2 - lon1) * (Math.PI/180);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c * 1000;
  };

  // --- HISTORY & STATE MACHINE LOGIC (REAL-TIME) ---
  useEffect(() => {
    if (!currentUser) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, CollectionName.TIME_ENTRIES),
      where('userId', '==', currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Ignorar snapshots com escritas pendentes para evitar flickering
      if (snapshot.metadata.hasPendingWrites) return;

      const entries = snapshot.docs
        .map(d => ({ id: d.id, ...(d.data() as any) } as TimeEntry))
        .filter(e => e.timestamp && e.timestamp.toDate);
      
      setHistory(entries);
      setLoadingData(false);

      // Determinar último registro de HOJE
      const todaysEntries = entries.filter(e => 
        e.timestamp.toDate() >= today
      );

      if (todaysEntries.length > 0) {
        setLastEntry(todaysEntries[0]);
      } else {
        setLastEntry(null);
      }
    }, (err: any) => {
      console.error("Error fetching history", err);
      setLoadingData(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // DETERMINISTIC NEXT ACTION (Problem 3 & 6)
  const getNextAction = (): ActionState => {
    if (!lastEntry) {
      return { 
        type: 'entry', 
        label: 'REGISTRAR ENTRADA', 
        icon: LogIn, 
        colorClass: 'bg-green-600 hover:bg-green-700',
        description: 'Iniciar jornada de trabalho'
      };
    }

    switch (lastEntry.type) {
      case 'entry':
        return { 
          type: 'lunch_start', 
          label: 'INICIAR ALMOÇO', 
          icon: Coffee, 
          colorClass: 'bg-yellow-600 hover:bg-yellow-700',
          description: 'Pausa para refeição'
        };
      case 'lunch_start':
        return { 
          type: 'lunch_end', 
          label: 'VOLTA DO ALMOÇO', 
          icon: Clock, 
          colorClass: 'bg-orange-600 hover:bg-orange-700',
          description: 'Retorno da pausa'
        };
      case 'lunch_end':
        return { 
          type: 'exit', 
          label: 'ENCERRAR EXPEDIENTE', 
          icon: LogOut, 
          colorClass: 'bg-red-600 hover:bg-red-700',
          description: 'Finalizar dia de trabalho'
        };
      case 'exit':
        return { 
          type: 'entry', 
          label: 'NOVA ENTRADA', 
          icon: LogIn, 
          colorClass: 'bg-blue-600 hover:bg-blue-700',
          description: 'Iniciar novo turno (Extra)'
        };
      default:
        // Fallback safe
        return { 
          type: 'entry', 
          label: 'REGISTRAR ENTRADA', 
          icon: LogIn, 
          colorClass: 'bg-green-600 hover:bg-green-700',
          description: 'Iniciar jornada'
        };
    }
  };

  // --- CAMERA FUNCTIONS ---
  const startCamera = async () => {
    try {
      // Small delay to ensure DOM is ready (Problem 5)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Stop any previous stream first
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: { ideal: "user" }, 
          width: { ideal: 640 }, 
          height: { ideal: 480 } 
        } 
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => console.error("Play error:", e)); 
        };
      }
    } catch (err: any) {
      console.error("Camera Error:", err);
      setErrorMessage("Erro ao acessar câmera. Verifique as permissões.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const getBase64FromUrl = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url, { method: 'GET', mode: 'cors' });
      if (!response.ok) throw new Error(`Fetch status: ${response.status}`);
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      // Fallback: Image Object
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error("Canvas context failed")); return; }
          ctx.drawImage(img, 0, 0);
          try { resolve(canvas.toDataURL('image/jpeg', 0.9)); } 
          catch (e) { reject(new Error("Canvas tainted")); }
        };
        img.onerror = () => reject(new Error("Image load fallback failed"));
      });
    }
  };

  // --- REGISTRATION LOGIC ---
  const handleRegister = async () => {
    const nextAction = getNextAction();

    // 1. Pre-checks
    console.log('1. Iniciando registro...');
    if (!currentUser || !videoRef.current) return;
    if (!streamRef.current || !streamRef.current.active) {
        setErrorMessage("Câmera desconectada. Recarregue a página.");
        return;
    }
    if (!detectedLocation && userProfile?.role !== 'admin') {
        setErrorMessage("Você está fora do perímetro permitido.");
        return;
    }
    
    // 2. Profile Photo Check
    const profilePhotoUrl = userProfile?.avatar || userProfile?.photoURL;
    if (!profilePhotoUrl) {
       setErrorMessage("Foto de perfil não cadastrada para comparação.");
       return;
    }

    // 3. Start Process (Block UI) (Problem 2)
    setProcessing(true);
    setProcessMessage('Capturando imagem...');
    setErrorMessage('');

    try {
        // A. Capture Frame
        console.log('2. Capturando frame...');
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas failed");
        
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);
        
        // Anti-spoofing Watermark
        ctx.font = "16px Arial";
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.fillText(new Date().toLocaleString(), 10, 470);

        const photoBase64 = canvas.toDataURL('image/jpeg', 0.85);
        console.log('2. Foto capturada');
        
        // B. Gemini Validation
        setProcessMessage('Validando biometria com IA...');
        
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('Chave da API Gemini não configurada (VITE_GEMINI_API_KEY).');
        }

        const ai = new GoogleGenAI({ apiKey });
        const refBase64 = await getBase64FromUrl(profilePhotoUrl);
        
        const currentData = photoBase64.split(',')[1];
        const refData = refBase64.split(',')[1];

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: {
              parts: [
                 { inlineData: { mimeType: 'image/jpeg', data: currentData } },
                 { inlineData: { mimeType: 'image/jpeg', data: refData } },
                 { text: "Analyze these two faces. Are they the same person? Reply with strictly valid JSON: { \"match\": boolean, \"confidence\": number } where confidence is 0.0 to 1.0." }
              ]
            },
            config: { responseMimeType: "application/json" }
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI");
        const result = JSON.parse(text);
        console.log('3. Gemini validado:', result);

        if (!result.match || result.confidence < 0.7) {
            throw new Error(`Rosto não corresponde ao perfil (Confiança: ${Math.round(result.confidence * 100)}%)`);
        }

        // C. Upload & Save
        setProcessMessage('Registrando no sistema...');
        const storageRef = ref(storage, `time_clock/${currentUser.uid}/${Date.now()}.jpg`);
        await uploadString(storageRef, photoBase64, 'data_url');
        const photoUrl = await getDownloadURL(storageRef);
        console.log('4. Upload foto concluído:', photoUrl);

        console.log('5. Salvando no Firestore...');
        const docRef = await addDoc(collection(db, CollectionName.TIME_ENTRIES), {
            userId: currentUser.uid,
            type: nextAction.type,
            timestamp: serverTimestamp(),
            locationId: detectedLocation?.id || 'unknown',
            location: currentLocation,
            photoEvidenceUrl: photoUrl,
            userAgent: navigator.userAgent,
            isManual: false,
            biometricVerified: true
        });
        console.log('6. Firestore salvo com sucesso, ID:', docRef.id);

        // D. Success State
        setSuccessMessage(`${nextAction.label} REGISTRADA!`);
        setProcessing(false);
        stopCamera();

        // Auto-reset after 3s
        setTimeout(() => {
            setSuccessMessage('');
            setActiveTab('history'); // UX: Go to history to show the record
        }, 3000);

    } catch (error: any) {
        console.error("Register Error:", error);
        setErrorMessage(error.message || "Erro técnico ao registrar ponto.");
        setProcessing(false);
    }
  };

  // --- HELPERS FOR HISTORY (Problem 4) ---
  const getActionLabel = (type: string) => {
    switch (type) {
        case 'entry': return { text: 'Entrada', icon: LogIn, color: 'text-green-600' };
        case 'lunch_start': return { text: 'Início Almoço', icon: Coffee, color: 'text-yellow-600' };
        case 'lunch_end': return { text: 'Fim Almoço', icon: Clock, color: 'text-orange-600' };
        case 'exit': return { text: 'Saída', icon: LogOut, color: 'text-red-600' };
        default: return { text: type, icon: CheckCircle2, color: 'text-gray-600' };
    }
  };

  // --- RENDER ---
  const nextAction = getNextAction();

  return (
    <div className="max-w-xl mx-auto space-y-4 animate-in fade-in duration-500 pb-20">
      
      {/* 1. Header (Compact) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
         <div className="flex flex-col">
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Hora Certa</span>
            <div className="text-2xl font-mono font-bold text-gray-900 leading-none">
               {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
            </div>
         </div>
         <div className="text-right flex flex-col items-end">
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider flex items-center gap-1">
               <MapPin size={10} /> Localização
            </span>
            <div className={`text-sm font-bold flex items-center gap-1 ${detectedLocation ? 'text-green-600' : 'text-red-500'}`}>
               {detectedLocation ? (
                 <>{detectedLocation.name} <ShieldCheck size={14} /></>
               ) : 'Fora do Perímetro'}
            </div>
         </div>
      </div>

      {/* TABS */}
      <div className="flex p-1 bg-gray-200 rounded-lg">
         <button 
           onClick={() => setActiveTab('register')}
           className={`flex-1 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'register' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'}`}
         >
            <ScanFace size={16} /> Registrar
         </button>
         <button 
           onClick={() => setActiveTab('history')}
           className={`flex-1 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'}`}
         >
            <History size={16} /> Histórico
         </button>
      </div>

      {/* TAB CONTENT: REGISTER */}
      {activeTab === 'register' && (
        <div className="flex flex-col gap-4">
            
            {/* 2. Camera Container (Center) */}
            <div className="relative bg-black rounded-2xl overflow-hidden shadow-lg aspect-[4/3] group">
                 {/* Video Stream */}
                 {!successMessage && (
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]" 
                    />
                 )}

                 {/* Success Overlay */}
                 {successMessage && (
                    <div className="absolute inset-0 bg-green-50 flex flex-col items-center justify-center z-30 animate-in zoom-in">
                       <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                          <CheckCircle2 className="w-10 h-10 text-green-600" />
                       </div>
                       <h3 className="text-2xl font-bold text-green-800 text-center px-4">{successMessage}</h3>
                    </div>
                 )}

                 {/* Processing Overlay (Problem 2) */}
                 {processing && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 text-white">
                        <Loader2 className="w-12 h-12 animate-spin text-brand-400 mb-4" />
                        <p className="text-lg font-bold">{processMessage}</p>
                    </div>
                 )}

                 {/* Error Overlay */}
                 {errorMessage && (
                    <div className="absolute inset-0 bg-red-900/90 backdrop-blur-sm flex flex-col items-center justify-center z-20 text-white px-6 text-center">
                        <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
                        <p className="font-bold mb-4">{errorMessage}</p>
                        <button 
                          onClick={() => { setErrorMessage(''); startCamera(); }}
                          className="px-4 py-2 bg-white text-red-900 rounded-lg text-sm font-bold"
                        >
                          Tentar Novamente
                        </button>
                    </div>
                 )}
            </div>

            {/* 3. Action Button (Bottom) */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <button
                    onClick={handleRegister}
                    disabled={processing || !!successMessage || !!errorMessage || !detectedLocation}
                    className={`
                        w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg
                        flex items-center justify-center gap-3 transition-all active:scale-95
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${nextAction.colorClass}
                    `}
                >
                    {processing ? (
                       <Loader2 className="animate-spin" /> 
                    ) : (
                       <nextAction.icon size={24} />
                    )}
                    {processing ? 'PROCESSANDO...' : nextAction.label}
                </button>
                <p className="text-center text-xs text-gray-500 mt-2">
                    {nextAction.description}
                </p>
            </div>

            {/* Last Record Hint */}
            {lastEntry && (
                <div className="text-center text-xs text-gray-400">
                    Último registro: {getActionLabel(lastEntry.type).text} às {lastEntry.timestamp?.toDate?.()?.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) ?? '--:--'}
                </div>
            )}
        </div>
      )}

      {/* TAB CONTENT: HISTORY (Problem 4) */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                 <h3 className="font-bold text-gray-700">Registros de Hoje</h3>
                 <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-bold">
                    {new Date().toLocaleDateString()}
                 </span>
             </div>
             
             {loadingData ? (
                 <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-brand-600"/></div>
             ) : (
                 <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                     {history.length === 0 && <p className="p-8 text-center text-gray-400 italic">Nenhum registro hoje.</p>}
                     {history.map(entry => {
                         const style = getActionLabel(entry.type);
                         return (
                             <div key={entry.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                 <div className="flex items-center gap-3">
                                     <div className={`p-2 rounded-lg bg-gray-50 ${style.color}`}>
                                         <style.icon size={20} />
                                     </div>
                                     <div>
                                         <p className={`font-bold text-sm ${style.color}`}>
                                             {style.text}
                                         </p>
                                         <p className="text-xs text-gray-400">
                                             {entry.location?.lat ? 'Via GPS/Mobile' : 'Manual'}
                                         </p>
                                     </div>
                                 </div>
                                 
                                 <div className="text-right">
                                     <div className="font-mono font-bold text-gray-900 text-lg">
                                        {entry.timestamp?.toDate?.()?.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) ?? '--:--'}
                                     </div>
                                     {entry.biometricVerified && (
                                         <div className="flex items-center justify-end gap-1 text-[10px] text-green-600 font-bold">
                                             <ShieldCheck size={10} /> Validado
                                         </div>
                                     )}
                                 </div>
                             </div>
                         );
                     })}
                 </div>
             )}
        </div>
      )}
    </div>
  );
};

export default Ponto;