import React, { useState, useEffect, useRef } from 'react';
import { addDoc, collection, serverTimestamp, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { CollectionName, WorkLocation, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Clock, MapPin, ShieldCheck, Loader2, Camera, AlertTriangle, CheckCircle2, Navigation } from 'lucide-react';

const Ponto: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // State Machine: 'idle' | 'checking_geo' | 'camera_active' | 'uploading' | 'success' | 'error'
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [allowedLocations, setAllowedLocations] = useState<WorkLocation[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [detectedLocation, setDetectedLocation] = useState<WorkLocation | null>(null);
  const [actionType, setActionType] = useState<string>(''); // entry, exit, etc.

  // Camera Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);

  // Clock Ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Initial Load: Get User's Allowed Locations
  useEffect(() => {
    const fetchAllowedLocations = async () => {
      if (!userProfile?.allowedLocationIds || userProfile.allowedLocationIds.length === 0) return;
      
      const locs: WorkLocation[] = [];
      const querySnapshot = await getDocs(collection(db, CollectionName.WORK_LOCATIONS));
      
      querySnapshot.forEach((doc) => {
        if (userProfile.allowedLocationIds?.includes(doc.id)) {
          locs.push({ id: doc.id, ...doc.data() } as WorkLocation);
        }
      });
      setAllowedLocations(locs);
    };
    fetchAllowedLocations();
  }, [userProfile]);

  // Helper: Haversine Distance
  const getDistanceFromLatLonInM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; // Distance in km
    return d * 1000; // Distance in meters
  };

  const deg2rad = (deg: number) => deg * (Math.PI/180);

  // 2. Start Process: Geo Check
  const handleStartRegister = (type: string) => {
    if (!currentUser) return;
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

        // Check against allowed locations
        let foundLocation: WorkLocation | null = null;
        
        // If user has no specific allowed locations restricted, assume global access (or prompt error based on business logic)
        // For this strict mode, if allowedLocationIds is empty, we block.
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
          setErrorMessage("Você está fora do perímetro permitido para registro de ponto.");
          setStatus('error');
        }
      },
      (error) => {
        setErrorMessage("Erro ao obter GPS. Verifique as permissões.");
        setStatus('error');
      },
      { enableHighAccuracy: true }
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
      setErrorMessage("Erro ao acessar câmera.");
      setStatus('error');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        context.drawImage(videoRef.current, 0, 0, 640, 480);
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
    if (!currentUser || !currentLocation) return;
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
        userAgent: navigator.userAgent
      });

      setStatus('success');
      setTimeout(() => {
        setStatus('idle');
        setPhotoData(null);
        setDetectedLocation(null);
      }, 4000);

    } catch (error) {
      console.error(error);
      setErrorMessage("Erro ao salvar registro.");
      setStatus('error');
    }
  };

  const reset = () => {
    setStatus('idle');
    setErrorMessage('');
    setPhotoData(null);
  };

  // --- RENDERING ---

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-green-50 rounded-2xl border border-green-200 animate-in fade-in zoom-in duration-300">
        <CheckCircle2 className="w-20 h-20 text-green-600 mb-4" />
        <h2 className="text-2xl font-bold text-green-800">Ponto Registrado!</h2>
        <p className="text-green-700 mt-2">Local: {detectedLocation?.name}</p>
        <p className="text-green-600 text-sm mt-1">{currentTime.toLocaleTimeString()}</p>
      </div>
    );
  }

  if (status === 'camera_active' || status === 'uploading') {
    return (
      <div className="max-w-md mx-auto bg-black rounded-2xl overflow-hidden shadow-2xl relative">
        <video ref={videoRef} autoPlay playsInline className="w-full h-80 object-cover" />
        <canvas ref={canvasRef} width="640" height="480" className="hidden" />
        
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center gap-4">
          <p className="text-white font-medium text-sm flex items-center gap-2">
            <MapPin size={16} className="text-green-400" />
            {detectedLocation?.name} (Confirmado)
          </p>
          
          {status === 'uploading' ? (
             <div className="flex items-center gap-2 text-white"><Loader2 className="animate-spin"/> Registrando...</div>
          ) : (
            <button onClick={capturePhoto} className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 flex items-center justify-center hover:scale-105 transition-transform">
               <div className="w-12 h-12 rounded-full bg-brand-600"></div>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto text-center space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ponto Eletrônico</h1>
        <p className="text-gray-500">Sistema seguro com validação biométrica e geolocalização.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 relative overflow-hidden">
        {/* Error Overlay */}
        {status === 'error' && (
           <div className="absolute inset-0 bg-white/90 z-20 flex flex-col items-center justify-center p-6 text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mb-2" />
              <p className="text-red-700 font-bold mb-4">{errorMessage}</p>
              <button onClick={reset} className="px-4 py-2 bg-gray-200 rounded-lg text-sm font-bold">Tentar Novamente</button>
           </div>
        )}

        {/* Loading Overlay */}
        {status === 'checking_geo' && (
           <div className="absolute inset-0 bg-white/90 z-20 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-brand-600 animate-spin mb-2" />
              <p className="text-brand-800 font-medium">Verificando localização...</p>
           </div>
        )}

        <div className="mb-8">
          <div className="text-6xl font-bold text-gray-900 tabular-nums tracking-tight">
            {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
          <div className="text-gray-500 font-medium mt-2">
            {currentTime.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleStartRegister('entry')}
            disabled={status !== 'idle'}
            className="group flex flex-col items-center justify-center p-4 rounded-xl border-2 border-green-100 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-300 transition-all active:scale-95"
          >
            <div className="p-3 bg-white rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform">
               <Clock className="w-6 h-6 text-green-600" />
            </div>
            <span className="font-bold">Entrada</span>
          </button>
          
          <button
            onClick={() => handleStartRegister('lunch_start')}
            disabled={status !== 'idle'}
            className="group flex flex-col items-center justify-center p-4 rounded-xl border-2 border-yellow-100 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 hover:border-yellow-300 transition-all active:scale-95"
          >
             <div className="p-3 bg-white rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform">
               <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <span className="font-bold">Saída Almoço</span>
          </button>

          <button
            onClick={() => handleStartRegister('lunch_end')}
            disabled={status !== 'idle'}
            className="group flex flex-col items-center justify-center p-4 rounded-xl border-2 border-yellow-100 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 hover:border-yellow-300 transition-all active:scale-95"
          >
             <div className="p-3 bg-white rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform">
               <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <span className="font-bold">Volta Almoço</span>
          </button>

          <button
            onClick={() => handleStartRegister('exit')}
            disabled={status !== 'idle'}
            className="group flex flex-col items-center justify-center p-4 rounded-xl border-2 border-red-100 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 transition-all active:scale-95"
          >
             <div className="p-3 bg-white rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform">
               <Clock className="w-6 h-6 text-red-600" />
            </div>
            <span className="font-bold">Saída Dia</span>
          </button>
        </div>

        <div className="mt-8 flex items-center justify-center text-xs text-gray-400 gap-2 border-t border-gray-100 pt-4">
          <Navigation size={12} />
          <span>Sua localização será gravada.</span>
          <ShieldCheck size={12} />
          <span>Foto obrigatória para validação.</span>
        </div>
      </div>
    </div>
  );
};

export default Ponto;