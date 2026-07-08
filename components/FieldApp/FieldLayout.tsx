import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ClipboardList, MapPin, User, Radio, UtensilsCrossed, Car, Shield, Download, X, AlertTriangle, Clock, CheckCircle2, XCircle, Activity, Headphones } from 'lucide-react';
import { db } from '../../firebase';
import { CollectionName } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { startFieldServices, stopFieldServices } from '../../services/FieldAppBootstrap';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useProfileAlerta } from '../../src/hooks/useProfileAlerta';
import { registrarPushToken } from '../../services/notificationService';
import FieldNotificacoes from './FieldNotificacoes';

interface ApkVersionInfo {
  build: number;
  version: string;
  url: string;
  notas: string;
  lancadoEm: string;
}

export default function FieldLayout() {
  const { currentUser, userProfile } = useAuth();
  const navigate  = useNavigate();
  const started   = useRef(false);
  const isAdmin   = ['admin', 'gestor', 'manager'].includes(userProfile?.role || '')
                  || !!(userProfile?.permissions?.canManageProjects)
                  || !!(userProfile?.permissions?.canEditTasks && userProfile?.permissions?.canDeleteTasks);
  const canSeeFeed = isAdmin || !!(userProfile?.permissions?.canViewFeed);

  const [suporteAberto, setSuporteAberto] = useState(0);

  // Contagem de dúvidas de suporte aguardando resposta — badge no ícone
  useEffect(() => {
    if (!isAdmin || !currentUser) return;
    const q = query(
      collection(db, CollectionName.OS_SUPORTE_THREADS),
      where('naoLidasGestor', '>', 0),
      where('archived', '==', false),
    );
    const unsub = onSnapshot(q, snap => setSuporteAberto(snap.size), () => {});
    return unsub;
  }, [isAdmin, currentUser]);

  const [updateInfo, setUpdateInfo]   = useState<ApkVersionInfo | null>(null);
  const [bannerDismissed, setBannerDismissed]   = useState(false);
  const [perfilBannerDismissed, setPerfilBannerDismissed] = useState(false);
  const profileAlerta = useProfileAlerta();

  /* ── Bootstrap de serviços de campo ────────────────────── */
  useEffect(() => {
    if (!currentUser || started.current) return;
    started.current = true;
    const displayName = (userProfile as any)?.nomeCompleto ?? userProfile?.displayName ?? 'Técnico';
    startFieldServices(currentUser.uid, displayName);
    registrarPushToken(currentUser.uid);
    return () => {
      started.current = false;
      stopFieldServices();
    };
  }, [currentUser]);

  /* ── Verificação de atualização do APK ─────────────────── */
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch('/apk-version.json?t=' + Date.now());
        if (!res.ok) return;
        const remote: ApkVersionInfo = await res.json();

        // Só verifica no Android nativo (não no browser)
        if (!Capacitor.isNativePlatform()) return;

        const info = await App.getInfo();
        const installedBuild = parseInt(info.build, 10);

        if (remote.build > installedBuild) {
          setUpdateInfo(remote);
        }
      } catch {
        // silencioso — update check não deve bloquear o app
      }
    };
    checkUpdate();
  }, []);

  const instalarAtualizacao = () => {
    if (!updateInfo) return;
    // Abre o download manager do Android para baixar e instalar o APK
    window.open(updateInfo.url, '_system');
  };

  const NAV_BASE = [
    { to: '/campo/os',      icon: ClipboardList,   label: 'O.S.'    },
    ...(canSeeFeed ? [{ to: '/campo/feed', icon: Activity, label: 'Feed' }] : []),
    ...(isAdmin ? [{ to: '/campo/suporte', icon: Headphones, label: 'Suporte', badge: suporteAberto }] : []),
    { to: '/campo/ponto',   icon: MapPin,          label: 'Ponto'   },
    { to: '/campo/almoco',  icon: UtensilsCrossed, label: 'Almoço'  },
    { to: '/campo/veiculo', icon: Car,             label: 'Veículo' },
  ];

  const NAV = isAdmin
    ? [...NAV_BASE, { to: '/campo/gestao', icon: Shield, label: 'O.S. Geral' }]
    : NAV_BASE;

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 safe-area-top">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
            <span className="text-white font-black text-xs">M</span>
          </div>
          <span className="font-bold text-sm text-white">MGR Campo</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Radio size={10} className="text-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-400">Rastreio ativo</span>
          </div>
          <FieldNotificacoes />
          <button
            onClick={() => navigate('/campo/perfil')}
            className="relative w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center active:bg-emerald-600 border border-emerald-600/50"
          >
            <User size={15} className="text-white" />
            {/* Badge: alerta de perfil tem prioridade sobre APK update */}
            {profileAlerta.temAlerta ? (
              <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-gray-900 ${
                profileAlerta.tipo === 'rejeitado' ? 'bg-red-500' :
                profileAlerta.tipo === 'aprovado'  ? 'bg-emerald-400' :
                profileAlerta.tipo === 'incompleto'? 'bg-red-500' :
                'bg-yellow-400'
              }`} />
            ) : updateInfo && !bannerDismissed ? (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-orange-500 rounded-full border border-gray-900" />
            ) : null}
          </button>
        </div>
      </header>

      {/* Banner de atualização */}
      {updateInfo && !bannerDismissed && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-orange-500/15 border-b border-orange-500/30">
          <Download size={14} className="text-orange-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-orange-300">
              Nova versão {updateInfo.version} disponível
            </p>
            <p className="text-[10px] text-orange-400/80 truncate">{updateInfo.notas}</p>
          </div>
          <button
            onClick={instalarAtualizacao}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-xl text-[11px] font-bold active:bg-orange-600"
          >
            <Download size={11} /> Instalar
          </button>
          <button
            onClick={() => setBannerDismissed(true)}
            className="flex-shrink-0 p-1 text-orange-400/60 active:text-orange-400"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Banner de alerta de perfil */}
      {profileAlerta.temAlerta && !perfilBannerDismissed && (() => {
        const cfg = {
          rejeitado: {
            bg: 'bg-red-500/15 border-red-500/30',
            text: 'text-red-300', sub: 'text-red-400/80',
            btn: 'bg-red-500 active:bg-red-600',
            icon: <XCircle size={14} className="text-red-400 flex-shrink-0" />,
            titulo: 'Solicitação recusada',
            msg: 'O gestor recusou sua alteração de dados. Veja o motivo.',
            acao: 'Ver detalhes',
          },
          aprovado: {
            bg: 'bg-emerald-500/15 border-emerald-500/30',
            text: 'text-emerald-300', sub: 'text-emerald-400/80',
            btn: 'bg-emerald-600 active:bg-emerald-700',
            icon: <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />,
            titulo: 'Dados atualizados!',
            msg: 'Sua solicitação foi aprovada pelo gestor.',
            acao: 'Ver perfil',
          },
          pendente: {
            bg: 'bg-yellow-500/15 border-yellow-500/30',
            text: 'text-yellow-300', sub: 'text-yellow-400/80',
            btn: 'bg-yellow-500 active:bg-yellow-600',
            icon: <Clock size={14} className="text-yellow-400 flex-shrink-0" />,
            titulo: 'Aguardando aprovação',
            msg: 'Sua solicitação de alteração está em análise.',
            acao: 'Ver perfil',
          },
          incompleto: {
            bg: 'bg-red-500/15 border-red-500/30',
            text: 'text-red-300', sub: 'text-red-400/80',
            btn: 'bg-red-500 active:bg-red-600',
            icon: <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />,
            titulo: 'Perfil incompleto',
            msg: 'Complete seus dados para usar todos os recursos.',
            acao: 'Completar',
          },
        }[profileAlerta.tipo!];

        return (
          <div className={`flex items-center gap-3 px-4 py-2.5 border-b ${cfg.bg}`}>
            {cfg.icon}
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold ${cfg.text}`}>{cfg.titulo}</p>
              <p className={`text-[10px] truncate ${cfg.sub}`}>{cfg.msg}</p>
            </div>
            <button
              onClick={() => navigate('/campo/perfil')}
              className={`flex-shrink-0 px-3 py-1.5 text-white rounded-xl text-[11px] font-bold ${cfg.btn}`}
            >
              {cfg.acao}
            </button>
            {profileAlerta.tipo === 'pendente' && (
              <button
                onClick={() => setPerfilBannerDismissed(true)}
                className="flex-shrink-0 p-1 text-yellow-400/60 active:text-yellow-400"
              >
                <X size={14} />
              </button>
            )}
          </div>
        );
      })()}

      {/* Content */}
      <main className="flex-1 overflow-y-auto overscroll-contain">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="flex bg-gray-900 border-t border-gray-800 safe-area-bottom">
        {NAV.map(({ to, icon: Icon, label, badge }: any) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
                isActive ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
              }`
            }
          >
            <span className="relative">
              <Icon size={22} />
              {!!badge && badge > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </span>
            <span className="text-[10px] font-semibold tracking-wide">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
