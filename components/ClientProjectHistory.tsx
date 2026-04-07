/**
 * components/ClientProjectHistory.tsx — Sprint 14
 *
 * Exibe o histórico completo de projetos de um cliente
 * na ficha de cliente (Clients.tsx).
 *
 * - KPIs: total, ativos, concluídos, valor faturado
 * - Cards de projeto com fase, valor e link para detalhe
 * - Botão "Usar como Template" para projetos concluídos
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, ExternalLink, Copy, TrendingUp,
  CheckCircle2, Clock, DollarSign, RefreshCw,
} from 'lucide-react';
import { useProject } from '../hooks/useProject';
import {
  ProjectPhase, PROJECT_PHASE_LABELS, PROJECT_PHASE_COLORS, PROJECT_TRANSITIONS,
} from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  clientId: string;
  clientName: string;
  onUseTemplate?: (projectId: string) => void;
}

const fmtCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return format(d, 'MMM yyyy', { locale: ptBR });
  } catch { return '—'; }
};

const ClientProjectHistory: React.FC<Props> = ({ clientId, clientName, onUseTemplate }) => {
  const navigate = useNavigate();
  const { projects, loading } = useProject();

  const [showAll, setShowAll] = useState(false);

  // Filtrar projetos do cliente
  const clientProjects = useMemo(
    () => projects
      .filter(p => p.clientId === clientId || p.clientName === clientName)
      .sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const db2 = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return db2 - da;
      }),
    [projects, clientId, clientName],
  );

  // KPIs
  const ativos      = clientProjects.filter(p => !['concluido', 'nao_aprovado'].includes(p.fase)).length;
  const concluidos  = clientProjects.filter(p => p.fase === 'concluido').length;
  const valorTotal  = clientProjects
    .filter(p => p.fase === 'concluido')
    .reduce((s, p) => s + (p.valorContrato || 0), 0);
  const emAndamento = clientProjects.filter(p =>
    ['contrato_assinado', 'em_planejamento', 'cronograma_aprovado', 'os_distribuidas', 'em_execucao'].includes(p.fase)
  ).length;

  const visible = showAll ? clientProjects : clientProjects.slice(0, 4);

  if (loading) return (
    <div className="flex justify-center py-6">
      <RefreshCw className="w-5 h-5 animate-spin text-brand-600" />
    </div>
  );

  if (clientProjects.length === 0) return (
    <div className="text-center py-8 text-gray-400">
      <Briefcase className="w-8 h-8 mx-auto mb-2 text-gray-200" />
      <p className="text-sm font-medium">Nenhum projeto neste cliente.</p>
      <button
        onClick={() => navigate('/app/projetos-v2/novo')}
        className="mt-2 text-xs text-brand-600 font-bold hover:underline"
      >
        Criar primeiro projeto →
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Total',       value: clientProjects.length, color: 'bg-brand-50 text-brand-700',   icon: <Briefcase className="w-3.5 h-3.5" /> },
          { label: 'Em Execução', value: emAndamento,           color: 'bg-amber-50 text-amber-700',   icon: <Clock className="w-3.5 h-3.5" /> },
          { label: 'Concluídos',  value: concluidos,            color: 'bg-emerald-50 text-emerald-700', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
          { label: 'Faturado',    value: valorTotal > 0 ? fmtCurrency(valorTotal) : '—', color: 'bg-purple-50 text-purple-700', icon: <DollarSign className="w-3.5 h-3.5" /> },
        ].map(k => (
          <div key={k.label} className={`rounded-xl p-2.5 ${k.color} flex flex-col gap-1`}>
            <div className="flex items-center gap-1 opacity-70">{k.icon}<span className="text-[9px] font-bold uppercase tracking-wide">{k.label}</span></div>
            <p className="text-sm font-extrabold truncate">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Lista de projetos */}
      <div className="space-y-2">
        {visible.map(p => (
          <div key={p.id}
            className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
            <div className="p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="text-xs font-bold text-gray-900 truncate">{p.nome}</p>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${PROJECT_PHASE_COLORS[p.fase]}`}>
                    {PROJECT_PHASE_LABELS[p.fase]}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400">
                  <span>{fmtDate(p.createdAt)}</span>
                  {p.valorContrato && p.valorContrato > 0 && (
                    <>
                      <span>·</span>
                      <span className="font-bold text-gray-600">{fmtCurrency(p.valorContrato)}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Template: só em concluídos */}
                {p.fase === 'concluido' && onUseTemplate && (
                  <button
                    onClick={() => onUseTemplate(p.id)}
                    title="Usar como template"
                    className="p-1.5 rounded-lg text-purple-400 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => navigate(`/app/projetos-v2/${p.id}`)}
                  title="Abrir projeto"
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Ver mais */}
      {clientProjects.length > 4 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="w-full text-xs font-bold text-brand-600 hover:underline py-1"
        >
          {showAll ? 'Ver menos' : `Ver todos os ${clientProjects.length} projetos →`}
        </button>
      )}
    </div>
  );
};

export default ClientProjectHistory;
