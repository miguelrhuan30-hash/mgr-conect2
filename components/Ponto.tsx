import React, { useState, useEffect, useRef } from 'react';




















import { addDoc, collection, serverTimestamp, getDocs, query, where, orderBy, limit, Timestamp, onSnapshot, doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { CollectionName, WorkLocation, TimeEntry } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { GoogleGenAI } from "@google/genai";
import { 
  Clock, MapPin, ShieldCheck, Loader2, AlertTriangle, 
  History, ScanFace, Camera, Coffee, LogOut, LogIn, CheckCircle2 
} from 'lucide-react';
import { logEvent } from '../utils/logger';
import VehicleCheck from './VehicleCheck';

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
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number, accuracy?: number | null} | null>(null);
  const [detectedLocation, setDetectedLocation] = useState<WorkLocation | null>(null);
  const [history, setHistory] = useState<TimeEntry[]>([]);
  const [lastEntry, setLastEntry] = useState<TimeEntry | null>(null);
  const [lunchCountdown, setLunchCountdown] = useState<string | null>(null);
  const [entryCountdown, setEntryCountdown] = useState<string | null>(null);
  // ── Veículos ──
  const [mostrarVehicleCheck, setMostrarVehicleCheck] = useState(false);
  const [novoTimeEntryId, setNovoTimeEntryId] = useState<string | undefined>(undefined);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const entryTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // --- CRONÔMETRO DE BOAS-VINDAS (20 min após entrada) ---
  useEffect(() => {
    const isEntry = lastEntry?.type === 'entry';
    if (!isEntry) {
      // Limpa se o último evento não é entrada
      if (entryTimerRef.current) clearInterval(entryTimerRef.current);
      setEntryCountdown(null);
      return;
    }

    const entryTime = lastEntry?.timestamp?.toDate?.() ?? null;
    if (!entryTime) return;

    const TOTAL_MS = 20 * 60 * 1000; // 20 minutos

    const tick = () => {
      const elapsed = Date.now() - entryTime.getTime();
      const remaining = Math.max(0, TOTAL_MS - elapsed);
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setEntryCountdown(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };

    tick(); // imediato
    if (entryTimerRef.current) clearInterval(entryTimerRef.current);
    entryTimerRef.current = setInterval(tick, 1000);

    return () => {
      if (entryTimerRef.current) clearInterval(entryTimerRef.current);
    };
  }, [lastEntry]);

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
        const { latitude, longitude, accuracy } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude, accuracy: accuracy });

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

  // --- LUNCH COUNTDOWN LOGIC ---
  useEffect(() => {
    // Limpar intervalo anterior
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    const nextAction = getNextAction();
    if (nextAction?.type !== 'lunch_end') {
      setLunchCountdown(null);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lunchStart = history
      .filter(e => 
        e.type === 'lunch_start' && 
        e.timestamp?.toDate &&
        e.timestamp.toDate() >= today
      )
      .sort((a, b) => 
        b.timestamp.toDate().getTime() - 
        a.timestamp.toDate().getTime()
      )[0];

    if (!lunchStart?.timestamp) {
      setLunchCountdown(null);
      return;
    }

    const tick = () => {
      const now = new Date();
      const diffMs = now.getTime() - lunchStart.timestamp.toDate().getTime();
      const minMinutes = 60; // 1 hora
      const remainingMs = (minMinutes * 60 * 1000) - diffMs;

      if (remainingMs <= 0) {
        setLunchCountdown(null);
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        return;
      }

      const remainingMin = Math.floor(remainingMs / 1000 / 60);
      const remainingSec = Math.floor((remainingMs / 1000) % 60);
      setLunchCountdown(
        `${String(remainingMin).padStart(2,'0')}:${String(remainingSec).padStart(2,'0')}`
      );
    };

    tick(); // executar imediatamente
    countdownRef.current = setInterval(tick, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [history, lastEntry]);

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
  const validateLunchMinTime = (): { valid: boolean; remaining?: string } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lunchStart = history
      .filter(e => 
        e.type === 'lunch_start' && 
        e.timestamp?.toDate &&
        e.timestamp.toDate() >= today
      )
      .sort((a, b) => 
        b.timestamp.toDate().getTime() - 
        a.timestamp.toDate().getTime()
      )[0];

    if (!lunchStart?.timestamp) return { valid: true };

    const lunchStartTime = lunchStart.timestamp.toDate();
    const now = new Date();
    const diffMs = now.getTime() - lunchStartTime.getTime();
    const diffMinutes = diffMs / 1000 / 60;
    const minMinutes = 60; // 1 hora

    if (diffMinutes < minMinutes) {
      const remainingMs = (minMinutes * 60 * 1000) - diffMs;
      const remainingMin = Math.floor(remainingMs / 1000 / 60);
      const remainingSec = Math.floor((remainingMs / 1000) % 60);
      return {
      valid: false,
        remaining: `${String(remainingMin).padStart(2,'0')}:${String(remainingSec).padStart(2,'0')}`
      };
    }

    return { valid: true };
  };

  const handleRegister = async () => {
    const nextAction = getNextAction();

    // 1. Pre-checks
    if (!currentUser || !videoRef.current) return;

    if (nextAction.type === 'lunch_end') {
      const lunchCheck = validateLunchMinTime();
      if (!lunchCheck.valid) {
        setErrorMessage(
          `⏱ Almoço mínimo de 1 hora não cumprido.\n` +
          `Tempo restante: ${lunchCheck.remaining}`
        );
        logEvent(
          currentUser.uid,
          userProfile?.displayName,
          'ponto_lunch_time_blocked',
          'warning',
          `Almoço bloqueado — tempo restante: ${lunchCheck.remaining}`,
          { lunchRemaining: lunchCheck.remaining }
        );
        return;
      }
    }

    if (nextAction.type === 'lunch_start' || nextAction.type === 'lunch_end') {
      const gpsOk = await new Promise<boolean>((resolve) => {
        if (!navigator.geolocation) { resolve(false); return; }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
            resolve(true);
          },
          () => resolve(false),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
      if (!gpsOk) {
        setErrorMessage("GPS necessário para registrar almoço. Ative a localização e tente novamente.");
        return;
      }
    }

    if (!streamRef.current || !streamRef.current.active) {
        setErrorMessage("Câmera desconectada. Recarregue a página.");
        return;
    }

    const requiresLocation = nextAction.type === 'entry' || nextAction.type === 'exit';
    const hasRestrictedPerimeter = userProfile?.allowedLocationIds && userProfile.allowedLocationIds.length > 0;

    if (requiresLocation && hasRestrictedPerimeter && !detectedLocation && userProfile?.role !== 'admin') {
        setErrorMessage("Você está fora do perímetro permitido.");
        return;
    }
    
    // GET FRESH GPS
    let freshLocation = currentLocation;
    try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
        });
        freshLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setCurrentLocation(freshLocation);
    } catch (err) {}
    
    const profilePhotoUrl = userProfile?.avatar || userProfile?.photoURL;
    if (!profilePhotoUrl) {
       setErrorMessage("Foto de perfil não cadastrada.");
       return;
    }

    // 2. Start Process
    setProcessing(true);
    setProcessMessage('Capturando...');
    setErrorMessage('');

    try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas failed");
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);
        
        ctx.font = "16px Arial";
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.fillText(new Date().toLocaleString(), 10, 470);

        const photoBase64 = canvas.toDataURL('image/jpeg', 0.85);

        // ─── PASSO 1: SALVAR O PONTO IMEDIATAMENTE NO FIRESTORE ───
        setProcessMessage('Gravando registro...');
        const docRef = await addDoc(collection(db, CollectionName.TIME_ENTRIES), {
            userId: currentUser.uid,
            type: nextAction.type,
            timestamp: serverTimestamp(),
            locationId: detectedLocation?.id || 'unknown',
            locationName: detectedLocation?.name || 'Capturado via GPS',
            isManual: false,
            gpsCoords: freshLocation ? { lat: freshLocation.lat, lng: freshLocation.lng, accuracy: freshLocation.accuracy } : null,
            userAgent: navigator.userAgent,
            biometricVerified: false,   // será atualizado pelo background
            photoURL: null,             // será atualizado pelo background
            aiValidation: null,         // será atualizado pelo background
        });

        // ─── PASSO 2: LIBERAR A UI APÓS CONFIRMAÇÃO DO FIRESTORE ───
        setSuccessMessage(`${nextAction.label} REGISTRADA!`);
        setProcessing(false);
        stopCamera();

        // ── Acionar formulário de veículo após entrada ──
        if (nextAction.type === 'entry') {
          setNovoTimeEntryId(docRef.id);
          setMostrarVehicleCheck(true);
        }
        logEvent(currentUser.uid, userProfile?.displayName, 'ponto_register_success', 'success', `Ponto gravado: ${nextAction.label}`, { extra: { docId: docRef.id } });

        // Auto-reset after 3s
        setTimeout(() => {
            setSuccessMessage('');
            setActiveTab('history');
        }, 3000);

        // ─── PASSO 3: PROCESSAR FOTO E IA EM BACKGROUND (updateDoc) ───
        (async () => {
          try {
            // 3a. Upload da foto capturada
            const storageRef = ref(storage, `${CollectionName.TIME_ENTRIES}/${currentUser.uid}_${docRef.id}.jpg`);
            await uploadString(storageRef, photoBase64, 'data_url');
            const photoURL = await getDownloadURL(storageRef);

            // 3b. Validação biométrica com Gemini
            let aiValidation: { match: boolean; confidence: number } | null = null;
            try {
              const refBase64 = await getBase64FromUrl(profilePhotoUrl);
              const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY as string });
              const response = await ai.models.generateContent({
                  model: "gemini-2.0-flash",
                  contents: {
                    parts: [
                       { inlineData: { mimeType: 'image/jpeg', data: photoBase64.split(',')[1] } },
                       { inlineData: { mimeType: 'image/jpeg', data: refBase64.split(',')[1] } },
                       { text: "Analyze these two faces. Are they the same person? Reply with strictly valid JSON: { \"match\": boolean, \"confidence\": number }." }
                    ]
                  },
                  config: { responseMimeType: "application/json" }
              });
              aiValidation = JSON.parse(response.text || 'null');
            } catch (aiError) {
              // IA falhou — registrar e continuar sem invalidar o ponto
              logEvent(
                currentUser.uid,
                userProfile?.displayName,
                'ponto_ai_validation_failed',
                'warning',
                `Validação biométrica falhou para o doc ${docRef.id}. Ponto mantido para conferência manual.`,
                { extra: { error: String(aiError) } }
              );
            }

            // 3c. Atualizar o documento já salvo com foto e resultado da IA
            await updateDoc(doc(db, CollectionName.TIME_ENTRIES, docRef.id), {
                photoURL,
                aiValidation,
                biometricVerified: aiValidation?.match === true,
            });

          } catch (bgError) {
            // Upload de foto falhou — registrar e não abortar o ponto
            logEvent(
              currentUser.uid,
              userProfile?.displayName,
              'ponto_background_processing_failed',
              'warning',
              `Processamento em background falhou para o doc ${docRef.id}. Ponto mantido para conferência manual.`,
              { extra: { error: String(bgError) } }
            );
          }
        })();

    } catch (err: any) {
        setProcessing(false);
        setErrorMessage(err.message || "Erro durante o registro.");
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

  const LocationBadge = ({ entry }: { entry: TimeEntry }) => {
    const isLunch = entry.type === 'lunch_start' || entry.type === 'lunch_end';
    
    if (isLunch && entry.mapsUrl) {
      return (
        <a 
          href={entry.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-blue-600 font-bold hover:text-blue-800 hover:underline"
          onClick={e => e.stopPropagation()}
        >
          <MapPin size={10} />
          Ver no Mapa
        </a>
      );
    }
    
    if (entry.locationVerified) {
      return (
        <div className="flex items-center gap-1 text-[10px] text-green-600 font-bold">
          <ShieldCheck size={10} />
          {entry.locationName || 'Verificado'}
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-1 text-[10px] text-orange-500 font-bold">
        <AlertTriangle size={10} />
        Fora do Perímetro
      </div>
    );
  };

  // --- RENDER ---
  const nextAction = getNextAction();
  const isLunchAction = nextAction.type === 'lunch_start' || nextAction.type === 'lunch_end';
  const requiresLocation = nextAction.type === 'entry' || nextAction.type === 'exit';
  const isLunchBlocked = lunchCountdown !== null && nextAction?.type === 'lunch_end';
  const isLunchWithoutGPS = isLunchAction && !currentLocation;
  const isBlocked = processing || !!successMessage || !!errorMessage || (requiresLocation && !detectedLocation) || isLunchBlocked || isLunchWithoutGPS;

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
            {isLunchAction ? (
              <div className={`text-sm font-bold flex items-center gap-1 ${currentLocation ? 'text-blue-600' : 'text-yellow-500'}`}>
                <MapPin size={14} />
                {currentLocation ? 'GPS Ativo' : 'GPS não disponível'}
              </div>
            ) : (
              <div className={`text-sm font-bold flex items-center gap-1 ${detectedLocation ? 'text-green-600' : 'text-red-500'}`}>
                {detectedLocation ? <><ShieldCheck size={14}/> {detectedLocation.name}</> : 'Fora do Perímetro'}
              </div>
            )}
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
                {lunchCountdown && nextAction?.type === 'lunch_end' && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center mb-4 animate-in slide-in-from-top duration-300">
                        <div className="text-[10px] text-orange-600 font-bold uppercase tracking-wider mb-2">
                            ⏱ AGUARDE PARA RETORNAR DO ALMOÇO
                        </div>
                        <div className="text-4xl font-black text-orange-600 font-mono leading-none">
                            {lunchCountdown}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-2">
                            Almoço mínimo de 1 hora obrigatório
                        </div>
                    </div>
                )}

                {/* ─── CRONÔMETRO PEDAGÓGICO DE BOAS-VINDAS ─────────────────── */}
                {entryCountdown && nextAction?.type !== 'entry' && (
                  <div className="mt-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 text-center animate-in slide-in-from-bottom duration-500">
                    {/* Ícone e saudação */}
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Coffee className="w-5 h-5 text-amber-600" />
                      <span className="text-sm font-extrabold text-amber-800 uppercase tracking-wide">Bom dia! ☀️</span>
                      <Coffee className="w-5 h-5 text-amber-600" />
                    </div>
                    <p className="text-xs text-amber-700 mb-4 leading-relaxed">
                      Tome seu café, arrume suas ferramentas<br />e prepare-se para iniciar as atividades!
                    </p>

                    {/* Cronômetro regressivo */}
                    <div className="relative inline-flex flex-col items-center">
                      <div className="w-28 h-28 rounded-full border-4 border-amber-300 bg-white shadow-inner flex flex-col items-center justify-center mb-2">
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-0.5">preparo</span>
                        <span className="text-3xl font-black text-amber-700 font-mono leading-none">
                          {entryCountdown}
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-500 font-bold">
                        {entryCountdown === '00:00' ? '✅ Pronto para começar!' : 'Tempo restante de preparo'}
                      </span>
                    </div>
                  </div>
                )}

                <button
                    onClick={handleRegister}
                    disabled={isBlocked}
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
                    {processing 
                        ? 'PROCESSANDO...' 
                        : isLunchBlocked 
                            ? `🍽️ Retornar em ${lunchCountdown}`
                            : nextAction.label
                    }
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

            {/* ─── ABERTURA DE VEÍCULO (após entrada) ─── */}
            {mostrarVehicleCheck && (
              <VehicleCheck
                timeEntryId={novoTimeEntryId}
                onComplete={() => setMostrarVehicleCheck(false)}
                onSkip={() => setMostrarVehicleCheck(false)}
              />
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
                                         <LocationBadge entry={entry} />
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