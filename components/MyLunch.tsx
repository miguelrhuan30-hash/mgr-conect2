import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, orderBy, onSnapshot, addDoc, getDocs,
  deleteDoc, updateDoc, setDoc, Timestamp, limit, doc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  CollectionName, LunchMenu, LunchDish, LunchChoice, LunchDayChoice,
  LunchLocation, LunchLocationType, LunchConfig, MarmitaSize,
} from '../types';
import {
  UtensilsCrossed, CheckCircle2, MapPin, Building2, Plane,
  AlertTriangle, Navigation, Pencil, Send, ArrowRight, Clock,
  Info, ChevronDown, Map as MapIcon,
} from 'lucide-react';
import GoogleMapPicker, { MapPickerResult } from './GoogleMapPicker';

/* ════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════ */

const DAY_KEYS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'] as const;
type DayKey = typeof DAY_KEYS[number];

const DAY_LABELS: Record<DayKey, string> = {
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
};

const MAX_PER_CATEGORY = 2;

/** Seleção de um dia: lista de IDs de misturas e guarnições escolhidas */
type DaySelection = { misturas: string[]; guarnicoes: string[] };

const emptyDaySelection = (): DaySelection => ({ misturas: [], guarnicoes: [] });

const MARMITA_SIZES: { value: MarmitaSize; label: string; emoji: string }[] = [
  { value: 'pequena', label: 'Pequena', emoji: '🥣' },
  { value: 'media',   label: 'Média',   emoji: '🍛' },
  { value: 'grande',  label: 'Grande',  emoji: '🍲' },
];

/* ════════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════════ */

const MyLunch: React.FC = () => {
  const { currentUser, userProfile } = useAuth();

  const [activeMenu, setActiveMenu] = useState<LunchMenu | null>(null);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [existingChoice, setExistingChoice] = useState<LunchChoice | null>(null);
  const [loadingChoice, setLoadingChoice] = useState(true);

  // Local selections: for each day, which mistura IDs and guarnicao IDs are chosen
  const [selections, setSelections] = useState<Record<DayKey, DaySelection>>({
    segunda: emptyDaySelection(), terca: emptyDaySelection(), quarta: emptyDaySelection(),
    quinta: emptyDaySelection(), sexta: emptyDaySelection(),
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [marmitaSizes, setMarmitaSizes] = useState<Record<DayKey, MarmitaSize>>({
    segunda: 'media', terca: 'media', quarta: 'media', quinta: 'media', sexta: 'media',
  });

  // Edit an existing day choice
  const [editingDay, setEditingDay] = useState<DayKey | null>(null);
  const [editSelections, setEditSelections] = useState<DaySelection>(emptyDaySelection());
  const [savingEdit, setSavingEdit] = useState(false);

  // Location
  const [todayLocation, setTodayLocation] = useState<LunchLocation | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [locationType, setLocationType] = useState<LunchLocationType | ''>('');
  const [address, setAddress] = useState('');
  const [clientName, setClientName] = useState('');
  const [gettingGPS, setGettingGPS] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [submittingLoc, setSubmittingLoc] = useState(false);
  const [showForaCidadeConfirm, setShowForaCidadeConfirm] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Sede config
  const [sedeNome, setSedeNome] = useState('Sede MGR');
  const [sedeEndereco, setSedeEndereco] = useState('');
  const [horarioLimite, setHorarioLimite] = useState('10:00');

  const todayISO = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  // Global (used for the location-today section only)
  const isPastDeadline = currentTimeStr >= horarioLimite;

  /**
   * Per-day deadline check:
   * - day already passed  → true  (can't edit)
   * - today               → check horarioLimite
   * - future day          → false (can edit)
   */
  const isDayPastDeadline = (day: DayKey): boolean => {
    if (!activeMenu) return true;
    const dayIndex = DAY_KEYS.indexOf(day);
    const dayDate = new Date(activeMenu.weekStart + 'T12:00:00');
    dayDate.setDate(dayDate.getDate() + dayIndex);
    const dayISO = dayDate.toISOString().split('T')[0];
    if (dayISO < todayISO) return true;   // day already passed
    if (dayISO > todayISO) return false;  // future day
    return currentTimeStr >= horarioLimite; // today: check time
  };

  // ── Load sede config ──
  useEffect(() => {
    const docRef = doc(db, CollectionName.LUNCH_CONFIG, 'sede');
    return onSnapshot(docRef, snap => {
      if (snap.exists()) {
        const data = snap.data() as LunchConfig;
        setSedeNome(data.sedeNome || 'Sede MGR');
        setSedeEndereco(data.sedeEndereco || '');
        setHorarioLimite(data.horarioLimite || '10:00');
      }
    });
  }, []);

  // ── Active menu ──
  useEffect(() => {
    // Nota: NÃO usa orderBy para evitar necessidade de índice composto no Firestore.
    // O sistema garante que só há 1 menu ativo por vez.
    const q = query(
      collection(db, CollectionName.LUNCH_MENUS),
      where('status', '==', 'ativo'),
      limit(1),
    );
    return onSnapshot(q, snap => {
      setActiveMenu(snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as LunchMenu));
      setLoadingMenu(false);
    }, err => {
      console.error('Erro ao carregar cardápio ativo:', err);
      setActiveMenu(null);
      setLoadingMenu(false);
    });
  }, []);

  // ── Existing choice ──
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
    }, err => {
      console.error('Erro ao carregar escolhas:', err);
      setExistingChoice(null);
      setLoadingChoice(false);
    });
  }, [activeMenu, currentUser]);

  // ── Today's location ──
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
    }, err => {
      console.error('Erro ao carregar localização:', err);
      setTodayLocation(null);
      setLoadingLocation(false);
    });
  }, [currentUser, todayISO]);

  // ── Derived: pratos by category ──
  const meatOptions  = useMemo(() => activeMenu?.pratos.filter(p => p.categoria === 'mistura')   ?? [], [activeMenu]);
  const sideOptions  = useMemo(() => activeMenu?.pratos.filter(p => p.categoria === 'guarnicao') ?? [], [activeMenu]);

  // ── Derived: set of current dish IDs (for unavailability detection) ──
  const currentDishIds = useMemo(() => new Set(activeMenu?.pratos.map(p => p.id) ?? []), [activeMenu]);

  // ── Check if any day has unavailable items ──
  const hasUnavailableItems = useMemo(() => {
    if (!existingChoice) return false;
    return DAY_KEYS.some(day => {
      const dc = existingChoice.escolhas[day] as LunchDayChoice | null | undefined;
      if (!dc) return false;
      return (dc.misturas?.some(m => !currentDishIds.has(m.id)) || dc.guarnicoes?.some(g => !currentDishIds.has(g.id)));
    });
  }, [existingChoice, currentDishIds]);

  // ── Toggle item in selection ──
  const toggleItem = (day: DayKey, categoria: 'misturas' | 'guarnicoes', itemId: string) => {
    setSelections(prev => {
      const daySel = { ...prev[day] };
      const arr = [...daySel[categoria]];
      const idx = arr.indexOf(itemId);
      if (idx >= 0) {
        arr.splice(idx, 1); // remove
      } else {
        if (arr.length >= MAX_PER_CATEGORY) return prev; // limit reached
        arr.push(itemId);
      }
      daySel[categoria] = arr;
      return { ...prev, [day]: daySel };
    });
  };

  // ── Submit choices ──
  const handleSubmitChoices = async () => {
    if (!currentUser || !userProfile || !activeMenu) return;
    setSubmitting(true);
    try {
      const escolhas: LunchChoice['escolhas'] = {};
      for (const day of DAY_KEYS) {
        const sel = selections[day];
        const hasAny = sel.misturas.length > 0 || sel.guarnicoes.length > 0;
        if (hasAny) {
          const dc: LunchDayChoice = {
            misturas: sel.misturas.map(id => {
              const dish = meatOptions.find(p => p.id === id);
              return { id, nome: dish?.nome ?? id };
            }),
            guarnicoes: sel.guarnicoes.map(id => {
              const dish = sideOptions.find(p => p.id === id);
              return { id, nome: dish?.nome ?? id };
            }),
            tamanho: marmitaSizes[day],
          };
          escolhas[day] = dc;
        } else {
          escolhas[day] = null;
        }
      }

      await addDoc(collection(db, CollectionName.LUNCH_CHOICES), {
        menuId: activeMenu.id,
        userId: currentUser.uid,
        userName: userProfile.nomeCompleto || userProfile.displayName,
        userSector: userProfile.sectorName || '',
        escolhas,
        enviadoEm: Timestamp.now(),
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Erro ao enviar escolhas:', err);
      alert('Erro ao enviar escolhas. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── GPS ──
  const handleGetLocation = () => {
    if (!navigator.geolocation) { alert('Geolocalização não suportada.'); return; }
    setGettingGPS(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`);
          const data = await res.json();
          if (data.display_name) setAddress(data.display_name);
        } catch (err) { console.error('Erro geocoding:', err); }
        setGettingGPS(false);
      },
      err => { console.error('GPS error:', err); alert('Não foi possível obter localização.'); setGettingGPS(false); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  // ── Submit location ──
  const handleSubmitLocation = async (tipo: LunchLocationType) => {
    if (!currentUser || !userProfile) return;
    setSubmittingLoc(true);
    try {
      const docData: Record<string, any> = {
        userId: currentUser.uid,
        userName: userProfile.nomeCompleto || userProfile.displayName || '',
        userSector: userProfile.sectorName || '',
        data: todayISO, tipo,
        informadoEm: Timestamp.now(),
        menuId: activeMenu?.id || '',
      };
      if (tipo === 'campo') {
        if (address) docData.endereco = address;
        if (clientName) docData.clienteNome = clientName;
        if (coords) docData.coordenadas = coords;
      }
      // Upsert: setDoc com ID determinístico para evitar duplicação ao trocar endereço
      const locationDocId = `${currentUser.uid}_${todayISO}`;
      await setDoc(doc(db, CollectionName.LUNCH_LOCATIONS, locationDocId), docData);
    } catch (err) {
      console.error('Erro ao enviar localização:', err);
      alert('Erro ao enviar localização.');
    } finally {
      setSubmittingLoc(false);
      setShowForaCidadeConfirm(false);
    }
  };

  // ── Reset location ──
  const handleResetLocation = async () => {
    if (!todayLocation) return;
    if (!confirm('Deseja alterar sua localização de hoje?')) return;
    try {
      await deleteDoc(doc(db, CollectionName.LUNCH_LOCATIONS, todayLocation.id));
      setLocationType(''); setAddress(''); setClientName(''); setCoords(null);
    } catch (err) { alert('Erro ao resetar localização.'); }
  };

  // ── Open edit for a specific day ──
  const openEditDay = (day: DayKey) => {
    if (!existingChoice) return;
    const dc = existingChoice.escolhas[day] as LunchDayChoice | null | undefined;
    setEditSelections({
      misturas: dc?.misturas?.map(m => m.id) ?? [],
      guarnicoes: dc?.guarnicoes?.map(g => g.id) ?? [],
    });
    setEditingDay(day);
  };

  // ── Toggle item inside the edit selection ──
  const toggleEditItem = (categoria: 'misturas' | 'guarnicoes', itemId: string) => {
    setEditSelections(prev => {
      const arr = [...prev[categoria]];
      const idx = arr.indexOf(itemId);
      if (idx >= 0) { arr.splice(idx, 1); }
      else { if (arr.length >= MAX_PER_CATEGORY) return prev; arr.push(itemId); }
      return { ...prev, [categoria]: arr };
    });
  };

  // ── Save edit for a specific day ──
  const handleSaveDayEdit = async () => {
    if (!existingChoice || !editingDay) return;
    setSavingEdit(true);
    try {
      const dc: LunchDayChoice = {
        misturas: editSelections.misturas.map(id => {
          const dish = meatOptions.find(p => p.id === id);
          return { id, nome: dish?.nome ?? id };
        }),
        guarnicoes: editSelections.guarnicoes.map(id => {
          const dish = sideOptions.find(p => p.id === id);
          return { id, nome: dish?.nome ?? id };
        }),
      };
      const hasAny = dc.misturas.length > 0 || dc.guarnicoes.length > 0;
      await updateDoc(doc(db, CollectionName.LUNCH_CHOICES, existingChoice.id), {
        [`escolhas.${editingDay}`]: hasAny ? dc : null,
        atualizadoEm: Timestamp.now(),
      });
      setEditingDay(null);
    } catch (err) {
      console.error('Erro ao salvar alteração:', err);
      alert('Erro ao salvar alteração. Tente novamente.');
    } finally {
      setSavingEdit(false);
    }
  };

  /* ════════════════════════════════════════════════════════════════
     RENDER STATES
     ════════════════════════════════════════════════════════════════ */

  const hasAnySelection = DAY_KEYS.some(d => selections[d].misturas.length > 0 || selections[d].guarnicoes.length > 0);

  if (loadingMenu || loadingChoice || loadingLocation) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-gray-400">
          <UtensilsCrossed size={24} className="animate-pulse" />
          <span className="text-sm">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!activeMenu) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className="text-center bg-white rounded-2xl border border-gray-200 shadow-sm p-10 space-y-4">
          <UtensilsCrossed size={48} className="mx-auto text-gray-300" />
          <h2 className="text-xl font-bold text-gray-800">Nenhum cardápio disponível</h2>
          <p className="text-gray-500 text-sm">O cardápio da semana ainda não foi cadastrado pela gestão. Aguarde a publicação.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className="text-center bg-white rounded-2xl border border-green-200 shadow-sm p-10 space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={36} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Escolhas enviadas com sucesso! ✅</h2>
          <p className="text-gray-500 text-sm">
            Seus pratos da semana foram registrados. Lembre-se de informar sua localização diariamente até as {horarioLimite}.
          </p>
          <button onClick={() => setSubmitted(false)}
            className="mt-4 px-6 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium text-sm">
            Ir para Localização do Dia
          </button>
        </div>
      </div>
    );
  }

  const formatDateBR = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
  const weekDays = `${formatDateBR(activeMenu.weekStart)} a ${formatDateBR(activeMenu.weekEnd)}`;

  /* ─── Already chose: show location form ─── */
  if (existingChoice) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UtensilsCrossed className="text-orange-500" /> Meu Almoço
          </h1>
          <p className="text-gray-500 text-sm mt-1">Semana {weekDays}</p>
        </div>

        {/* Summary of existing choices */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700">Seus pedidos da semana</h3>
            <span className="text-xs text-orange-600 flex items-center gap-1">
              <Clock size={12} /> Prazo diário: {horarioLimite}
            </span>
          </div>

          {/* Alert: unavailable items */}
          {hasUnavailableItems && (
            <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-red-800">⚠️ O cardápio foi alterado pelo restaurante!</p>
                <p className="text-xs text-red-700 mt-0.5">Alguns itens do seu pedido não estão mais disponíveis (marcados em vermelho). Clique em "Alterar" para atualizar seu pedido com os novos pratos.</p>
              </div>
            </div>
          )}
          <div className="divide-y divide-gray-50">
            {DAY_KEYS.map(day => {
              const dc = existingChoice.escolhas[day] as LunchDayChoice | null | undefined;
              const isEditing = editingDay === day;

              return (
                <div key={day} className="px-4 py-3">
                  {/* Day header + Alterar button */}
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-orange-500">{DAY_LABELS[day]}</p>
                    {!isEditing && !isDayPastDeadline(day) && (
                      <button
                        onClick={() => openEditDay(day)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1 transition-colors"
                      >
                        <Pencil size={11} /> Alterar
                      </button>
                    )}
                    {isEditing && (
                      <span className="text-xs text-blue-600 font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">Editando...</span>
                    )}
                  </div>

                  {/* Current choices (shown when not editing) */}
                  {!isEditing && (
                    dc ? (
                      <div className="flex flex-wrap gap-1.5">
                        {dc.misturas?.map(m => {
                          const unavailable = !currentDishIds.has(m.id);
                          return (
                            <span key={m.id} className={`text-xs px-2 py-0.5 rounded-full ${
                              unavailable
                                ? 'bg-red-100 text-red-700 border border-red-300 line-through'
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {unavailable ? '⚠️' : '🥩'} {m.nome}
                              {unavailable && <span className="ml-1 text-[9px] font-bold no-underline">INDISPONÍVEL</span>}
                            </span>
                          );
                        })}
                        {dc.guarnicoes?.map(g => {
                          const unavailable = !currentDishIds.has(g.id);
                          return (
                            <span key={g.id} className={`text-xs px-2 py-0.5 rounded-full ${
                              unavailable
                                ? 'bg-red-100 text-red-700 border border-red-300 line-through'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {unavailable ? '⚠️' : '🥗'} {g.nome}
                              {unavailable && <span className="ml-1 text-[9px] font-bold no-underline">INDISPONÍVEL</span>}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">— Não vai almoçar</span>
                    )
                  )}

                  {/* Inline edit form */}
                  {isEditing && (
                    <div className="mt-2 space-y-3 bg-blue-50/50 border border-blue-200 rounded-xl p-3">
                      {/* Misturas */}
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">🥩 Misturas</span>
                          <span className="text-xs text-gray-400">até {MAX_PER_CATEGORY}</span>
                          {editSelections.misturas.length > 0 && (
                            <span className="ml-auto text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
                              {editSelections.misturas.length}/{MAX_PER_CATEGORY} ✓
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {meatOptions.map(p => {
                            const selected = editSelections.misturas.includes(p.id);
                            const limitReached = !selected && editSelections.misturas.length >= MAX_PER_CATEGORY;
                            return (
                              <button key={p.id} onClick={() => toggleEditItem('misturas', p.id)} disabled={limitReached}
                                className={`flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all active:scale-[0.98] text-sm ${
                                  selected ? 'bg-orange-500 border-orange-500 text-white'
                                  : limitReached ? 'bg-gray-50 border-gray-100 text-gray-300 opacity-50 cursor-not-allowed'
                                  : 'bg-white border-gray-200 text-gray-800 hover:border-orange-300 hover:bg-orange-50'
                                }`}>
                                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selected ? 'bg-white border-white' : 'border-gray-300'}`}>
                                  {selected && <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500"><polyline points="20 6 9 17 4 12" /></svg>}
                                </div>
                                <span className="font-medium leading-tight">{p.nome}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {/* Guarnições */}
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-green-600 uppercase tracking-wide">🥗 Guarnições</span>
                          <span className="text-xs text-gray-400">até {MAX_PER_CATEGORY}</span>
                          {editSelections.guarnicoes.length > 0 && (
                            <span className="ml-auto text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                              {editSelections.guarnicoes.length}/{MAX_PER_CATEGORY} ✓
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {sideOptions.map(p => {
                            const selected = editSelections.guarnicoes.includes(p.id);
                            const limitReached = !selected && editSelections.guarnicoes.length >= MAX_PER_CATEGORY;
                            return (
                              <button key={p.id} onClick={() => toggleEditItem('guarnicoes', p.id)} disabled={limitReached}
                                className={`flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all active:scale-[0.98] text-sm ${
                                  selected ? 'bg-green-500 border-green-500 text-white'
                                  : limitReached ? 'bg-gray-50 border-gray-100 text-gray-300 opacity-50 cursor-not-allowed'
                                  : 'bg-white border-gray-200 text-gray-800 hover:border-green-300 hover:bg-green-50'
                                }`}>
                                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selected ? 'bg-white border-white' : 'border-gray-300'}`}>
                                  {selected && <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><polyline points="20 6 9 17 4 12" /></svg>}
                                </div>
                                <span className="font-medium leading-tight">{p.nome}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <button onClick={handleSaveDayEdit} disabled={savingEdit}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-bold active:scale-[0.98]">
                          {savingEdit ? 'Salvando...' : '✓ Salvar Alteração'}
                        </button>
                        <button onClick={() => setEditingDay(null)} disabled={savingEdit}
                          className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Location section */}
        <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden">
          <div className="bg-orange-50 px-5 py-4 border-b border-orange-100">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-orange-600" />
              <h3 className="text-sm font-bold text-orange-800">
                Informar Minha Localização — Hoje ({new Date().toLocaleDateString('pt-BR')})
              </h3>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <Clock size={14} className="text-orange-500" />
              <span className={`text-xs font-medium ${isPastDeadline ? 'text-red-600' : 'text-orange-600'}`}>
                {isPastDeadline ? `⚠️ O prazo para informar (${horarioLimite}) já passou!` : `Informe até as ${horarioLimite}`}
              </span>
            </div>
          </div>

          <div className="mx-5 mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong>ATENÇÃO:</strong> Se estiver fora da cidade e <strong>NÃO informar</strong>, sua marmita será pedida normalmente e você <strong>perderá o direito ao vale-alimentação</strong>.
              </p>
            </div>
          </div>

          <div className="p-5">
            {todayLocation ? (
              <div className="text-center py-6 space-y-3">
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
                  <button onClick={handleResetLocation}
                    className="mt-3 flex items-center gap-2 mx-auto px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors">
                    <Pencil size={14} /> Reinformar Localização
                  </button>
                )}
              </div>
            ) : (
              <LocationForm
                locationType={locationType} setLocationType={setLocationType}
                address={address} setAddress={setAddress}
                clientName={clientName} setClientName={setClientName}
                gettingGPS={gettingGPS} handleGetLocation={handleGetLocation}
                showMapPicker={showMapPicker} setShowMapPicker={setShowMapPicker}
                coords={coords} setCoords={setCoords} setAddress2={setAddress}
                submittingLoc={submittingLoc}
                handleSubmitLocation={handleSubmitLocation}
                showForaCidadeConfirm={showForaCidadeConfirm}
                setShowForaCidadeConfirm={setShowForaCidadeConfirm}
                sedeNome={sedeNome} sedeEndereco={sedeEndereco}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ─── Selection form ─── */
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <UtensilsCrossed className="text-orange-500" /> Meu Almoço
        </h1>
        <p className="text-gray-500 text-sm mt-1">Monte sua marmita para a semana {weekDays}</p>
      </div>

      {/* Cardápio overview */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <UtensilsCrossed size={16} className="text-orange-500" /> Cardápio da Semana
        </h3>
        <div className="space-y-3">
          {meatOptions.length > 0 && (
            <div>
              <p className="text-xs font-bold text-orange-500 uppercase tracking-wide mb-1.5">🥩 Misturas disponíveis</p>
              <div className="flex flex-wrap gap-2">
                {meatOptions.map(p => (
                  <div key={p.id} className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                    <p className="text-sm font-medium text-orange-800">{p.nome}</p>
                    {p.descricao && <p className="text-xs text-orange-600 mt-0.5">{p.descricao}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {sideOptions.length > 0 && (
            <div>
              <p className="text-xs font-bold text-green-600 uppercase tracking-wide mb-1.5">🥗 Guarnições disponíveis</p>
              <div className="flex flex-wrap gap-2">
                {sideOptions.map(p => (
                  <div key={p.id} className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <p className="text-sm font-medium text-green-800">{p.nome}</p>
                    {p.descricao && <p className="text-xs text-green-600 mt-0.5">{p.descricao}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Day-by-day selection — mobile-first */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-orange-50 px-4 py-4 border-b border-orange-100">
          <h3 className="text-sm font-bold text-orange-800">Monte sua marmita para cada dia</h3>
          <p className="text-xs text-orange-600 mt-1">
            Escolha até {MAX_PER_CATEGORY} misturas e até {MAX_PER_CATEGORY} guarnições por dia
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {DAY_KEYS.map(day => {
            const sel = selections[day];
            return (
              <div key={day} className="px-4 py-4">
                {/* Day header */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-800">📅 {DAY_LABELS[day]}</p>
                  {(sel.misturas.length > 0 || sel.guarnicoes.length > 0) && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                      {sel.misturas.length + sel.guarnicoes.length} item(s)
                    </span>
                  )}
                </div>

                {/* ── Misturas ── */}
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">🥩 Misturas</span>
                    <span className="text-xs text-gray-400">até {MAX_PER_CATEGORY}</span>
                    {sel.misturas.length > 0 && (
                      <span className="ml-auto text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
                        {sel.misturas.length}/{MAX_PER_CATEGORY} ✓
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {meatOptions.map(p => {
                      const selected = sel.misturas.includes(p.id);
                      const limitReached = !selected && sel.misturas.length >= MAX_PER_CATEGORY;
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleItem(day, 'misturas', p.id)}
                          disabled={limitReached}
                          className={`flex items-center gap-3 w-full text-left px-3 py-3 rounded-xl border-2 transition-all active:scale-[0.98] ${
                            selected
                              ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                              : limitReached
                              ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed opacity-50'
                              : 'bg-white border-gray-200 text-gray-800 hover:border-orange-300 hover:bg-orange-50'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                            selected ? 'bg-white border-white' : limitReached ? 'border-gray-200' : 'border-gray-300'
                          }`}>
                            {selected && (
                              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-medium leading-tight">{p.nome}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Guarnições ── */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-green-600 uppercase tracking-wide">🥗 Guarnições</span>
                    <span className="text-xs text-gray-400">até {MAX_PER_CATEGORY}</span>
                    {sel.guarnicoes.length > 0 && (
                      <span className="ml-auto text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                        {sel.guarnicoes.length}/{MAX_PER_CATEGORY} ✓
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sideOptions.map(p => {
                      const selected = sel.guarnicoes.includes(p.id);
                      const limitReached = !selected && sel.guarnicoes.length >= MAX_PER_CATEGORY;
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleItem(day, 'guarnicoes', p.id)}
                          disabled={limitReached}
                          className={`flex items-center gap-3 w-full text-left px-3 py-3 rounded-xl border-2 transition-all active:scale-[0.98] ${
                            selected
                              ? 'bg-green-500 border-green-500 text-white shadow-sm'
                              : limitReached
                              ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed opacity-50'
                              : 'bg-white border-gray-200 text-gray-800 hover:border-green-300 hover:bg-green-50'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                            selected ? 'bg-white border-white' : limitReached ? 'border-gray-200' : 'border-gray-300'
                          }`}>
                            {selected && (
                              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-medium leading-tight">{p.nome}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Tamanho da marmita ── */}
                <div>
                  <span className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-2 block">📦 Tamanho da Marmita</span>
                  <div className="flex gap-2">
                    {MARMITA_SIZES.map(sz => (
                      <button key={sz.value}
                        onClick={() => setMarmitaSizes(prev => ({ ...prev, [day]: sz.value }))}
                        className={`flex-1 flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border-2 transition-all active:scale-[0.98] ${
                          marmitaSizes[day] === sz.value
                            ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm'
                            : 'border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50/30'
                        }`}>
                        <span className="text-lg">{sz.emoji}</span>
                        <span className="text-xs font-bold">{sz.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-4 bg-gray-50 border-t border-gray-100">
          <button onClick={handleSubmitChoices} disabled={submitting || !hasAnySelection}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold text-base shadow-sm active:scale-[0.98]">
            <Send size={18} /> {submitting ? 'Enviando...' : 'Enviar Escolhas da Semana'}
          </button>
          {!hasAnySelection && (
            <p className="text-center text-xs text-gray-400 mt-2">Selecione ao menos 1 item para enviar</p>
          )}
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   LOCATION FORM — sub-component
   ════════════════════════════════════════════════════════════════ */

interface LocationFormProps {
  locationType: LunchLocationType | '';
  setLocationType: (t: LunchLocationType | '') => void;
  address: string;
  setAddress: (a: string) => void;
  clientName: string;
  setClientName: (c: string) => void;
  gettingGPS: boolean;
  handleGetLocation: () => void;
  showMapPicker: boolean;
  setShowMapPicker: (v: boolean) => void;
  coords: { lat: number; lng: number } | null;
  setCoords: (c: { lat: number; lng: number } | null) => void;
  setAddress2: (a: string) => void;
  submittingLoc: boolean;
  handleSubmitLocation: (tipo: LunchLocationType) => void;
  showForaCidadeConfirm: boolean;
  setShowForaCidadeConfirm: (v: boolean) => void;
  sedeNome: string;
  sedeEndereco: string;
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

      {/* Em campo */}
      <div className={`rounded-xl border-2 transition-all cursor-pointer ${
        locationType === 'campo' ? 'border-green-400 bg-green-50/50 shadow-sm' : 'border-gray-200 hover:border-green-300 hover:bg-green-50/30'
      }`} onClick={() => setLocationType('campo')}>
        <div className="flex items-center gap-3 p-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            locationType === 'campo' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-600'}`}>
            <MapPin size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-800">📍 Estou em campo</p>
            <p className="text-xs text-gray-500">Informar endereço e nome do cliente</p>
          </div>
          <CheckMark checked={locationType === 'campo'} />
        </div>
        {locationType === 'campo' && (
          <div className="px-4 pb-4 space-y-3 border-t border-green-100 pt-3">
              <button onClick={e => { e.stopPropagation(); setShowMapPicker(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium">
                <MapIcon size={14} /> Abrir Mapa para Localizar
              </button>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Endereço</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} onClick={e => e.stopPropagation()}
                placeholder="Rua, número, bairro, cidade..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-300 outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nome do Cliente</label>
              <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} onClick={e => e.stopPropagation()}
                placeholder="Ex: Supermercado Bom Preço"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-300 outline-none" />
            </div>
            <button onClick={e => { e.stopPropagation(); handleSubmitLocation('campo'); }}
              disabled={submittingLoc || (!address && !clientName)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-bold">
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

      {/* Na sede */}
      <button onClick={() => handleSubmitLocation('sede')} disabled={submittingLoc}
        className="rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 p-4 flex items-center gap-3 transition-all text-left">
        <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
          <Building2 size={20} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-800">🏢 Vou almoçar na sede</p>
          <p className="text-xs text-gray-500">{sedeNome}{sedeEndereco ? ` — ${sedeEndereco}` : ''}</p>
        </div>
        <ArrowRight size={16} className="text-gray-400" />
      </button>

      {/* Fora da cidade */}
      <div className={`rounded-xl border-2 transition-all ${showForaCidadeConfirm ? 'border-orange-400 bg-orange-50/50' : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/30'}`}>
        <button onClick={() => setShowForaCidadeConfirm(!showForaCidadeConfirm)}
          className="w-full p-4 flex items-center gap-3 text-left">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${showForaCidadeConfirm ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600'}`}>
            <Plane size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-800">✈️ Estou fora da cidade</p>
            <p className="text-xs text-gray-500">Marmita não será pedida, receberá vale-alimentação</p>
          </div>
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${showForaCidadeConfirm ? 'rotate-180' : ''}`} />
        </button>
        {showForaCidadeConfirm && (
          <div className="px-4 pb-4 border-t border-orange-100 pt-3 space-y-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-red-800 space-y-1">
                  <p className="font-bold">Ao confirmar "Fora da cidade":</p>
                  <ul className="list-disc ml-4 space-y-0.5">
                    <li>Sua marmita <strong>NÃO será pedida</strong> hoje</li>
                    <li>Você receberá o <strong>vale-alimentação do dia</strong></li>
                  </ul>
                </div>
              </div>
            </div>
            <button onClick={() => handleSubmitLocation('fora_cidade')} disabled={submittingLoc}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors text-sm font-bold">
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
    {checked && (
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )}
  </div>
);

export default MyLunch;
