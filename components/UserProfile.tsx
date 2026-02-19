import React, { useState, useRef, useEffect } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { ref, getDownloadURL, uploadString } from 'firebase/storage';
import { db, storage } from '../firebase';
import { CollectionName } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { faceService } from '../utils/FaceRecognitionService';
import { 
  Camera, User, Loader2, ShieldCheck, 
  AlertTriangle, MapPin, Clock, ScanFace, X, RefreshCw, Check
} from 'lucide-react';

const UserProfile: React.FC = () => {
  const { userProfile, currentUser } = useAuth();
  
  // States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false); // Validating face
  const [saving, setSaving] = useState(false); // Uploading to firebase
  const [cameraError, setCameraError] = useState('');
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Helper: Get initials
  const displayImage = userProfile?.avatar || userProfile?.photoURL;
  const initials = userProfile?.displayName 
    ? userProfile.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  // --- CAMERA LOGIC ---

  const startCamera = async () => {
    setIsCameraOpen(true);
    setCapturedImage(null);
    setCameraError('');
    
    try {
      // Pre-load models to ensure smoother experience
      await faceService.loadModels();

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera Error:", err);
      setCameraError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setCapturedImage(null);
    setProcessing(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    // 1. Draw video frame to canvas
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw image (mirror effect needs to be handled if CSS transform is used, 
      // but for raw data analysis we draw normally, or flip if we want the saved image to match preview)
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // 2. Convert to Base64
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      
      // 3. Biometric Validation (IA)
      setProcessing(true);
      try {
        const tempImg = new Image();
        tempImg.src = dataUrl;
        await new Promise(r => tempImg.onload = r);

        const faceDescriptor = await faceService.extractFaceDescriptor(tempImg);

        if (!faceDescriptor) {
          alert("⚠️ NENHUM ROSTO DETECTADO!\n\nPor favor:\n- Centralize seu rosto\n- Remova acessórios (óculos escuros, máscara)\n- Garanta boa iluminação");
          setProcessing(false);
          return; // Stop here, don't set capturedImage
        }

        // Face found! Set image and proceed
        setCapturedImage(dataUrl);

      } catch (error) {
        console.error("Validation Error:", error);
        alert("Erro técnico ao validar biometria.");
      } finally {
        setProcessing(false);
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    // Ensure video plays again if it was paused
    if (videoRef.current) videoRef.current.play();
  };

  const handleSavePhoto = async () => {
    if (!capturedImage || !currentUser) return;
    setSaving(true);

    try {
      // 1. Extract descriptor again to ensure we save the biometrics data
      const tempImg = new Image();
      tempImg.src = capturedImage;
      await new Promise(r => tempImg.onload = r);
      const faceDescriptor = await faceService.extractFaceDescriptor(tempImg);

      if (!faceDescriptor) {
          throw new Error("Biometria inválida no momento do salvamento.");
      }

      // 2. Upload to Firebase Storage
      const storageRef = ref(storage, `profiles/${currentUser.uid}_avatar.jpg`);
      await uploadString(storageRef, capturedImage, 'data_url');
      const downloadURL = await getDownloadURL(storageRef);

      // 3. Update Firestore with Photo URL AND Biometrics Data
      await updateDoc(doc(db, CollectionName.USERS, currentUser.uid), {
        avatar: downloadURL,
        photoURL: downloadURL,
        biometrics: faceService.descriptorToString(faceDescriptor)
      });

      alert("Foto de perfil e biometria atualizadas com sucesso!");
      stopCamera();

    } catch (error) {
      console.error("Save Error:", error);
      alert("Erro ao salvar foto de perfil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
          <p className="text-gray-500">Gerencie sua identidade visual e informações de acesso.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Avatar & Actions */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col items-center text-center">
            
            <div className="relative mb-6">
              <div className="w-40 h-40 rounded-full border-4 border-brand-100 overflow-hidden shadow-inner bg-gray-50 flex items-center justify-center relative">
                {displayImage ? (
                  <img 
                    src={displayImage} 
                    alt="Perfil" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-bold text-brand-300">{initials}</span>
                )}
              </div>

              {/* Camera Trigger Button - NO FILE INPUT */}
              <button 
                onClick={startCamera}
                className="absolute bottom-0 right-0 p-3 bg-brand-600 text-white rounded-full shadow-lg hover:bg-brand-700 hover:scale-105 transition-all border-2 border-white cursor-pointer"
                title="Tirar Foto"
              >
                <Camera size={20} />
              </button>
            </div>

            <h2 className="text-xl font-bold text-gray-900">{userProfile?.displayName}</h2>
            <p className="text-sm text-gray-500 capitalize">{userProfile?.role === 'admin' ? 'Administrador' : userProfile?.role || 'Colaborador'}</p>
            
            <div className="mt-4 flex gap-2 justify-center">
               <span className="px-3 py-1 bg-brand-50 text-brand-700 text-xs font-bold rounded-full border border-brand-100 uppercase tracking-wide">
                 Nível {userProfile?.level || 1}
               </span>
               <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full border border-gray-200 uppercase tracking-wide">
                 {userProfile?.sectorName || 'Geral'}
               </span>
            </div>
            
            {userProfile?.biometrics && (
                <div className="mt-4 flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
                    <ScanFace size={14} />
                    <span className="font-bold">Biometria Cadastrada</span>
                </div>
            )}
          </div>

          <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
             <div className="flex items-start gap-3">
               <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
               <div className="text-sm text-orange-800">
                 <p className="font-bold mb-1">Atenção à Foto de Perfil</p>
                 <p>
                   Esta imagem gera sua <strong>chave biométrica</strong> para bater o ponto.
                   <br/><br/>
                   <strong>Requisitos Obrigatórios:</strong>
                 </p>
                 <ul className="list-disc list-inside mt-1 ml-1 space-y-1 text-xs">
                    <li>Rosto totalmente visível</li>
                    <li>Sem óculos escuros ou máscara</li>
                    <li>Boa iluminação</li>
                    <li>Apenas uma pessoa na foto</li>
                 </ul>
               </div>
             </div>
          </div>
        </div>

        {/* Right Column: Details */}
        <div className="md:col-span-2 space-y-6">
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
              <User size={18} /> Dados Cadastrais
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nome Completo</label>
                <div className="p-3 bg-gray-50 rounded-lg text-gray-900 font-medium text-sm border border-gray-200">
                  {userProfile?.displayName}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">E-mail de Acesso</label>
                <div className="p-3 bg-gray-50 rounded-lg text-gray-900 font-medium text-sm border border-gray-200 flex items-center justify-between">
                  {userProfile?.email}
                  <ShieldCheck size={16} className="text-green-500" title="E-mail Verificado" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">UID (Identificador)</label>
                <div className="p-3 bg-gray-50 rounded-lg text-gray-500 font-mono text-xs border border-gray-200 truncate">
                  {currentUser?.uid}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Data de Cadastro</label>
                <div className="p-3 bg-gray-50 rounded-lg text-gray-900 text-sm border border-gray-200">
                  {userProfile?.createdAt ? new Date(userProfile.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
              <Clock size={18} /> Jornada e Acesso
            </div>
            <div className="p-6">
               {userProfile?.workSchedule ? (
                 <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col items-center justify-center text-center">
                       <span className="text-xs text-blue-600 font-bold uppercase mb-1">Entrada</span>
                       <span className="text-2xl font-bold text-blue-900">{userProfile.workSchedule.startTime}</span>
                    </div>
                    <div className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col items-center justify-center text-center">
                       <span className="text-xs text-blue-600 font-bold uppercase mb-1">Almoço</span>
                       <span className="text-2xl font-bold text-blue-900">{userProfile.workSchedule.lunchDuration} min</span>
                    </div>
                    <div className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col items-center justify-center text-center">
                       <span className="text-xs text-blue-600 font-bold uppercase mb-1">Saída</span>
                       <span className="text-2xl font-bold text-blue-900">{userProfile.workSchedule.endTime}</span>
                    </div>
                 </div>
               ) : (
                 <p className="text-gray-500 text-sm italic">Jornada de trabalho não configurada.</p>
               )}

               <div className="mt-6">
                 <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                   <MapPin size={16} /> Locais Permitidos ({userProfile?.allowedLocationIds?.length || 0})
                 </h4>
                 {(!userProfile?.allowedLocationIds || userProfile.allowedLocationIds.length === 0) ? (
                    <p className="text-xs text-gray-400">Nenhum local específico. (Acesso Livre ou Configuração Pendente)</p>
                 ) : (
                   <div className="flex flex-wrap gap-2">
                     {userProfile.allowedLocationIds.map(locId => (
                        <span key={locId} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded border border-gray-200">
                          Local ID: {locId}
                        </span>
                     ))}
                   </div>
                 )}
               </div>
            </div>
          </div>

        </div>
      </div>

      {/* CAMERA MODAL */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
              
              {/* Header */}
              <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
                 <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Camera size={20} className="text-brand-600"/> Atualizar Foto
                 </h3>
                 <button onClick={stopCamera} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                    <X size={20} className="text-gray-500" />
                 </button>
              </div>

              {/* Video Area */}
              <div className="relative bg-black h-80 flex items-center justify-center overflow-hidden">
                 {cameraError ? (
                   <div className="text-white text-center p-6">
                      <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
                      <p>{cameraError}</p>
                   </div>
                 ) : (
                   <>
                      {/* Video Element (Live Feed) - Mirrored */}
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] ${capturedImage ? 'hidden' : 'block'}`}
                      />
                      
                      {/* Hidden Canvas for Capture */}
                      <canvas ref={canvasRef} className="hidden" />
                      
                      {/* Captured Image Preview - Mirrored to match video experience */}
                      {capturedImage && (
                        <img 
                          src={capturedImage} 
                          alt="Preview" 
                          className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]" 
                        />
                      )}

                      {/* Face Guidelines Overlay (only when live) */}
                      {!capturedImage && !cameraError && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                           <div className="w-48 h-64 border-2 border-white/50 rounded-full border-dashed"></div>
                        </div>
                      )}

                      {/* Processing Overlay */}
                      {processing && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-20">
                           <Loader2 size={48} className="text-brand-500 animate-spin mb-3" />
                           <p className="text-white font-bold">Validando Biometria...</p>
                        </div>
                      )}
                   </>
                 )}
              </div>

              {/* Actions Footer */}
              <div className="p-6 bg-white border-t flex flex-col gap-3">
                 {!capturedImage ? (
                    <button 
                       onClick={handleCapture}
                       disabled={processing || !!cameraError}
                       className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg hover:bg-brand-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                       <Camera size={20} /> Capturar Foto
                    </button>
                 ) : (
                    <div className="flex gap-3">
                       <button 
                         onClick={handleRetake}
                         className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                       >
                         <RefreshCw size={18} /> Tentar Novamente
                       </button>
                       <button 
                         onClick={handleSavePhoto}
                         disabled={saving}
                         className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                       >
                         {saving ? <Loader2 className="animate-spin" size={20}/> : <Check size={20} />} 
                         Salvar Foto
                       </button>
                    </div>
                 )}
                 
                 <p className="text-center text-xs text-gray-400 mt-2">
                    A foto deve mostrar claramente seu rosto para funcionamento do registro de ponto.
                 </p>
              </div>

           </div>
        </div>
      )}

    </div>
  );
};

export default UserProfile;