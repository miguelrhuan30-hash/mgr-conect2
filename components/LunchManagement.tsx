import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc,
  Timestamp, getDocs, getDoc, setDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName, LunchMenu, LunchDish, LunchChoice, LunchLocation, LunchLocationType, LunchConfig } from '../types';
import {
  UtensilsCrossed, Plus, Trash2, Save, Copy, Check,
  CheckCircle2, MapPin, Building2, Plane, AlertTriangle,
  Calendar, ClipboardList, Settings2, Filter, Layers,
  Map as MapIcon
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

  // ── Form state (new menu) ──
  const [showForm, setShowForm] = useState(false);
  const [weekStart, setWeekStart] = useState(getNextMonday());
  const [pratos, setPratos] = useState<LunchDish[]>([
    { id: generateId(), nome: '', descricao: '', ordem: 1 },
  ]);
  const [saving, setSaving] = useState(false);

  // ── Choices ──
  const [choices, setChoices] = useState<LunchChoice[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayKey>('segunda');
  const [copied, setCopied] = useState(false);
  const [copiedGrouped, setCopiedGrouped] = useState(false);

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
    const q = query(
      collection(db, CollectionName.LUNCH_MENUS),
      orderBy('criadoEm', 'desc'),
    );
    return onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as LunchMenu[];
      setMenus(data);
      setLoadingMenus(false);
      if (!selectedMenuId && data.length > 0) setSelectedMenuId(data[0].id);
    });
  }, []);

  /* ─── Real-time: choices for selected menu ─── */
  useEffect(() => {
    if (!selectedMenuId) return;
    const q = query(
      collection(db, CollectionName.LUNCH_CHOICES),
      where('menuId', '==', selectedMenuId),
    );
    return onSnapshot(q, snap => {
      setChoices(snap.docs.map(d => ({ id: d.id, ...d.data() })) as LunchChoice[]);
    });
  }, [selectedMenuId]);

  /* ─── Real-time: locations for selected date ─── */
  useEffect(() => {
    if (!locDate) return;
    const q = query(
      collection(db, CollectionName.LUNCH_LOCATIONS),
      where('data', '==', locDate),
    );
    return onSnapshot(q, snap => {
      setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() })) as LunchLocation[]);
    });
  }, [locDate]);

  /* ─── Prato CRUD ─── */
  const addPrato = () =>
    setPratos(prev => [...prev, { id: generateId(), nome: '', descricao: '', ordem: prev.length + 1 }]);

  const removePrato = (id: string) =>
    setPratos(prev => prev.filter(p => p.id !== id).map((p, i) => ({ ...p, ordem: i + 1 })));

  const updatePrato = (id: string, field: 'nome' | 'descricao', value: string) =>
    setPratos(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)));

  /* ─── Save HQ config ─── */
  const handleSaveSede = async () => {
    if (!currentUser) return;
    setSavingSede(true);
    try {
      await setDoc(doc(db, CollectionName.LUNCH_CONFIG, 'sede'), {
        sedeNome,
        sedeEndereco,
        horarioLimite,
        atualizadoPor: currentUser.uid,
        atualizadoEm: Timestamp.now(),
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
    const cleanPratos = pratos.filter(p => p.nome.trim());
    if (cleanPratos.length === 0) return alert('Adicione ao menos 1 prato.');

    setSaving(true);
    try {
      const activeMenus = menus.filter(m => m.status === 'ativo');
      for (const m of activeMenus) {
        await updateDoc(doc(db, CollectionName.LUNCH_MENUS, m.id), { status: 'encerrado' });
      }
      await addDoc(collection(db, CollectionName.LUNCH_MENUS), {
        weekStart,
        weekEnd: getFridayFromMonday(weekStart),
        status: 'ativo',
        pratos: cleanPratos,
        criadoPor: currentUser.uid,
        criadoPorNome: userProfile.displayName,
        criadoEm: Timestamp.now(),
      });
      setShowForm(false);
      setPratos([{ id: generateId(), nome: '', descricao: '', ordem: 1 }]);
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

  /* ─── Pedidos: filtered + grouped ─── */

  // Choices that have a meal selected for the day
  const filteredChoices = useMemo(() => {
    return choices.filter(c => {
      const dayChoice = c.escolhas[selectedDay];
      return dayChoice && dayChoice.pratoNome;
    });
  }, [choices, selectedDay]);

  // Split locations for the selected day into sede / campo / fora
  const dayLocations = useMemo(() => {
    // Get the ISO date for the selected day of the selected menu
    const menuObj = menus.find(m => m.id === selectedMenuId);
    if (!menuObj) return { sede: [] as (LunchLocation & { prato?: string })[], campo: [] as (LunchLocation & { prato?: string })[], fora: [] as (LunchLocation & { prato?: string })[] };

    const dayIndex = DAY_KEYS.indexOf(selectedDay);
    const menuDate = new Date(menuObj.weekStart + 'T12:00:00');
    menuDate.setDate(menuDate.getDate() + dayIndex);
    const dateISO = menuDate.toISOString().split('T')[0];

    const dayLocs = locations.filter(l => l.data === dateISO);

    type LocWithPrato = LunchLocation & { prato?: string };
    const sede: LocWithPrato[] = [];
    const campo: LocWithPrato[] = [];
    const fora: LocWithPrato[] = [];

    dayLocs.forEach(loc => {
      const userChoice = choices.find(c => c.userId === loc.userId);
      const prato = userChoice?.escolhas[selectedDay]?.pratoNome;
      const item = { ...loc, prato };

      if (loc.tipo === 'sede') sede.push(item);
      else if (loc.tipo === 'campo') campo.push(item);
      else if (loc.tipo === 'fora_cidade') fora.push(item);
    });

    return { sede, campo, fora };
  }, [locations, choices, selectedDay, selectedMenuId, menus]);

  // Group by address for the delivery clipboard
  const groupedByAddress = useMemo(() => {
    const groups: Record<string, { address: string; meals: { userName: string; prato: string }[] }> = {};

    // Sede group
    const sedeLabel = `${sedeNome}${sedeEndereco ? ' - ' + sedeEndereco : ''}`;

    filteredChoices.forEach(c => {
      const prato = c.escolhas[selectedDay]?.pratoNome || '';
      // Find location for this user
      const menuObj = menus.find(m => m.id === selectedMenuId);
      if (!menuObj) return;
      const dayIndex = DAY_KEYS.indexOf(selectedDay);
      const menuDate = new Date(menuObj.weekStart + 'T12:00:00');
      menuDate.setDate(menuDate.getDate() + dayIndex);
      const dateISO = menuDate.toISOString().split('T')[0];

      const loc = locations.find(l => l.userId === c.userId && l.data === dateISO);

      // Skip "fora da cidade" — they don't get meals
      if (loc?.tipo === 'fora_cidade') return;

      let addressKey: string;
      if (!loc || loc.tipo === 'sede') {
        addressKey = sedeLabel;
      } else {
        // campo
        const addrParts = [loc.clienteNome, loc.endereco].filter(Boolean).join(' - ');
        addressKey = addrParts || 'Endereço não informado';
      }

      if (!groups[addressKey]) {
        groups[addressKey] = { address: addressKey, meals: [] };
      }
      groups[addressKey].meals.push({ userName: c.userName, prato });
    });

    return Object.values(groups);
  }, [filteredChoices, locations, selectedDay, selectedMenuId, menus, sedeNome, sedeEndereco]);

  /* ─── Clipboard: simple list ─── */
  const buildClipboardText = (): string => {
    const menuObj = menus.find(m => m.id === selectedMenuId);
    const weekLabel = menuObj ? `${formatDateBR(menuObj.weekStart)} a ${formatDateBR(menuObj.weekEnd)}` : '';
    let text = `📋 Pedidos ${DAY_LABELS[selectedDay]} (${weekLabel}):\n\n`;
    filteredChoices.forEach((c, i) => {
      const prato = c.escolhas[selectedDay]!;
      text += `${i + 1}. ${c.userName} — ${prato.pratoNome}\n`;
    });
    text += `\nTotal: ${filteredChoices.length} pedido(s)`;
    return text;
  };

  /* ─── Clipboard: grouped by address ─── */
  const buildGroupedClipboardText = (): string => {
    const menuObj = menus.find(m => m.id === selectedMenuId);
    const weekLabel = menuObj ? `${formatDateBR(menuObj.weekStart)} a ${formatDateBR(menuObj.weekEnd)}` : '';
    let text = `📋 Pedidos por Endereço — ${DAY_LABELS[selectedDay]} (${weekLabel}):\n`;

    groupedByAddress.forEach(group => {
      // Count meals by type
      const mealCounts: Record<string, number> = {};
      group.meals.forEach(m => {
        mealCounts[m.prato] = (mealCounts[m.prato] || 0) + 1;
      });
      const summary = Object.entries(mealCounts)
        .map(([prato, count]) => `${count} marmita ${prato}`)
        .join(', ');

      text += `\n📍 ${group.address}\n`;
      text += `   ${summary}\n`;
      group.meals.forEach(m => {
        text += `   • ${m.userName} — ${m.prato}\n`;
      });
    });

    // Fora da cidade section
    const foraChoices = filteredChoices.filter(c => {
      const menuObj2 = menus.find(m => m.id === selectedMenuId);
      if (!menuObj2) return false;
      const dayIndex = DAY_KEYS.indexOf(selectedDay);
      const menuDate = new Date(menuObj2.weekStart + 'T12:00:00');
      menuDate.setDate(menuDate.getDate() + dayIndex);
      const dateISO = menuDate.toISOString().split('T')[0];
      const loc = locations.find(l => l.userId === c.userId && l.data === dateISO);
      return loc?.tipo === 'fora_cidade';
    });

    if (foraChoices.length > 0) {
      text += `\n✈️ Fora da Cidade (NÃO pedir):\n`;
      foraChoices.forEach(c => {
        text += `   ❌ ${c.userName}\n`;
      });
    }

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

  /* ════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════ */

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
              <input
                type="text"
                value={sedeNome}
                onChange={e => setSedeNome(e.target.value)}
                placeholder="Ex: Sede MGR"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Endereço Completo da Sede</label>
              <input
                type="text"
                value={sedeEndereco}
                onChange={e => setSedeEndereco(e.target.value)}
                placeholder="Ex: Rua Exemplo, 123, Centro, Cidade"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Horário Limite para Localização</label>
              <input
                type="time"
                value={horarioLimite}
                onChange={e => setHorarioLimite(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Colaboradores devem informar localização até este horário</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSaveSede}
              disabled={savingSede}
              className="flex items-center gap-2 px-5 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              <Save size={14} /> {savingSede ? 'Salvando...' : 'Salvar Configurações'}
            </button>
            <button
              onClick={() => setShowSedeMapPicker(true)}
              className="flex items-center gap-2 px-5 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
            >
              <MapIcon size={14} /> Abrir Mapa
            </button>
            <button
              onClick={() => setShowSedeConfig(false)}
              className="px-4 py-2 text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              Fechar
            </button>
          </div>

          {/* Google Maps Picker for Sede */}
          {showSedeMapPicker && (
            <GoogleMapPicker
              initialSearch={sedeEndereco || sedeNome}
              title="Selecionar Localização da Sede"
              onConfirm={(data: MapPickerResult) => {
                setSedeEndereco(data.address);
                setShowSedeMapPicker(false);
              }}
              onCancel={() => setShowSedeMapPicker(false)}
            />
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-0 overflow-x-auto">
        {([
          { key: 'cardapio', label: 'Cardápio', icon: Calendar },
          { key: 'pedidos', label: 'Relatório de Pedidos', icon: ClipboardList },
          { key: 'localizacao', label: 'Localização do Dia', icon: MapPin },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Cardápio ── */}
      {activeTab === 'cardapio' && (
        <div className="space-y-6">
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium shadow-sm"
            >
              <Plus size={18} /> Cadastrar Cardápio da Semana
            </button>
          )}

          {showForm && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
              <h2 className="text-lg font-bold text-gray-900">Novo Cardápio Semanal</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Início da Semana (Segunda)</label>
                  <input
                    type="date"
                    value={weekStart}
                    onChange={e => setWeekStart(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fim da Semana (Sexta)</label>
                  <input
                    type="date"
                    value={getFridayFromMonday(weekStart)}
                    readOnly
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Pratos Disponíveis</label>
                  <button onClick={addPrato} className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium">
                    <Plus size={14} /> Adicionar Prato
                  </button>
                </div>
                {pratos.map((prato, idx) => (
                  <div key={prato.id} className="flex gap-3 items-start bg-orange-50/50 rounded-lg p-3 border border-orange-100">
                    <span className="text-sm font-bold text-orange-400 mt-2 w-6 text-center">{idx + 1}</span>
                    <div className="flex-1 space-y-2">
                      <input type="text" placeholder="Nome do prato (ex: Frango Grelhado)" value={prato.nome}
                        onChange={e => updatePrato(prato.id, 'nome', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none" />
                      <input type="text" placeholder="Descrição (ex: Acompanha arroz e salada)" value={prato.descricao || ''}
                        onChange={e => updatePrato(prato.id, 'descricao', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-200 outline-none text-gray-600" />
                    </div>
                    {pratos.length > 1 && (
                      <button onClick={() => removePrato(prato.id)} className="mt-2 text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveMenu} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors font-medium">
                  <Save size={16} /> {saving ? 'Salvando...' : 'Salvar e Ativar Cardápio'}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium">Cancelar</button>
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
            {menus.map(menu => (
              <div key={menu.id}
                className={`bg-white rounded-xl border shadow-sm p-5 ${menu.status === 'ativo' ? 'border-green-300 ring-1 ring-green-100' : 'border-gray-200'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">Semana {formatDateBR(menu.weekStart)} a {formatDateBR(menu.weekEnd)}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                        menu.status === 'ativo' ? 'bg-green-100 text-green-700 border-green-200'
                        : menu.status === 'rascunho' ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {menu.status === 'ativo' ? '● Ativo' : menu.status === 'rascunho' ? 'Rascunho' : 'Encerrado'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{menu.pratos.length} prato(s) • Criado por {menu.criadoPorNome}</p>
                  </div>
                  <div className="flex gap-2">
                    {menu.status === 'ativo' && (
                      <button onClick={() => toggleMenuStatus(menu.id, 'encerrado')}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors font-medium">Encerrar</button>
                    )}
                    {menu.status === 'encerrado' && (
                      <button onClick={() => toggleMenuStatus(menu.id, 'ativo')}
                        className="text-xs px-3 py-1.5 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition-colors font-medium">Reativar</button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {menu.pratos.map(p => (
                    <span key={p.id} className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full">🍽️ {p.nome}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: Relatório de Pedidos ── */}
      {activeTab === 'pedidos' && (
        <div className="space-y-5">
          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Cardápio</label>
                <select value={selectedMenuId} onChange={e => setSelectedMenuId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none">
                  {menus.map(m => (
                    <option key={m.id} value={m.id}>{formatDateBR(m.weekStart)} a {formatDateBR(m.weekEnd)} {m.status === 'ativo' ? '● Ativo' : ''}</option>
                  ))}
                </select>
              </div>
              <div className="sm:w-52">
                <label className="block text-sm font-medium text-gray-700 mb-1">Dia da Semana</label>
                <select value={selectedDay} onChange={e => setSelectedDay(e.target.value as DayKey)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none">
                  {DAY_KEYS.map(k => (<option key={k} value={k}>{DAY_LABELS[k]}</option>))}
                </select>
              </div>
            </div>
          </div>

          {/* ── LIST 1: Simple list (all orders) ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">
                📋 Lista de Pedidos — {DAY_LABELS[selectedDay]}
                <span className="ml-2 text-xs font-normal text-gray-500">({filteredChoices.length} pedido{filteredChoices.length !== 1 ? 's' : ''})</span>
              </h3>
              {filteredChoices.length > 0 && (
                <button onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    copied ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'}`}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copiado!' : 'Copiar Lista'}
                </button>
              )}
            </div>
            {filteredChoices.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <ClipboardList size={36} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum pedido para {DAY_LABELS[selectedDay]}</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {filteredChoices.map((c, idx) => (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-3 hover:bg-orange-50/30 transition-colors">
                    <span className="text-sm font-bold text-gray-400 w-6 text-right">{idx + 1}.</span>
                    <span className="text-sm font-medium text-gray-900 flex-1">{c.userName}</span>
                    <span className="text-sm text-orange-600 font-medium">{c.escolhas[selectedDay]?.pratoNome}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── LIST 2: Fora da Cidade (separated) ── */}
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

          {/* ── LIST 3: Agrupado por Endereço ── */}
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
                {groupedByAddress.map((group, gi) => {
                  // Count meals by type
                  const mealCounts: Record<string, number> = {};
                  group.meals.forEach(m => {
                    mealCounts[m.prato] = (mealCounts[m.prato] || 0) + 1;
                  });
                  return (
                    <div key={gi} className="px-5 py-4">
                      <div className="flex items-start gap-2 mb-2">
                        <MapPin size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-gray-800">{group.address}</p>
                          <p className="text-xs text-green-700 mt-0.5">
                            {Object.entries(mealCounts).map(([prato, count]) => `${count} marmita ${prato}`).join(', ')}
                          </p>
                        </div>
                      </div>
                      <div className="ml-6 space-y-0.5">
                        {group.meals.map((m, mi) => (
                          <p key={mi} className="text-xs text-gray-600">• {m.userName} — {m.prato}</p>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preview grouped text */}
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none" />
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
                          {getLocIcon(loc.tipo)}
                          {getLocLabel(loc.tipo)}
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
    </div>
  );
};

export default LunchManagement;
