/**
 * components/AlertasCentral.tsx — Sprint 17
 *
 * Sino de notificações no header com dropdown de alertas gerenciais.
 * Agrupa alertas por severidade: Crítico / Atenção / Operacional.
 * Cada alerta tem link de navegação direta para o item.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, AlertTriangle, Clock, TrendingUp, ExternalLink,
  CheckCircle2, X, AlertCircle,
} from 'lucide-react';
import {
  useAlertas, Alerta, AlertaSeveridade,
} from '../hooks/useAlertas';

// ── Configuração visual por severidade ──────────────────────────────────────
const SEV_CONFIG: Record<AlertaSeveridade, {
  label: string;
  badgeColor: string;
  headerColor: string;
  icon: React.ReactNode;
}> = {
  critico: {
    label: '🔴 Crítico',
    badgeColor: 'bg-red-500',
    headerColor: 'bg-red-50 border-red-100 text-red-700',
    icon: <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />,
  },
  atencao: {
    label: '🟡 Atenção',
    badgeColor: 'bg-yellow-500',
    headerColor: 'bg-yellow-50 border-yellow-100 text-yellow-700',
    icon: <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />,
  },
  operacional: {
    label: '🟠 Operacional',
    badgeColor: 'bg-orange-400',
    headerColor: 'bg-orange-50 border-orange-100 text-orange-700',
    icon: <Clock className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />,
  },
};

// ── Item de alerta individual ────────────────────────────────────────────────
const AlertaItem: React.FC<{ alerta: Alerta; onNavigate: () => void }> = ({ alerta, onNavigate }) => {
  const navigate = useNavigate();
  const cfg = SEV_CONFIG[alerta.severidade];

  return (
    <button
      onClick={() => { navigate(alerta.link); onNavigate(); }}
      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3 border-b border-gray-100 last:border-0"
    >
      {cfg.icon}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-gray-900 truncate">{alerta.titulo}</p>
        <p className="text-[10px] text-gray-500 truncate mt-0.5">{alerta.descricao}</p>
      </div>
      <ExternalLink className="w-3 h-3 text-gray-300 flex-shrink-0 mt-0.5" />
    </button>
  );
};

// ── Componente principal ─────────────────────────────────────────────────────
const AlertasCentral: React.FC = () => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { alertas, total, criticos, loading } = useAlertas();

  // Fechar ao clicar fora
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Agrupar por severidade
  const grupos: Array<{ sev: AlertaSeveridade; items: Alerta[] }> = [
    { sev: 'critico'     as AlertaSeveridade, items: alertas.filter(a => a.severidade === 'critico') },
    { sev: 'atencao'     as AlertaSeveridade, items: alertas.filter(a => a.severidade === 'atencao') },
    { sev: 'operacional' as AlertaSeveridade, items: alertas.filter(a => a.severidade === 'operacional') },
  ].filter(g => g.items.length > 0);

  const badgeColor = criticos > 0 ? 'bg-red-500' : total > 0 ? 'bg-yellow-500' : 'bg-gray-400';
  const animate    = criticos > 0 ? 'animate-pulse' : '';

  return (
    <div className="relative" ref={panelRef}>
      {/* ── Botão Sino ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`relative p-2 rounded-xl hover:bg-gray-100 transition-colors ${open ? 'bg-gray-100' : ''}`}
        title={`${total} alerta${total !== 1 ? 's' : ''} operacional${total !== 1 ? 'is' : ''}`}
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {!loading && total > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 ${badgeColor} ${animate} text-white text-[9px] font-extrabold rounded-full flex items-center justify-center px-1`}>
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {/* ── Painel dropdown ── */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden z-[60]">
          {/* Header do painel */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <div>
              <p className="text-sm font-extrabold text-gray-900">Central de Alertas</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {loading ? 'Carregando...' : total === 0 ? 'Nenhum alerta no momento ✓' : `${total} alerta${total !== 1 ? 's' : ''} operacional${total !== 1 ? 'is' : ''}`}
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-gray-200 transition-colors">
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>

          {/* Conteúdo */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : total === 0 ? (
              <div className="flex flex-col items-center py-8 text-gray-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-300 mb-2" />
                <p className="text-sm font-medium text-gray-500">Tudo em ordem!</p>
                <p className="text-[10px] text-gray-400 mt-1">Sem alertas operacionais.</p>
              </div>
            ) : (
              grupos.map(g => (
                <div key={g.sev}>
                  {/* Header do grupo */}
                  <div className={`px-4 py-1.5 border-y text-[9px] font-extrabold uppercase tracking-widest ${SEV_CONFIG[g.sev].headerColor}`}>
                    {SEV_CONFIG[g.sev].label} · {g.items.length}
                  </div>
                  {g.items.map(a => (
                    <AlertaItem key={a.id} alerta={a} onNavigate={() => setOpen(false)} />
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {total > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
              <p className="text-[9px] text-gray-400 text-center">
                Clique em um alerta para navegar diretamente
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlertasCentral;
