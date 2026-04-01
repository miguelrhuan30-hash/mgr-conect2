import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection, query, where, onSnapshot, deleteDoc,
  setDoc, Timestamp, limit, doc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  CollectionName, LunchMenu, LunchMenuMode, LunchChoice, LunchDayChoice,
  LunchLocation, LunchLocationType, LunchConfig, MarmitaSize,
} from '../types';
import {
  UtensilsCrossed, CheckCircle2, MapPin, Building2, Plane,
  AlertTriangle, Pencil, Send, ArrowRight, Clock,
  ChevronDown, Map as MapIcon, Calendar, X, Info,
} from 'lucide-react';
import GoogleMapPicker, { MapPickerResult } from './GoogleMapPicker';

/* ═══════════════════ HELPERS ═══════════════════ */
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
  { value: 'media', label: 'Média', emoji: '🍛' },
  { value: 'grande', label: 'Grande', emoji: '🍲' },
];
const fmtBR = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

/* ═══════════════════ COMPONENT ═══════════════════ */
const MyLunch: React.FC = () => {
  const { currentUser, userProfile } = useAuth();

  const [activeMenu, setActiveMenu] = useState<LunchMenu | null>(null);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [existingChoice, setExistingChoice] = useState<LunchChoice | null>(null);
  const [loadingChoice, setLoadingChoice] = useState(true);

  const [selections, setSelections] = useState<Record<DayKey, DaySelection>>({
    segunda: emptyDay(), terca: emptyDay(), quarta: emptyDay(), quinta: emptyDay(), sexta: emptyDay(),
  });
  const [sizes, setSizes] = useState<Record<DayKey, MarmitaSize>>({
    segunda: 'media', terca: 'media', quarta: 'media', quinta: 'media', sexta: 'media',
  });
  const [submittingToday, setSubmittingToday] = useState(false);
  const [submittingWeek, setSubmittingWeek] = useState(false);
  const [showWeekForm, setShowWeekForm] = useState(false);

  const [editingDay, setEditingDay] = useState<DayKey | null>(null);
  const [editSel, setEditSel] = useState<DaySelection>(emptyDay());
  const [savingEdit, setSavingEdit] = useState(false);

  const [todayLocation, setTodayLocation] = useState<LunchLocation | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [locType, setLocType] = useState<LunchLocationType | ''>('');
  const [address, setAddress] = useState('');
  const [clientName, setClientName] = useState('');
  const [gettingGPS, setGettingGPS] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [submittingLoc, setSubmittingLoc] = useState(false);
  const [showForaConfirm, setShowForaConfirm] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const [sedeNome, setSedeNome] = useState('Sede MGR');
  const [sedeEndereco, setSedeEndereco] = useState('');
  const [horarioLimite, setHorarioLimite] = useState('10:00');

  const todayISO = new Date().toISOString().split('T')[0];
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const isPastDeadline = timeStr >= horarioLimite;
  const todayKey = todayDayKey();

  /* ─── Effects ─── */
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

  /* ─── Derived ─── */
  const meatOpts = useMemo(() => activeMenu?.pratos.filter(p => p.categoria === 'mistura') ?? [], [activeMenu]);
  const sideOpts = useMemo(() => activeMenu?.pratos.filter(p => p.categoria === 'guarnicao') ?? [], [activeMenu]);
  const dishIds = useMemo(() => new Set(activeMenu?.pratos.map(p => p.id) ?? []), [activeMenu]);
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

  /* ─── Helpers ─── */
  const buildDayChoice = (day: DayKey): LunchDayChoice => ({
    misturas: selections[day].misturas.map(id => ({ id, nome: meatOpts.find(p => p.id === id)?.nome ?? id })),
    guarnicoes: selections[day].guarnicoes.map(id => ({ id, nome: sideOpts.find(p => p.id === id)?.nome ?? id })),
    tamanho: sizes[day],
  });

  const choiceDocId = () => `${currentUser!.uid}_${activeMenu!.id}`;

  const migrateOldDoc = (docId: string) => {
    if (existingChoice && existingChoice.id !== docId) {
      deleteDoc(doc(db, CollectionName.LUNCH_CHOICES, existingChoice.id)).catch(() => {});
    }
  };

  const baseChoiceDoc = () => ({
    menuId: activeMenu!.id,
    userId: currentUser!.uid,
    userName: userProfile?.nomeCompleto || userProfile?.displayName || '',
    userSector: userProfile?.sectorName || '',
  });

  /* ─── Submit today ─── */
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
    } catch { alert('Erro ao salvar. Tente novamente.'); }
    finally { setSubmittingToday(false); }
  };

  /* ─── Submit full week ─── */
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
      setShowWeekForm(false);
    } catch { alert('Erro ao salvar. Tente novamente.'); }
    finally { setSubmittingWeek(false); }
  };

  const toggleItem = (day: DayKey, cat: 'misturas' | 'guarnicoes', id: string) => {
    setSelections(prev => {
      const s = { ...prev[day] }; const arr = [...s[cat]]; const i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1); else { if (arr.length >= MAX_PER_CATEGORY) return prev; arr.push(id); }
      return { ...prev, [day]: { ...s, [cat]: arr } };
    });
  };

  const openEditDay = (day: DayKey) => {
    if (!existingChoice) return;
    const dc = existingChoice.escolhas[day] as LunchDayChoice | null | undefined;
    setEditSel({
      misturas: dc?.misturas?.filter(m => dishIds.has(m.id)).map(m => m.id) ?? [],
      guarnicoes: dc?.guarnicoes?.filter(g => dishIds.has(g.id)).map(g => g.id) ?? [],
    });
    setEditingDay(day);
  };

  const toggleEditItem = (cat: 'misturas' | 'guarnicoes', id: string) => {
    setEditSel(prev => {
      const arr = [...prev[cat]]; const i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1); else { if (arr.length >= MAX_PER_CATEGORY) return prev; arr.push(id); }
      return { ...prev, [cat]: arr };
    });
  };

  const handleSaveEdit = async () => {
    if (!existingChoice || !editingDay || !currentUser || !activeMenu) return;
    setSavingEdit(true);
    try {
      const dc: LunchDayChoice = {
        misturas: editSel.misturas.map(id => ({ id, nome: meatOpts.find(p => p.id === id)?.nome ?? id })),
        guarnicoes: editSel.guarnicoes.map(id => ({ id, nome: sideOpts.find(p => p.id === id)?.nome ?? id })),
        tamanho: sizes[editingDay],
      };
      const hasAny = dc.misturas.length > 0 || dc.guarnicoes.length > 0;
      const docId = choiceDocId();
      await setDoc(doc(db, CollectionName.LUNCH_CHOICES, docId), {
        ...baseChoiceDoc(),
        escolhas: { ...(existingChoice.escolhas ?? {}), [editingDay]: hasAny ? dc : null },
        enviadoEm: existingChoice.enviadoEm ?? Timestamp.now(),
        atualizadoEm: Timestamp.now(),
      });
      migrateOldDoc(docId);
      setEditingDay(null);
    } catch { alert('Erro ao salvar.'); }
    finally { setSavingEdit(false); }
  };

  const handleGetGPS = () => {
    if (!navigator.geolocation) { alert('Geolocalização não suportada.'); return; }
    setGettingGPS(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`);
          const d = await r.json(); if (d.display_name) setAddress(d.display_name);
        } catch { }
        setGettingGPS(false);
      },
      () => { alert('Não foi possível obter localização.'); setGettingGPS(false); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const handleSubmitLocation = async (tipo: LunchLocationType) => {
    if (!currentUser || !userProfile) return;
    setSubmittingLoc(true);
    try {
      const d: Record<string, any> = {
        userId: currentUser.uid, userName: userProfile.nomeCompleto || userProfile.displayName || '',
        userSector: userProfile.sectorName || '', data: todayISO, tipo,
        informadoEm: Timestamp.now(), menuId: activeMenu?.id || '',
      };
      if (tipo === 'campo') { if (address) d.endereco = address; if (clientName) d.clienteNome = clientName; if (coords) d.coordenadas = coords; }
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

  /* ══════════════════════ RENDER ══════════════════════ */
  if (loadingMenu || loadingChoice || loadingLocation) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex items-center gap-3 text-gray-400">
        <UtensilsCrossed size={24} className="animate-pulse" /><span className="text-sm">Carregando...</span>
      </div>
    </div>
  );

  if (!activeMenu) return (
    <div className="max-w-lg mx-auto mt-12">
      <div className="text-center bg-white rounded-2xl border border-gray-200 shadow-sm p-10 space-y-4">
        <UtensilsCrossed size={48} className="mx-auto text-gray-300" />
        <h2 className="text-xl font-bold text-gray-800">Nenhum cardápio disponível</h2>
        <p className="text-gray-500 text-sm">O cardápio ainda não foi cadastrado pela gestão.</p>
      </div>
    </div>
  );

  const weekLabel = isWeekly
    ? `Semana ${fmtBR(activeMenu.weekStart)} a ${fmtBR(activeMenu.weekEnd)}`
    : activeMenu.dataUnica ? `Dia ${fmtBR(activeMenu.dataUnica)}` : '';

  const hasTodayNewSel = selections[todayKey].misturas.length > 0 || selections[todayKey].guarnicoes.length > 0;

  /* ─── Inline edit panel (reused for today and week form days) ─── */
  const renderEditPanel = (day: DayKey, onCancel: () => void, onSave: () => void, saving: boolean) => {
    const dc = existingChoice?.escolhas[day] as LunchDayChoice | null | undefined;
    const removedM = dc?.misturas?.filter(m => !dishIds.has(m.id)) ?? [];
    const removedG = dc?.guarnicoes?.filter(g => !dishIds.has(g.id)) ?? [];
    return (
      <div className="mt-2 space-y-3 bg-blue-50/50 border border-blue-200 rounded-xl p-3">
        {(removedM.length > 0 || removedG.length > 0) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
            <p className="text-[10px] font-bold text-red-700 mb-1.5">⚠️ Itens removidos do cardápio:</p>
            <div className="flex flex-wrap gap-1">
              {removedM.map(m => <span key={m.id} className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 line-through">🥩 {m.nome}</span>)}
              {removedG.map(g => <span key={g.id} className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 line-through">🥗 {g.nome}</span>)}
            </div>
          </div>
        )}
        {(['misturas', 'guarnicoes'] as const).map(cat => {
          const opts = cat === 'misturas' ? meatOpts : sideOpts;
          const color = cat === 'misturas' ? 'orange' : 'green';
          const label = cat === 'misturas' ? '🥩 Misturas' : '🥗 Guarnições';
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-xs font-bold text-${color}-600 uppercase tracking-wide`}>{label}</span>
                <span className="text-xs text-gray-400">até {MAX_PER_CATEGORY}</span>
                {editSel[cat].length > 0 && <span className={`ml-auto text-[10px] font-bold bg-${color}-100 text-${color}-700 px-1.5 py-0.5 rounded-full`}>{editSel[cat].length}/{MAX_PER_CATEGORY} ✓</span>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {opts.map(p => {
                  const sel = editSel[cat].includes(p.id);
                  const blocked = !sel && editSel[cat].length >= MAX_PER_CATEGORY;
                  return (
                    <button key={p.id} onClick={() => toggleEditItem(cat, p.id)} disabled={blocked}
                      className={`flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all text-sm ${sel ? `bg-${color}-500 border-${color}-500 text-white` : blocked ? 'bg-gray-50 border-gray-100 text-gray-300 opacity-50 cursor-not-allowed' : `bg-white border-gray-200 text-gray-800 hover:border-${color}-300 hover:bg-${color}-50`}`}>
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${sel ? 'bg-white border-white' : 'border-gray-300'}`}>
                        {sel && <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className={`text-${color}-500`}><polyline points="20 6 9 17 4 12" /></svg>}
                      </div>
                      <span className="font-medium leading-tight">{p.nome}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="pt-1">
          <span className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-2 block">📦 Tamanho</span>
          <div className="flex gap-2">
            {SIZES.map(sz => (
              <button key={sz.value} onClick={() => setSizes(prev => ({ ...prev, [day]: sz.value }))}
                className={`flex-1 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border-2 transition-all ${sizes[day] === sz.value ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600 hover:border-purple-300'}`}>
                <span className="text-base">{sz.emoji}</span><span className="text-xs font-bold">{sz.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onSave} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-bold">
            {saving ? 'Salvando...' : '✓ Salvar Alteração'}
          </button>
          <button onClick={onCancel} disabled={saving} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm">Cancelar</button>
        </div>
      </div>
    );
  };

  /* ─── Day selection form (for new choices) ─── */
  const renderDayForm = (day: DayKey) => (
    <div className="space-y-4">
      {(['misturas', 'guarnicoes'] as const).map(cat => {
        const opts = cat === 'misturas' ? meatOpts : sideOpts;
        const color = cat === 'misturas' ? 'orange' : 'green';
        const label = cat === 'misturas' ? '🥩 Misturas' : '🥗 Guarnições';
        const sel = selections[day][cat];
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold text-${color}-600 uppercase tracking-wide`}>{label}</span>
              <span className="text-xs text-gray-400">até {MAX_PER_CATEGORY}</span>
              {sel.length > 0 && <span className={`ml-auto text-[10px] font-bold bg-${color}-100 text-${color}-700 px-1.5 py-0.5 rounded-full`}>{sel.length}/{MAX_PER_CATEGORY} ✓</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {opts.map(p => {
                const selected = sel.includes(p.id);
                const blocked = !selected && sel.length >= MAX_PER_CATEGORY;
                return (
                  <button key={p.id} onClick={() => toggleItem(day, cat, p.id)} disabled={blocked}
                    className={`flex items-center gap-3 w-full text-left px-3 py-3 rounded-xl border-2 transition-all ${selected ? `bg-${color}-500 border-${color}-500 text-white shadow-sm` : blocked ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed opacity-50' : `bg-white border-gray-200 text-gray-800 hover:border-${color}-300 hover:bg-${color}-50`}`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selected ? 'bg-white border-white' : 'border-gray-300'}`}>
                      {selected && <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className={`text-${color}-500`}><polyline points="20 6 9 17 4 12" /></svg>}
                    </div>
                    <span className="text-sm font-medium leading-tight">{p.nome}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div>
        <span className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-2 block">📦 Tamanho da Marmita</span>
        <div className="flex gap-2">
          {SIZES.map(sz => (
            <button key={sz.value} onClick={() => setSizes(prev => ({ ...prev, [day]: sz.value }))}
              className={`flex-1 flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border-2 transition-all ${sizes[day] === sz.value ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm' : 'border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50/30'}`}>
              <span className="text-lg">{sz.emoji}</span><span className="text-xs font-bold">{sz.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <UtensilsCrossed className="text-orange-500" /> Meu Almoço
        </h1>
        <p className="text-gray-500 text-sm mt-1">{weekLabel}</p>
      </div>

      {/* ⚠️ Unavailability banner */}
      {todayChoice && todayHasUnavailable && (
        <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={22} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-800">Alguns itens da sua escolha não estão mais disponíveis</p>
            <p className="text-xs text-red-700 mt-1">Por favor altere sua escolha de hoje antes de enviar sua localização.</p>
          </div>
        </div>
      )}

      {/* ═══ SECTION 1: Today's food choice ═══ */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-orange-50 px-5 py-3 border-b border-orange-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-orange-800">🍽️ Seu almoço de hoje — {DAY_LABELS[todayKey]}</h3>
            <p className="text-xs text-orange-600 mt-0.5 flex items-center gap-1">
              <Clock size={11} />
              {isPastDeadline ? <span className="text-red-600">⚠️ Prazo encerrado ({horarioLimite})</span> : `Altere até as ${horarioLimite}`}
            </p>
          </div>
        </div>
        <div className="p-5">
          {todayChoice ? (
            /* ── Summary of today's existing choice ── */
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {todayChoice.misturas?.map(m => {
                  const unavail = !dishIds.has(m.id);
                  return <span key={m.id} className={`text-xs px-2.5 py-1 rounded-full ${unavail ? 'bg-red-100 text-red-700 border border-red-300 line-through' : 'bg-orange-100 text-orange-800 border border-orange-200'}`}>{unavail ? '⚠️' : '🥩'} {m.nome}{unavail && <span className="ml-1 text-[9px] font-bold no-underline">INDISPONÍVEL</span>}</span>;
                })}
                {todayChoice.guarnicoes?.map(g => {
                  const unavail = !dishIds.has(g.id);
                  return <span key={g.id} className={`text-xs px-2.5 py-1 rounded-full ${unavail ? 'bg-red-100 text-red-700 border border-red-300 line-through' : 'bg-green-100 text-green-800 border border-green-200'}`}>{unavail ? '⚠️' : '🥗'} {g.nome}{unavail && <span className="ml-1 text-[9px] font-bold no-underline">INDISPONÍVEL</span>}</span>;
                })}
                {todayChoice.tamanho && <span className="text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 border border-purple-200">📦 {todayChoice.tamanho}</span>}
              </div>
              {editingDay === todayKey ? (
                renderEditPanel(todayKey, () => setEditingDay(null), handleSaveEdit, savingEdit)
              ) : (
                !isDayLocked(todayKey) && (
                  <button onClick={() => openEditDay(todayKey)} className="flex items-center gap-1.5 text-xs text-blue-600 font-medium bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors">
                    <Pencil size={11} /> Editar meu almoço de hoje
                  </button>
                )
              )}
            </div>
          ) : (
            /* ── New selection form for today ── */
            <div className="space-y-4">
              {renderDayForm(todayKey)}
              <button onClick={handleSubmitToday} disabled={submittingToday || !hasTodayNewSel}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm shadow-sm active:scale-[0.98] transition-all">
                <Send size={16} /> {submittingToday ? 'Confirmando...' : 'Confirmar pedido de hoje'}
              </button>
              {!hasTodayNewSel && <p className="text-center text-xs text-gray-400">Selecione ao menos 1 item</p>}
            </div>
          )}
        </div>
      </div>

      {/* ═══ SECTION 2: Weekly pre-register OR daily notice ═══ */}
      {isWeekly ? (
        !showWeekForm ? (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <Calendar size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-blue-800">📅 Cardápio semanal disponível!</p>
                <p className="text-xs text-blue-700 mt-1">Quer adiantar suas escolhas de segunda a sexta?</p>
              </div>
            </div>
            <button onClick={() => setShowWeekForm(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-blue-300 text-blue-700 bg-white rounded-xl hover:bg-blue-50 font-semibold text-sm transition-colors">
              <Calendar size={15} /> Pré-cadastrar semana completa
              <span className="text-xs font-normal text-blue-500">(opcional)</span>
            </button>
          </div>
        ) : (
          /* ── Expanded week form ── */
          <div className="bg-white rounded-2xl border border-blue-200 shadow-sm overflow-hidden">
            <div className="bg-blue-50 px-5 py-3 border-b border-blue-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2"><Calendar size={16} /> Escolha para toda a semana</h3>
              <button onClick={() => setShowWeekForm(false)} className="p-1 text-blue-400 hover:text-blue-600 rounded-lg"><X size={16} /></button>
            </div>
            <div className="divide-y divide-gray-100">
              {DAY_KEYS.map(day => {
                const locked = isDayLocked(day);
                const sel = selections[day];
                const isToday = day === todayKey;
                return (
                  <div key={day} className={`px-5 py-4 ${locked && !isToday ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-gray-800">
                        📅 {DAY_LABELS[day]} {isToday && <span className="ml-1 text-xs text-orange-500 font-normal">(hoje)</span>}
                      </p>
                      {(sel.misturas.length > 0 || sel.guarnicoes.length > 0) && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{sel.misturas.length + sel.guarnicoes.length} item(s)</span>
                      )}
                    </div>
                    {locked && !isToday
                      ? <p className="text-xs text-gray-400">⏰ Prazo encerrado</p>
                      : renderDayForm(day)}
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
              <button onClick={handleSubmitWeek} disabled={submittingWeek}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bold text-sm shadow-sm">
                <Send size={16} /> {submittingWeek ? 'Salvando...' : 'Salvar semana completa'}
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Info size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">Apenas cardápio do dia disponível para escolha.</p>
        </div>
      )}

      {/* ═══ SECTION 3: Location ═══ */}
      <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden">
        <div className="bg-orange-50 px-5 py-4 border-b border-orange-100">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-orange-600" />
            <h3 className="text-sm font-bold text-orange-800">Informar Minha Localização — Hoje ({new Date().toLocaleDateString('pt-BR')})</h3>
          </div>
          <p className={`text-xs font-medium mt-1 ${isPastDeadline ? 'text-red-600' : 'text-orange-600'}`}>
            <Clock size={12} className="inline mr-1" />
            {isPastDeadline ? `⚠️ O prazo para informar (${horarioLimite}) já passou!` : `Informe até as ${horarioLimite}`}
          </p>
        </div>

        {todayHasUnavailable ? (
          /* Blocked — must fix food choice first */
          <div className="p-5 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <p className="text-sm font-bold text-gray-700">🔒 Localização bloqueada</p>
            <p className="text-xs text-gray-500 mt-1">Altere seu pedido de hoje antes de informar a localização.</p>
          </div>
        ) : (
          <div className="p-5">
            <div className="mx-0 mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>ATENÇÃO:</strong> Se estiver fora da cidade e <strong>NÃO informar</strong>, sua marmita será pedida normalmente e você <strong>perderá o direito ao vale-alimentação</strong>.
                </p>
              </div>
            </div>
            {todayLocation ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={28} className="text-green-600" />
                </div>
                <p className="text-sm font-bold text-gray-800">Localização já informada hoje!</p>
                <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
                  {todayLocation.tipo === 'sede' && <Building2 size={16} className="text-blue-600" />}
                  {todayLocation.tipo === 'campo' && <MapPin size={16} className="text-green-600" />}
                  {todayLocation.tipo === 'fora_cidade' && <Plane size={16} className="text-orange-600" />}
                  <span className="text-sm text-gray-700">
                    {todayLocation.tipo === 'sede' && `${sedeNome}${sedeEndereco ? ` — ${sedeEndereco}` : ''}`}
                    {todayLocation.tipo === 'campo' && `Em Campo — ${todayLocation.endereco || ''}${todayLocation.clienteNome ? ` • ${todayLocation.clienteNome}` : ''}`}
                    {todayLocation.tipo === 'fora_cidade' && 'Fora da Cidade (vale-alimentação)'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Informado às {todayLocation.informadoEm?.toDate?.()?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || '—'}
                </p>
                {!isPastDeadline && (
                  <button onClick={handleResetLocation} className="mt-2 flex items-center gap-2 mx-auto px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors">
                    <Pencil size={14} /> Reinformar Localização
                  </button>
                )}
              </div>
            ) : (
              <LocationForm
                locationType={locType} setLocationType={setLocType}
                address={address} setAddress={setAddress}
                clientName={clientName} setClientName={setClientName}
                gettingGPS={gettingGPS} handleGetLocation={handleGetGPS}
                showMapPicker={showMapPicker} setShowMapPicker={setShowMapPicker}
                coords={coords} setCoords={setCoords} setAddress2={setAddress}
                submittingLoc={submittingLoc}
                handleSubmitLocation={handleSubmitLocation}
                showForaCidadeConfirm={showForaConfirm}
                setShowForaCidadeConfirm={setShowForaConfirm}
                sedeNome={sedeNome} sedeEndereco={sedeEndereco}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   LOCATION FORM — sub-component (unchanged)
   ════════════════════════════════════════════════════════════════ */
interface LocationFormProps {
  locationType: LunchLocationType | ''; setLocationType: (t: LunchLocationType | '') => void;
  address: string; setAddress: (a: string) => void;
  clientName: string; setClientName: (c: string) => void;
  gettingGPS: boolean; handleGetLocation: () => void;
  showMapPicker: boolean; setShowMapPicker: (v: boolean) => void;
  coords: { lat: number; lng: number } | null;
  setCoords: (c: { lat: number; lng: number } | null) => void;
  setAddress2: (a: string) => void;
  submittingLoc: boolean;
  handleSubmitLocation: (tipo: LunchLocationType) => void;
  showForaCidadeConfirm: boolean; setShowForaCidadeConfirm: (v: boolean) => void;
  sedeNome: string; sedeEndereco: string;
}

const LocationForm: React.FC<LocationFormProps> = ({
  locationType, setLocationType, address, setAddress, clientName, setClientName,
  gettingGPS, handleGetLocation, showMapPicker, setShowMapPicker, coords, setCoords,
  setAddress2, submittingLoc, handleSubmitLocation, showForaCidadeConfirm,
  setShowForaCidadeConfirm, sedeNome, sedeEndereco,
}) => (
  <div className="space-y-4">
    <p className="text-sm text-gray-600 font-medium">Onde você vai almoçar hoje?</p>
    <div className="grid grid-cols-1 gap-3">
      <div className={`rounded-xl border-2 transition-all cursor-pointer ${locationType === 'campo' ? 'border-green-400 bg-green-50/50 shadow-sm' : 'border-gray-200 hover:border-green-300 hover:bg-green-50/30'}`} onClick={() => setLocationType('campo')}>
        <div className="flex items-center gap-3 p-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${locationType === 'campo' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-600'}`}><MapPin size={20} /></div>
          <div className="flex-1"><p className="text-sm font-bold text-gray-800">📍 Estou em campo</p><p className="text-xs text-gray-500">Informar endereço e nome do cliente</p></div>
          <CheckMark checked={locationType === 'campo'} />
        </div>
        {locationType === 'campo' && (
          <div className="px-4 pb-4 space-y-3 border-t border-green-100 pt-3">
            <button onClick={e => { e.stopPropagation(); setShowMapPicker(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium">
              <MapIcon size={14} /> Abrir Mapa para Localizar
            </button>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Endereço</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} onClick={e => e.stopPropagation()} placeholder="Rua, número, bairro, cidade..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nome do Cliente</label>
              <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} onClick={e => e.stopPropagation()} placeholder="Ex: Supermercado Bom Preço" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-300" />
            </div>
            <button onClick={e => { e.stopPropagation(); handleSubmitLocation('campo'); }} disabled={submittingLoc || (!address && !clientName)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-bold">
              <Send size={14} /> {submittingLoc ? 'Enviando...' : 'Confirmar Localização'}
            </button>
          </div>
        )}
        {showMapPicker && (
          <GoogleMapPicker initialLat={coords?.lat} initialLng={coords?.lng} title="Selecionar Localização em Campo"
            onConfirm={(data: MapPickerResult) => { setAddress2(data.address); setCoords({ lat: data.lat, lng: data.lng }); setShowMapPicker(false); }}
            onCancel={() => setShowMapPicker(false)} />
        )}
      </div>

      <button onClick={() => handleSubmitLocation('sede')} disabled={submittingLoc} className="rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 p-4 flex items-center gap-3 transition-all text-left">
        <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><Building2 size={20} /></div>
        <div className="flex-1"><p className="text-sm font-bold text-gray-800">🏢 Vou almoçar na sede</p><p className="text-xs text-gray-500">{sedeNome}{sedeEndereco ? ` — ${sedeEndereco}` : ''}</p></div>
        <ArrowRight size={16} className="text-gray-400" />
      </button>

      <div className={`rounded-xl border-2 transition-all ${showForaCidadeConfirm ? 'border-orange-400 bg-orange-50/50' : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/30'}`}>
        <button onClick={() => setShowForaCidadeConfirm(!showForaCidadeConfirm)} className="w-full p-4 flex items-center gap-3 text-left">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${showForaCidadeConfirm ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600'}`}><Plane size={20} /></div>
          <div className="flex-1"><p className="text-sm font-bold text-gray-800">✈️ Estou fora da cidade</p><p className="text-xs text-gray-500">Marmita não será pedida, receberá vale-alimentação</p></div>
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${showForaCidadeConfirm ? 'rotate-180' : ''}`} />
        </button>
        {showForaCidadeConfirm && (
          <div className="px-4 pb-4 border-t border-orange-100 pt-3 space-y-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-red-800 space-y-1">
                  <p className="font-bold">Ao confirmar "Fora da cidade":</p>
                  <ul className="list-disc ml-4 space-y-0.5"><li>Sua marmita <strong>NÃO será pedida</strong> hoje</li><li>Você receberá o <strong>vale-alimentação do dia</strong></li></ul>
                </div>
              </div>
            </div>
            <button onClick={() => handleSubmitLocation('fora_cidade')} disabled={submittingLoc} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-bold">
              <Plane size={14} /> {submittingLoc ? 'Enviando...' : 'Confirmar — Estou Fora da Cidade'}
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
);

const CheckMark: React.FC<{ checked: boolean }> = ({ checked }) => (
  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${checked ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>
    {checked && <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
  </div>
);

export default MyLunch;
