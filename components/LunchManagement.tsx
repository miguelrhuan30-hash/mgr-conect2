import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc,
  Timestamp, getDocs, getDoc, setDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  CollectionName, LunchMenu, LunchMenuMode, LunchDish, LunchChoice, LunchDayChoice,
  LunchLocation, LunchLocationType, LunchConfig, MarmitaSize,
} from '../types';
import {
  UtensilsCrossed, Plus, Trash2, Save, Copy, Check,
  CheckCircle2, MapPin, Building2, Plane, AlertTriangle,
  Calendar, ClipboardList, Settings2, Filter, Layers,
  Map as MapIcon, Drumstick, Salad, Pencil, X, Loader2,
} from 'lucide-react';
import GoogleMapPicker, { MapPickerResult } from './GoogleMapPicker';
import * as XLSX from 'xlsx';

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

const generateId = () => Math.random().toString(36).substring(2, 11);

const getNextMonday = (): string => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
};

const getFridayFromMonday = (monday: string): string => {
  const d = new Date(monday + 'T12:00:00');
  d.setDate(d.getDate() + 4);
  return d.toISOString().split('T')[0];
};

const formatDateBR = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/* ════════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════════ */

const LunchManagement: React.FC = () => {
  const { currentUser, userProfile } = useAuth();

  // ── Tabs ──
  const [activeTab, setActiveTab] = useState<'cardapio' | 'pedidos' | 'localizacao'>('cardapio');

  // ── Menus ──
  const [menus, setMenus] = useState<LunchMenu[]>([]);
  const [loadingMenus, setLoadingMenus] = useState(true);

  // ── Form: novo cardápio ──
  const [showForm, setShowForm] = useState(false);
  const [modoNovo, setModoNovo] = useState<LunchMenuMode>('semanal');
  const [dataUnica, setDataUnica] = useState(new Date().toISOString().split('T')[0]);
  const [textoLivre, setTextoLivre] = useState('');

  // Parser de texto livre para tags (modo diario)
  const parsearTextoLivre = (texto: string): string[] => {
    return texto.split(/[,\n;]+/).map(s => s.trim()).filter(s => s.length > 1).slice(0, 10);
  };
  const [weekStart, setWeekStart] = useState(getNextMonday());
  // tags (strings com o nome de cada item)
  const [misturasTags, setMisturasTags] = useState<string[]>([]);
  const [guarnicoesTags, setGuarnicoesTags] = useState<string[]>([]);
  const [misturaDraft, setMisturaDraft] = useState('');
  const [guarnicaoDraft, setGuarnicaoDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Choices ──
  const [allChoices, setAllChoices] = useState<LunchChoice[]>([]);
  // Filtro único por data
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [copied, setCopied] = useState(false);
  const [copiedGrouped, setCopiedGrouped] = useState(false);
  const [exportingXLS, setExportingXLS] = useState(false);
  const [cleaningDups, setCleaningDups] = useState(false);
  const [cleanMsg, setCleanMsg] = useState('');

  // ── Locations ──
  const [locations, setLocations] = useState<LunchLocation[]>([]);
  const [locDate, setLocDate] = useState(new Date().toISOString().split('T')[0]);

  // ── HQ Config ──
  const [sedeNome, setSedeNome] = useState('Sede MGR');
  const [sedeEndereco, setSedeEndereco] = useState('');
  const [horarioLimite, setHorarioLimite] = useState('10:00');
  const [savingSede, setSavingSede] = useState(false);
  const [showSedeConfig, setShowSedeConfig] = useState(false);
  const [showSedeMapPicker, setShowSedeMapPicker] = useState(false);

  // ── Edit existing menu ──
  const [editingMenu, setEditingMenu] = useState<LunchMenu | null>(null);
  const [editMisturas, setEditMisturas] = useState<string[]>([]);
  const [editGuarnicoes, setEditGuarnicoes] = useState<string[]>([]);
  const [editMisturaDraft, setEditMisturaDraft] = useState('');
  const [editGuarnicaoDraft, setEditGuarnicaoDraft] = useState('');
  const [savingMenuEdit, setSavingMenuEdit] = useState(false);

  // ── Deadline ──
  const nowMgmt = new Date();
  const currentTimeMgmt = `${String(nowMgmt.getHours()).padStart(2, '0')}:${String(nowMgmt.getMinutes()).padStart(2, '0')}`;
  const isPastDeadlineMgmt = currentTimeMgmt >= horarioLimite;

  /* ─── Load HQ config ─── */
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

  /* ─── Real-time: menus ─── */
  useEffect(() => {
    const q = query(collection(db, CollectionName.LUNCH_MENUS), orderBy('criadoEm', 'desc'));
    return onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as LunchMenu[];
      setMenus(data);
      setLoadingMenus(false);
    });
  }, []);

  /* ─── Real-time: TODOS os choices (busca por data depois) ─── */
  useEffect(() => {
    const q = query(collection(db, CollectionName.LUNCH_CHOICES), orderBy('enviadoEm', 'desc'));
    return onSnapshot(q, snap => {
      setAllChoices(snap.docs.map(d => ({ id: d.id, ...d.data() })) as LunchChoice[]);
    });
  }, []);

  /* ─── Real-time: locations ─── */
  useEffect(() => {
    if (!locDate) return;
    const q = query(collection(db, CollectionName.LUNCH_LOCATIONS), where('data', '==', locDate));
    return onSnapshot(q, snap => {
      setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() })) as LunchLocation[]);
    });
  }, [locDate]);

  /* ─── Tag helpers ─── */
  const commitMistura = () => {
    const v = misturaDraft.trim();
    if (v && !misturasTags.includes(v)) setMisturasTags(prev => [...prev, v]);
    setMisturaDraft('');
  };
  const commitGuarnicao = () => {
    const v = guarnicaoDraft.trim();
    if (v && !guarnicoesTags.includes(v)) setGuarnicoesTags(prev => [...prev, v]);
    setGuarnicaoDraft('');
  };
  const removeMisturaTag = (nome: string) => setMisturasTags(prev => prev.filter(t => t !== nome));
  const removeGuarnicaoTag = (nome: string) => setGuarnicoesTags(prev => prev.filter(t => t !== nome));

  /* ─── Save HQ config ─── */
  const handleSaveSede = async () => {
    if (!currentUser) return;
    setSavingSede(true);
    try {
      await setDoc(doc(db, CollectionName.LUNCH_CONFIG, 'sede'), {
        sedeNome, sedeEndereco, horarioLimite,
        atualizadoPor: currentUser.uid, atualizadoEm: Timestamp.now(),
      });
      setShowSedeConfig(false);
    } catch (err) {
      console.error('Erro ao salvar config sede:', err);
    } finally {
      setSavingSede(false);
    }
  };

  /* ─── Save new menu ─── */
  const handleSaveMenu = async () => {
    if (!currentUser || !userProfile) return;
    // commit any pending draft before saving
    const allMisturas = misturaDraft.trim()
      ? [...misturasTags, misturaDraft.trim()]
      : misturasTags;
    const allGuarnicoes = guarnicaoDraft.trim()
      ? [...guarnicoesTags, guarnicaoDraft.trim()]
      : guarnicoesTags;
    if (allMisturas.length === 0)  return alert('Adicione ao menos 1 mistura.');
    if (allGuarnicoes.length === 0) return alert('Adicione ao menos 1 guarnição.');

    setSaving(true);
    try {
      const activeMenus = menus.filter(m => m.status === 'ativo');
      for (const m of activeMenus) {
        await updateDoc(doc(db, CollectionName.LUNCH_MENUS, m.id), { status: 'encerrado' });
      }
      const allPratos: LunchDish[] = [
        ...allMisturas.map((nome, i) => ({ id: generateId(), nome, descricao: '', ordem: i + 1, categoria: 'mistura' as const })),
        ...allGuarnicoes.map((nome, i) => ({ id: generateId(), nome, descricao: '', ordem: i + 1, categoria: 'guarnicao' as const })),
      ];
      await addDoc(collection(db, CollectionName.LUNCH_MENUS), {
        modo: modoNovo,
        weekStart: modoNovo === 'semanal' ? weekStart : '',
        weekEnd: modoNovo === 'semanal' ? getFridayFromMonday(weekStart) : '',
        dataUnica: modoNovo === 'diario' ? dataUnica : null,
        status: 'ativo',
        pratos: allPratos,
        criadoPor: currentUser.uid,
        criadoPorNome: userProfile.displayName,
        criadoEm: Timestamp.now(),
      });
      setShowForm(false);
      setMisturasTags([]);
      setGuarnicoesTags([]);
      setMisturaDraft('');
      setGuarnicaoDraft('');
      setTextoLivre('');
    } catch (err) {
      console.error('Erro ao salvar cardápio:', err);
      alert('Erro ao salvar cardápio.');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Toggle menu status ─── */
  const toggleMenuStatus = async (menuId: string, newStatus: 'ativo' | 'encerrado') => {
    try {
      if (newStatus === 'ativo') {
        const activeMenus = menus.filter(m => m.status === 'ativo');
        for (const m of activeMenus) {
          await updateDoc(doc(db, CollectionName.LUNCH_MENUS, m.id), { status: 'encerrado' });
        }
      }
      await updateDoc(doc(db, CollectionName.LUNCH_MENUS, menuId), { status: newStatus, atualizadoEm: Timestamp.now() });
    } catch (err) {
      console.error('Erro ao alterar status:', err);
    }
  };

  /* ─── Open edit menu ─── */
  const openEditMenu = (menu: LunchMenu) => {
    setEditingMenu(menu);
    setEditMisturas(menu.pratos.filter(p => p.categoria === 'mistura').map(p => p.nome));
    setEditGuarnicoes(menu.pratos.filter(p => p.categoria === 'guarnicao').map(p => p.nome));
    setEditMisturaDraft(''); setEditGuarnicaoDraft('');
  };

  /* ─── Save edited menu ─── */
  const handleSaveMenuEdit = async () => {
    if (!editingMenu || !currentUser) return;
    const allMisturas = editMisturaDraft.trim() ? [...editMisturas, editMisturaDraft.trim()] : editMisturas;
    const allGuarnicoes = editGuarnicaoDraft.trim() ? [...editGuarnicoes, editGuarnicaoDraft.trim()] : editGuarnicoes;
    if (allMisturas.length === 0) return alert('Adicione ao menos 1 mistura.');
    if (allGuarnicoes.length === 0) return alert('Adicione ao menos 1 guarnição.');
    setSavingMenuEdit(true);
    try {
      // Preserve IDs for existing dishes, generate new IDs for new ones
      const existingDishes = editingMenu.pratos;
      const newPratos: LunchDish[] = [
        ...allMisturas.map((nome, i) => {
          const existing = existingDishes.find(p => p.nome === nome && p.categoria === 'mistura');
          return { id: existing?.id || generateId(), nome, descricao: '', ordem: i + 1, categoria: 'mistura' as const };
        }),
        ...allGuarnicoes.map((nome, i) => {
          const existing = existingDishes.find(p => p.nome === nome && p.categoria === 'guarnicao');
          return { id: existing?.id || generateId(), nome, descricao: '', ordem: i + 1, categoria: 'guarnicao' as const };
        }),
      ];
      await updateDoc(doc(db, CollectionName.LUNCH_MENUS, editingMenu.id), {
        pratos: newPratos,
        atualizadoEm: Timestamp.now(),
      });
      setEditingMenu(null);
    } catch (err) {
      console.error('Erro ao editar cardápio:', err);
      alert('Erro ao salvar alterações do cardápio.');
    } finally { setSavingMenuEdit(false); }
  };

  /* ─── Helper: resumo de um pedido do dia ─── */
  const getDayChoiceSummary = (choice: LunchChoice, day: DayKey): string => {
    const dc = choice.escolhas[day] as LunchDayChoice | null | undefined;
    if (!dc) return '—';
    const parts: string[] = [];
    if (dc.misturas?.length)  parts.push(...dc.misturas.map(m => `🥩 ${m.nome}`));
    if (dc.guarnicoes?.length) parts.push(...dc.guarnicoes.map(g => `🥗 ${g.nome}`));
    return parts.join(', ') || '—';
  };

  /* ─── Helper: resolve a data ISO de uma escolha (dayKey) dentro de um menu ─── */
  const getChoiceDateForDay = (menu: LunchMenu, dayKey: DayKey): string | null => {
    if (menu.modo === 'diario') return menu.dataUnica ?? null;
    if (menu.modo === 'fixo' || !menu.weekStart || menu.weekStart.trim() === '') return null;
    const idx = DAY_KEYS.indexOf(dayKey);
    const d = new Date(menu.weekStart + 'T12:00:00');
    if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + idx);
    return d.toISOString().split('T')[0];
  };

  /* ─── Helper: nome do dia da semana a partir de uma data ISO ─── */
  const getDayOfWeekLabel = (isoDate: string): string => {
    const d = new Date(isoDate + 'T12:00:00');
    if (isNaN(d.getTime())) return '';
    const names = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return names[d.getDay()] ?? '';
  };

  /* ─── Pedidos filtrados pela selectedDate — busca em TODOS os choices ─── */
  type FilteredChoiceEntry = {
    choice: LunchChoice;
    dayKey: DayKey;
    menu: LunchMenu | null;
    menuEncerrado: boolean;
  };

  const filteredChoicesByDate = useMemo((): FilteredChoiceEntry[] => {
    if (!selectedDate) return [];
    const candidates: FilteredChoiceEntry[] = [];

    allChoices.forEach(choice => {
      const menu = menus.find(m => m.id === choice.menuId) ?? null;

      // Para cardápio semanal: testar cada dayKey
      const keysToCheck: DayKey[] = menu?.modo === 'diario' ? [] : DAY_KEYS as unknown as DayKey[];

      if (menu?.modo === 'diario') {
        // cardápio diário: só tem 'segunda' como dayKey padrão, mas a data é dataUnica
        // O usuário faz escolha em `segunda` quando é diário
        const dateForDay = getChoiceDateForDay(menu, 'segunda');
        if (dateForDay === selectedDate) {
          const dc = choice.escolhas['segunda'] as LunchDayChoice | null | undefined;
          if (dc && ((dc.misturas?.length ?? 0) > 0 || (dc.guarnicoes?.length ?? 0) > 0)) {
            candidates.push({
              choice,
              dayKey: 'segunda',
              menu,
              menuEncerrado: menu.status === 'encerrado',
            });
          }
        }
      } else {
        // cardápio semanal ou null: testar cada dayKey
        for (const dayKey of keysToCheck) {
          const dateForDay = menu ? getChoiceDateForDay(menu, dayKey) : null;
          if (dateForDay !== selectedDate) continue;
          const dc = choice.escolhas[dayKey] as LunchDayChoice | null | undefined;
          if (dc && ((dc.misturas?.length ?? 0) > 0 || (dc.guarnicoes?.length ?? 0) > 0)) {
            candidates.push({
              choice,
              dayKey,
              menu,
              menuEncerrado: (menu?.status ?? 'encerrado') === 'encerrado',
            });
          }
        }
      }
    });

    // Dedup: manter somente o mais recente por userId
    const byUser = new Map<string, FilteredChoiceEntry>();
    candidates.forEach(entry => {
      const existing = byUser.get(entry.choice.userId);
      if (!existing ||
        (entry.choice.enviadoEm?.toMillis?.() ?? 0) > (existing.choice.enviadoEm?.toMillis?.() ?? 0)) {
        byUser.set(entry.choice.userId, entry);
      }
    });
    return Array.from(byUser.values());
  }, [allChoices, menus, selectedDate]);

  // Alias retrocompatível para partes do código que ainda usam filteredChoices
  const filteredChoices = filteredChoicesByDate.map(e => e.choice);

  /* ─── Locations split para a data selecionada ─── */
  const dayLocations = useMemo(() => {
    const dayLocs = locations.filter(l => l.data === selectedDate);
    const sede: LunchLocation[] = [], campo: LunchLocation[] = [], fora: LunchLocation[] = [];
    dayLocs.forEach(loc => {
      if (loc.tipo === 'sede') sede.push(loc);
      else if (loc.tipo === 'campo') campo.push(loc);
      else fora.push(loc);
    });
    return { sede, campo, fora };
  }, [locations, selectedDate]);

  /* ─── Clipboard: usa selectedDate diretamente ─── */
  const getDayDateISO = (): string => selectedDate;

  const TAMANHO_LABELS: Record<string, string> = {
    pequena: 'pequena', media: 'média', grande: 'grande',
  };

  const buildClipboardText = (): string => {
    const dayLabel = getDayOfWeekLabel(selectedDate);
    const dateBR = formatDateBR(selectedDate);
    let text = `📋 Pedidos ${dayLabel} · ${dateBR}:\n\n`;
    filteredChoicesByDate.forEach(({ choice, dayKey }, i) => {
      const dc = choice.escolhas[dayKey] as LunchDayChoice | null;
      const mistStr  = dc?.misturas?.map(m => m.nome).join(' + ')  || '—';
      const garnStr  = dc?.guarnicoes?.map(g => g.nome).join(' + ') || '—';
      const tamLabel = dc?.tamanho ? TAMANHO_LABELS[dc.tamanho] || dc.tamanho : 'média';
      text += `${i + 1} ${tamLabel}: ${choice.userName}\n   🥩 ${mistStr}\n   🥗 ${garnStr}\n`;
    });
    text += `\nTotal: ${filteredChoicesByDate.length} marmita(s)`;
    return text;
  };

  /* ─── Clipboard: agrupado por endereço ─── */
  const groupedByAddress = useMemo(() => {
    const sedeLabel = `${sedeNome}${sedeEndereco ? ' - ' + sedeEndereco : ''}`;
    type MealInfo = { userName: string; misturas: string; guarnicoes: string; tamanho: string };
    const groups: Record<string, { address: string; meals: MealInfo[] }> = {};

    // Dedup locations: apenas o mais recente por userId+data
    const latestLocs = new Map<string, LunchLocation>();
    locations.forEach(l => {
      const key = `${l.userId}_${l.data}`;
      const existing = latestLocs.get(key);
      if (!existing || (l.informadoEm?.toMillis?.() ?? 0) > (existing.informadoEm?.toMillis?.() ?? 0)) {
        latestLocs.set(key, l);
      }
    });
    const dedupedLocations = Array.from(latestLocs.values());

    filteredChoicesByDate.forEach(({ choice, dayKey }) => {
      const loc = dedupedLocations.find(l => l.userId === choice.userId && l.data === selectedDate);
      if (loc?.tipo === 'fora_cidade') return;

      const dc = choice.escolhas[dayKey] as LunchDayChoice | null;
      const mistStr  = dc?.misturas?.map(m => m.nome).join(' + ')  || '—';
      const garnStr  = dc?.guarnicoes?.map(g => g.nome).join(' + ') || '—';
      const tamLabel = dc?.tamanho ? (TAMANHO_LABELS[dc.tamanho] || dc.tamanho) : 'média';

      let addressKey: string;
      if (!loc || loc.tipo === 'sede') {
        addressKey = sedeLabel;
      } else {
        const addrParts = [loc.clienteNome, loc.endereco].filter(Boolean).join(' - ');
        addressKey = addrParts || 'Endereço não informado';
      }
      if (!groups[addressKey]) groups[addressKey] = { address: addressKey, meals: [] };
      groups[addressKey].meals.push({ userName: choice.userName, misturas: mistStr, guarnicoes: garnStr, tamanho: tamLabel });
    });
    return Object.values(groups);
  }, [filteredChoicesByDate, locations, selectedDate, sedeNome, sedeEndereco]);

  const buildGroupedClipboardText = (): string => {
    const dayLabel = getDayOfWeekLabel(selectedDate);
    const dateBR = formatDateBR(selectedDate);
    let text = `📋 Pedidos por Endereço — ${dayLabel} · ${dateBR}:\n`;
    groupedByAddress.forEach(group => {
      text += `\n📍 ${group.address}\n`;
      group.meals.forEach((m, i) => {
        text += `   ${i + 1} ${m.tamanho}:  ${m.userName}\n     🥩 ${m.misturas}\n     🥗 ${m.guarnicoes}\n`;
      });
    });
    const foraEntries = filteredChoicesByDate.filter(({ choice }) => {
      const loc = locations.find(l => l.userId === choice.userId && l.data === selectedDate);
      return loc?.tipo === 'fora_cidade';
    });
    if (foraEntries.length > 0) {
      text += `\n✈️ Fora da Cidade (NÃO pedir):\n`;
      foraEntries.forEach(({ choice }) => { text += `   ❌ ${choice.userName}\n`; });
    }
    // Totalizar marmitas por endereço
    const totalMarmitas = groupedByAddress.reduce((sum, g) => sum + g.meals.length, 0);
    text += `\n📦 Total: ${totalMarmitas} marmita(s)`;
    return text;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildClipboardText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { alert('Falha ao copiar.'); }
  };

  const handleCopyGrouped = async () => {
    try {
      await navigator.clipboard.writeText(buildGroupedClipboardText());
      setCopiedGrouped(true);
      setTimeout(() => setCopiedGrouped(false), 2000);
    } catch { alert('Falha ao copiar.'); }
  };

  /* ── Exportar XLS ── */
  const handleExportXLS = () => {
    setExportingXLS(true);
    try {
      const wb = XLSX.utils.book_new();
      const dayLabel = getDayOfWeekLabel(selectedDate);
      const dateBR = formatDateBR(selectedDate);

      // Dedup locations
      const latestLocs = new Map<string, LunchLocation>();
      locations.forEach(l => {
        const key = `${l.userId}_${l.data}`;
        const ex = latestLocs.get(key);
        if (!ex || (l.informadoEm?.toMillis?.() ?? 0) > (ex.informadoEm?.toMillis?.() ?? 0)) latestLocs.set(key, l);
      });
      const dedupLocs = Array.from(latestLocs.values());

      const getLocForUser = (userId: string) =>
        dedupLocs.find(l => l.userId === userId && l.data === selectedDate) ?? null;

      const locLabel = (l: LunchLocation | null) => {
        if (!l || l.tipo === 'sede') return sedeNome + (sedeEndereco ? ` - ${sedeEndereco}` : '');
        if (l.tipo === 'fora_cidade') return 'Fora da Cidade';
        return [l.clienteNome, l.endereco].filter(Boolean).join(' - ') || 'Campo';
      };
      const locTipo = (l: LunchLocation | null) => {
        if (!l || l.tipo === 'sede') return 'Sede';
        if (l.tipo === 'fora_cidade') return 'Fora da Cidade';
        return 'Campo';
      };

      // Aba 1: Pedidos
      const pedidosData = filteredChoicesByDate.map(({ choice, dayKey, menuEncerrado }, i) => {
        const dc = choice.escolhas[dayKey] as LunchDayChoice | null;
        const loc = getLocForUser(choice.userId);
        return {
          'Nº': i + 1,
          'Nome': choice.userName,
          'Setor': choice.userSector || '',
          'Misturas': dc?.misturas?.map(m => m.nome).join(' + ') || '—',
          'Guarnições': dc?.guarnicoes?.map(g => g.nome).join(' + ') || '—',
          'Tamanho': dc?.tamanho || 'média',
          'Tipo Localização': locTipo(loc),
          'Endereço Entrega': locLabel(loc),
          'Status Cardápio': menuEncerrado ? '⚠️ Cardápio Desativado' : '✅ Ativo',
        };
      });
      const ws1 = XLSX.utils.json_to_sheet(pedidosData);
      ws1['!cols'] = [{ wch: 4 }, { wch: 22 }, { wch: 14 }, { wch: 28 }, { wch: 28 }, { wch: 10 }, { wch: 16 }, { wch: 36 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'Pedidos');

      // Aba 2: Por Endereço
      const endData: Record<string, any>[] = [];
      groupedByAddress.forEach(group => {
        group.meals.forEach((m, i) => {
          endData.push({
            'Endereço': i === 0 ? group.address : '',
            'Nº': i + 1,
            'Nome': m.userName,
            'Misturas': m.misturas,
            'Guarnições': m.guarnicoes,
            'Tamanho': m.tamanho,
          });
        });
        endData.push({});
      });
      const ws2 = XLSX.utils.json_to_sheet(endData);
      ws2['!cols'] = [{ wch: 36 }, { wch: 4 }, { wch: 22 }, { wch: 28 }, { wch: 28 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Por Endereço');

      // Aba 3: Fora da Cidade
      const foraData = filteredChoicesByDate
        .filter(({ choice }) => getLocForUser(choice.userId)?.tipo === 'fora_cidade')
        .map(({ choice }) => ({ 'Nome': choice.userName, 'Setor': choice.userSector || '' }));
      if (foraData.length > 0) {
        const ws3 = XLSX.utils.json_to_sheet(foraData);
        XLSX.utils.book_append_sheet(wb, ws3, 'Fora da Cidade');
      }

      const safeDateBR = dateBR.replace(/\//g, '-');
      XLSX.writeFile(wb, `Pedidos_Almoco_${dayLabel}_${safeDateBR}.xlsx`);
    } catch (err) {
      console.error('Erro ao exportar XLS:', err);
      alert('Erro ao exportar. Tente novamente.');
    } finally {
      setExportingXLS(false);
    }
  };

  /* ── Limpar duplicados de LunchChoices (migração) ── */
  const handleCleanDuplicates = async () => {
    if (!confirm('Isso vai remover registros duplicados de pedidos (mantendo o mais recente por colaborador). Continuar?')) return;
    setCleaningDups(true); setCleanMsg('');
    try {
      const snap = await getDocs(collection(db, CollectionName.LUNCH_CHOICES));
      const groups = new Map<string, { id: string; ref: any; ts: number }[]>();
      snap.docs.forEach(d => {
        const data = d.data() as any;
        const key = `${data.userId}_${data.menuId}`;
        const ts = data.enviadoEm?.toMillis?.() ?? 0;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push({ id: d.id, ref: d.ref, ts });
      });
      let deleted = 0;
      for (const [, docs] of groups) {
        if (docs.length <= 1) continue;
        docs.sort((a, b) => b.ts - a.ts); // newest first
        for (let i = 1; i < docs.length; i++) { await deleteDoc(docs[i].ref); deleted++; }
      }
      setCleanMsg(`✅ Limpeza concluída: ${deleted} duplicata(s) removida(s).`);
      setTimeout(() => setCleanMsg(''), 5000);
    } catch (err) {
      console.error(err); setCleanMsg('❌ Erro ao limpar duplicatas.');
    } finally {
      setCleaningDups(false);
    }
  };

  /* ─── Location helpers ─── */
  const getLocIcon = (tipo: LunchLocationType) => {
    switch (tipo) {
      case 'sede': return <Building2 size={16} className="text-blue-600" />;
      case 'campo': return <MapPin size={16} className="text-green-600" />;
      case 'fora_cidade': return <Plane size={16} className="text-orange-600" />;
    }
  };
  const getLocLabel = (tipo: LunchLocationType) => {
    switch (tipo) {
      case 'sede': return 'Na Sede';
      case 'campo': return 'Em Campo';
      case 'fora_cidade': return 'Fora da Cidade';
    }
  };
  const getLocBadge = (tipo: LunchLocationType) => {
    switch (tipo) {
      case 'sede': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'campo': return 'bg-green-100 text-green-700 border-green-200';
      case 'fora_cidade': return 'bg-orange-100 text-orange-700 border-orange-200';
    }
  };

  /* ─── Render ─── */
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UtensilsCrossed className="text-orange-500" /> Gestão de Almoços
          </h1>
          <p className="text-gray-500 text-sm mt-1">Cadastre o cardápio semanal e acompanhe pedidos dos colaboradores</p>
        </div>
        <button
          onClick={() => setShowSedeConfig(!showSedeConfig)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-orange-600 font-medium transition-colors"
        >
          <Settings2 size={16} /> Configurações
        </button>
      </div>

      {/* Sede Config Panel */}
      {showSedeConfig && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2">
            <Building2 size={16} /> Configurações do Módulo Almoço
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome da Sede</label>
              <input type="text" value={sedeNome} onChange={e => setSedeNome(e.target.value)} placeholder="Ex: Sede MGR"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Endereço Completo da Sede</label>
              <input type="text" value={sedeEndereco} onChange={e => setSedeEndereco(e.target.value)} placeholder="Ex: Rua Exemplo, 123"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Horário Limite para Localização</label>
              <input type="time" value={horarioLimite} onChange={e => setHorarioLimite(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none" />
              <p className="text-xs text-gray-400 mt-1">Colaboradores devem informar até este horário</p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={handleSaveSede} disabled={savingSede}
              className="flex items-center gap-2 px-5 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors text-sm font-medium">
              <Save size={14} /> {savingSede ? 'Salvando...' : 'Salvar Configurações'}
            </button>
            <button onClick={() => setShowSedeMapPicker(true)}
              className="flex items-center gap-2 px-5 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium">
              <MapIcon size={14} /> Abrir Mapa
            </button>
            <button onClick={handleCleanDuplicates} disabled={cleaningDups}
              className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors text-sm font-medium">
              {cleaningDups ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {cleaningDups ? 'Limpando...' : 'Limpar Duplicados'}
            </button>
            <button onClick={() => setShowSedeConfig(false)}
              className="px-4 py-2 text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm">
              Fechar
            </button>

          </div>
          {showSedeMapPicker && (
            <GoogleMapPicker initialSearch={sedeEndereco || sedeNome} title="Selecionar Localização da Sede"
              onConfirm={(data: MapPickerResult) => { setSedeEndereco(data.address); setShowSedeMapPicker(false); }}
              onCancel={() => setShowSedeMapPicker(false)} />
          )}
        </div>
      )}
      {cleanMsg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${cleanMsg.startsWith('✅') ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {cleanMsg}
        </div>
      )}


      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-0 overflow-x-auto">
        {([
          { key: 'cardapio', label: 'Cardápio', icon: Calendar },
          { key: 'pedidos', label: 'Relatório de Pedidos', icon: ClipboardList },
          { key: 'localizacao', label: 'Localização do Dia', icon: MapPin },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Cardápio ── */}
      {activeTab === 'cardapio' && (
        <div className="space-y-6">
          {!showForm && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Novo cardápio:</p>
              <div className="flex gap-2 flex-wrap">
                {([
                  { value: 'semanal' as LunchMenuMode, label: 'Semanal (seg-sex)', emoji: '📅' },
                  { value: 'diario' as LunchMenuMode,  label: 'Diário (data única)', emoji: '📆' },
                  { value: 'fixo' as LunchMenuMode,    label: 'Fixo (sem data)',    emoji: '📌' },
                ] as const).map(opt => (
                  <button key={opt.value}
                    onClick={() => { setModoNovo(opt.value); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-lg font-medium text-sm hover:bg-orange-600 transition-colors shadow-sm">
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showForm && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-900">
                  {modoNovo === 'semanal' ? 'Novo Cardápio Semanal' : modoNovo === 'diario' ? 'Novo Cardápio Diário' : 'Novo Cardápio Fixo'}
                </h2>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                  modoNovo === 'semanal' ? 'bg-blue-100 text-blue-700 border-blue-200'
                  : modoNovo === 'diario' ? 'bg-purple-100 text-purple-700 border-purple-200'
                  : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                  {modoNovo === 'semanal' ? '📅 Semanal' : modoNovo === 'diario' ? '📆 Diário' : '📌 Fixo'}
                </span>
              </div>

              {/* Dates — adaptive per mode */}
              {modoNovo === 'semanal' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Início da Semana (Segunda)</label>
                    <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fim da Semana (Sexta)</label>
                    <input type="date" value={getFridayFromMonday(weekStart)} readOnly
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500" />
                  </div>
                </div>
              )}
              {modoNovo === 'diario' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data do Cardápio</label>
                    <input type="date" value={dataUnica} onChange={e => setDataUnica(e.target.value)}
                      className="w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cadastro rápido (cole o menu do dia)</label>
                    <textarea
                      value={textoLivre}
                      onChange={e => setTextoLivre(e.target.value)}
                      placeholder={'Cole o menu aqui (separe por vírgula, ponto-e-vírgula ou linha):\nFrango Grelhado, Bife acebolado\nArroz, Feijão, Salada'}
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 outline-none"
                    />
                    {textoLivre.trim() && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">Itens detectados:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {parsearTextoLivre(textoLivre).map((item, i) => (
                            <span key={i} className="text-xs bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full">{item}</span>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">💡 Use as seções abaixo para separar em misturas e guarnições, ou adicione tudo como misturas.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {modoNovo === 'fixo' && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
                  📌 Cardápio fixo — sem data de vigência. Fica ativo até ser substituído por outro.
                </div>
              )}

              {/* ── Seção Misturas ── */}
              <div className="space-y-3">
                {/* ── Misturas — tag input ── */}
                <div>
                  <label className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-2">
                    <span className="text-lg">🥩</span> Misturas da Semana
                    <span className="text-xs font-normal text-gray-400">proteínas / pratos principais</span>
                  </label>
                  {/* Chips existentes */}
                  {misturasTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {misturasTags.map(tag => (
                        <span key={tag}
                          className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-800 border border-orange-300 px-3 py-1.5 rounded-full text-sm font-medium">
                          🥩 {tag}
                          <button onClick={() => removeMisturaTag(tag)}
                            className="text-orange-500 hover:text-red-600 transition-colors ml-0.5 font-bold text-xs">✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Input para adicionar */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={misturaDraft}
                      onChange={e => setMisturaDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitMistura(); } }}
                      placeholder="Digite o nome da mistura e pressione Enter... (ex: Frango Grelhado)"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
                    />
                    <button onClick={commitMistura} disabled={!misturaDraft.trim()}
                      className="px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-40 transition-colors text-sm font-medium flex items-center gap-1">
                      <Plus size={14} /> Add
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Pressione <kbd className="bg-gray-100 border border-gray-300 rounded px-1 text-[10px]">Enter</kbd> ou clique em Add para incluir cada mistura</p>
                </div>

                {/* ── Guarnições — tag input ── */}
                <div>
                  <label className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-2">
                    <span className="text-lg">🥗</span> Guarnições da Semana
                    <span className="text-xs font-normal text-gray-400">acompanhamentos / saladas</span>
                  </label>
                  {guarnicoesTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {guarnicoesTags.map(tag => (
                        <span key={tag}
                          className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 border border-green-300 px-3 py-1.5 rounded-full text-sm font-medium">
                          🥗 {tag}
                          <button onClick={() => removeGuarnicaoTag(tag)}
                            className="text-green-500 hover:text-red-600 transition-colors ml-0.5 font-bold text-xs">✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={guarnicaoDraft}
                      onChange={e => setGuarnicaoDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitGuarnicao(); } }}
                      placeholder="Digite o nome da guarnição e pressione Enter... (ex: Arroz Branco)"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-300 focus:border-green-400 outline-none"
                    />
                    <button onClick={commitGuarnicao} disabled={!guarnicaoDraft.trim()}
                      className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors text-sm font-medium flex items-center gap-1">
                      <Plus size={14} /> Add
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Pressione <kbd className="bg-gray-100 border border-gray-300 rounded px-1 text-[10px]">Enter</kbd> ou clique em Add para incluir cada guarnição</p>
                </div>
              </div>{/* end space-y-3 */}

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button onClick={handleSaveMenu} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors font-medium">
                  <Save size={16} /> {saving ? 'Salvando...' : 'Salvar e Ativar Cardápio'}
                </button>
                <button onClick={() => { setShowForm(false); setMisturasTags([]); setGuarnicoesTags([]); setMisturaDraft(''); setGuarnicaoDraft(''); }}
                  className="px-5 py-2.5 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Menu list */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Cardápios cadastrados</h3>
            {loadingMenus && <div className="text-sm text-gray-400">Carregando...</div>}
            {!loadingMenus && menus.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <UtensilsCrossed size={40} className="mx-auto mb-3 opacity-40" />
                <p>Nenhum cardápio cadastrado ainda.</p>
              </div>
            )}
            {menus.map(menu => {
              const menuMisturas  = menu.pratos.filter(p => p.categoria === 'mistura');
              const menuGuarnicoes = menu.pratos.filter(p => p.categoria === 'guarnicao');
              return (
                <div key={menu.id}
                  className={`bg-white rounded-xl border shadow-sm p-5 ${menu.status === 'ativo' ? 'border-green-300 ring-1 ring-green-100' : 'border-gray-200'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900">
                          {(menu.modo === 'diario' || (!menu.modo && !menu.weekStart)) && menu.dataUnica
                            ? `Cardápio ${formatDateBR(menu.dataUnica)}`
                            : menu.modo === 'fixo'
                            ? 'Cardápio Fixo'
                            : `Semana ${formatDateBR(menu.weekStart)} a ${formatDateBR(menu.weekEnd)}`
                          }
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                          (menu.modo || 'semanal') === 'semanal' ? 'bg-blue-50 text-blue-600 border-blue-200'
                          : menu.modo === 'diario' ? 'bg-purple-50 text-purple-600 border-purple-200'
                          : 'bg-gray-50 text-gray-500 border-gray-200'
                        }`}>
                          {(menu.modo || 'semanal') === 'semanal' ? '📅' : menu.modo === 'diario' ? '📆' : '📌'} {(menu.modo || 'semanal').charAt(0).toUpperCase() + (menu.modo || 'semanal').slice(1)}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                          menu.status === 'ativo' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          {menu.status === 'ativo' ? '● Ativo' : 'Encerrado'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {menuMisturas.length} mistura(s) · {menuGuarnicoes.length} guarnição(ões) · Criado por {menu.criadoPorNome}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {menu.status === 'ativo' && (
                        <>
                          <button onClick={() => openEditMenu(menu)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors font-medium flex items-center gap-1">
                            <Pencil size={12} /> Editar Cardápio
                          </button>
                          <button onClick={() => toggleMenuStatus(menu.id, 'encerrado')}
                            className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors font-medium">Encerrar</button>
                        </>
                      )}
                      {menu.status === 'encerrado' && (
                        <>
                          <button onClick={() => openEditMenu(menu)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors font-medium flex items-center gap-1">
                            <Pencil size={12} /> Editar
                          </button>
                          <button onClick={() => toggleMenuStatus(menu.id, 'ativo')}
                            className="text-xs px-3 py-1.5 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition-colors font-medium">Reativar</button>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Badges separados por categoria */}
                  <div className="mt-3 space-y-2">
                    {menuMisturas.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wide mr-1">🥩 Misturas:</span>
                        {menuMisturas.map(p => (
                          <span key={p.id} className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">{p.nome}</span>
                        ))}
                      </div>
                    )}
                    {menuGuarnicoes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] font-bold text-green-600 uppercase tracking-wide mr-1">🥗 Guarnições:</span>
                        {menuGuarnicoes.map(p => (
                          <span key={p.id} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">{p.nome}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB: Relatório de Pedidos ── */}
      {activeTab === 'pedidos' && (
        <div className="space-y-5">
          {!isPastDeadlineMgmt && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-800">⏳ Aguarde até as {horarioLimite} para gerar o pedido final</p>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                  Colaboradores podem informar ou alterar a localização até as <strong>{horarioLimite}</strong>.
                </p>
                <p className="text-[10px] text-amber-600 mt-2 font-medium">Horário atual: {currentTimeMgmt} · Limite: {horarioLimite}</p>
              </div>
            </div>
          )}
          {isPastDeadlineMgmt && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <Check size={16} className="text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-800"><strong>✅ Horário limite ({horarioLimite}) atingido.</strong> Os relatórios estão prontos para serem copiados.</p>
            </div>
          )}

          {/* Filtro único por data */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Calendar size={14} className="text-orange-500" />
                  Data do Relatório
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
                />
                {selectedDate && (
                  <p className="text-xs text-orange-600 font-semibold mt-1.5">
                    📅 {getDayOfWeekLabel(selectedDate)} · {formatDateBR(selectedDate)}
                  </p>
                )}
              </div>
              <div className="text-sm text-gray-500 pb-1">
                {filteredChoicesByDate.length} pedido{filteredChoicesByDate.length !== 1 ? 's' : ''} encontrado{filteredChoicesByDate.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Lista de pedidos */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">
                📋 Lista de Pedidos — {getDayOfWeekLabel(selectedDate) || 'Selecione uma data'}
                {selectedDate && <span className="ml-1 font-normal text-gray-500">· {formatDateBR(selectedDate)}</span>}
                <span className="ml-2 text-xs font-normal text-gray-500">({filteredChoicesByDate.length} pedido{filteredChoicesByDate.length !== 1 ? 's' : ''})</span>
              </h3>
              {filteredChoicesByDate.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={handleCopy}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      copied ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'}`}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copiado!' : 'Copiar Lista'}
                  </button>
                  <button onClick={handleExportXLS} disabled={exportingXLS}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all disabled:opacity-50">
                    {exportingXLS ? <Loader2 size={14} className="animate-spin" /> : <span>📊</span>}
                    {exportingXLS ? 'Exportando...' : 'Exportar Excel'}
                  </button>
                </div>
              )}
            </div>
            {filteredChoicesByDate.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <ClipboardList size={36} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum pedido encontrado para {formatDateBR(selectedDate)}</p>
                <p className="text-xs mt-1 text-gray-300">Verifique se a data está correta</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {filteredChoicesByDate.map(({ choice, dayKey, menuEncerrado }, idx) => {
                  const dc = choice.escolhas[dayKey] as LunchDayChoice | null;
                  return (
                    <li key={choice.id} className={`px-5 py-3 hover:bg-orange-50/30 transition-colors ${
                      menuEncerrado ? 'border-l-4 border-amber-400 bg-amber-50/20' : ''
                    }`}>
                      <div className="flex items-start gap-3">
                        <span className="text-sm font-bold text-gray-400 w-6 text-right mt-0.5">{idx + 1}.</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">{choice.userName}</p>
                            {menuEncerrado && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                                <AlertTriangle size={9} /> Cardápio Desativado
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {dc?.misturas?.map(m => (
                              <span key={m.id} className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">🥩 {m.nome}</span>
                            ))}
                            {dc?.guarnicoes?.map(g => (
                              <span key={g.id} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">🥗 {g.nome}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Fora da cidade */}
          {dayLocations.fora.length > 0 && (
            <div className="bg-white rounded-xl border border-orange-200 shadow-sm">
              <div className="px-5 py-4 border-b border-orange-100 bg-orange-50/50">
                <h3 className="text-sm font-bold text-orange-800 flex items-center gap-2">
                  <Plane size={16} /> Fora da Cidade — NÃO pedir marmita
                  <span className="text-xs font-normal text-orange-600">({dayLocations.fora.length})</span>
                </h3>
              </div>
              <ul className="divide-y divide-orange-50">
                {dayLocations.fora.map(loc => (
                  <li key={loc.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="text-sm font-medium text-gray-700">❌ {loc.userName}</span>
                    <span className="text-xs text-orange-500 italic ml-auto">Vale-alimentação</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Agrupado por endereço */}
          {groupedByAddress.length > 0 && (
            <div className="bg-white rounded-xl border border-green-200 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-green-100 bg-green-50/50">
                <h3 className="text-sm font-bold text-green-800 flex items-center gap-2">
                  <Layers size={16} /> Agrupado por Endereço de Entrega
                </h3>
                <button onClick={handleCopyGrouped}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    copiedGrouped ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'}`}>
                  {copiedGrouped ? <Check size={14} /> : <Copy size={14} />}
                  {copiedGrouped ? 'Copiado!' : 'Copiar Lista Agrupada'}
                </button>
              </div>
              <div className="divide-y divide-green-50">
                {groupedByAddress.map((group, gi) => (
                  <div key={gi} className="px-5 py-4">
                    <div className="flex items-start gap-2 mb-2">
                      <MapPin size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm font-bold text-gray-800">{group.address}</p>
                    </div>
                    <div className="ml-6 space-y-2">
                      {group.meals.map((m, mi) => (
                        <div key={mi} className="text-xs text-gray-600">
                          <p className="font-medium text-gray-800">• {m.userName}</p>
                          <p className="ml-3 text-orange-600">🥩 {m.misturas}</p>
                          <p className="ml-3 text-green-600">🥗 {m.guarnicoes}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pré-visualização do clipboard */}
          {groupedByAddress.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 font-medium mb-2">Pré-visualização (lista agrupada por endereço):</p>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{buildGroupedClipboardText()}</pre>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Localização do Dia ── */}
      {activeTab === 'localizacao' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                <input type="date" value={locDate} onChange={e => setLocDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none" />
              </div>
              <div className="text-sm text-gray-500">{locations.length} registro(s) para {formatDateBR(locDate)}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {locations.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <MapPin size={36} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhuma localização informada para esta data</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Colaborador</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden sm:table-cell">Endereço / Cliente</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden md:table-cell">Horário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {locations.map(loc => (
                    <tr key={loc.id} className="hover:bg-orange-50/30 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-900">{loc.userName}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${getLocBadge(loc.tipo)}`}>
                          {getLocIcon(loc.tipo)} {getLocLabel(loc.tipo)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600 hidden sm:table-cell">
                        {loc.tipo === 'sede' && <span className="text-blue-600">{sedeNome}{sedeEndereco ? ` — ${sedeEndereco}` : ''}</span>}
                        {loc.tipo === 'campo' && <span>{loc.endereco}{loc.clienteNome ? ` • ${loc.clienteNome}` : ''}</span>}
                        {loc.tipo === 'fora_cidade' && <span className="text-orange-600 italic">Marmita não será pedida</span>}
                      </td>
                      <td className="px-5 py-3 text-gray-500 hidden md:table-cell text-xs">
                        {loc.informadoEm?.toDate?.()?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ═══ MODAL: EDITAR CARDÁPIO ═══ */}
      {editingMenu && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Pencil size={18} className="text-blue-600" /> Editar Cardápio
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Semana {formatDateBR(editingMenu.weekStart)} a {formatDateBR(editingMenu.weekEnd)}
                </p>
              </div>
              <button onClick={() => setEditingMenu(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Warning */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>Atenção:</strong> Se remover um prato que já foi selecionado por colaboradores, 
                  ele aparecerá em <span className="text-red-600 font-bold">vermelho</span> no pedido do colaborador com aviso "Item indisponível". 
                  O colaborador poderá alterar seu pedido.
                </p>
              </div>

              {/* Misturas */}
              <div>
                <label className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-2">
                  <span className="text-lg">🥩</span> Misturas
                  <span className="text-xs font-normal text-gray-400">{editMisturas.length} item(ns)</span>
                </label>
                {editMisturas.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editMisturas.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-800 border border-orange-300 px-3 py-1.5 rounded-full text-sm font-medium">
                        🥩 {tag}
                        <button onClick={() => setEditMisturas(prev => prev.filter(t => t !== tag))}
                          className="text-orange-500 hover:text-red-600 transition-colors ml-0.5 font-bold text-xs">✕</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="text" value={editMisturaDraft} onChange={e => setEditMisturaDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const v = editMisturaDraft.trim();
                        if (v && !editMisturas.includes(v)) setEditMisturas(prev => [...prev, v]);
                        setEditMisturaDraft('');
                      }
                    }}
                    placeholder="Adicionar mistura..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none" />
                  <button onClick={() => {
                    const v = editMisturaDraft.trim();
                    if (v && !editMisturas.includes(v)) setEditMisturas(prev => [...prev, v]);
                    setEditMisturaDraft('');
                  }} disabled={!editMisturaDraft.trim()}
                    className="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-40 transition-colors text-sm font-medium">
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Guarnições */}
              <div>
                <label className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-2">
                  <span className="text-lg">🥗</span> Guarnições
                  <span className="text-xs font-normal text-gray-400">{editGuarnicoes.length} item(ns)</span>
                </label>
                {editGuarnicoes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editGuarnicoes.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 border border-green-300 px-3 py-1.5 rounded-full text-sm font-medium">
                        🥗 {tag}
                        <button onClick={() => setEditGuarnicoes(prev => prev.filter(t => t !== tag))}
                          className="text-green-500 hover:text-red-600 transition-colors ml-0.5 font-bold text-xs">✕</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="text" value={editGuarnicaoDraft} onChange={e => setEditGuarnicaoDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const v = editGuarnicaoDraft.trim();
                        if (v && !editGuarnicoes.includes(v)) setEditGuarnicoes(prev => [...prev, v]);
                        setEditGuarnicaoDraft('');
                      }
                    }}
                    placeholder="Adicionar guarnição..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-300 outline-none" />
                  <button onClick={() => {
                    const v = editGuarnicaoDraft.trim();
                    if (v && !editGuarnicoes.includes(v)) setEditGuarnicoes(prev => [...prev, v]);
                    setEditGuarnicaoDraft('');
                  }} disabled={!editGuarnicaoDraft.trim()}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors text-sm font-medium">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setEditingMenu(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium">
                Cancelar
              </button>
              <button onClick={handleSaveMenuEdit} disabled={savingMenuEdit}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors text-sm font-bold flex items-center justify-center gap-2">
                {savingMenuEdit ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : <><Save size={16} /> Salvar Alterações</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LunchManagement;
