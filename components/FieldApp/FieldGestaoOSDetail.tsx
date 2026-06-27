/**
 * FieldGestaoOSDetail — painel de gerenciamento admin de uma O.S.
 * Full-screen modal: visualiza todos os dados + editar / reagendar / reatribuir / mudar status / excluir.
 */
import React, { useState, useEffect } from 'react';
import {
  doc, updateDoc, deleteDoc, collection, query, where, getDocs, Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { OSField } from './FieldOS';
import {
  X, ChevronLeft, User, CalendarDays, AlertCircle, CheckCircle2, Wrench, Clock,
  MapPin, ClipboardList, Trash2, Pencil, Calendar, UserCog, RefreshCw,
  CheckSquare, Square, Loader2, AlertTriangle, ChevronRight, Tag,
} from 'lucide-react';

interface Props {
  os: OSField;
  onClose: () => void;
  onUpdate: (updated: OSField) => void;
  onDelete: () => void;
}

const STATUS_OPTIONS = [
  { value: 'open',        label: 'Aberta',       color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',          icon: <Clock size={11} /> },
  { value: 'pending',     label: 'Pendente',      color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',    icon: <AlertCircle size={11} /> },
  { value: 'in-progress', label: 'Em andamento',  color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',   icon: <Wrench size={11} /> },
  { value: 'completed',   label: 'Concluída',     color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <CheckCircle2 size={11} /> },
];

const PRIORITY_OPTIONS = [
  { value: 'baixa',  label: 'Baixa',    color: 'border-emerald-500 bg-emerald-500/10 text-emerald-400' },
  { value: 'media',  label: 'Média',    color: 'border-yellow-500 bg-yellow-500/10 text-yellow-400'   },
  { value: 'alta',   label: 'Alta',     color: 'border-red-500 bg-red-500/10 text-red-400'            },
  { value: 'critica', label: 'Crítica', color: 'border-red-700 bg-red-700/20 text-red-300'            },
];

const tsToLocal = (ts: Timestamp | undefined): string => {
  if (!ts) return '';
  const d = ts.toDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const localToTs = (v: string): Timestamp | null => {
  if (!v) return null;
  return Timestamp.fromDate(new Date(v));
};

const diasEmAberto = (os: OSField): number => {
  const criado = (os as any).criadoEm?.toDate?.() ?? (os as any).createdAt?.toDate?.();
  if (!criado) return 0;
  return Math.floor((Date.now() - criado.getTime()) / 86400000);
};

type Painel = 'none' | 'editar' | 'status' | 'reagendar' | 'reatribuir' | 'excluir';

export default function FieldGestaoOSDetail({ os, onClose, onUpdate, onDelete }: Props) {
  const { currentUser, userProfile } = useAuth();
  const [painel, setPainel]         = useState<Painel>('none');
  const [saving, setSaving]         = useState(false);

  // ── Editar campos básicos ──
  const [editTitle, setEditTitle]       = useState(os.title ?? '');
  const [editDesc, setEditDesc]         = useState(os.description ?? '');
  const [editPriority, setEditPriority] = useState(os.priority ?? 'baixa');

  // ── Reagendar ──
  const [novaStart, setNovaStart] = useState(tsToLocal(os.startDate));
  const [novaEnd, setNovaEnd]     = useState(tsToLocal((os as any).endDate));

  // ── Reatribuir ──
  const [users, setUsers]         = useState<{ uid: string; nome: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [novoResp, setNovoResp]   = useState<{ uid: string; nome: string } | null>(null);

  // ── Status ──
  const [novoStatus, setNovoStatus] = useState(os.status ?? 'pending');

  useEffect(() => {
    if (painel !== 'reatribuir' || users.length > 0) return;
    setLoadingUsers(true);
    getDocs(query(collection(db, 'users'), where('ativo', '==', true))).then(snap => {
      const list = snap.docs.map(d => {
        const data = d.data();
        return { uid: d.id, nome: data.nomeCompleto || data.displayName || data.email || d.id };
      });
      list.sort((a, b) => a.nome.localeCompare(b.nome));
      setUsers(list);
      setLoadingUsers(false);
    }).catch(() => setLoadingUsers(false));
  }, [painel]);

  const save = async (updates: Record<string, any>, label: string) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'tasks', os.id), {
        ...updates,
        atualizadoPor: currentUser?.uid,
        atualizadoEm: Timestamp.now(),
      });
      onUpdate({ ...os, ...updates } as OSField);
      setPainel('none');
    } catch (e) {
      console.error(`[FieldGestaoOSDetail] ${label}:`, e);
      alert(`Erro ao ${label}. Tente novamente.`);
    } finally {
      setSaving(false);
    }
  };

  const handleExcluir = async () => {
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'tasks', os.id));
      onDelete();
    } catch (e) {
      console.error('[FieldGestaoOSDetail] excluir:', e);
      alert('Erro ao excluir. Tente novamente.');
      setSaving(false);
    }
  };

  const statusCfg = STATUS_OPTIONS.find(s => s.value === os.status) ?? STATUS_OPTIONS[0];
  const dias      = diasEmAberto(os);

  const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) =>
    value ? (
      <div className="flex items-start gap-3 py-2.5 border-b border-gray-800/60">
        <span className="text-gray-600 mt-0.5 flex-shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-[9px] text-gray-600 uppercase font-bold tracking-wide">{label}</p>
          <p className="text-sm text-gray-200 mt-0.5">{value}</p>
        </div>
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <button onClick={onClose} className="p-1.5 rounded-lg bg-gray-800 active:bg-gray-700">
          <ChevronLeft size={18} className="text-gray-300" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-orange-400 font-bold uppercase tracking-wide">Gestão de O.S.</p>
          {os.numeroOS && <p className="text-xs text-gray-500">{os.numeroOS}</p>}
        </div>
        {dias > 0 && (
          <span className={`text-[10px] font-black px-2 py-1 rounded-full border ${
            dias > 14 ? 'bg-red-500/20 text-red-400 border-red-500/30'
            : dias > 7  ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
            :              'bg-gray-800 text-gray-500 border-gray-700'
          }`}>
            {dias}d em aberto
          </span>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Hero */}
        <div className="px-4 pt-5 pb-4 border-b border-gray-800">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h1 className="text-xl font-black text-white leading-snug flex-1">{os.title ?? 'Sem título'}</h1>
            <span className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold flex-shrink-0 ${statusCfg.color}`}>
              {statusCfg.icon} {statusCfg.label}
            </span>
          </div>
          {os.description && (
            <p className="text-sm text-gray-400 leading-relaxed">{os.description}</p>
          )}
        </div>

        {/* Info */}
        <div className="px-4 py-2">
          <InfoRow icon={<User size={14} />}        label="Responsável"   value={os.assigneeName ?? (os.assignedUserNames?.[0] ?? null)} />
          <InfoRow icon={<User size={14} />}        label="Cliente"       value={os.clientName} />
          <InfoRow icon={<Tag size={14} />}         label="Tipo de serviço" value={os.tipoServico} />
          <InfoRow icon={<CalendarDays size={14} />} label="Data agendada" value={
            os.startDate
              ? os.startDate.toDate().toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : null
          } />
          {os.assignedUserNames && os.assignedUserNames.length > 0 && (
            <div className="flex items-start gap-3 py-2.5 border-b border-gray-800/60">
              <span className="text-gray-600 mt-0.5 flex-shrink-0"><User size={14} /></span>
              <div>
                <p className="text-[9px] text-gray-600 uppercase font-bold tracking-wide">Colaboradores</p>
                <p className="text-sm text-gray-200 mt-0.5">{os.assignedUserNames.join(', ')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Tarefas summary */}
        {os.tarefasOS && os.tarefasOS.length > 0 && (
          <div className="px-4 py-4 border-t border-gray-800">
            <p className="text-[10px] text-gray-600 uppercase font-bold tracking-wide mb-3">
              Tarefas ({os.tarefasOS.filter((t: any) => t.concluida).length}/{os.tarefasOS.length} concluídas)
            </p>
            <div className="space-y-2">
              {os.tarefasOS.map((t: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  {t.concluida
                    ? <CheckSquare size={14} className="text-emerald-400 flex-shrink-0" />
                    : <Square size={14} className="text-gray-600 flex-shrink-0" />
                  }
                  <span className={`text-xs ${t.concluida ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                    {t.descricao ?? t.titulo ?? `Tarefa ${i + 1}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Painéis de ação ── */}

        {/* Editar campos básicos */}
        {painel === 'editar' && (
          <div className="mx-4 my-4 bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-4">
            <p className="text-xs font-bold text-white">Editar O.S.</p>
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold">Título</label>
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold">Descrição</label>
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                rows={3}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Prioridade</label>
              <div className="grid grid-cols-4 gap-2">
                {PRIORITY_OPTIONS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setEditPriority(p.value)}
                    className={`py-2 rounded-xl border text-[10px] font-bold transition-all ${
                      editPriority === p.value ? p.color : 'border-gray-700 text-gray-500 bg-gray-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => save({ title: editTitle, description: editDesc, priority: editPriority }, 'salvar')}
                disabled={saving || !editTitle.trim()}
                className="flex-1 py-2.5 bg-orange-600 text-white font-bold text-xs rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Pencil size={13} />}
                Salvar alterações
              </button>
              <button onClick={() => setPainel('none')} disabled={saving}
                className="px-4 py-2.5 bg-gray-800 text-gray-400 font-bold text-xs rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Mudar status */}
        {painel === 'status' && (
          <div className="mx-4 my-4 bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-white">Mudar status</p>
            {STATUS_OPTIONS.map(s => (
              <button
                key={s.value}
                onClick={() => setNovoStatus(s.value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                  novoStatus === s.value
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-gray-700 bg-gray-800'
                }`}
              >
                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${s.color}`}>
                  {s.icon} {s.label}
                </span>
                {novoStatus === s.value && <CheckCircle2 size={14} className="text-orange-400 ml-auto" />}
              </button>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => save({ status: novoStatus }, 'mudar status')}
                disabled={saving}
                className="flex-1 py-2.5 bg-orange-600 text-white font-bold text-xs rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Confirmar status
              </button>
              <button onClick={() => setPainel('none')} disabled={saving}
                className="px-4 py-2.5 bg-gray-800 text-gray-400 font-bold text-xs rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Reagendar */}
        {painel === 'reagendar' && (
          <div className="mx-4 my-4 bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-4">
            <p className="text-xs font-bold text-white">Reagendar O.S.</p>
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold">Data / hora de início</label>
              <input
                type="datetime-local"
                value={novaStart}
                onChange={e => setNovaStart(e.target.value)}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold">Data / hora de encerramento</label>
              <input
                type="datetime-local"
                value={novaEnd}
                onChange={e => setNovaEnd(e.target.value)}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  const updates: Record<string, any> = {};
                  const ts = localToTs(novaStart);
                  const te = localToTs(novaEnd);
                  if (ts) updates.startDate = ts;
                  if (te) updates.endDate   = te;
                  if (Object.keys(updates).length === 0) return;
                  save(updates, 'reagendar');
                }}
                disabled={saving || !novaStart}
                className="flex-1 py-2.5 bg-orange-600 text-white font-bold text-xs rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Calendar size={13} />}
                Confirmar datas
              </button>
              <button onClick={() => setPainel('none')} disabled={saving}
                className="px-4 py-2.5 bg-gray-800 text-gray-400 font-bold text-xs rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Reatribuir */}
        {painel === 'reatribuir' && (
          <div className="mx-4 my-4 bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-white">Reatribuir O.S.</p>
            {loadingUsers ? (
              <div className="flex justify-center py-4">
                <Loader2 size={20} className="text-orange-400 animate-spin" />
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-1">
                <button
                  onClick={() => setNovoResp({ uid: '', nome: 'Sem responsável' })}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                    novoResp?.uid === '' ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700 bg-gray-800'
                  }`}
                >
                  <User size={13} className="text-gray-500" />
                  <span className="text-sm text-gray-300">Sem responsável</span>
                  {novoResp?.uid === '' && <CheckCircle2 size={13} className="text-orange-400 ml-auto" />}
                </button>
                {users.map(u => (
                  <button
                    key={u.uid}
                    onClick={() => setNovoResp(u)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                      novoResp?.uid === u.uid ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700 bg-gray-800'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-black text-gray-300">{u.nome[0].toUpperCase()}</span>
                    </div>
                    <span className="text-sm text-gray-300 flex-1 text-left">{u.nome}</span>
                    {novoResp?.uid === u.uid && <CheckCircle2 size={13} className="text-orange-400" />}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  if (!novoResp) return;
                  save({
                    assignedTo:   novoResp.uid || null,
                    assigneeName: novoResp.uid ? novoResp.nome : null,
                  }, 'reatribuir');
                }}
                disabled={saving || !novoResp}
                className="flex-1 py-2.5 bg-orange-600 text-white font-bold text-xs rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <UserCog size={13} />}
                Confirmar atribuição
              </button>
              <button onClick={() => setPainel('none')} disabled={saving}
                className="px-4 py-2.5 bg-gray-800 text-gray-400 font-bold text-xs rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Confirmar exclusão */}
        {painel === 'excluir' && (
          <div className="mx-4 my-4 bg-red-900/20 border border-red-700/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400" />
              <p className="text-sm font-bold text-red-300">Excluir O.S.?</p>
            </div>
            <p className="text-xs text-red-400/80">
              Esta ação é irreversível. A O.S. <strong>{os.title}</strong> e todos os seus dados serão permanentemente removidos.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleExcluir}
                disabled={saving}
                className="flex-1 py-2.5 bg-red-700 text-white font-bold text-xs rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Excluir definitivamente
              </button>
              <button onClick={() => setPainel('none')} disabled={saving}
                className="px-4 py-2.5 bg-gray-800 text-gray-400 font-bold text-xs rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="h-32" />
      </div>

      {/* ── Action bar ── */}
      {painel === 'none' && (
        <div className="flex-shrink-0 px-4 py-4 bg-gray-900 border-t border-gray-800 space-y-2 safe-area-bottom">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPainel('editar')}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-800 border border-gray-700 text-gray-200 font-bold text-xs rounded-xl active:bg-gray-700"
            >
              <Pencil size={13} /> Editar
            </button>
            <button
              onClick={() => { setNovoStatus(os.status ?? 'pending'); setPainel('status'); }}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-800 border border-gray-700 text-gray-200 font-bold text-xs rounded-xl active:bg-gray-700"
            >
              <RefreshCw size={13} /> Status
            </button>
            <button
              onClick={() => { setNovaStart(tsToLocal(os.startDate)); setNovaEnd(tsToLocal((os as any).endDate)); setPainel('reagendar'); }}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-800 border border-gray-700 text-gray-200 font-bold text-xs rounded-xl active:bg-gray-700"
            >
              <Calendar size={13} /> Reagendar
            </button>
            <button
              onClick={() => { setNovoResp(null); setPainel('reatribuir'); }}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-800 border border-gray-700 text-gray-200 font-bold text-xs rounded-xl active:bg-gray-700"
            >
              <UserCog size={13} /> Reatribuir
            </button>
          </div>
          <button
            onClick={() => setPainel('excluir')}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-red-900/30 border border-red-700/40 text-red-400 font-bold text-xs rounded-xl active:bg-red-900/50"
          >
            <Trash2 size={13} /> Excluir O.S.
          </button>
        </div>
      )}
    </div>
  );
}
