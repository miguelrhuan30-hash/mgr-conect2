import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, onSnapshot, deleteDoc,
  setDoc, Timestamp, limit, doc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  CollectionName, LunchMenu, LunchMenuMode, LunchChoice, LunchDayChoice,
  LunchLocation, LunchLocationType, LunchConfig, MarmitaSize,
} from '../../types';
import { registrarAtividade } from '../../services/activityFeedService';
import {
  UtensilsCrossed, CheckCircle2, MapPin, Building2, Plane,
  AlertTriangle, Pencil, Send, ArrowRight, Clock,
  ChevronDown, Calendar, X, Info, Navigation,
} from 'lucide-react';

const DAY_KEYS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'] as const;
type DayKey = typeof DAY_KEYS[number];
const DAY_LABELS: Record<DayKey, string> = {
  segunda: 'Segunda-feira', terca: 'Terça-feira', quarta: 'Quarta-feira',
  quinta: 'Quinta-feira', sexta: 'Sexta-feira',
};
const MAX_PER_CATEGORY = 2;
const todayDayKey = (): DayKey => {
  const map: Record<number, DayKey> = { 1: 'segunda', 2: 'terca', 3: 'quarta', 4: 'quinta', 5: 'sexta' };
  return map[new Date().getDay()] ?? 'segunda';
};
type DaySelection = { misturas: string[]; guarnicoes: string[] };
const emptyDay = (): DaySelection => ({ misturas: [], guarnicoes: [] });
const SIZES: { value: MarmitaSize; label: string; emoji: string }[] = [
  { value: 'pequena', label: 'Pequena', emoji: '🥣' },
  { value: 'media',   label: 'Média',   emoji: '🍛' },
  { value: 'grande',  label: 'Grande',  emoji: '🍲' },
];
const fmtBR = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

export default function FieldAlmoco() {
  const { currentUser, userProfile } = useAuth();

  const [activeMenu, setActiveMenu]         = useState<LunchMenu | null>(null);
  const [loadingMenu, setLoadingMenu]       = useState(true);
  const [existingChoice, setExistingChoice] = useState<LunchChoice | null>(null);
  const [loadingChoice, setLoadingChoice]   = useState(true);

  const [selections, setSelections] = useState<Record<DayKey, DaySelection>>({
    segunda: emptyDay(), terca: emptyDay(), quarta: emptyDay(), quinta: emptyDay(), sexta: emptyDay(),
  });
  const [sizes, setSizes] = useState<Record<DayKey, MarmitaSize>>({
    segunda: 'media', terca: 'media', quarta: 'media', quinta: 'media', sexta: 'media',
  });
  const [notes, setNotes] = useState<Record<DayKey, string>>({
    segunda: '', terca: '', quarta: '', quinta: '', sexta: '',
  });
  const [submittingToday, setSubmittingToday] = useState(false);
  const [submittingWeek, setSubmittingWeek]   = useState(false);
  const [showWeekForm, setShowWeekForm]       = useState(false);
  const [editingDay, setEditingDay]           = useState<DayKey | null>(null);
  const [editSel, setEditSel]                 = useState<DaySelection>(emptyDay());
  const [editNote, setEditNote]               = useState('');
  const [savingEdit, setSavingEdit]           = useState(false);

  const [todayLocation, setTodayLocation]     = useState<LunchLocation | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [locType, setLocType]                 = useState<LunchLocationType | ''>('');
  const [address, setAddress]                 = useState('');
  const [clientName, setClientName]           = useState('');
  const [gettingGPS, setGettingGPS]           = useState(false);
  const [coords, setCoords]                   = useState<{ lat: number; lng: number } | null>(null);
  const [submittingLoc, setSubmittingLoc]     = useState(false);
  const [showForaConfirm, setShowForaConfirm] = useState(false);

  const [sedeNome, setSedeNome]           = useState('Sede MGR');
  const [sedeEndereco, setSedeEndereco]   = useState('');
  const [horarioLimite, setHorarioLimite] = useState('10:00');

  const todayISO = new Date().toISOString().split('T')[0];
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const isPastDeadline = timeStr >= horarioLimite;
  const todayKey = todayDayKey();

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return onSnapshot(doc(db, CollectionName.LUNCH_CONFIG, 'sede'), snap => {
      if (snap.exists()) {
        const d = snap.data() as LunchConfig;
        setSedeNome(d.sedeNome || 'Sede MGR');
        setSedeEndereco(d.sedeEndereco || '');
        setHorarioLimite(d.horarioLimite || '10:00');
      }
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, CollectionName.LUNCH_MENUS), where('status', '==', 'ativo'), limit(1));
    return onSnapshot(q, snap => {
      setActiveMenu(snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as LunchMenu));
      setLoadingMenu(false);
    }, () => { setActiveMenu(null); setLoadingMenu(false); });
  }, []);

  useEffect(() => {
    if (!activeMenu || !currentUser) { setLoadingChoice(false); return; }
    const q = query(
      collection(db, CollectionName.LUNCH_CHOICES),
      where('menuId', '==', activeMenu.id),
      where('userId', '==', currentUser.uid),
      limit(1),
    );
    return onSnapshot(q, snap => {
      setExistingChoice(snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as LunchChoice));
      setLoadingChoice(false);
    }, () => { setExistingChoice(null); setLoadingChoice(false); });
  }, [activeMenu, currentUser]);

  useEffect(() => {
    if (!currentUser) { setLoadingLocation(false); return; }
    const q = query(
      collection(db, CollectionName.LUNCH_LOCATIONS),
      where('userId', '==', currentUser.uid),
      where('data', '==', todayISO),
      limit(1),
    );
    return onSnapshot(q, snap => {
      setTodayLocation(snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as LunchLocation));
      setLoadingLocation(false);
    }, () => { setTodayLocation(null); setLoadingLocation(false); });
  }, [currentUser, todayISO]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const meatOpts = useMemo(() => activeMenu?.pratos.filter(p => p.categoria === 'mistura') ?? [], [activeMenu]);
  const sideOpts = useMemo(() => activeMenu?.pratos.filter(p => p.categoria === 'guarnicao') ?? [], [activeMenu]);
  const dishIds  = useMemo(() => new Set(activeMenu?.pratos.map(p => p.id) ?? []), [activeMenu]);
  const isWeekly = !activeMenu?.modo || activeMenu.modo === 'semanal';
  const todayChoice = existingChoice?.escolhas?.[todayKey] as LunchDayChoice | null | undefined;
  const todayHasUnavailable = useMemo(() => {
    if (!todayChoice) return false;
    return (todayChoice.misturas?.some(m => !dishIds.has(m.id)) || todayChoice.guarnicoes?.some(g => !dishIds.has(g.id))) ?? false;
  }, [todayChoice, dishIds]);

  const isDayLocked = (day: DayKey) => {
    if (!activeMenu || !isWeekly) return isPastDeadline;
    const idx = DAY_KEYS.indexOf(day);
    const d = new Date(activeMenu.weekStart + 'T12:00:00');
    d.setDate(d.getDate() + idx);
    const iso = d.toISOString().split('T')[0];
    if (iso < todayISO) return true;
    if (iso > todayISO) return false;
    return isPastDeadline;
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const buildDayChoice = (day: DayKey): LunchDayChoice => ({
    misturas:   selections[day].misturas.map(id => ({ id, nome: meatOpts.find(p => p.id === id)?.nome ?? id })),
    guarnicoes: selections[day].guarnicoes.map(id => ({ id, nome: sideOpts.find(p => p.id === id)?.nome ?? id })),
    tamanho:    sizes[day],
    ...(notes[day].trim() ? { observacao: notes[day].trim() } : {}),
  });
  const choiceDocId = () => `${currentUser!.uid}_${activeMenu!.id}`;
  const migrateOldDoc = (docId: string) => {
    if (existingChoice && existingChoice.id !== docId)
      deleteDoc(doc(db, CollectionName.LUNCH_CHOICES, existingChoice.id)).catch(() => {});
  };
  const baseChoiceDoc = () => ({
    menuId: activeMenu!.id, userId: currentUser!.uid,
    userName: userProfile?.nomeCompleto || userProfile?.displayName || '',
    userSector: userProfile?.sectorName || '',
  });

  // ── Submit today ────────────────────────────────────────────────────────────
  const handleSubmitToday = async () => {
    if (!currentUser || !userProfile || !activeMenu) return;
    const sel = selections[todayKey];
    if (!sel.misturas.length && !sel.guarnicoes.length) return;
    setSubmittingToday(true);
    try {
      const docId = choiceDocId();
      await setDoc(doc(db, CollectionName.LUNCH_CHOICES, docId), {
        ...baseChoiceDoc(),
        escolhas: { ...(existingChoice?.escolhas ?? {}), [todayKey]: buildDayChoice(todayKey) },
        enviadoEm: Timestamp.now(), atualizadoEm: Timestamp.now(),
      });
      migrateOldDoc(docId);
      registrarAtividade({
        tipo: 'almoco_pedido',
        autorId: currentUser.uid,
        autorNome: userProfile?.nomeCompleto || userProfile?.displayName || 'Colaborador',
        titulo: 'Pedido de marmita — hoje',
        descricao: [...sel.misturas.map(id => meatOpts.find(p => p.id === id)?.nome), ...sel.guarnicoes.map(id => sideOpts.find(p => p.id === id)?.nome)].filter(Boolean).join(', ') || undefined,
        meta: { ambiente: 'field_app', dia: todayKey },
      });
    } catch { alert('Erro ao salvar. Tente novamente.'); }
    finally { setSubmittingToday(false); }
  };

  // ── Submit full week ────────────────────────────────────────────────────────
  const handleSubmitWeek = async () => {
    if (!currentUser || !userProfile || !activeMenu) return;
    setSubmittingWeek(true);
    try {
      const escolhas: LunchChoice['escolhas'] = {};
      DAY_KEYS.forEach(day => {
        const sel = selections[day];
        escolhas[day] = (sel.misturas.length || sel.guarnicoes.length) ? buildDayChoice(day) : null;
      });
      const docId = choiceDocId();
      await setDoc(doc(db, CollectionName.LUNCH_CHOICES, docId), {
        ...baseChoiceDoc(), escolhas, enviadoEm: Timestamp.now(), atualizadoEm: Timestamp.now(),
      });
      migrateOldDoc(docId);
      registrarAtividade({
        tipo: 'almoco_pedido',
        autorId: currentUser.uid,
        autorNome: userProfile?.nomeCompleto || userProfile?.displayName || 'Colaborador',
        titulo: 'Pedido de marmita — semana toda',
        meta: { ambiente: 'field_app' },
      });
      setShowWeekForm(false);
    } catch { alert('Erro ao salvar. Tente novamente.'); }
    finally { setSubmittingWeek(false); }
  };

  const toggleItem = (day: DayKey, cat: 'misturas' | 'guarnicoes', id: string) => {
    setSelections(prev => {
      const s = { ...prev[day] }; const arr = [...s[cat]]; const i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1);
      else { if (arr.length >= MAX_PER_CATEGORY) return prev; arr.push(id); }
      return { ...prev, [day]: { ...s, [cat]: arr } };
    });
  };

  const openEditDay = (day: DayKey) => {
    if (!existingChoice) return;
    const dc = existingChoice.escolhas[day] as LunchDayChoice | null | undefined;
    setEditSel({
      misturas:   dc?.misturas?.filter(m => dishIds.has(m.id)).map(m => m.id) ?? [],
      guarnicoes: dc?.guarnicoes?.filter(g => dishIds.has(g.id)).map(g => g.id) ?? [],
    });
    setEditNote(dc?.observacao ?? '');
    setEditingDay(day);
  };

  const toggleEditItem = (cat: 'misturas' | 'guarnicoes', id: string) => {
    setEditSel(prev => {
      const arr = [...prev[cat]]; const i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1);
      else { if (arr.length >= MAX_PER_CATEGORY) return prev; arr.push(id); }
      return { ...prev, [cat]: arr };
    });
  };

  const handleSaveEdit = async () => {
    if (!existingChoice || !editingDay || !currentUser || !activeMenu) return;
    setSavingEdit(true);
    try {
      const dc: LunchDayChoice = {
        misturas:   editSel.misturas.map(id => ({ id, nome: meatOpts.find(p => p.id === id)?.nome ?? id })),
        guarnicoes: editSel.guarnicoes.map(id => ({ id, nome: sideOpts.find(p => p.id === id)?.nome ?? id })),
        tamanho:    sizes[editingDay],
        ...(editNote.trim() ? { observacao: editNote.trim() } : {}),
      };
      const hasAny = dc.misturas.length > 0 || dc.guarnicoes.length > 0;
      const docId = choiceDocId();
      await setDoc(doc(db, CollectionName.LUNCH_CHOICES, docId), {
        ...baseChoiceDoc(),
        escolhas: { ...(existingChoice.escolhas ?? {}), [editingDay]: hasAny ? dc : null },
        enviadoEm: existingChoice.enviadoEm ?? Timestamp.now(), atualizadoEm: Timestamp.now(),
      });
      migrateOldDoc(docId);
      if (hasAny) {
        registrarAtividade({
          tipo: 'almoco_pedido',
          autorId: currentUser.uid,
          autorNome: userProfile?.nomeCompleto || userProfile?.displayName || 'Colaborador',
          titulo: `Pedido de marmita — ${DAY_LABELS[editingDay]}`,
          descricao: [...dc.misturas.map(m => m.nome), ...dc.guarnicoes.map(g => g.nome)].join(', ') || undefined,
          meta: { ambiente: 'field_app', dia: editingDay },
        });
      }
      setEditingDay(null);
    } catch { alert('Erro ao salvar.'); }
    finally { setSavingEdit(false); }
  };

  // ── GPS ─────────────────────────────────────────────────────────────────────
  const handleGetGPS = () => {
    if (!navigator.geolocation) { alert('Geolocalização não suportada.'); return; }
    setGettingGPS(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`);
          const d = await r.json();
          if (d.display_name) setAddress(d.display_name);
        } catch {}
        setGettingGPS(false);
      },
      () => { alert('Não foi possível obter localização.'); setGettingGPS(false); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  // ── Submit location ─────────────────────────────────────────────────────────
  const handleSubmitLocation = async (tipo: LunchLocationType) => {
    if (!currentUser || !userProfile) return;
    setSubmittingLoc(true);
    try {
      const d: Record<string, any> = {
        userId: currentUser.uid,
        userName: userProfile.nomeCompleto || userProfile.displayName || '',
        userSector: userProfile.sectorName || '',
        data: todayISO, tipo, informadoEm: Timestamp.now(), menuId: activeMenu?.id || '',
      };
      if (tipo === 'campo') {
        if (address) d.endereco = address;
        if (clientName) d.clienteNome = clientName;
        if (coords) d.coordenadas = coords;
      }
      await setDoc(doc(db, CollectionName.LUNCH_LOCATIONS, `${currentUser.uid}_${todayISO}`), d);
    } catch { alert('Erro ao enviar localização.'); }
    finally { setSubmittingLoc(false); setShowForaConfirm(false); }
  };

  const handleResetLocation = async () => {
    if (!todayLocation || !confirm('Deseja alterar sua localização de hoje?')) return;
    try {
      await deleteDoc(doc(db, CollectionName.LUNCH_LOCATIONS, todayLocation.id));
      setLocType(''); setAddress(''); setClientName(''); setCoords(null);
    } catch { alert('Erro ao resetar.'); }
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loadingMenu || loadingChoice || loadingLocation) return (
    <div className="flex items-center justify-center h-full gap-3 text-gray-500">
      <UtensilsCrossed size={22} className="animate-pulse text-orange-400" />
      <span className="text-sm">Carregando...</span>
    </div>
  );

  if (!activeMenu) return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4">
      <UtensilsCrossed size={44} className="text-gray-700" />
      <div>
        <p className="text-base font-bold text-gray-300">Nenhum cardápio disponível</p>
        <p className="text-xs text-gray-600 mt-1">O cardápio ainda não foi cadastrado pela gestão.</p>
      </div>
    </div>
  );

  const weekLabel = isWeekly
    ? `Semana ${fmtBR(activeMenu.weekStart)} a ${fmtBR(activeMenu.weekEnd)}`
    : activeMenu.dataUnica ? `Dia ${fmtBR(activeMenu.dataUnica)}` : '';

  const hasTodayNewSel = selections[todayKey].misturas.length > 0 || selections[todayKey].guarnicoes.length > 0;

  // ── Sub-renderers ───────────────────────────────────────────────────────────
  const renderDayForm = (day: DayKey) => (
    <div className="space-y-4">
      {(['misturas', 'guarnicoes'] as const).map(cat => {
        const opts  = cat === 'misturas' ? meatOpts : sideOpts;
        const emoji = cat === 'misturas' ? '🥩' : '🥗';
        const label = cat === 'misturas' ? 'Misturas' : 'Guarnições';
        const sel   = selections[day][cat];
        const colorSel   = cat === 'misturas' ? 'bg-orange-500 border-orange-500' : 'bg-green-600 border-green-600';
        const colorLabel = cat === 'misturas' ? 'text-orange-400' : 'text-green-400';
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold uppercase tracking-wide ${colorLabel}`}>{emoji} {label}</span>
              <span className="text-xs text-gray-600">até {MAX_PER_CATEGORY}</span>
              {sel.length > 0 && <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${cat === 'misturas' ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'}`}>{sel.length}/{MAX_PER_CATEGORY} ✓</span>}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {opts.map(p => {
                const selected = sel.includes(p.id);
                const blocked  = !selected && sel.length >= MAX_PER_CATEGORY;
                return (
                  <button key={p.id} onClick={() => toggleItem(day, cat, p.id)} disabled={blocked}
                    className={`flex items-center gap-3 w-full text-left px-3 py-3 rounded-xl border-2 transition-all text-sm font-medium ${selected ? `${colorSel} text-white` : blocked ? 'bg-gray-800/40 border-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-800 border-gray-700 text-gray-200 active:border-gray-500'}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selected ? 'bg-white border-white' : 'border-gray-600'}`}>
                      {selected && <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke={cat === 'misturas' ? '#f97316' : '#16a34a'} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    </div>
                    {p.nome}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {/* Tamanho */}
      <div>
        <span className="text-xs font-bold text-purple-400 uppercase tracking-wide mb-2 block">📦 Tamanho</span>
        <div className="flex gap-2">
          {SIZES.map(sz => (
            <button key={sz.value} onClick={() => setSizes(prev => ({ ...prev, [day]: sz.value }))}
              className={`flex-1 flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border-2 transition-all ${sizes[day] === sz.value ? 'border-purple-500 bg-purple-500/20 text-purple-300' : 'border-gray-700 text-gray-500 active:border-gray-600'}`}>
              <span className="text-base">{sz.emoji}</span>
              <span className="text-xs font-bold">{sz.label}</span>
            </button>
          ))}
        </div>
      </div>
      {/* Observação */}
      <div>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">✏️ Observação (opcional)</label>
        <textarea value={notes[day]} onChange={e => setNotes(prev => ({ ...prev, [day]: e.target.value }))}
          placeholder="Ex: sem feijão, mais arroz, sem cebola..." maxLength={120} rows={2}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 resize-none" />
        {notes[day].length > 0 && <p className="text-[10px] text-gray-600 text-right mt-0.5">{notes[day].length}/120</p>}
      </div>
    </div>
  );

  const renderEditPanel = (day: DayKey, onCancel: () => void, onSave: () => void, saving: boolean) => {
    const dc = existingChoice?.escolhas[day] as LunchDayChoice | null | undefined;
    const removedM = dc?.misturas?.filter(m => !dishIds.has(m.id)) ?? [];
    const removedG = dc?.guarnicoes?.filter(g => !dishIds.has(g.id)) ?? [];
    return (
      <div className="mt-2 space-y-3 bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
        {(removedM.length > 0 || removedG.length > 0) && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
            <p className="text-[10px] font-bold text-red-400 mb-1.5">⚠️ Itens removidos do cardápio:</p>
            <div className="flex flex-wrap gap-1">
              {removedM.map(m => <span key={m.id} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 line-through">🥩 {m.nome}</span>)}
              {removedG.map(g => <span key={g.id} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 line-through">🥗 {g.nome}</span>)}
            </div>
          </div>
        )}
        {(['misturas', 'guarnicoes'] as const).map(cat => {
          const opts = cat === 'misturas' ? meatOpts : sideOpts;
          const colorSel = cat === 'misturas' ? 'bg-orange-500 border-orange-500' : 'bg-green-600 border-green-600';
          const label = cat === 'misturas' ? '🥩 Misturas' : '🥗 Guarnições';
          return (
            <div key={cat}>
              <span className={`text-xs font-bold uppercase tracking-wide mb-1.5 block ${cat === 'misturas' ? 'text-orange-400' : 'text-green-400'}`}>{label}</span>
              <div className="grid grid-cols-1 gap-1.5">
                {opts.map(p => {
                  const sel = editSel[cat].includes(p.id);
                  const blocked = !sel && editSel[cat].length >= MAX_PER_CATEGORY;
                  return (
                    <button key={p.id} onClick={() => toggleEditItem(cat, p.id)} disabled={blocked}
                      className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border-2 text-sm ${sel ? `${colorSel} text-white` : blocked ? 'bg-gray-800/30 border-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-800 border-gray-700 text-gray-300'}`}>
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${sel ? 'bg-white border-white' : 'border-gray-600'}`} />
                      {p.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="flex gap-2">
          <button onClick={() => setSizes(prev => ({ ...prev, [day]: 'pequena' }))} className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold ${sizes[day]==='pequena'?'border-purple-500 bg-purple-500/20 text-purple-300':'border-gray-700 text-gray-500'}`}>🥣 Pequena</button>
          <button onClick={() => setSizes(prev => ({ ...prev, [day]: 'media' }))} className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold ${sizes[day]==='media'?'border-purple-500 bg-purple-500/20 text-purple-300':'border-gray-700 text-gray-500'}`}>🍛 Média</button>
          <button onClick={() => setSizes(prev => ({ ...prev, [day]: 'grande' }))} className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold ${sizes[day]==='grande'?'border-purple-500 bg-purple-500/20 text-purple-300':'border-gray-700 text-gray-500'}`}>🍲 Grande</button>
        </div>
        <textarea value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Observação..." maxLength={120} rows={2}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none resize-none" />
        <div className="flex gap-2">
          <button onClick={onSave} disabled={saving} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
            {saving ? 'Salvando...' : '✓ Salvar'}
          </button>
          <button onClick={onCancel} disabled={saving} className="px-4 py-2.5 bg-gray-800 text-gray-400 rounded-xl text-sm">Cancelar</button>
        </div>
      </div>
    );
  };

  return (
    <div className="overflow-y-auto h-full px-4 py-4 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-black text-white flex items-center gap-2">
          <UtensilsCrossed size={18} className="text-orange-400" /> Meu Almoço
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">{weekLabel}</p>
      </div>

      {/* Banner itens indisponíveis */}
      {todayChoice && todayHasUnavailable && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-300">Itens indisponíveis no seu pedido</p>
            <p className="text-xs text-red-400 mt-0.5">Altere sua escolha de hoje antes de enviar a localização.</p>
          </div>
        </div>
      )}

      {/* ══ Almoço de hoje ══ */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-orange-300">🍽️ Hoje — {DAY_LABELS[todayKey]}</p>
            <p className={`text-xs mt-0.5 flex items-center gap-1 ${isPastDeadline ? 'text-red-400' : 'text-orange-400'}`}>
              <Clock size={10} />
              {isPastDeadline ? `⚠️ Prazo encerrado (${horarioLimite})` : `Altere até as ${horarioLimite}`}
            </p>
          </div>
        </div>
        <div className="p-4">
          {todayChoice ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {todayChoice.misturas?.map(m => {
                  const unavail = !dishIds.has(m.id);
                  return <span key={m.id} className={`text-xs px-2.5 py-1 rounded-full ${unavail ? 'bg-red-500/20 text-red-400 line-through' : 'bg-orange-500/20 text-orange-300'}`}>🥩 {m.nome}</span>;
                })}
                {todayChoice.guarnicoes?.map(g => {
                  const unavail = !dishIds.has(g.id);
                  return <span key={g.id} className={`text-xs px-2.5 py-1 rounded-full ${unavail ? 'bg-red-500/20 text-red-400 line-through' : 'bg-green-500/20 text-green-300'}`}>🥗 {g.nome}</span>;
                })}
                {todayChoice.tamanho && <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300">📦 {todayChoice.tamanho}</span>}
              </div>
              {todayChoice.observacao && (
                <p className="text-xs text-gray-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                  ✏️ {todayChoice.observacao}
                </p>
              )}
              {editingDay === todayKey
                ? renderEditPanel(todayKey, () => setEditingDay(null), handleSaveEdit, savingEdit)
                : !isDayLocked(todayKey) && (
                  <button onClick={() => openEditDay(todayKey)}
                    className="flex items-center gap-1.5 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 active:bg-blue-500/20">
                    <Pencil size={11} /> Editar pedido de hoje
                  </button>
                )
              }
            </div>
          ) : isDayLocked(todayKey) ? (
            <div className="flex flex-col items-center text-center gap-3 py-6">
              <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <Clock size={24} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-red-300">Pedidos encerrados</p>
                <p className="text-xs text-gray-500 mt-1 max-w-xs">
                  O horário limite ({horarioLimite}) para pedir o almoço de hoje já passou.
                  Fale com a gestão se precisar de algo.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {renderDayForm(todayKey)}
              <button onClick={handleSubmitToday} disabled={submittingToday || !hasTodayNewSel}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-orange-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed active:bg-orange-600">
                <Send size={15} /> {submittingToday ? 'Confirmando...' : 'Confirmar pedido de hoje'}
              </button>
              {!hasTodayNewSel && <p className="text-center text-xs text-gray-600">Selecione ao menos 1 item</p>}
            </div>
          )}
        </div>
      </div>

      {/* ══ Semana completa / diário ══ */}
      {isWeekly ? (
        !showWeekForm ? (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Calendar size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-blue-300">📅 Cardápio semanal disponível</p>
                <p className="text-xs text-blue-400 mt-0.5">Quer adiantar suas escolhas de segunda a sexta?</p>
              </div>
            </div>
            <button onClick={() => setShowWeekForm(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 border border-blue-500/30 text-blue-300 bg-blue-500/10 rounded-xl font-semibold text-sm active:bg-blue-500/20">
              <Calendar size={14} /> Pré-cadastrar semana completa
            </button>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-3 flex items-center justify-between">
              <p className="text-sm font-bold text-blue-300 flex items-center gap-2"><Calendar size={14} /> Semana completa</p>
              <button onClick={() => setShowWeekForm(false)} className="p-1 text-gray-500"><X size={15} /></button>
            </div>
            <div className="divide-y divide-gray-800">
              {DAY_KEYS.map(day => {
                const locked  = isDayLocked(day);
                const isToday = day === todayKey;
                return (
                  <div key={day} className={`px-4 py-4 ${locked && !isToday ? 'opacity-40' : ''}`}>
                    <p className="text-sm font-bold text-white mb-3">
                      📅 {DAY_LABELS[day]} {isToday && <span className="text-xs text-orange-400 font-normal">(hoje)</span>}
                    </p>
                    {locked && !isToday
                      ? <p className="text-xs text-gray-600">⏰ Prazo encerrado</p>
                      : renderDayForm(day)}
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-4 border-t border-gray-800">
              <button onClick={handleSubmitWeek} disabled={submittingWeek}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 active:bg-blue-700">
                <Send size={15} /> {submittingWeek ? 'Salvando...' : 'Salvar semana completa'}
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-2.5">
          <Info size={15} className="text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-300">Apenas cardápio do dia disponível.</p>
        </div>
      )}

      {/* ══ Localização ══ */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <MapPin size={15} className="text-orange-400" />
            <p className="text-sm font-bold text-orange-300">Localização de hoje</p>
          </div>
          <p className={`text-xs mt-0.5 flex items-center gap-1 ${isPastDeadline ? 'text-red-400' : 'text-orange-400'}`}>
            <Clock size={10} />
            {isPastDeadline ? `⚠️ Prazo (${horarioLimite}) encerrado` : `Informe até as ${horarioLimite}`}
          </p>
        </div>

        {todayHasUnavailable ? (
          <div className="p-5 text-center">
            <AlertTriangle size={24} className="text-red-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-300">Localização bloqueada</p>
            <p className="text-xs text-gray-600 mt-1">Corrija seu pedido de hoje primeiro.</p>
          </div>
        ) : todayLocation ? (
          <div className="p-4 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={24} className="text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-white">Localização informada!</p>
            <div className="inline-flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5">
              {todayLocation.tipo === 'sede'       && <Building2 size={15} className="text-blue-400" />}
              {todayLocation.tipo === 'campo'      && <MapPin    size={15} className="text-green-400" />}
              {todayLocation.tipo === 'fora_cidade'&& <Plane     size={15} className="text-orange-400" />}
              <span className="text-sm text-gray-300">
                {todayLocation.tipo === 'sede'        && `${sedeNome}`}
                {todayLocation.tipo === 'campo'       && `Em Campo${todayLocation.endereco ? ` — ${todayLocation.endereco}` : ''}`}
                {todayLocation.tipo === 'fora_cidade' && 'Fora da Cidade'}
              </span>
            </div>
            <p className="text-xs text-gray-600">
              {todayLocation.informadoEm?.toDate?.()?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || '—'}
            </p>
            {!isPastDeadline && (
              <button onClick={handleResetLocation}
                className="flex items-center gap-2 mx-auto px-4 py-2 text-xs font-medium text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                <Pencil size={12} /> Alterar localização
              </button>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {/* Aviso */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-relaxed">
                <strong>Atenção:</strong> Se estiver fora da cidade e não informar, sua marmita será pedida e você perderá o vale-alimentação.
              </p>
            </div>

            <p className="text-sm text-gray-400 font-medium">Onde você vai almoçar hoje?</p>

            {/* Em campo */}
            <div className={`rounded-xl border-2 transition-all ${locType === 'campo' ? 'border-green-500/50 bg-green-500/5' : 'border-gray-800'}`}>
              <button onClick={() => setLocType('campo')} className="w-full p-4 flex items-center gap-3 text-left">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${locType === 'campo' ? 'bg-green-500 text-white' : 'bg-green-500/20 text-green-400'}`}>
                  <MapPin size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-200">📍 Estou em campo</p>
                  <p className="text-xs text-gray-500">Informar endereço e cliente</p>
                </div>
              </button>
              {locType === 'campo' && (
                <div className="px-4 pb-4 space-y-3 border-t border-green-500/20 pt-3">
                  <button onClick={handleGetGPS} disabled={gettingGPS}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-60">
                    <Navigation size={14} /> {gettingGPS ? 'Obtendo GPS...' : 'Usar minha localização atual'}
                  </button>
                  {coords && <p className="text-[11px] text-emerald-400">📍 GPS capturado</p>}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Endereço</label>
                    <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                      placeholder="Rua, número, bairro, cidade..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Nome do cliente</label>
                    <input type="text" value={clientName} onChange={e => setClientName(e.target.value)}
                      placeholder="Ex: Supermercado Bom Preço"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500" />
                  </div>
                  <button onClick={() => handleSubmitLocation('campo')} disabled={submittingLoc || (!address && !clientName)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 active:bg-green-700">
                    <Send size={14} /> {submittingLoc ? 'Enviando...' : 'Confirmar localização'}
                  </button>
                </div>
              )}
            </div>

            {/* Na sede */}
            <button onClick={() => handleSubmitLocation('sede')} disabled={submittingLoc}
              className="w-full rounded-xl border-2 border-gray-800 p-4 flex items-center gap-3 active:bg-gray-800/60">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Building2 size={18} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-gray-200">🏢 Vou almoçar na sede</p>
                <p className="text-xs text-gray-500">{sedeNome}{sedeEndereco ? ` — ${sedeEndereco}` : ''}</p>
              </div>
              <ArrowRight size={15} className="text-gray-600" />
            </button>

            {/* Fora da cidade */}
            <div className={`rounded-xl border-2 transition-all ${showForaConfirm ? 'border-orange-500/40 bg-orange-500/5' : 'border-gray-800'}`}>
              <button onClick={() => setShowForaConfirm(!showForaConfirm)} className="w-full p-4 flex items-center gap-3 text-left">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${showForaConfirm ? 'bg-orange-500 text-white' : 'bg-orange-500/20 text-orange-400'}`}>
                  <Plane size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-200">✈️ Estou fora da cidade</p>
                  <p className="text-xs text-gray-500">Marmita não será pedida, receberá vale</p>
                </div>
                <ChevronDown size={15} className={`text-gray-600 transition-transform ${showForaConfirm ? 'rotate-180' : ''}`} />
              </button>
              {showForaConfirm && (
                <div className="px-4 pb-4 border-t border-orange-500/20 pt-3 space-y-3">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                    <p className="text-xs text-red-300 font-bold mb-1">Ao confirmar:</p>
                    <ul className="text-xs text-red-400 list-disc ml-4 space-y-0.5">
                      <li>Sua marmita <strong>NÃO será pedida</strong> hoje</li>
                      <li>Você receberá o <strong>vale-alimentação do dia</strong></li>
                    </ul>
                  </div>
                  <button onClick={() => handleSubmitLocation('fora_cidade')} disabled={submittingLoc}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-orange-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 active:bg-orange-700">
                    <Plane size={14} /> {submittingLoc ? 'Enviando...' : 'Confirmar — Fora da Cidade'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
