import React, { Suspense, lazy, useEffect, useState } from 'react';
import clarity from '@microsoft/clarity';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { auth, db } from './firebase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoadingScreen from './components/LoadingScreen';
import { PermissionSet, CollectionName } from './types';
import { ShieldAlert, LogOut, Clock, Lock, AlertCircle } from 'lucide-react';

// ─────────────────────────────────────────────
// ERROR BOUNDARY — Rotas Públicas
// Captura qualquer erro de render nas páginas públicas e exibe
// mensagem amigável em vez de tela branca.
// ─────────────────────────────────────────────
class PublicErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#0a1628', color: '#94a3b8', gap: 16,
          fontFamily: 'system-ui, sans-serif',
        }}>
          <AlertCircle size={48} color="#ef4444" />
          <h1 style={{ color: 'white', fontSize: 22, fontWeight: 800, margin: 0 }}>
            Erro ao carregar a apresentação
          </h1>
          <p style={{ margin: 0, fontSize: 14 }}>
            Tente recarregar a página. Se o problema persistir, solicite um novo link.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────
// LAZY LOAD — Módulos existentes
// ─────────────────────────────────────────────
const Login            = lazy(() => import('./components/Login'));
const Dashboard        = lazy(() => import('./components/Dashboard'));
const Ponto            = lazy(() => import('./components/Ponto'));
const Tasks            = lazy(() => import('./components/Tasks'));
const Schedule         = lazy(() => import('./components/Schedule'));
const TaskTemplates    = lazy(() => import('./components/TaskTemplates'));
// Projects (antigo módulo os_projects) removido — unificado no ProjectHub/ProjectDetail
const Inventory        = lazy(() => import('./components/Inventory'));
const Users            = lazy(() => import('./components/Users'));
const UserProfile      = lazy(() => import('./components/UserProfile'));
const SectorManagement = lazy(() => import('./components/SectorManagement'));
const Clients          = lazy(() => import('./components/Clients'));
const WorkLocations    = lazy(() => import('./components/WorkLocations'));
const AttendanceReports= lazy(() => import('./components/AttendanceReports'));
const PendingApproval  = lazy(() => import('./components/PendingApproval'));
const LandingPage      = lazy(() => import('./components/LandingPage'));
const SystemLogs       = lazy(() => import('./components/SystemLogs'));
const TechnicianStats  = lazy(() => import('./components/TechnicianStats'));
const CampaignManagement=lazy(() => import('./components/CampaignManagement'));
const IntelWorkspace   = lazy(() => import('./components/IntelWorkspace'));
const IntelGuard       = lazy(() => import('./components/IntelGuard'));

// ─────────────────────────────────────────────
// LAZY LOAD — SPRINT 30-34: Novos módulos MGR Ops 2.0
// ─────────────────────────────────────────────
const Assets      = lazy(() => import('./components/Assets'));
const Pipeline    = lazy(() => import('./components/Pipeline'));
const OSExecution = lazy(() => import('./components/OSExecution'));
const Billing     = lazy(() => import('./components/Billing'));
const BIDashboard = lazy(() => import('./components/BIDashboard'));

// ─────────────────────────────────────────────
// LAZY LOAD — SPRINT VEÍCULOS
// ─────────────────────────────────────────────
const VehicleLog          = lazy(() => import('./components/VehicleLog'));
const VehicleDetail       = lazy(() => import('./components/VehicleDetail'));
const VehicleCheckConfig  = lazy(() => import('./components/VehicleCheckConfig'));

// ─────────────────────────────────────────────
// LAZY LOAD — SPRINT 38-45: Módulo O.S. Completo
// ─────────────────────────────────────────────
const TaskPhotoConfig = lazy(() => import('./components/TaskPhotoConfig'));
const OSPrintLayout   = lazy(() => import('./components/OSPrintLayout'));

// ─────────────────────────────────────────────
// LAZY LOAD — SPRINT 46: OS Module Restructuring
// ─────────────────────────────────────────────
const OSViewModal    = lazy(() => import('./components/OSViewModal'));
const OSEditModal    = lazy(() => import('./components/OSEditModal'));
const PhotoAnnotator = lazy(() => import('./components/PhotoAnnotator'));

// ─────────────────────────────────────────────
// LAZY LOAD — SPRINT 47: Orçamento
// ─────────────────────────────────────────────
const OrcamentoModule  = lazy(() => import('./components/Orcamento'));
const OrcamentoPublico = lazy(() => import('./components/OrcamentoPublico'));

// ─────────────────────────────────────────────
// LAZY LOAD — SPRINT 51: Propostas PDF
// ─────────────────────────────────────────────
const PropostasPDF = lazy(() => import('./components/PropostasPDF'));



// ─────────────────────────────────────────────
// LAZY LOAD — SPRINT 51B: Apresentações Interativas
// ─────────────────────────────────────────────
const Apresentacoes     = lazy(() => import('./components/Apresentacoes'));
const ApresentacaoPublica = lazy(() => import('./components/ApresentacaoPublica'));
const PropostaDocPublica  = lazy(() => import('./components/PropostaDocPublica'));

// ─────────────────────────────────────────────
// LAZY LOAD — SPRINT 49: Módulo Meu Almoço
// ─────────────────────────────────────────────
const LunchManagement = lazy(() => import('./components/LunchManagement'));
const MyLunch         = lazy(() => import('./components/MyLunch'));
const FolhaPonto      = lazy(() => import('./components/FolhaPonto'));
const EspelhoMensal   = lazy(() => import('./components/EspelhoMensal'));

// ─────────────────────────────────────────────
// LAZY LOAD — SPRINT 50: People Analytics
// ─────────────────────────────────────────────
const SurveyManagement = lazy(() => import('./components/SurveyManagement'));
const SurveyResponder  = lazy(() => import('./components/SurveyResponder'));
const SurveyDashboard  = lazy(() => import('./components/SurveyDashboard'));
// Sprint 52: pesquisa pública via link/QR code
const SurveyPublico    = lazy(() => import('./components/SurveyPublico'));

// ─────────────────────────────────────────────
// LAZY LOAD — Sprint Projetos v2: Ciclo de Vida Completo
// ─────────────────────────────────────────────
const ProjectHub       = lazy(() => import('./components/ProjectHub'));
const ProjectDetail    = lazy(() => import('./components/ProjectDetail'));
const LeadsDashboard   = lazy(() => import('./components/LeadsDashboard'));
const ProjectUpsell    = lazy(() => import('./components/ProjectUpsell'));
const GanttGerencial   = lazy(() => import('./components/GanttGerencial'));
const FlowAtendimento  = lazy(() => import('./components/FlowAtendimento'));
const Fornecedores     = lazy(() => import('./components/Fornecedores'));
const Candidatos       = lazy(() => import('./components/Candidatos'));
const CalendarioOS     = lazy(() => import('./components/CalendarioOS'));

// ─────────────────────────────────────────────
// LAZY LOAD — MGR Academy (LMS interno)
// ─────────────────────────────────────────────
const Academy        = lazy(() => import('./components/Academy'));
const AcademyManage  = lazy(() => import('./components/academy/AcademyManage'));
const ModuleViewer   = lazy(() => import('./components/academy/ModuleViewer'));
const AcademyPeople  = lazy(() => import('./components/academy/AcademyPeople'));

// ─────────────────────────────────────────────
// LAZY LOAD — Instalar App (página de download APK)
// ─────────────────────────────────────────────
const InstallarApp = lazy(() => import('./components/InstallarApp'));

// ─────────────────────────────────────────────
// LAZY LOAD — Feed de Gestão (atividades em tempo real)
// ─────────────────────────────────────────────
const FeedGestao = lazy(() => import('./components/FeedGestao'));

// ─────────────────────────────────────────────
// LAZY LOAD — Field App (APK de campo)
// ─────────────────────────────────────────────
const FieldLayout     = lazy(() => import('./components/FieldApp/FieldLayout'));
const FieldOS         = lazy(() => import('./components/FieldApp/FieldOS'));
const FieldCalendario = lazy(() => import('./components/FieldApp/FieldCalendario'));
const FieldGestaoOS   = lazy(() => import('./components/FieldApp/FieldGestaoOS'));
const FieldPonto      = lazy(() => import('./components/FieldApp/FieldPonto'));
const FieldPerfil     = lazy(() => import('./components/FieldApp/FieldPerfil'));
const FieldVeiculo    = lazy(() => import('./components/FieldApp/FieldVeiculo'));
const FieldAlmoco     = lazy(() => import('./components/FieldApp/FieldAlmoco'));

// ─────────────────────────────────────────────
// COMPONENTE: EnforceShiftLock
// ─────────────────────────────────────────────
const EnforceShiftLock = ({ isShiftLocked, children }: { isShiftLocked: boolean; children?: React.ReactNode }) => {
  const location = useLocation();

  if (isShiftLocked) {
    if (!location.pathname.includes('/app/ponto')) {
      return <Navigate to="/app/ponto" replace />;
    }
    return (
      <div className="flex flex-col h-full">
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="text-orange-600 w-5 h-5 animate-pulse" />
            <span className="text-orange-800 text-sm font-bold">
              Acesso ao sistema bloqueado. Registre sua entrada para liberar os menus.
            </span>
          </div>
        </div>
        {children}
      </div>
    );
  }
  return <>{children}</>;
};

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────
const CLARITY_ID = 'wrmn2l1ftm';

// Detecta se está rodando dentro do APK Capacitor (nativo)
const isNativeApp = (): boolean =>
  typeof (window as any).Capacitor !== 'undefined' &&
  (window as any).Capacitor.isNativePlatform?.() === true;

const AppContent: React.FC = () => {
  const { currentUser, userProfile, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    clarity.init(CLARITY_ID);
  }, []);

  const [isShiftOpen, setIsShiftOpen]     = useState(false);
  const [checkingShift, setCheckingShift] = useState(true);

  const isMaster = currentUser?.email?.toLowerCase() === import.meta.env.VITE_MASTER_EMAIL?.toLowerCase();

  // ── Correção automática de permissões do Master Admin ──
  useEffect(() => {
    if (isMaster && userProfile && currentUser) {
      const needsCorrection =
        userProfile.permissions?.requiresTimeClock === true ||
        userProfile.role !== 'admin';
      if (needsCorrection) {
        const correctPermissions = async () => {
          try {
            const userRef = doc(db, CollectionName.USERS, currentUser.uid);
            await updateDoc(userRef, {
              role: 'admin',
              'permissions.requiresTimeClock': false,
              'permissions.canManageUsers': true,
              'permissions.canManageSettings': true,
              'permissions.canRegisterAttendance': true,
            });
          } catch (error) {
            console.error('❌ MASTER ADMIN: Fix failed', error);
          }
        };
        correctPermissions();
      }
    }
  }, [isMaster, userProfile, currentUser]);

  // ── Monitor de turno (shift) ──
  useEffect(() => {
    if (!currentUser) {
      setCheckingShift(false);
      return;
    }
    const q = query(
      collection(db, CollectionName.TIME_ENTRIES),
      where('userId', '==', currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(1),
    );
    const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      if (!snapshot.empty) {
        const lastEntry = snapshot.docs[0].data();
        const isOpen = lastEntry.type === 'entry' || lastEntry.type === 'lunch_end';
        setIsShiftOpen(isOpen);
      } else {
        setIsShiftOpen(false);
      }
      setCheckingShift(false);
    }, (error) => {
      console.error('Error monitoring shift status:', error);
      setCheckingShift(false);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // ── Helper de permissão ──
  const hasPermission = (key: keyof PermissionSet): boolean => {
    if (!userProfile) return false;
    if (userProfile.role === 'admin' || userProfile.role === 'developer') return true;
    return !!userProfile.permissions?.[key];
  };

  const handleEmergencyLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  if (loading || (currentUser && checkingShift)) return <LoadingScreen />;

  const isAvatarMissing =
    currentUser &&
    userProfile &&
    userProfile.role !== 'pending' &&
    !userProfile.avatar &&
    !userProfile.photoURL;

  const requiresTimeClock = !isMaster && (userProfile?.permissions?.requiresTimeClock ?? false);
  const isShiftLocked = !!(
    !isMaster &&
    currentUser &&
    userProfile?.role !== 'pending' &&
    requiresTimeClock &&
    !isShiftOpen
  );

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>

        {/* ── ROTAS PÚBLICAS ── */}
        {/* No APK nativo: / vai direto para /campo (logado) ou /login (deslogado) */}
        <Route
          path="/"
          element={
            isNativeApp()
              ? currentUser
                ? <Navigate to="/campo" replace />
                : <Navigate to="/login" replace />
              : <LandingPage />
          }
        />
        <Route path="/login" element={<Login />} />

        <Route
          path="/aguardando-aprovacao"
          element={currentUser ? <PendingApproval /> : <Navigate to="/login" />}
        />

        {/* ── ROTA DE IMPRESSÃO (sem Layout — tela limpa para imprimir) ── */}
        <Route
          path="/app/os/:osId/print"
          element={currentUser ? <OSPrintLayout /> : <Navigate to="/login" />}
        />

        {/* ── ROTAS PROTEGIDAS ── */}
        <Route
          path="/app"
          element={
            currentUser ? (
              isMaster ? (
                <EnforceShiftLock isShiftLocked={isShiftLocked}>
                  <Layout />
                </EnforceShiftLock>
              ) : userProfile?.role === 'pending' ? (
                <Navigate to="/aguardando-aprovacao" />
              ) : isAvatarMissing ? (
                <div className="min-h-screen bg-gray-50 flex flex-col">
                  <div className="bg-red-600 px-4 py-3 text-white flex items-center justify-between shadow-md z-50 sticky top-0">
                    <div className="flex items-center gap-3 mx-auto">
                      <ShieldAlert className="w-6 h-6 animate-pulse flex-shrink-0" />
                      <span className="font-bold text-sm md:text-base text-center">
                        BLOQUEIO DE SEGURANÇA: Para utilizar o sistema e registrar ponto, você deve cadastrar uma foto de perfil válida.
                      </span>
                    </div>
                    <button
                      onClick={handleEmergencyLogout}
                      className="text-white/80 hover:text-white text-xs underline ml-4 flex items-center gap-1 flex-shrink-0"
                    >
                      <LogOut size={14} /> Sair
                    </button>
                  </div>
                  <div className="flex-1 p-6 flex justify-center overflow-y-auto">
                    <div className="w-full max-w-4xl pt-8">
                      <UserProfile />
                    </div>
                  </div>
                </div>
              ) : (
                <EnforceShiftLock isShiftLocked={isShiftLocked}>
                  <Layout />
                </EnforceShiftLock>
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        >
          {/* ════════════════════════════════════════
              ROTAS EXISTENTES
          ════════════════════════════════════════ */}
          <Route index element={<Dashboard />} />
          <Route path="perfil" element={<UserProfile />} />
          <Route path="instalar-app" element={<InstallarApp />} />

          <Route path="ponto"
            element={hasPermission('canRegisterAttendance') ? <Ponto /> : <Navigate to="/app" />} />
          {/* Rota /projetos removida — unificado no projetos-v2 */}
          <Route path="tarefas"
            element={hasPermission('canViewTasks') ? <Tasks /> : <Navigate to="/app" />} />
          <Route path="agenda"
            element={hasPermission('canViewSchedule') ? <Schedule /> : <Navigate to="/app" />} />
          <Route path="clientes"
            element={hasPermission('canManageClients') ? <Clients /> : <Navigate to="/app" />} />
          <Route path="estoque"
            element={hasPermission('canViewInventory') ? <Inventory /> : <Navigate to="/app" />} />
          <Route path="modelos"
            element={hasPermission('canManageSettings') ? <TaskTemplates /> : <Navigate to="/app" />} />
          <Route path="relatorios-ponto"
            element={hasPermission('canViewAttendanceReports') ? <AttendanceReports /> : <Navigate to="/app" />} />
          <Route path="folha-ponto"
            element={hasPermission('canViewAttendanceReports') ? <FolhaPonto /> : <Navigate to="/app" />} />
          <Route path="espelho-mensal"
            element={hasPermission('canViewAttendanceReports') ? <EspelhoMensal /> : <Navigate to="/app" />} />
          <Route path="campanhas"
            element={hasPermission('canManageSettings') ? <CampaignManagement /> : <Navigate to="/app" />} />
          <Route path="logs"
            element={hasPermission('canManageSettings') ? <SystemLogs /> : <Navigate to="/app" />} />
          <Route path="usuarios"
            element={hasPermission('canManageUsers') ? <Users /> : <Navigate to="/app" />} />
          <Route path="candidatos"
            element={hasPermission('canManageUsers') ? <Candidatos /> : <Navigate to="/app" />} />
          <Route path="ranking" element={<TechnicianStats />} />
          <Route path="setores"
            element={hasPermission('canManageSectors') ? <SectorManagement /> : <Navigate to="/app" />} />
          <Route path="locais"
            element={hasPermission('canManageUsers') ? <WorkLocations /> : <Navigate to="/app" />} />

          {/* ════════════════════════════════════════
              SPRINT 30 — Ativos de Clientes
          ════════════════════════════════════════ */}
          <Route path="ativos"
            element={hasPermission('canManageClients') ? <Assets /> : <Navigate to="/app" />} />

          {/* ════════════════════════════════════════
              SPRINT 31 — Pipeline de O.S.
          ════════════════════════════════════════ */}
          <Route path="pipeline"
            element={hasPermission('canManageProjects') ? <Pipeline /> : <Navigate to="/app" />} />

          {/* ════════════════════════════════════════
              SPRINT 32 — Execução de Campo
          ════════════════════════════════════════ */}
          <Route path="execucao/:taskId"
            element={hasPermission('canViewTasks') ? <OSExecution /> : <Navigate to="/app" />} />

          {/* ════════════════════════════════════════
              SPRINT 33 — Faturamento e Recebíveis
          ════════════════════════════════════════ */}
          <Route path="faturamento"
            element={hasPermission('canViewFinancials') ? <Billing /> : <Navigate to="/app" />} />

          {/* ════════════════════════════════════════
              SPRINT 34 — Dashboard BI / KPIs
          ════════════════════════════════════════ */}
          <Route path="bi"
            element={hasPermission('canManageSettings') ? <BIDashboard /> : <Navigate to="/app" />} />

          {/* ════════════════════════════════════════
              SPRINT VEÍCULOS — Controle de Frota
          ════════════════════════════════════════ */}
          <Route path="veiculos"
            element={(hasPermission('canRegisterAttendance') || hasPermission('canViewAttendanceReports')) ? <VehicleLog /> : <Navigate to="/app" />} />
          <Route path="veiculos/config"
            element={hasPermission('canManageSettings') ? <VehicleCheckConfig /> : <Navigate to="/app/veiculos" />} />
          <Route path="veiculos/:id"
            element={hasPermission('canViewAttendanceReports') ? <VehicleDetail /> : <Navigate to="/app" />} />

          {/* ════════════════════════════════════════
              SPRINT 38-45 — Módulo O.S. Completo
          ════════════════════════════════════════ */}
          <Route path="os-foto-config"
            element={hasPermission('canManageSettings') ? <TaskPhotoConfig /> : <Navigate to="/app" />} />
          {/* os/:osId/print movida para fora do Layout — rota independente sem sidebar */}

          {/* ════════════════════════════════════════
              SPRINT 47 — Orçamento
          ════════════════════════════════════════ */}
          <Route path="orcamentos"
            element={hasPermission('canViewFinancials') ? <OrcamentoModule /> : <Navigate to="/app" />} />

          {/* ════════════════════════════════════════
              SPRINT 51 — Propostas PDF
          ════════════════════════════════════════ */}
          <Route path="propostas-pdf"
            element={hasPermission('canViewFinancials') ? <PropostasPDF /> : <Navigate to="/app" />} />

          {/* ════════════════════════════════════════
              SPRINT 51B — Apresentações Interativas
          ════════════════════════════════════════ */}
          <Route path="apresentacoes"
            element={hasPermission('canViewFinancials') ? <Apresentacoes /> : <Navigate to="/app" />} />

          {/* ════════════════════════════════════════
              SPRINT 49 — Módulo Meu Almoço
          ════════════════════════════════════════ */}
          <Route path="gestao-almoco"
            element={hasPermission('canManageLunch') ? <LunchManagement /> : <Navigate to="/app" />} />
          <Route path="meu-almoco" element={<MyLunch />} />

          {/* ════════════════════════════════════════
              SPRINT 50 — People Analytics
          ════════════════════════════════════════ */}
          <Route path="pesquisas"
            element={hasPermission('canManageSurveys') ? <SurveyManagement /> : <Navigate to="/app" />} />
          <Route path="pesquisas/responder" element={<SurveyResponder />} />
          <Route path="pesquisas/dashboard"
            element={hasPermission('canManageSurveys') ? <SurveyDashboard /> : <Navigate to="/app" />} />

          {/* ════════════════════════════════════════
              Sprint Projetos v2 — Ciclo de Vida Completo
          ════════════════════════════════════════ */}
          {/* Flow de Atendimento — módulo unificado com 12 fases */}
          <Route path="flow-atendimento"
            element={hasPermission('canManageProjects') ? <FlowAtendimento /> : <Navigate to="/app" />} />
          {/* Rotas individuais mantidas (backward compatible) */}
          <Route path="projetos-v2"
            element={hasPermission('canManageProjects') ? <ProjectHub /> : <Navigate to="/app" />} />
          <Route path="projetos-v2/:projectId"
            element={hasPermission('canManageProjects') ? <ProjectDetail /> : <Navigate to="/app" />} />
          <Route path="leads"
            element={hasPermission('canManageProjects') ? <LeadsDashboard /> : <Navigate to="/app" />} />
          <Route path="nao-aprovados"
            element={hasPermission('canManageProjects') ? <ProjectUpsell /> : <Navigate to="/app" />} />
          <Route path="gantt-gerencial"
            element={hasPermission('canManageProjects') ? <GanttGerencial /> : <Navigate to="/app" />} />
          <Route path="fornecedores"
            element={hasPermission('canManageProjects') ? <Fornecedores /> : <Navigate to="/app" />} />
          <Route path="calendario"
            element={hasPermission('canManageProjects') ? <CalendarioOS /> : <Navigate to="/app" />} />

          {/* ════════════════════════════════════════
              SPRINT IW-01 — Intel Workspace v2
          ════════════════════════════════════════ */}
          <Route path="inteligencia"
            element={<IntelGuard><IntelWorkspace /></IntelGuard>} />

          {/* ════════════════════════════════════════
              MGR ACADEMY — LMS interno
          ════════════════════════════════════════ */}
          <Route path="academy" element={<Academy />} />
          <Route path="academy/modulo/:moduleId" element={<ModuleViewer />} />
          <Route path="academy/gerenciar"
            element={hasPermission('canManageAcademy') ? <AcademyManage /> : <Navigate to="/app/academy" />} />
          <Route path="academy/turma"
            element={hasPermission('canManageAcademy') ? <AcademyPeople /> : <Navigate to="/app/academy" />} />

          {/* ════════════════════════════════════════
              FEED DE GESTÃO — Atividades em tempo real
          ════════════════════════════════════════ */}
          <Route path="feed" element={<FeedGestao />} />

        </Route>{/* fim /app */}

        {/* ════════════════════════════════════════
            CAMPO — App de campo (APK Android)
            Rota isolada: sem Layout admin, mobile-first
        ════════════════════════════════════════ */}
        <Route
          path="/campo"
          element={
            currentUser ? <FieldLayout /> : <Navigate to="/login" />
          }
        >
          <Route index element={<Navigate to="os" replace />} />
          <Route path="os"        element={<FieldOS />} />
          <Route path="gestao"    element={<FieldGestaoOS />} />
          {/* rotas legadas — redirecionam para a view unificada */}
          <Route path="agenda"    element={<Navigate to="/campo/os" replace />} />
          <Route path="calendario" element={<Navigate to="/campo/os" replace />} />
          <Route path="ponto"     element={<FieldPonto />} />
          <Route path="almoco"    element={<FieldAlmoco />} />
          <Route path="veiculo"   element={<FieldVeiculo />} />
          <Route path="perfil"    element={<FieldPerfil />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
    </Suspense>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <Router>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/p/:slug" element={<PublicErrorBoundary><ApresentacaoPublica /></PublicErrorBoundary>} />
          <Route path="/proposta/:slug" element={<PublicErrorBoundary><PropostaDocPublica /></PublicErrorBoundary>} />
          <Route path="/orcamentos/:id" element={<PublicErrorBoundary><OrcamentoPublico /></PublicErrorBoundary>} />
          {/* Sprint 52 — pesquisa pública anônima via link/QR code */}
          <Route path="/pesquisa/:surveyId" element={<PublicErrorBoundary><SurveyPublico /></PublicErrorBoundary>} />
          <Route path="*" element={<AppContent />} />
        </Routes>
      </Suspense>
    </Router>
  </AuthProvider>
);

export default App;
