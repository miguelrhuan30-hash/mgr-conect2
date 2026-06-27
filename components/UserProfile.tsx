import React, { useState, useRef, useEffect } from 'react';
import { updateDoc, doc, deleteField } from 'firebase/firestore';
import { ref, getDownloadURL, uploadString } from 'firebase/storage';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { CollectionName } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  Camera, User, Loader2, ShieldCheck,
  AlertTriangle, MapPin, Clock, ScanFace, X, RefreshCw, Check, Lock, Eye, EyeOff,
  KeyRound, GraduationCap,
} from 'lucide-react';
import CareerBadges from './academy/CareerBadges';

const UserProfile: React.FC = () => {
  const { userProfile, currentUser } = useAuth();
  const navigate = useNavigate();
  
  // States — foto
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cameraError, setCameraError] = useState('');

  // States — trocar senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Helper: Get initials
  const displayImage = userProfile?.avatar || userProfile?.photoURL;
  const initials = userProfile?.displayName 
    ? userProfile.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  // --- CAMERA LIFECYCLE MANAGEMENT ---
  useEffect(() => {
    let currentStream: MediaStream | null = null;

    const initializeCamera = async () => {
      if (isCameraOpen) {
        setCameraError('');

        try {
          await new Promise(resolve => setTimeout(resolve, 150)); // Fix black screen
          currentStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              width: { ideal: 480 }, 
              height: { ideal: 480 }, 
              facingMode: { ideal: "user" } 
            } 
          });

          if (currentStream) {
            streamRef.current = currentStream;
            if (videoRef.current) {
              videoRef.current.srcObject = currentStream;
              videoRef.current.onloadedmetadata = () => {
                 videoRef.current?.play().catch(e => console.error("Play error:", e));
              };
            }
          }
        } catch (err: any) {
          console.error("Camera Error:", err);
          setCameraError(`Não foi possível acessar a câmera: ${err.name}`);
        }
      }
    };

    if (isCameraOpen) {
      initializeCamera();
    }

    return () => {
      if (currentStream) currentStream.getTracks().forEach(track => track.stop());
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    };
  }, [isCameraOpen]);

  const startCamera = () => {
    setCapturedImage(null);
    setCameraError('');
    setIsCameraOpen(true);
  };

  const stopCamera = () => {
    setIsCameraOpen(false);
    setCapturedImage(null);
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedImage(dataUrl);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    if (videoRef.current) videoRef.current.play().catch(console.error);
  };

  const handleSavePhoto = async () => {
    if (!capturedImage || !currentUser) return;
    setSaving(true);
    try {
      const storageRef = ref(storage, `profiles/${currentUser.uid}_avatar.jpg`);
      await uploadString(storageRef, capturedImage, 'data_url');
      const downloadURL = await getDownloadURL(storageRef);

      // Atualiza o documento do usuário
      // O AuthContext (com onSnapshot) detectará essa mudança automaticamente
      await updateDoc(doc(db, CollectionName.USERS, currentUser.uid), {
        avatar: downloadURL,
        photoURL: downloadURL
      });
      
      // Feedback visual antes do redirecionamento
      setSaving(false);
      
      // Redirecionamento automático para a tela de ponto
      // Dá um pequeno delay para garantir que o contexto propagou a mudança
      setTimeout(() => {
        navigate('/app/ponto');
      }, 1000);

    } catch (error) {
      console.error("Save Error:", error);
      alert("Erro ao salvar foto.");
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (novaSenha.length < 8) {
      setPasswordError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setPasswordError('A nova senha e a confirmação não coincidem.');
      return;
    }
    if (!currentUser?.email) return;

    setSavingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, senhaAtual);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, novaSenha);
      // Remove o flag de senha temporária se estava ativo
      if (userProfile?.requiresPasswordChange) {
        await updateDoc(doc(db, CollectionName.USERS, currentUser.uid), {
          requiresPasswordChange: deleteField(),
          tempPasswordSetAt: deleteField(),
          tempPasswordSetBy: deleteField(),
        });
      }
      setPasswordSuccess(true);
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPasswordError('Senha atual incorreta.');
      } else if (err.code === 'auth/weak-password') {
        setPasswordError('Senha muito fraca. Use pelo menos 8 caracteres.');
      } else {
        setPasswordError('Erro ao alterar senha. Tente novamente.');
      }
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
          <p className="text-gray-500">Gerencie sua identidade visual.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="w-40 h-40 rounded-full border-4 border-brand-100 overflow-hidden shadow-inner bg-gray-50 flex items-center justify-center relative">
                {displayImage ? (
                  <img src={displayImage} alt="Perfil" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold text-brand-300">{initials}</span>
                )}
              </div>
              <button 
                onClick={startCamera}
                className="absolute bottom-0 right-0 p-3 bg-brand-600 text-white rounded-full shadow-lg hover:bg-brand-700 transition-all border-2 border-white cursor-pointer z-20"
                title="Tirar Foto"
              >
                <Camera size={20} />
              </button>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mt-4">{userProfile?.displayName}</h2>
            <p className="text-sm text-gray-500 capitalize">{userProfile?.role}</p>
          </div>
          
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
             <div className="flex items-start gap-3">
               <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
               <div className="text-sm text-orange-800">
                 <p className="font-bold mb-1">Atenção à Foto de Perfil</p>
                 <p className="text-xs">
                   Esta imagem será usada pelo sistema de IA (Gemini) para validar sua identidade ao bater ponto. Garanta que seu rosto esteja visível e bem iluminado.
                 </p>
               </div>
             </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
              <User size={18} /> Dados Cadastrais
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nome Completo</label>
                <div className="p-3 bg-gray-50 rounded-lg text-gray-900 font-medium text-sm border border-gray-200">{userProfile?.displayName}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">E-mail</label>
                <div className="p-3 bg-gray-50 rounded-lg text-gray-900 font-medium text-sm border border-gray-200 flex items-center justify-between">
                  {userProfile?.email}
                  <ShieldCheck size={16} className="text-green-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Aviso de senha temporária */}
          {userProfile?.requiresPasswordChange && (
            <div className="bg-orange-50 rounded-xl border border-orange-200 p-4 flex items-start gap-3">
              <KeyRound className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-orange-800 text-sm">Senha temporária ativa</p>
                <p className="text-xs text-orange-700 mt-1">
                  Um gestor definiu uma senha temporária para seu acesso. Por segurança, altere sua senha agora usando o formulário abaixo.
                </p>
              </div>
            </div>
          )}

          {/* Segurança — trocar senha */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
              <Lock size={18} /> Segurança
            </div>
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              {/* Senha atual */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Senha atual</label>
                <div className="relative">
                  <input
                    type={showSenhaAtual ? 'text' : 'password'}
                    value={senhaAtual}
                    onChange={e => setSenhaAtual(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full p-3 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button type="button" onClick={() => setShowSenhaAtual(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showSenhaAtual ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>

              {/* Nova senha */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nova senha</label>
                <div className="relative">
                  <input
                    type={showNovaSenha ? 'text' : 'password'}
                    value={novaSenha}
                    onChange={e => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                    className="w-full p-3 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button type="button" onClick={() => setShowNovaSenha(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNovaSenha ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>

              {/* Confirmar nova senha */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Confirmar nova senha</label>
                <div className="relative">
                  <input
                    type={showConfirmar ? 'text' : 'password'}
                    value={confirmarSenha}
                    onChange={e => setConfirmarSenha(e.target.value)}
                    placeholder="Repita a nova senha"
                    required
                    className="w-full p-3 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button type="button" onClick={() => setShowConfirmar(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirmar ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>

              {passwordError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={15}/> {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <Check size={15}/> Senha alterada com sucesso!
                </div>
              )}

              <button
                type="submit"
                disabled={savingPassword || !senhaAtual || !novaSenha || !confirmarSenha}
                className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {savingPassword ? <Loader2 size={18} className="animate-spin"/> : <Lock size={18}/>}
                {savingPassword ? 'Alterando...' : 'Alterar Senha'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ── Carreira MGR — badges, certificações e cursos externos ── */}
      {currentUser && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 font-bold text-gray-900 mb-4">
            <GraduationCap size={18} /> Minha Carreira MGR
          </div>
          <CareerBadges userId={currentUser.uid} />
        </div>
      )}

      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl">
              <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
                 <h3 className="font-bold text-gray-900 flex items-center gap-2"><Camera size={20}/> Atualizar Foto</h3>
                 <button onClick={stopCamera} className="p-1 hover:bg-gray-200 rounded-full"><X size={20}/></button>
              </div>
              <div className="relative bg-black h-80 flex items-center justify-center overflow-hidden">
                 {cameraError ? (
                   <div className="text-white text-center p-6"><p>{cameraError}</p></div>
                 ) : (
                   <>
                      <video ref={videoRef} autoPlay playsInline muted className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] ${capturedImage ? 'hidden' : 'block'}`} />
                      <canvas ref={canvasRef} className="hidden" />
                      {capturedImage && <img src={capturedImage} alt="Preview" className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]" />}
                   </>
                 )}
              </div>
              <div className="p-6 bg-white border-t flex flex-col gap-3">
                 {!capturedImage ? (
                    <button onClick={handleCapture} disabled={!!cameraError} className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700">Capturar Foto</button>
                 ) : (
                    <div className="flex gap-3">
                       <button onClick={handleRetake} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold">Tentar Novamente</button>
                       <button onClick={handleSavePhoto} disabled={saving} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                         {saving ? <Loader2 className="animate-spin" size={20}/> : <Check size={20} />} Salvar Foto
                       </button>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile;