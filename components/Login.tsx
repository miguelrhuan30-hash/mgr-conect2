import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { CollectionName } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Lock, Mail, Hexagon, AlertCircle, ArrowLeft, HelpCircle, CheckCircle, ArrowLeft as Back } from 'lucide-react';
import { logEvent } from '../utils/logger';

type LoginView = 'login' | 'register' | 'forgot';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [view, setView] = useState<LoginView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Esqueci minha senha
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const isNative = typeof (window as any).Capacitor !== 'undefined' &&
    (window as any).Capacitor.isNativePlatform?.() === true;

  useEffect(() => {
    if (currentUser) {
      navigate(isNative ? '/campo' : '/app');
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
      case 'auth/user-disabled':
        return 'Este acesso foi desativado. Fale com a gestão de RH se acredita que isso é um engano.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas falhas. Tente novamente mais tarde.';
      default:
        return `Erro: ${error.message || 'Falha na autenticação'}`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    logEvent('anon', email, 'login_attempt', 'info', `Tentativa de login: ${email}`);

    try {
      let userCredential;
      let effectiveIsLogin = view === 'login';

      try {
        if (view === 'login') {
          userCredential = await signInWithEmailAndPassword(auth, email, password);
        } else {
          userCredential = await createUserWithEmailAndPassword(auth, email, password);
        }
      } catch (initialError: any) {
        if (view === 'register' && initialError.code === 'auth/email-already-in-use') {
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
        const isMaster = user.email?.toLowerCase() === import.meta.env.VITE_MASTER_EMAIL?.toLowerCase();

        if (isMaster) {
          await setDoc(doc(db, CollectionName.USERS, user.uid), {
            uid: user.uid,
            email: user.email,
            displayName: 'Gestor Mestre',
            role: 'admin',
            xp: 0,
            level: 1,
            workSchedule: { startTime: '00:00', endTime: '23:59', lunchDuration: 0 },
            allowedLocationIds: [],
            permissions: {
              canManageUsers: true,
              canManageSettings: true,
              canManageSectors: true,
              canViewTasks: true,
              canCreateTasks: true,
              canEditTasks: true,
              canDeleteTasks: true,
              canManageClients: true,
              canManageProjects: true,
              canViewInventory: true,
              canManageInventory: true,
              canRegisterAttendance: true,
              canViewAttendanceReports: true,
              canManageAttendance: true,
              requiresTimeClock: false,
              canViewFinancials: true,
              canResetUserPasswords: true,
            }
          }, { merge: true });
        } else if (!effectiveIsLogin) {
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

        logEvent(user.uid, user.email, 'login_success', 'success', `Login efetuado: ${user.email}`);
        navigate(isNative ? '/campo' : '/app');
      }

    } catch (err: any) {
      console.error("Authentication error:", err);
      setError(getErrorMessage(err));
      logEvent('anon', email, 'login_error', 'error', `Falha no login: ${email}`, {
        errorMessage: err?.message || err?.code || 'Erro desconhecido'
      });
      if (err.code === 'auth/email-already-in-use' || (view === 'register' && err.code === 'auth/wrong-password')) {
        setView('login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess(false);

    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      setForgotError('Informe um e-mail válido.');
      return;
    }

    setForgotLoading(true);
    try {
      // Busca o usuário no Firestore pelo email
      const q = query(
        collection(db, CollectionName.USERS),
        where('email', '==', forgotEmail.trim().toLowerCase())
      );
      const snap = await getDocs(q);

      const uid = snap.empty ? undefined : snap.docs[0].id;
      const displayName = snap.empty ? undefined : (snap.docs[0].data().displayName || snap.docs[0].data().nomeCompleto);

      // Cria pedido de redefinição no Firestore
      await addDoc(collection(db, CollectionName.PASSWORD_RESET_REQUESTS), {
        email: forgotEmail.trim().toLowerCase(),
        displayName: displayName || null,
        uid: uid || null,
        status: 'pending',
        requestedAt: serverTimestamp(),
      });

      setForgotSuccess(true);
    } catch (err) {
      console.error('Erro ao enviar pedido:', err);
      setForgotError('Erro ao enviar solicitação. Tente novamente.');
    } finally {
      setForgotLoading(false);
    }
  };

  const switchView = (v: LoginView) => {
    setView(v);
    setError('');
    setForgotError('');
    setForgotSuccess(false);
    setForgotEmail('');
    setEmail('');
    setPassword('');
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
          <h2 className="mt-2 text-3xl font-extrabold text-gray-900">MGR ERP</h2>
          <p className="mt-2 text-sm text-gray-600">Sistema Integrado de Gestão</p>
        </div>

        {/* ── Vista: Esqueci minha senha ── */}
        {view === 'forgot' && (
          <div className="space-y-5">
            <button
              onClick={() => switchView('login')}
              className="flex items-center text-sm text-gray-500 hover:text-brand-600 transition-colors"
            >
              <Back className="w-4 h-4 mr-1" /> Voltar ao login
            </button>

            {forgotSuccess ? (
              <div className="text-center py-6 space-y-4">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Solicitação enviada!</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Um gestor foi notificado e entrará em contato com você em breve para fornecer um acesso temporário.
                  </p>
                </div>
                <button
                  onClick={() => switchView('login')}
                  className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors"
                >
                  Voltar ao login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Esqueceu sua senha?</h3>
                  <p className="text-sm text-gray-500">
                    Informe seu e-mail e um gestor receberá uma notificação para liberar um acesso temporário para você.
                  </p>
                </div>

                <div className="relative">
                  <Mail className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    required
                    className="appearance-none block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-xl focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm bg-white"
                    placeholder="Seu e-mail cadastrado"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                </div>

                {forgotError && (
                  <div className="rounded-md bg-red-50 p-4 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-800">{forgotError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-brand-600 hover:bg-brand-700 focus:outline-none disabled:opacity-70 transition-colors"
                >
                  {forgotLoading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Solicitar acesso temporário'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── Vista: Login / Cadastro ── */}
        {view !== 'forgot' && (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div className="relative">
                <Mail className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm bg-white"
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
                  className="appearance-none rounded-none relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm bg-white"
                  placeholder="Senha (mínimo 6 caracteres)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" aria-hidden="true" />
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
                  view === 'login' ? 'Entrar no Sistema' : 'Criar Conta'
                )}
              </button>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                className="text-sm text-brand-600 hover:text-brand-500"
                onClick={() => switchView(view === 'login' ? 'register' : 'login')}
              >
                {view === 'login' ? 'Primeiro acesso? Cadastre-se' : 'Já tem conta? Entre'}
              </button>

              {view === 'login' && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={() => switchView('forgot')}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  Esqueci minha senha
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
