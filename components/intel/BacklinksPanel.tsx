/**
 * components/intel/BacklinksPanel.tsx — Intel Workspace v2 (Sprint IW-01)
 * Painel que lista onde um IntelItem está sendo referenciado.
 */
import React, { useEffect, useState } from 'react';
import { Link2, Loader2, ArrowRight } from 'lucide-react';
import { IntelLink, IntelToolId } from '../../types';

const TOOL_LABELS: Record<IntelToolId, string> = {
  eisenhower: '📋 Eisenhower',
  ishikawa:   '🐟 Ishikawa',
  canvas:     '▦ Canvas',
  bpmn:       '⬡ BPMN',
  roadmap:    '→ Roadmap',
};

const SLOT_LABELS: Record<string, string> = {
  do: 'Urgente + Importante',
  plan: 'Não-Urgente + Importante',
  dele: 'Urgente + Não-Importante',
  elim: 'Eliminar',
  metodo: 'Método',
  mao_de_obra: 'Mão de Obra',
  maquina: 'Máquina',
  material: 'Material',
  meio: 'Meio Ambiente',
  medicao: 'Medição',
  parceiros: 'Parceiros-Chave',
  atividades: 'Atividades-Chave',
  recursos: 'Recursos-Chave',
  proposta: 'Proposta de Valor',
  relacionamento: 'Relacionamento c/ Clientes',
  canais: 'Canais',
  clientes: 'Segmento de Clientes',
  custos: 'Estrutura de Custos',
  receitas: 'Fontes de Receita',
  lane_comercial: 'Lane Comercial',
  lane_tecnico: 'Lane Técnico',
  lane_admin: 'Lane Administrativo',
  lane_financeiro: 'Lane Financeiro',
  q1: 'Q1',
  q2: 'Q2',
  q3: 'Q3',
  q4: 'Q4',
  backlog: 'Backlog',
};

interface BacklinksPanelProps {
  itemId: string;
  getBacklinks: (itemId: string) => Promise<IntelLink[]>;
  onNavigate: (toolId: IntelToolId) => void;
}

const BacklinksPanel: React.FC<BacklinksPanelProps> = ({ itemId, getBacklinks, onNavigate }) => {
  const [links, setLinks] = useState<IntelLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getBacklinks(itemId)
      .then(l => { setLinks(l); setLoading(false); })
      .catch(() => setLoading(false));
  }, [itemId, getBacklinks]);

  if (loading) return (
    <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
      <Loader2 size={12} className="animate-spin" />
      Carregando referências...
    </div>
  );

  return (
    <div className="space-y-2 pt-3 border-t border-gray-100">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
        <Link2 size={10} />
        {links.length === 0
          ? 'Nenhuma referência ainda'
          : `Referenciado em ${links.length} local${links.length !== 1 ? 'is' : ''}`}
      </p>

      {links.length === 0 && (
        <p className="text-xs text-gray-400 italic">
          Use <code className="bg-gray-100 px-1 rounded font-mono text-[10px]">[[{'{'}nome{'}'}]]</code> em outra ferramenta para criar um link aqui.
        </p>
      )}

      {links.map(link => (
        <button
          key={link.id}
          onClick={() => onNavigate(link.targetToolId)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-all text-left group"
        >
          <span className="text-xs font-semibold text-gray-700 group-hover:text-brand-700">
            {TOOL_LABELS[link.targetToolId]}
          </span>
          <span className="text-[10px] text-gray-400 truncate max-w-[120px]">
            {SLOT_LABELS[link.targetSlotKey] || link.targetSlotKey}
          </span>
          <ArrowRight size={12} className="text-gray-400 group-hover:text-brand-600 flex-shrink-0 transition-colors" />
        </button>
      ))}
    </div>
  );
};

export default BacklinksPanel;
