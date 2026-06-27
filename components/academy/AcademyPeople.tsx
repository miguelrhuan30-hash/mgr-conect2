// ═══════════════════════════════════════════════════════════════════════════
// MGR ACADEMY — Painel de Turma (Admin) — Fase 4
// Progresso por colaborador, liberação de provas bloqueadas e cadastro manual
// de certificações / cursos externos com comprovante.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CollectionName, UserProfile, AcademyModule, AcademyProgress } from '../../types';
import {
  Users as UsersIcon, Search, Unlock, Plus, X, Loader2, BadgeCheck, Globe,
  Upload, Trash2, CheckCircle2, ArrowLeft, ClipboardList,
} from 'lucide-react';
import CareerBadges from './CareerBadges';
import { uploadExternalProof } from './academyHelpers';

const AcademyPeople: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UserProfile | null>(null);

  useEffect(() => {
    return onSnapshot(collection(db, CollectionName.USERS), snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)).filter(u => u.role !== 'pending'));
    });
  }, []);

  const filtered = users.filter(u =>
    (u.displayName || u.email || '').toLowerCase().includes(search.toLowerCase()));

  if (selected) return <PersonDetail user={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center"><UsersIcon className="text-brand-700" size={22} /></div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Academia MGR — Turma</h1>
          <p className="text-sm text-gray-500">Acompanhe o progresso e gerencie a carreira de cada colaborador.</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar colaborador…"
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(u => (
          <button key={u.uid} onClick={() => setSelected(u)} className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-md transition-shadow flex items-center gap-3">
            {u.avatar || u.photoURL ? <img src={u.avatar || u.photoURL} alt="" className="w-10 h-10 rounded-full object-cover" /> :
              <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold">{(u.displayName || 'U').charAt(0)}</div>}
            <div className="min-w-0">
              <p className="font-bold text-sm text-gray-900 truncate">{u.displayName || u.email}</p>
              <p className="text-xs text-gray-500 truncate capitalize">{u.sectorName || u.role}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Detalhe de um colaborador ──────────────────────────────────────────────
const PersonDetail: React.FC<{ user: UserProfile; onBack: () => void }> = ({ user, onBack }) => {
  const [blocked, setBlocked] = useState<AcademyProgress[]>([]);
  const [modules, setModules] = useState<Record<string, AcademyModule>>({});
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const unsubB = onSnapshot(query(collection(db, CollectionName.ACADEMY_PROGRESS), where('userId', '==', user.uid)),
      snap => setBlocked(snap.docs.map(d => ({ id: d.id, ...d.data() } as AcademyProgress)).filter(p => p.examBlocked)));
    const unsubM = onSnapshot(collection(db, CollectionName.ACADEMY_MODULES),
      snap => { const m: Record<string, AcademyModule> = {}; snap.docs.forEach(d => m[d.id] = { id: d.id, ...d.data() } as AcademyModule); setModules(m); });
    return () => { unsubB(); unsubM(); };
  }, [user.uid]);

  const unlock = async (moduleId: string) => {
    setUnlocking(moduleId);
    try {
      await httpsCallable(functions, 'adminUnlockExam')({ userId: user.uid, moduleId });
    } catch (e: any) {
      alert(e?.message || 'Erro ao liberar.');
    } finally { setUnlocking(null); }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium mb-4"><ArrowLeft size={18} /> Turma</button>

      <div className="flex items-center gap-3 mb-5">
        {user.avatar || user.photoURL ? <img src={user.avatar || user.photoURL} alt="" className="w-14 h-14 rounded-full object-cover" /> :
          <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xl">{(user.displayName || 'U').charAt(0)}</div>}
        <div>
          <h1 className="text-xl font-bold text-gray-900">{user.displayName || user.email}</h1>
          <p className="text-sm text-gray-500 capitalize">{user.sectorName || user.role}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="ml-auto flex items-center gap-2 px-3 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700">
          <Plus size={16} /> Certificação / Curso
        </button>
      </div>

      {/* Provas bloqueadas — liberação */}
      {blocked.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <h3 className="flex items-center gap-2 font-bold text-amber-800 text-sm mb-3"><ClipboardList size={16} /> Provas bloqueadas ({blocked.length})</h3>
          <div className="space-y-2">
            {blocked.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-white rounded-lg border border-amber-200 px-3 py-2">
                <span className="text-sm font-medium text-gray-800">{modules[p.moduleId]?.title || 'Módulo'}</span>
                <button onClick={() => unlock(p.moduleId)} disabled={unlocking === p.moduleId}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 disabled:opacity-50">
                  {unlocking === p.moduleId ? <Loader2 size={13} className="animate-spin" /> : <Unlock size={13} />} Liberar nova tentativa
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vitrine de carreira do colaborador + gestão de externos */}
      <ManagedCareer userId={user.uid} />

      {showAdd && <AddExternalModal userId={user.uid} onClose={() => setShowAdd(false)} />}
    </div>
  );
};

// ── Vitrine + lista de externos com botão de excluir (visão adm) ──
const ManagedCareer: React.FC<{ userId: string }> = ({ userId }) => {
  const [externals, setExternals] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => onSnapshot(query(collection(db, CollectionName.ACADEMY_EXTERNAL_BADGES), where('userId', '==', userId)),
    snap => setExternals(snap.docs.map(d => ({ id: d.id, title: (d.data() as any).title })))), [userId]);

  const remove = async (id: string) => { if (confirm('Excluir este registro?')) await deleteDoc(doc(db, CollectionName.ACADEMY_EXTERNAL_BADGES, id)); };

  return (
    <div className="space-y-4">
      <CareerBadges userId={userId} />
      {externals.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">Gerenciar registros externos</p>
          <div className="flex flex-wrap gap-2">
            {externals.map(e => (
              <span key={e.id} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs">
                {e.title}
                <button onClick={() => remove(e.id)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Modal: adicionar certificação / curso externo ──
const AddExternalModal: React.FC<{ userId: string; onClose: () => void }> = ({ userId, onClose }) => {
  const { currentUser } = useAuth();
  const [type, setType] = useState<'certification' | 'external'>('certification');
  const [title, setTitle] = useState('');
  const [institution, setInstitution] = useState('');
  const [completedDate, setCompletedDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() || !currentUser) return;
    setSaving(true);
    try {
      let proof: { url: string; path: string } | null = null;
      if (file) { setProgress(0); proof = await uploadExternalProof(userId, file, setProgress); }
      await addDoc(collection(db, CollectionName.ACADEMY_EXTERNAL_BADGES), {
        userId, type, title: title.trim(), institution: institution.trim() || null,
        completedDate: completedDate || null, validUntil: validUntil || null,
        proofUrl: proof?.url || null, proofPath: proof?.path || null,
        addedByAdmin: currentUser.uid, addedAt: serverTimestamp(),
      });
      onClose();
    } catch (e: any) {
      alert(e?.message || 'Erro ao salvar.');
    } finally { setSaving(false); setProgress(null); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Adicionar Certificação / Curso</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <TypeBtn active={type === 'certification'} onClick={() => setType('certification')} icon={BadgeCheck} label="Certificação" />
            <TypeBtn active={type === 'external'} onClick={() => setType('external')} icon={Globe} label="Curso externo" />
          </div>
          <L label="Título *"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: NR-35 Trabalho em Altura" className="inp" /></L>
          <L label="Instituição"><input value={institution} onChange={e => setInstitution(e.target.value)} placeholder="Ex: SENAI" className="inp" /></L>
          <div className="grid grid-cols-2 gap-3">
            <L label="Concluído em"><input type="date" value={completedDate} onChange={e => setCompletedDate(e.target.value)} className="inp" /></L>
            <L label="Válido até (opcional)"><input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="inp" /></L>
          </div>
          <L label="Comprovante (PDF/imagem)">
            <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 cursor-pointer hover:border-brand-400">
              <Upload size={16} /> {file ? file.name : 'Selecionar arquivo'}
              <input type="file" accept="application/pdf,image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
            {progress !== null && <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-brand-500" style={{ width: `${progress}%` }} /></div>}
          </L>
          <button onClick={save} disabled={!title.trim() || saving} className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Salvar
          </button>
        </div>
      </div>
      <style>{`.inp{width:100%;padding:0.625rem;border:1px solid #e5e7eb;border-radius:0.5rem;font-size:0.875rem}.inp:focus{outline:none;box-shadow:0 0 0 2px rgb(var(--brand-500,59 130 246)/.4)}`}</style>
    </div>
  );
};

const TypeBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ElementType; label: string }> = ({ active, onClick, icon: Icon, label }) => (
  <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold ${active ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}><Icon size={15} /> {label}</button>
);
const L: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div><label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>{children}</div>
);

export default AcademyPeople;
