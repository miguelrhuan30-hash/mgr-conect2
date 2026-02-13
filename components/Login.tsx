import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { CollectionName } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Lock, Mail, Hexagon, AlertCircle, TestTube2, ArrowLeft } from 'lucide-react';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { loginAsDemo, currentUser } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (currentUser) {
      navigate('/app');
    }
  }, [currentUser, navigate]);

  const getErrorMessage = (error: any) => {
    if (!error) return 'Erro desconhecido';
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'Este e-mail já está cadastrado. Tente fazer login.';
      case 'auth/weak-password':
        return 'A senha deve ter pelo menos 6 caracteres.';
      case 'auth/invalid-email':
        return 'Formato de e-mail inválido.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'E-mail ou senha incorretos.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas falhas. Tente novamente mais tarde.';
      default:
        return `Erro: ${error.message || 'Falha na autenticação'}`;
    }
  };

  const handleDemoLogin = () => {
    loginAsDemo();
    navigate('/app');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres.');
        return;
    }

    setLoading(true);

    try {
      let userCredential;
      let effectiveIsLogin = isLogin; 
      
      try {
        if (isLogin) {
          userCredential = await signInWithEmailAndPassword(auth, email, password);
        } else {
          userCredential = await createUserWithEmailAndPassword(auth, email, password);
        }
      } catch (initialError: any) {
        if (!isLogin && initialError.code === 'auth/email-already-in-use') {
           try {
             userCredential = await signInWithEmailAndPassword(auth, email, password);
             effectiveIsLogin = true; 
           } catch (loginError: any) {
             throw loginError; 
           }
        } else {
          throw initialError;
        }
      }

      if (userCredential && userCredential.user) {
        const user = userCredential.user;
        const isMaster = user.email?.toLowerCase() === 'mgrgestor@mgr.com';

        if (isMaster) {
            await setDoc(doc(db, CollectionName.USERS, user.uid), {
              uid: user.uid,
              email: user.email,
              displayName: 'Gestor Mestre',
              role: 'admin',
              xp: 9999,
              level: 99,
          }, { merge: true });
        } 
        else if (!effectiveIsLogin) {
          // NEW USERS START AS PENDING
          await setDoc(doc(db, CollectionName.USERS, user.uid), {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || email.split('@')[0],
              role: 'pending', 
              xp: 0,
              level: 1,
              createdAt: serverTimestamp()
          });
        }
        
        navigate('/app'); // Force redirect on success
      }

    } catch (err: any) {
      console.error("Authentication error:", err);
      setError(getErrorMessage(err));
      
      if (err.code === 'auth/email-already-in-use' || (!isLogin && err.code === 'auth/wrong-password')) {
         setIsLogin(true); 
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 relative">
      <button 
        onClick={() => navigate('/')} 
        className="absolute top-4 left-4 flex items-center text-gray-500 hover:text-brand-600 transition-colors"
      >
        <ArrowLeft className="w-5 h-5 mr-1" /> Voltar ao Site
      </button>

      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-lg">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-brand-600 rounded-xl flex items-center justify-center text-white mb-4">
            <Hexagon className="h-10 w-10" />
          </div>
          <h2 className="mt-2 text-3xl font-extrabold text-gray-900">
            MGR ERP
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sistema Integrado de Gestão
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div className="relative">
              <Mail className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
              <input
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
                placeholder="Endereço de e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <Lock className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
              <input
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
                placeholder="Senha (mínimo 6 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-70 transition-colors"
            >
              {loading ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                isLogin ? 'Entrar no Sistema' : 'Criar Conta'
              )}
            </button>

            <button
              type="button"
              onClick={handleDemoLogin}
              className="group relative w-full flex justify-center items-center py-3 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors"
            >
              <TestTube2 className="w-4 h-4 mr-2 text-gray-500" />
              Acesso Demonstração (Teste)
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              className="text-sm text-brand-600 hover:text-brand-500"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setEmail('');
                setPassword('');
              }}
            >
              {isLogin ? 'Primeiro acesso? Cadastre-se' : 'Já tem conta? Entre'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;