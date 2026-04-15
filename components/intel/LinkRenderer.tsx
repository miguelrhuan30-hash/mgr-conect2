/**
 * components/intel/LinkRenderer.tsx — Intel Workspace v2 (Sprint IW-01)
 * Renderiza texto raw com [[links]] resolvidos como badges coloridos.
 * Links não encontrados aparecem tracejados em cinza.
 */
import React from 'react';
import { ExternalLink, AlertCircle } from 'lucide-react';
import { IntelItem, IntelToolId } from '../../types';
import { useLinkParser } from '../../hooks/useLinkParser';

const TOOL_COLORS: Record<IntelToolId, {
  bg: string; text: string; border: string; badge: string; label: string;
}> = {
  eisenhower: { bg: 'bg-blue-50',   text: 'text-blue-800',   border: 'border-blue-200',   badge: '📋', label: 'Eisenhower' },
  ishikawa:   { bg: 'bg-red-50',    text: 'text-red-800',    border: 'border-red-200',    badge: '🐟', label: 'Ishikawa'   },
  canvas:     { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200', badge: '▦',  label: 'Canvas'     },
  bpmn:       { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200', badge: '⬡',  label: 'BPMN'       },
  roadmap:    { bg: 'bg-amber-50',  text: 'text-amber-800',  border: 'border-amber-200',  badge: '→',  label: 'Roadmap'    },
};

interface LinkRendererProps {
  raw: string;
  items: IntelItem[];
  onNavigate?: (toolId: IntelToolId) => void;
  className?: string;
}

const LinkRenderer: React.FC<LinkRendererProps> = ({ raw, items, onNavigate, className = '' }) => {
  const { parseText } = useLinkParser(items);
  const tokens = parseText(raw);

  if (!raw) return null;

  return (
    <span className={`leading-relaxed ${className}`}>
      {tokens.map((token, i) => {
        if (token.type === 'text') {
          return <span key={i} className="whitespace-pre-wrap">{token.content}</span>;
        }

        // Link resolvido — badge colorido clicável
        if (token.resolvedItem) {
          const cfg = TOOL_COLORS[token.resolvedItem.toolId];
          return (
            <button
              key={i}
              onClick={() => onNavigate?.(token.resolvedItem!.toolId)}
              title={`Ver em ${cfg.label}`}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-semibold mx-0.5 cursor-pointer transition-all hover:opacity-75 hover:scale-105 active:scale-95 ${cfg.bg} ${cfg.text} ${cfg.border}`}
            >
              <span className="text-[11px]">{cfg.badge}</span>
              <span>{token.content}</span>
              <ExternalLink size={9} className="opacity-60 flex-shrink-0" />
            </button>
          );
        }

        // Link não resolvido — tracejado cinza
        return (
          <span
            key={i}
            title="Item não encontrado — crie primeiro na ferramenta de origem"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-dashed border-gray-300 text-xs text-gray-400 mx-0.5 cursor-help"
          >
            <AlertCircle size={9} className="flex-shrink-0" />
            {token.content}
          </span>
        );
      })}
    </span>
  );
};

export default LinkRenderer;
