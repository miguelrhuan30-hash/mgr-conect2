import React, { useState, useEffect, useRef } from 'react';
import {
  collection, query, orderBy, limit, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  Activity, Search, Download,
  CheckCircle2, AlertTriangle, XCircle, Info,
  User, Clock, ChevronDown, ChevronUp, X, Loader2
} from 'lucide-react';

interface SystemLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: any;
  metadata?: Record<string, any>;
}

const LEVEL_CONFIG = {
  info:    { label: 'Info',    icon: Info,          color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
  success: { label: 'Sucesso', icon: CheckCircle2,  color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500'  },
  warning: { label: 'Alerta',  icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  error:   { label: 'Erro',    icon: XCircle,       color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500'    },
};

const ACTION_LABELS: Record<string, string> = {
  page_view:               'Navegação',
  login_attempt:           'Tentativa de Login',
  login_success:           'Login Efetuado',
  login_error:             'Erro de Login',
  ponto_register_success:  'Ponto Registrado',
  ponto_register_error:    'Erro no Ponto',
  ponto_location_blocked:  'Bloqueio GPS',
  ponto_lunch_time_blocked:'Almoço Bloqueado',
  ponto_lunch_gps_blocked: 'GPS Almoço',
  ponto_upload_photo:      'Foto Enviada',
};

const SystemLogs: React.FC = () => {
  const { userProfile } = useAuth();

  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<'all' | SystemLog['level']>('all');
  const [filterAction, setFilterAction] = useState('all');
  const [limitCount, setLimitCount] = useState(100);
  const [liveMode, setLiveMode] = useState(true);

  const unsubRef = useRef<(() => void) | null>(null);

  const isAuthorized =
    userProfile?.role === 'admin' ||
    userProfile?.role === 'developer' ||
    !!userProfile?.permissions?.canManageSettings;

  useEffect(() => {
    if (!isAuthorized) return;
    if (unsubRef.current) unsubRef.current();

    setLoading(true);

    const q = query(
      collection(db, CollectionName.SYSTEM_LOGS),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as SystemLog[];
      setLogs(data);
      setLoading(false);
    }, (err: any) => {
      if (err?.code !== 'permission-denied') console.error('SystemLogs error:', err);
      setLoading(false);
    });

    unsubRef.current = unsub;
    return () => unsub();
  }, [isAuthorized, limitCount]);

  const filteredLogs = logs.filter(log => {
    const matchSearch =
      !searchTerm ||
      log.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchLevel = filterLevel === 'all' || log.level === filterLevel;
    const matchAction = filterAction === 'all' || log.action === filterAction;
    return matchSearch && matchLevel && matchAction;
  });

  const uniqueActions = Array.from(new Set(logs.map(l => l.action))).sort();

  const exportCSV = () => {
    const header = ['Data/Hora', 'Usuário', 'Ação', 'Nível', 'Mensagem'];
    const rows = filteredLogs.map(log => [
      log.timestamp?.toDate?.()?.toLocaleString() ?? '',
      log.userName ?? '',
      log.action ?? '',
      log.level ?? '',
      `"${(log.message ?? '').replace(/"/g, "'")}"`,
    ]);
    const csv = [header, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_sistema_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = {
    total:   filteredLogs.length,
    error:   filteredLogs.filter(l => l.level === 'error').length,
    warning: filteredLogs.filter(l => l.level === 'warning').length,
    success: filteredLogs.filter(l => l.level === 'success').length,
  };

  if (!isAuthorized) {
    return (
      <div className="text-center py-12">
        <XCircle className="mx-auto w-12 h-12 text-red-400 mb-3" />
        <h2 className="text-2xl font-bold text-gray-900">Acesso Restrito</h2>
        <p className="text-gray-500">Você não tem permissão para visualizar os logs do sistema.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="text-brand-600" size={26} />
            Log do Sistema
          </h1>
          <p className="text-gray-500">Auditoria de ações e eventos em tempo real.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLiveMode(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              liveMode ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${liveMode ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            {liveMode ? 'Ao Vivo' : 'Pausado'}
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          >
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total',   value: stats.total,   color: 'text-gray-700',   bg: 'bg-gray-50',   border: 'border-gray-200'   },
          { label: 'Erros',   value: stats.error,   color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200'    },
          { label: 'Alertas', value: stats.warning, color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
          { label: 'Sucesso', value: stats.success, color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200'  },
        ].map(s => (
          <div key={s.label} className={`${s.bg} ${s.border} border rounded-xl p-4`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por usuário, ação, mensagem..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-brand-500 focus:border-brand-500"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value as any)}
          className="border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white text-gray-900">
          <option value="all">Todos os Níveis</option>
          <option value="info">Info</option>
          <option value="success">Sucesso</option>
          <option value="warning">Alerta</option>
          <option value="error">Erro</option>
        </select>

        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
          className="border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white text-gray-900">
          <option value="all">Todas as Ações</option>
          {uniqueActions.map(a => (
            <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
          ))}
        </select>

        <select value={limitCount} onChange={e => setLimitCount(Number(e.target.value))}
          className="border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white text-gray-900">
          <option value={50}>50 registros</option>
          <option value={100}>100 registros</option>
          <option value={250}>250 registros</option>
          <option value={500}>500 registros</option>
        </select>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-16">
            <Loader2 className="animate-spin text-brand-600 w-8 h-8" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Activity className="mx-auto w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Nenhum registro encontrado.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredLogs.map(log => {
              const cfg = LEVEL_CONFIG[log.level] ?? LEVEL_CONFIG.info;
              const LevelIcon = cfg.icon;
              const isOpen = expanded === log.id;
              const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

              return (
                <div key={log.id} className="hover:bg-gray-50/70 transition-colors">
                  <div
                    className={`px-4 py-3 flex items-start gap-3 ${hasMetadata ? 'cursor-pointer' : ''}`}
                    onClick={() => hasMetadata && setExpanded(isOpen ? null : log.id)}
                  >
                    {/* Icon */}
                    <div className={`mt-0.5 flex-shrink-0 p-1.5 rounded-lg ${cfg.bg}`}>
                      <LevelIcon size={14} className={cfg.color} />
                    </div>

                    {/* Message */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 leading-snug">{log.message}</p>
                    </div>

                    {/* Meta right */}
                    <div className="flex-shrink-0 text-right flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <User size={12} />
                        <span className="max-w-[120px] truncate">{log.userName || log.userId || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 font-mono">
                        <Clock size={12} />
                        {log.timestamp?.toDate?.()?.toLocaleString('pt-BR', {
                          day: '2-digit', month: '2-digit',
                          hour: '2-digit', minute: '2-digit', second: '2-digit'
                        }) ?? '—'}
                      </div>
                      {hasMetadata && (
                        <span className="text-[10px] text-brand-500 flex items-center gap-0.5">
                          {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          detalhes
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metadata expandido */}
                  {isOpen && hasMetadata && (
                    <div className="px-4 pb-3 ml-10">
                      <pre className="text-[11px] bg-gray-900 text-green-400 rounded-lg p-3 overflow-x-auto font-mono leading-relaxed">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {!loading && filteredLogs.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Exibindo <strong>{filteredLogs.length}</strong> de <strong>{logs.length}</strong> registros
            </span>
            {logs.length >= limitCount && (
              <button onClick={() => setLimitCount(v => v + 100)} className="text-xs text-brand-600 hover:underline font-medium">
                Carregar mais 100
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default SystemLogs;
