/**
 * components/TaskPhotoConfig.tsx — Sprint 39
 * Painel admin para configurar os slots de foto das tarefas de O.S.
 * Análogo ao VehicleCheckConfig.tsx — grava em: os_task_photo_config/default
 */
import React, { useState, useEffect } from 'react';
import { getDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName, OSFotoSlot } from '../types';
import {
  Settings, Plus, Save, ChevronUp, ChevronDown,
  Eye, EyeOff, Pencil, X, Loader2, CheckCircle2, Camera,
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ── Fallback padrão ───────────────────────────────────────────────────────────

export const TASK_PHOTO_DEFAULT: OSFotoSlot[] = [
  { key: 'antes',  label: 'Foto antes',  descricao: 'Estado inicial do equipamento',        required: true,  order: 0, active: true },
  { key: 'depois', label: 'Foto depois', descricao: 'Estado após execução do serviço',      required: true,  order: 1, active: true },
];

const CONFIG_DOC = 'default';
const CONFIG_COL = CollectionName.OS_TASK_PHOTO_CONFIG;

// ── Utilidade ─────────────────────────────────────────────────────────────────

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    || `slot_${Date.now()}`;
}

// ── Formulário de slot ────────────────────────────────────────────────────────

interface SlotFormProps {
  initial?: OSFotoSlot | null;
  existingKeys: string[];
  onSave: (slot: OSFotoSlot, isNew: boolean) => void;
  onCancel: () => void;
}

const SlotForm: React.FC<SlotFormProps> = ({ initial, onSave, onCancel }) => {
  const isNew = !initial;
  const [form, setForm] = useState({
    label:    initial?.label    ?? '',
    descricao: initial?.descricao ?? '',
    required: initial?.required ?? true,
    active:   initial?.active   ?? true,
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));
  const toggle = (k: string) => setForm(p => ({ ...p, [k]: !(p as any)[k] }));

  const handleSave = () => {
    if (!form.label.trim()) return;
    const key = initial?.key ?? slugify(form.label);
    const order = initial?.order ?? 999;
    onSave({ key, ...form, label: form.label.trim(), descricao: form.descricao.trim(), order }, isNew);
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">
        {isNew ? 'Novo slot de foto' : `Editando: ${initial?.label}`}
      </p>
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1">Nome / Label *</label>
        <input value={form.label} onChange={set('label')} placeholder="Ex: Foto do painel"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1">Instrução para o técnico</label>
        <input value={form.descricao} onChange={set('descricao')} placeholder="Ex: Fotografe o painel de controle completo"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
          <input type="checkbox" checked={form.required} onChange={() => toggle('required')} className="w-4 h-4 accent-blue-600" />
          Obrigatória
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
          <input type="checkbox" checked={form.active} onChange={() => toggle('active')} className="w-4 h-4 accent-emerald-600" />
          Ativa
        </label>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} disabled={!form.label.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors">
          <Save className="w-3.5 h-3.5" /> {isNew ? 'Adicionar' : 'Salvar edição'}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 border border-gray-200 text-sm text-gray-500 rounded-lg hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </div>
  );
};

// ── Card de slot ──────────────────────────────────────────────────────────────

interface SlotCardProps {
  slot: OSFotoSlot;
  index: number;
  total: number;
  onToggleActive: () => void;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const SlotCard: React.FC<SlotCardProps> = ({ slot, index, total, onToggleActive, onEdit, onMoveUp, onMoveDown }) => (
  <div className={`bg-white rounded-xl border px-4 py-3 flex items-center gap-3 transition-all ${slot.active ? 'border-gray-200 shadow-sm' : 'border-gray-100 opacity-60'}`}>
    <div className="flex flex-col gap-0.5">
      <button onClick={onMoveUp} disabled={index === 0} className="p-0.5 rounded text-gray-400 hover:text-gray-700 disabled:opacity-20">
        <ChevronUp className="w-4 h-4" />
      </button>
      <button onClick={onMoveDown} disabled={index >= total - 1} className="p-0.5 rounded text-gray-400 hover:text-gray-700 disabled:opacity-20">
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>

    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
      <Camera className="w-4 h-4 text-gray-400" />
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-gray-800 text-sm">{slot.label}</span>
        {slot.required
          ? <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full border border-red-200">Obrigatória</span>
          : <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full border border-gray-200">Opcional</span>
        }
        {!slot.active && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded-full">Inativa</span>}
      </div>
      {slot.descricao && <p className="text-xs text-gray-400 truncate mt-0.5">{slot.descricao}</p>}
      <p className="text-[10px] text-gray-300 mt-0.5 font-mono">key: {slot.key}</p>
    </div>

    <div className="flex items-center gap-1 flex-shrink-0">
      <button onClick={onToggleActive} title={slot.active ? 'Inativar' : 'Ativar'}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
        {slot.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
      <button onClick={onEdit} title="Editar"
        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  </div>
);

// ── Componente principal ──────────────────────────────────────────────────────

const TaskPhotoConfig: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [slots, setSlots]             = useState<OSFotoSlot[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [editando, setEditando]       = useState<OSFotoSlot | null>(null);
  const [adicionando, setAdicionando] = useState(false);

  useEffect(() => {
    getDoc(doc(db, CONFIG_COL, CONFIG_DOC))
      .then(snap => {
        if (snap.exists() && Array.isArray(snap.data().slots)) {
          setSlots((snap.data().slots as OSFotoSlot[]).sort((a, b) => a.order - b.order));
        } else {
          setSlots(TASK_PHOTO_DEFAULT);
        }
      })
      .catch(() => setSlots(TASK_PHOTO_DEFAULT))
      .finally(() => setLoading(false));
  }, []);

  const handleSalvar = async () => {
    if (!currentUser || saving) return;
    setSaving(true);
    try {
      await setDoc(doc(db, CONFIG_COL, CONFIG_DOC), {
        slots: slots.map((s, i) => ({ ...s, order: i })),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const moveSlot = (idx: number, dir: 'up' | 'down') => {
    setSlots(prev => {
      const arr = [...prev];
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  };

  const toggleActive = (key: string) =>
    setSlots(prev => prev.map(s => s.key === key ? { ...s, active: !s.active } : s));

  const saveSlot = (slot: OSFotoSlot, isNew: boolean) => {
    if (isNew) {
      setSlots(prev => [...prev, { ...slot, order: prev.length }]);
    } else {
      setSlots(prev => prev.map(s => s.key === slot.key ? slot : s));
    }
    setEditando(null);
    setAdicionando(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" /> Config. Fotos de Tarefas (O.S.)
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Define quais fotos são exigidas em cada tarefa de O.S.</p>
        </div>
        <button onClick={handleSalvar} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      {/* Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 leading-relaxed">
        <strong>Slots obrigatórios</strong> bloqueiam a conclusão da tarefa enquanto a foto não for tirada.
        <strong className="ml-1">Slots opcionais</strong> aparecem mas não bloqueiam.
        <strong className="ml-1">Inativar</strong> remove o slot sem excluir.
      </div>

      {/* Lista de slots */}
      <div className="space-y-2">
        {slots.map((slot, idx) => (
          editando?.key === slot.key ? (
            <SlotForm key={slot.key} initial={editando}
              existingKeys={slots.map(s => s.key).filter(k => k !== slot.key)}
              onSave={saveSlot} onCancel={() => setEditando(null)} />
          ) : (
            <SlotCard key={slot.key} slot={slot} index={idx} total={slots.length}
              onToggleActive={() => toggleActive(slot.key)}
              onEdit={() => { setAdicionando(false); setEditando(slot); }}
              onMoveUp={() => moveSlot(idx, 'up')}
              onMoveDown={() => moveSlot(idx, 'down')} />
          )
        ))}
      </div>

      {/* Adicionar novo */}
      {adicionando ? (
        <SlotForm existingKeys={slots.map(s => s.key)} onSave={saveSlot} onCancel={() => setAdicionando(false)} />
      ) : (
        <button onClick={() => { setEditando(null); setAdicionando(true); }}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300
                     rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
          <Plus className="w-4 h-4" /> Adicionar novo slot de foto
        </button>
      )}

      {/* Resumo */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex gap-6 text-xs text-gray-600">
        <span><strong className="text-gray-800">{slots.filter(s => s.active).length}</strong> ativos</span>
        <span><strong className="text-gray-800">{slots.filter(s => s.active && s.required).length}</strong> obrigatórios</span>
        <span><strong className="text-gray-800">{slots.filter(s => !s.active).length}</strong> inativos</span>
      </div>
    </div>
  );
};

export default TaskPhotoConfig;
