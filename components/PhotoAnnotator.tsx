/**
 * components/PhotoAnnotator.tsx — Sprint 46
 *
 * Editor de fotos de evidência com anotações padronizadas.
 * Apenas 2 tipos de elementos: Círculo e Seta (sem desenho livre).
 * Cada elemento pode ser arrastado, expandido/reduzido.
 * Legenda automática gerada por elemento.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { FotoSlotConfig, FotoEvidencia, FotoAnotacao } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';
import {
  X, Circle, ArrowRight, Save, RotateCcw, ChevronDown, Camera, Loader2,
} from 'lucide-react';

// ── Color palette ─────────────────────────────────────────────────────────────
const CORES = [
  { label: 'Verde',    hex: '#22c55e' },
  { label: 'Vermelho', hex: '#ef4444' },
  { label: 'Azul',     hex: '#3b82f6' },
  { label: 'Amarelo',  hex: '#eab308' },
  { label: 'Branco',   hex: '#ffffff' },
];

// ── SVG overlay component ──────────────────────────────────────────────────────
const SVGOverlay: React.FC<{
  anotacoes: FotoAnotacao[];
  selected: string | null;
  tool: 'circulo' | 'seta' | null;
  cor: string;
  onAdd: (a: Partial<FotoAnotacao>) => void;
  onSelect: (id: string | null) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}> = ({ anotacoes, selected, tool, cor, onAdd, onSelect, onDragEnd }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<{ id: string; ox: number; oy: number } | null>(null);

  const pct = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width)  * 100,
      y: ((e.clientY - rect.top)  / rect.height) * 100,
    };
  };

  const handleSVGClick = (e: React.PointerEvent) => {
    if (!tool) return;
    const { x, y } = pct(e);
    if (tool === 'circulo') onAdd({ tipo: 'circulo', x, y, raio: 8, cor, descricao: '' });
    if (tool === 'seta')    onAdd({ tipo: 'seta',    x, y, dx: 15, dy: 0, cor, descricao: '' });
    e.stopPropagation();
  };

  const startDrag = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const { x, y } = pct(e);
    dragging.current = { id, ox: x, oy: y };
    (e.target as Element).setPointerCapture(e.pointerId);
    onSelect(id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !svgRef.current) return;
    const { x, y } = pct(e);
    onDragEnd(dragging.current.id, x, y);
  };

  const onPointerUp = () => { dragging.current = null; };

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full"
      style={{ cursor: tool ? 'crosshair' : 'default' }}
      onPointerDown={handleSVGClick}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {anotacoes.map(a => {
        const isSelected = a.id === selected;
        const strokeW = isSelected ? 3 : 2;
        if (a.tipo === 'circulo') {
          return (
            <g key={a.id}>
              <circle
                cx={`${a.x}%`} cy={`${a.y}%`} r={`${a.raio ?? 8}%`}
                fill="none"
                stroke={a.cor} strokeWidth={strokeW}
                strokeDasharray={isSelected ? '4 2' : undefined}
                style={{ cursor: 'move' }}
                onPointerDown={e => { e.stopPropagation(); startDrag(e, a.id); }}
              />
              {isSelected && (
                <circle cx={`${a.x}%`} cy={`${(a.y ?? 0) - (a.raio ?? 8)}%`}
                  r="1.5%" fill={a.cor} style={{ cursor: 'ns-resize' }} />
              )}
            </g>
          );
        }
        // seta
        const x2 = a.x + (a.dx ?? 15);
        const y2 = a.y + (a.dy ?? 0);
        return (
          <g key={a.id} style={{ cursor: 'move' }}
            onPointerDown={e => { e.stopPropagation(); startDrag(e, a.id); }}>
            <defs>
              <marker id={`arrow-${a.id}`} markerWidth="6" markerHeight="6"
                refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill={a.cor} />
              </marker>
            </defs>
            <line
              x1={`${a.x}%`} y1={`${a.y}%`}
              x2={`${x2}%`}  y2={`${y2}%`}
              stroke={a.cor} strokeWidth={strokeW}
              strokeDasharray={isSelected ? '4 2' : undefined}
              markerEnd={`url(#arrow-${a.id})`}
            />
          </g>
        );
      })}
    </svg>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
interface PhotoAnnotatorProps {
  osId: string;
  tarefaId: string;
  slot: FotoSlotConfig;
  existingFoto?: FotoEvidencia;
  onSaved: (foto: FotoEvidencia) => void;
  onClose: () => void;
}

const PhotoAnnotator: React.FC<PhotoAnnotatorProps> = ({
  osId, tarefaId, slot, existingFoto, onSaved, onClose,
}) => {
  const { currentUser } = useAuth();

  const [imgSrc, setImgSrc]           = useState<string>(existingFoto?.url || '');
  const [anotacoes, setAnotacoes]     = useState<FotoAnotacao[]>(existingFoto?.anotacoes || []);
  const [descGeral, setDescGeral]     = useState(existingFoto?.descricaoGeral || '');
  const [tool, setTool]               = useState<'circulo' | 'seta' | null>(null);
  const [corAtiva, setCorAtiva]       = useState(CORES[0].hex);
  const [selected, setSelected]       = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);
  const [uploading, setUploading]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Upload photo ──────────────────────────────────────────────────────────
  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Preview immediately
      const reader = new FileReader();
      reader.onload = ev => setImgSrc(ev.target?.result as string);
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  };

  // ── Annotation ops ────────────────────────────────────────────────────────
  const addAnotacao = useCallback((partial: Partial<FotoAnotacao>) => {
    const a: FotoAnotacao = {
      id: `a_${Date.now()}`,
      tipo: partial.tipo || 'circulo',
      x: partial.x ?? 50, y: partial.y ?? 50,
      raio: partial.raio, dx: partial.dx, dy: partial.dy,
      cor: partial.cor || corAtiva,
      descricao: '',
    };
    setAnotacoes(prev => [...prev, a]);
    setSelected(a.id);
    setTool(null);
  }, [corAtiva]);

  const updateAnotacao = (id: string, patch: Partial<FotoAnotacao>) =>
    setAnotacoes(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));

  const dragEnd = (id: string, x: number, y: number) =>
    setAnotacoes(prev => prev.map(a => a.id === id ? { ...a, x, y } : a));

  const removeSelected = () => {
    if (!selected) return;
    setAnotacoes(prev => prev.filter(a => a.id !== selected));
    setSelected(null);
  };

  const adjustSize = (delta: number) => {
    if (!selected) return;
    setAnotacoes(prev => prev.map(a =>
      a.id === selected
        ? a.tipo === 'circulo'
          ? { ...a, raio: Math.max(2, (a.raio ?? 8) + delta) }
          : { ...a, dx: (a.dx ?? 15) + delta }
        : a
    ));
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const salvar = async () => {
    if (!imgSrc || !currentUser) return;
    setSaving(true);
    try {
      let url = existingFoto?.url || '';

      // Only upload if we have a new local blob (data: URL)
      if (imgSrc.startsWith('data:')) {
        const blob = await fetch(imgSrc).then(r => r.blob());
        const path = `os_fotos/${osId}/${tarefaId}/${slot.id}_${Date.now()}.jpg`;
        const snap = await uploadBytes(storageRef(storage, path), blob);
        url = await getDownloadURL(snap.ref);
      }

      const foto: FotoEvidencia = {
        id: existingFoto?.id || `foto_${Date.now()}`,
        slotId: slot.id,
        slotTitulo: slot.titulo,
        url,
        descricaoGeral: descGeral,
        anotacoes,
        tiradaPor: currentUser.uid,
        tiradaEm: existingFoto?.tiradaEm || Timestamp.now(),
      };

      onSaved(foto);
    } finally {
      setSaving(false);
    }
  };

  const selectedAnnotation = anotacoes.find(a => a.id === selected);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-gray-900 w-full sm:max-w-xl sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden"
        style={{ maxHeight: '96vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
          <div>
            <p className="text-white font-bold text-sm">{slot.titulo}</p>
            {slot.instrucao && <p className="text-gray-400 text-xs">{slot.instrucao}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Image area */}
          <div className="relative bg-black" style={{ minHeight: 220 }}>
            {imgSrc ? (
              <>
                <img src={imgSrc} alt="evidência" className="w-full max-h-72 object-contain" />
                <SVGOverlay
                  anotacoes={anotacoes}
                  selected={selected}
                  tool={tool}
                  cor={corAtiva}
                  onAdd={addAnotacao}
                  onSelect={setSelected}
                  onDragEnd={dragEnd}
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
                <Camera size={40} />
                <p className="text-sm">Nenhuma foto tirada ainda</p>
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className="px-4 py-3 bg-gray-800 flex items-center gap-3 flex-wrap">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
              {imgSrc ? 'Trocar foto' : 'Tirar foto'}
            </button>

            {imgSrc && (
              <>
                <div className="w-px h-5 bg-gray-600" />
                {/* Tool selector */}
                <button
                  onClick={() => setTool(t => t === 'circulo' ? null : 'circulo')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors
                    ${tool === 'circulo' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                >
                  <Circle size={12} /> Círculo
                </button>
                <button
                  onClick={() => setTool(t => t === 'seta' ? null : 'seta')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors
                    ${tool === 'seta' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                >
                  <ArrowRight size={12} /> Seta
                </button>

                {/* Colors */}
                <div className="flex gap-1 items-center ml-1">
                  {CORES.map(c => (
                    <button
                      key={c.hex}
                      title={c.label}
                      onClick={() => setCorAtiva(c.hex)}
                      style={{ backgroundColor: c.hex }}
                      className={`w-5 h-5 rounded-full border-2 transition-all ${corAtiva === c.hex ? 'border-white scale-110' : 'border-transparent'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Selected element controls */}
          {selectedAnnotation && (
            <div className="px-4 py-3 bg-gray-750 border-t border-gray-700 space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-gray-400 text-xs font-semibold flex-1">
                  {selectedAnnotation.tipo === 'circulo' ? '⭕' : '➡️'} Elemento selecionado
                </p>
                <button onClick={() => adjustSize(-2)} className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">−</button>
                <button onClick={() => adjustSize(+2)} className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">+</button>
                <button onClick={removeSelected} className="px-2 py-0.5 bg-red-800 text-red-200 rounded text-xs">Remover</button>
              </div>
              <input
                value={selectedAnnotation.descricao}
                onChange={e => updateAnotacao(selectedAnnotation.id, { descricao: e.target.value })}
                placeholder="Descrição deste elemento..."
                className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
            </div>
          )}

          {/* Auto-generated legend */}
          {anotacoes.length > 0 && (
            <div className="px-4 py-3 bg-gray-800 border-t border-gray-700">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">📝 Legenda</p>
              <div className="space-y-1">
                {anotacoes.map((a, i) => (
                  <div key={a.id} className="flex items-start gap-2 text-xs">
                    <span style={{ color: a.cor }} className="flex-shrink-0">
                      {a.tipo === 'circulo' ? '⭕' : '➡️'} {a.tipo === 'circulo' ? 'Círculo' : 'Seta'} {i + 1}:
                    </span>
                    <span className="text-gray-400">{a.descricao || <em className="text-gray-600">Sem descrição</em>}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Descrição geral */}
          <div className="px-4 py-3 bg-gray-800 border-t border-gray-700">
            <label className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">💬 Descrição geral da foto</label>
            <textarea
              value={descGeral}
              onChange={e => setDescGeral(e.target.value)}
              rows={2}
              placeholder="Descreva o que esta foto representa..."
              className="mt-1.5 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-800 border-t border-gray-700 flex gap-2 justify-end">
          <button onClick={() => setAnotacoes([])} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-gray-700 text-gray-300 text-xs hover:bg-gray-600">
            <RotateCcw size={12} /> Limpar anotações
          </button>
          <button
            onClick={salvar}
            disabled={saving || !imgSrc}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar foto
          </button>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
    </div>
  );
};

export default PhotoAnnotator;
