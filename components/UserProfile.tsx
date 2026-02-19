import React, { useState } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { CollectionName } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { compressImage } from '../utils/compressor';
import { faceService } from '../utils/FaceRecognitionService';
import { 
  Camera, User, Loader2, ShieldCheck, UploadCloud, 
  AlertTriangle, CheckCircle2, MapPin, Clock, ScanFace
} from 'lucide-react';

const UserProfile: React.FC = () => {
  const { userProfile, currentUser } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false); // State for facial analysis
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  // Fallback visual logic
  const displayImage = localPreview || userProfile?.avatar || userProfile?.photoURL;
  const initials = userProfile?.displayName 
    ? userProfile.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !currentUser) return;
    
    const file = e.target.files[0];
    setAnalyzing(true);

    try {
      // --- BIOMETRIC VALIDATION START ---
      
      // 1. Create a temporary image element to pass to face-api
      const tempImg = new Image();
      const objectUrl = URL.createObjectURL(file);
      tempImg.src = objectUrl;
      
      // Wait for image to load
      await new Promise((resolve, reject) => {
        tempImg.onload = resolve;
        tempImg.onerror = reject;
      });

      // 2. Extract Face Descriptor
      // This automatically loads models if not loaded
      const faceDescriptor = await faceService.extractFaceDescriptor(tempImg);
      
      // Clean up object URL
      URL.revokeObjectURL(objectUrl);

      // 3. Validation Logic
      if (!faceDescriptor) {
        alert("Erro Biométrico: Nenhum rosto detectado na foto. Por favor, envie uma foto clara, de frente, com boa iluminação e sem acessórios cobrindo o rosto.");
        setAnalyzing(false);
        return; // Stop upload
      }

      // If we got here, a valid face was found.
      // --- BIOMETRIC VALIDATION END ---

      setAnalyzing(false);
      setUploading(true);

      // 4. Compress Image (Optimize for storage and load speed)
      // Resize to max 500px width/height, 80% quality JPEG
      const compressedFile = await compressImage(file, 500, 0.8);

      // 5. Create Storage Reference
      // Path: profiles/{userId}_avatar.jpg - overwrites previous to save space
      const storageRef = ref(storage, `profiles/${currentUser.uid}_avatar.jpg`);

      // 6. Upload
      await uploadBytes(storageRef, compressedFile);

      // 7. Get URL
      const downloadURL = await getDownloadURL(storageRef);

      // 8. Update Firestore with Avatar AND Biometrics
      await updateDoc(doc(db, CollectionName.USERS, currentUser.uid), {
        avatar: downloadURL,
        photoURL: downloadURL, // Update legacy field too for compatibility
        biometrics: faceService.descriptorToString(faceDescriptor) // Save the face signature
      });

      // 9. Update Local State for immediate feedback
      setLocalPreview(downloadURL);
      alert("Foto de perfil e biometria facial atualizadas com sucesso!");

    } catch (error) {
      console.error("Error uploading avatar:", error);
      alert("Erro ao processar a foto. Verifique se o arquivo é uma imagem válida.");
    } finally {
      setAnalyzing(false);
      setUploading(false);
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
            
            <div className="relative group cursor-pointer mb-6">
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
                
                {(uploading || analyzing) && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm p-2">
                    <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                    <span className="text-white text-xs font-bold">
                        {analyzing ? 'Validando Biometria...' : 'Enviando...'}
                    </span>
                  </div>
                )}
              </div>

              {/* Hover Overlay for Edit */}
              <label className={`absolute inset-0 rounded-full bg-black/0 ${(!uploading && !analyzing) ? 'group-hover:bg-black/40' : ''} transition-all flex items-center justify-center cursor-pointer`}>
                {!uploading && !analyzing && (
                    <div className="opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all flex flex-col items-center text-white font-medium text-sm">
                    <Camera size={24} className="mb-1" />
                    <span>Alterar Foto</span>
                    </div>
                )}
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  disabled={uploading || analyzing}
                />
              </label>
            </div>

            <h2 className="text-xl font-bold text-gray-900">{userProfile?.displayName}</h2>
            <p className="text-sm text-gray-500 capitalize">{userProfile?.role === 'admin' ? 'Administrador' : userProfile?.role || 'Colaborador'}</p>
            
            <div className="mt-4 flex gap-2">
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
    </div>
  );
};

export default UserProfile;