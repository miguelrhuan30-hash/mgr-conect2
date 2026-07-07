/**
 * FieldConfiguracoes — Tela de permissões e configurações do app MGR Campo.
 * Verifica e solicita todas as permissões necessárias (atuais e futuras)
 * antes que o colaborador precise usar a funcionalidade.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Camera }              from '@capacitor/camera';
import { Geolocation }         from '@capacitor/geolocation';
import { LocalNotifications }  from '@capacitor/local-notifications';
import { PushNotifications }   from '@capacitor/push-notifications';
import {
  ChevronLeft, Camera as CameraIcon, Image, Mic, MapPin, MapPinOff,
  Bell, BellRing, Phone, PhoneCall, Settings, CheckCircle2,
  XCircle, AlertCircle, Loader2, RefreshCw, Shield, Lock,
} from 'lucide-react';

/* ─── Tipos ──────────────────────────────────────────────────────────────── */
type PermStatus = 'granted' | 'denied' | 'prompt' | 'unavailable' | 'checking';

interface Permissao {
  id:          string;
  label:       string;
  descricao:   string;
  icon:        React.ReactNode;
  obrigatoria: boolean;
  status:      PermStatus;
  manual?:     boolean; // só pode ser liberada nas config do dispositivo
  check:       () => Promise<PermStatus>;
  solicitar:   () => Promise<PermStatus>;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const isNative = Capacitor.isNativePlatform();

const webPermQuery = async (name: PermissionName): Promise<PermStatus> => {
  try {
    const r = await navigator.permissions.query({ name });
    return r.state === 'granted' ? 'granted'
          : r.state === 'denied' ? 'denied'
          : 'prompt';
  } catch { return 'unavailable'; }
};

const capStatus = (s: string): PermStatus =>
  s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'prompt';

/* ─── Abre configurações do app no dispositivo ───────────────────────────── */
const abrirConfigDispositivo = () => {
  if (Capacitor.getPlatform() === 'android') {
    // Android — abre via intent através de window location
    window.open('app-settings:', '_system');
  } else if (Capacitor.getPlatform() === 'ios') {
    window.open('app-settings:', '_system');
  }
};

/* ─── Definição de cada permissão ───────────────────────────────────────── */
const buildPermissoes = (): Omit<Permissao, 'status'>[] => [
  /* ── Câmera ── */
  {
    id: 'camera',
    label: 'Câmera',
    descricao: 'Tirar fotos de evidências nas ordens de serviço e registrar início dos trabalhos.',
    icon: <CameraIcon size={20} />,
    obrigatoria: true,
    check: async () => {
      if (!isNative) return webPermQuery('camera' as PermissionName);
      const r = await Camera.checkPermissions();
      return capStatus(r.camera);
    },
    solicitar: async () => {
      if (!isNative) {
        try {
          await navigator.mediaDevices.getUserMedia({ video: true });
          return 'granted';
        } catch { return 'denied'; }
      }
      const r = await Camera.requestPermissions({ permissions: ['camera'] });
      return capStatus(r.camera);
    },
  },

  /* ── Galeria ── */
  {
    id: 'galeria',
    label: 'Galeria de Fotos e Vídeos',
    descricao: 'Selecionar fotos e vídeos existentes na galeria para enviar como evidências.',
    icon: <Image size={20} />,
    obrigatoria: true,
    check: async () => {
      if (!isNative) return 'unavailable';
      const r = await Camera.checkPermissions();
      return capStatus(r.photos);
    },
    solicitar: async () => {
      if (!isNative) return 'unavailable';
      const r = await Camera.requestPermissions({ permissions: ['photos'] });
      return capStatus(r.photos);
    },
  },

  /* ── Microfone ── */
  {
    id: 'microfone',
    label: 'Microfone',
    descricao: 'Gravar vídeos de evidências com áudio diretamente pela câmera.',
    icon: <Mic size={20} />,
    obrigatoria: false,
    check: async () => {
      if (!isNative) return webPermQuery('microphone' as PermissionName);
      try {
        // Capacitor Camera plugin includes microphone for video
        const r = await Camera.checkPermissions();
        // Fallback para Web API se plugin não retornar
        if ('microphone' in r) return capStatus((r as any).microphone);
        return webPermQuery('microphone' as PermissionName);
      } catch { return webPermQuery('microphone' as PermissionName); }
    },
    solicitar: async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        return 'granted';
      } catch { return 'denied'; }
    },
  },

  /* ── Localização em uso ── */
  {
    id: 'localizacao',
    label: 'Localização (em uso)',
    descricao: 'Rastreio GPS para registro de ponto, rotas e localização das O.S. em campo.',
    icon: <MapPin size={20} />,
    obrigatoria: true,
    check: async () => {
      if (!isNative) return webPermQuery('geolocation' as PermissionName);
      const r = await Geolocation.checkPermissions();
      return capStatus(r.location);
    },
    solicitar: async () => {
      if (!isNative) {
        return new Promise<PermStatus>(resolve => {
          navigator.geolocation.getCurrentPosition(
            () => resolve('granted'),
            e => resolve(e.code === 1 ? 'denied' : 'prompt'),
          );
        });
      }
      const r = await Geolocation.requestPermissions({ permissions: ['location'] });
      return capStatus(r.location);
    },
  },

  /* ── Localização em 2° plano ── */
  {
    id: 'localizacao_fundo',
    label: 'Localização em 2° plano',
    descricao: 'Continuar rastreio GPS mesmo com o app minimizado ou tela desligada. Necessário selecionar "Permitir sempre" nas configurações.',
    icon: <MapPinOff size={20} />,
    obrigatoria: false,
    manual: true,
    check: async () => {
      if (!isNative) return 'unavailable';
      try {
        const r = await Geolocation.checkPermissions();
        // coarseLocation é o proxy mais próximo de background no Capacitor
        if ('coarseLocation' in r) return capStatus(r.coarseLocation);
        return 'prompt';
      } catch { return 'unavailable'; }
    },
    solicitar: async () => {
      // Background location no Android 10+ exige "Permitir sempre" manual
      abrirConfigDispositivo();
      return 'prompt';
    },
  },

  /* ── Notificações locais ── */
  {
    id: 'notificacoes',
    label: 'Notificações',
    descricao: 'Receber alertas de novas O.S., prazos e atualizações de tarefas mesmo fora do app.',
    icon: <Bell size={20} />,
    obrigatoria: false,
    check: async () => {
      if (!isNative) {
        if (!('Notification' in window)) return 'unavailable';
        const s = Notification.permission;
        return s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'prompt';
      }
      try {
        const r = await LocalNotifications.checkPermissions();
        return capStatus(r.display);
      } catch { return 'unavailable'; }
    },
    solicitar: async () => {
      if (!isNative) {
        if (!('Notification' in window)) return 'unavailable';
        const r = await Notification.requestPermission();
        return r === 'granted' ? 'granted' : r === 'denied' ? 'denied' : 'prompt';
      }
      try {
        const r = await LocalNotifications.requestPermissions();
        return capStatus(r.display);
      } catch { return 'unavailable'; }
    },
  },

  /* ── Push Notifications ── */
  {
    id: 'push',
    label: 'Notificações Push (Servidor)',
    descricao: 'Receber mensagens do servidor MGR em tempo real — novas atribuições, aprovações e alertas urgentes.',
    icon: <BellRing size={20} />,
    obrigatoria: false,
    check: async () => {
      if (!isNative) return 'unavailable';
      try {
        const r = await PushNotifications.checkPermissions();
        return capStatus(r.receive);
      } catch { return 'unavailable'; }
    },
    solicitar: async () => {
      if (!isNative) return 'unavailable';
      try {
        const r = await PushNotifications.requestPermissions();
        if (r.receive === 'granted') {
          await PushNotifications.register();
        }
        return capStatus(r.receive);
      } catch { return 'unavailable'; }
    },
  },

  /* ── Sons e toque ── */
  {
    id: 'sons',
    label: 'Sons e Toque',
    descricao: 'Tocar sons para notificações, alertas de O.S. urgentes e chamadas recebidas no app.',
    icon: <Phone size={20} />,
    obrigatoria: false,
    manual: true,
    check: async () => 'prompt',
    solicitar: async () => {
      abrirConfigDispositivo();
      return 'prompt';
    },
  },

  /* ── Realizar chamadas ── */
  {
    id: 'chamadas',
    label: 'Realizar Chamadas',
    descricao: 'Abrir o discador para ligar diretamente para clientes e responsáveis das O.S. sem sair do app.',
    icon: <PhoneCall size={20} />,
    obrigatoria: false,
    manual: true,
    check: async () => 'prompt',
    solicitar: async () => {
      abrirConfigDispositivo();
      return 'prompt';
    },
  },
];

/* ─── Badge de status ─────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: PermStatus }) {
  if (status === 'checking') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-700 text-gray-400 text-[10px] font-bold">
        <Loader2 size={10} className="animate-spin" /> Verificando
      </span>
    );
  }
  if (status === 'granted') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
        <CheckCircle2 size={10} /> Concedida
      </span>
    );
  }
  if (status === 'denied') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold">
        <XCircle size={10} /> Negada
      </span>
    );
  }
  if (status === 'unavailable') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-500 border border-gray-700 text-[10px] font-bold">
        — Não disponível
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-[10px] font-bold">
      <AlertCircle size={10} /> Pendente
    </span>
  );
}

/* ─── Botão de ação ──────────────────────────────────────────────────────── */
function ActionBtn({
  status, manual, loading, onClick,
}: { status: PermStatus; manual?: boolean; loading: boolean; onClick: () => void }) {
  if (status === 'granted') {
    return (
      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
        <CheckCircle2 size={14} /> Permissão concedida
      </div>
    );
  }
  if (status === 'unavailable') {
    return (
      <span className="text-[11px] text-gray-600">Não aplicável neste dispositivo</span>
    );
  }
  if (status === 'denied' || manual) {
    return (
      <button
        onClick={onClick}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 text-xs font-bold rounded-xl active:bg-gray-600 disabled:opacity-50"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Settings size={12} />}
        Abrir configurações
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl active:bg-emerald-700 disabled:opacity-50"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
      Solicitar permissão
    </button>
  );
}

/* ─── Componente principal ───────────────────────────────────────────────── */
export default function FieldConfiguracoes() {
  const navigate = useNavigate();
  const [permissoes, setPermissoes] = useState<Permissao[]>(() =>
    buildPermissoes().map(p => ({ ...p, status: 'checking' as PermStatus }))
  );
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  /* ── Verificar todas ao montar ── */
  const checkAll = useCallback(async () => {
    const defs = buildPermissoes();
    const results = await Promise.allSettled(defs.map(p => p.check()));
    setPermissoes(defs.map((p, i) => ({
      ...p,
      status: results[i].status === 'fulfilled'
        ? (results[i] as PromiseFulfilledResult<PermStatus>).value
        : 'unavailable',
    })));
  }, []);

  useEffect(() => { checkAll(); }, [checkAll]);

  /* ── Solicitar permissão individual ── */
  const handleSolicitar = async (id: string) => {
    const perm = permissoes.find(p => p.id === id);
    if (!perm) return;
    setLoading(prev => ({ ...prev, [id]: true }));
    try {
      const novoStatus = await perm.solicitar();
      setPermissoes(prev =>
        prev.map(p => p.id === id ? { ...p, status: novoStatus } : p)
      );
    } catch {
      // Se falhar, re-check
      const status = await perm.check().catch(() => 'unavailable' as PermStatus);
      setPermissoes(prev =>
        prev.map(p => p.id === id ? { ...p, status } : p)
      );
    } finally {
      setLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  /* ── Contadores ── */
  const total     = permissoes.filter(p => p.status !== 'unavailable').length;
  const concedidas = permissoes.filter(p => p.status === 'granted').length;
  const pct       = total > 0 ? Math.round((concedidas / total) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg bg-gray-800 active:bg-gray-700"
        >
          <ChevronLeft size={18} className="text-gray-300" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white">Configurações do App</p>
          <p className="text-[10px] text-gray-500">Permissões e preferências</p>
        </div>
        <button
          onClick={checkAll}
          className="p-2 rounded-lg bg-gray-800 active:bg-gray-700"
        >
          <RefreshCw size={15} className="text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── Resumo ── */}
        <div className="mx-4 mt-5 mb-4 bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 flex items-center justify-center">
              <Shield size={18} className="text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-white">
                {concedidas} de {total} permissões concedidas
              </p>
              <p className="text-[10px] text-gray-500">
                {pct === 100 ? 'App totalmente configurado' : 'Libere as permissões pendentes'}
              </p>
            </div>
          </div>
          {/* Barra de progresso */}
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                pct === 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-orange-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Solicitar todas pendentes */}
          {pct < 100 && (
            <button
              onClick={async () => {
                for (const p of permissoes) {
                  if (p.status === 'prompt' && !p.manual) {
                    await handleSolicitar(p.id);
                  }
                }
              }}
              className="mt-3 w-full py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl active:bg-emerald-700 flex items-center justify-center gap-2"
            >
              <Lock size={13} /> Conceder todas as permissões pendentes
            </button>
          )}
        </div>

        {/* ── Seção: Obrigatórias ── */}
        <div className="px-4 mb-1">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">Obrigatórias</p>
        </div>
        {permissoes.filter(p => p.obrigatoria).map(p => (
          <PermCard
            key={p.id}
            perm={p}
            loading={!!loading[p.id]}
            onSolicitar={() => handleSolicitar(p.id)}
          />
        ))}

        {/* ── Seção: Opcionais ── */}
        <div className="px-4 mt-5 mb-1">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">Opcionais / Futuras</p>
        </div>
        {permissoes.filter(p => !p.obrigatoria).map(p => (
          <PermCard
            key={p.id}
            perm={p}
            loading={!!loading[p.id]}
            onSolicitar={() => handleSolicitar(p.id)}
          />
        ))}

        {/* ── Nota sobre permissões negadas ── */}
        <div className="mx-4 mt-5 mb-6 bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            <span className="font-bold text-gray-400">Permissão negada?</span> Se o sistema bloquear uma permissão, toque em "Abrir configurações", acesse <span className="text-white">Permissões</span> e libere manualmente. No Android: <span className="text-white">Configurações → Apps → MGR Campo → Permissões</span>.
          </p>
        </div>

      </div>
    </div>
  );
}

/* ─── Card de permissão ──────────────────────────────────────────────────── */
function PermCard({
  perm, loading, onSolicitar,
}: { perm: Permissao; loading: boolean; onSolicitar: () => void }) {
  const isGranted     = perm.status === 'granted';
  const isUnavailable = perm.status === 'unavailable';

  return (
    <div className={`mx-4 mb-2 rounded-2xl border p-4 transition-all ${
      isGranted
        ? 'bg-emerald-900/10 border-emerald-700/30'
        : isUnavailable
        ? 'bg-gray-900/40 border-gray-800/50 opacity-60'
        : 'bg-gray-900 border-gray-800'
    }`}>
      <div className="flex items-start gap-3">
        {/* Ícone */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isGranted     ? 'bg-emerald-500/20 text-emerald-400' :
          isUnavailable ? 'bg-gray-800 text-gray-600' :
          perm.status === 'denied' ? 'bg-red-500/20 text-red-400' :
          'bg-orange-500/15 text-orange-400'
        }`}>
          {perm.icon}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-bold text-white">{perm.label}</p>
            {perm.obrigatoria && (
              <span className="text-[9px] font-black px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded-full border border-orange-500/30 uppercase tracking-wide">
                obrigatória
              </span>
            )}
            {perm.manual && (
              <span className="text-[9px] font-black px-1.5 py-0.5 bg-gray-700 text-gray-500 rounded-full border border-gray-600 uppercase tracking-wide">
                manual
              </span>
            )}
          </div>

          <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
            {perm.descricao}
          </p>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <StatusBadge status={perm.status} />
            <ActionBtn
              status={perm.status}
              manual={perm.manual}
              loading={loading}
              onClick={onSolicitar}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
