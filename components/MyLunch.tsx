import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, orderBy, onSnapshot, addDoc, getDocs,
  deleteDoc, Timestamp, limit, doc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName, LunchMenu, LunchChoice, LunchLocation, LunchLocationType, LunchConfig } from '../types';
import {
  UtensilsCrossed, CheckCircle2, MapPin, Building2, Plane,
  AlertTriangle, Navigation, Pencil, Send, ArrowRight, Clock,
  Info, ChevronDown, Map as MapIcon
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

const DAY_EMOJIS: Record<DayKey, string> = {
  segunda: '📅',
  terca: '📅',
  quarta: '📅',
  quinta: '📅',
  sexta: '📅',
};

/* ════════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════════ */

const MyLunch: React.FC = () => {
  const { currentUser, userProfile } = useAuth();

  // ── Active menu ──
  const [activeMenu, setActiveMenu] = useState<LunchMenu | null>(null);
  const [loadingMenu, setLoadingMenu] = useState(true);

  // ── User's choices ──
  const [existingChoice, setExistingChoice] = useState<LunchChoice | null>(null);
  const [loadingChoice, setLoadingChoice] = useState(true);

  // ── Selection form ──
  const [selections, setSelections] = useState<Record<DayKey, string>>({
    segunda: '', terca: '', quarta: '', quinta: '', sexta: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ── Location form ──
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

  // ── Sede config ──
  const [sedeNome, setSedeNome] = useState('Sede MGR');
  const [sedeEndereco, setSedeEndereco] = useState('');
  const [horarioLimite, setHorarioLimite] = useState('10:00');

  const todayISO = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const isPastDeadline = currentTimeStr >= horarioLimite;

  /* ─── Load sede config ─── */
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

  /* ─── Real-time: active menu ─── */
  useEffect(() => {
    const q = query(
      collection(db, CollectionName.LUNCH_MENUS),
      where('status', '==', 'ativo'),
      orderBy('criadoEm', 'desc'),
      limit(1),
    );
    return onSnapshot(q, snap => {
      if (!snap.empty) {
        setActiveMenu({ id: snap.docs[0].id, ...snap.docs[0].data() } as LunchMenu);
      } else {
        setActiveMenu(null);
      }
      setLoadingMenu(false);
    });
  }, []);

  /* ─── Real-time: existing choice for current user + menu ─── */
  useEffect(() => {
    if (!activeMenu || !currentUser) {
      setLoadingChoice(false);
      return;
    }
    const q = query(
      collection(db, CollectionName.LUNCH_CHOICES),
      where('menuId', '==', activeMenu.id),
      where('userId', '==', currentUser.uid),
      limit(1),
    );
    return onSnapshot(q, snap => {
      if (!snap.empty) {
        setExistingChoice({ id: snap.docs[0].id, ...snap.docs[0].data() } as LunchChoice);
      } else {
        setExistingChoice(null);
      }
      setLoadingChoice(false);
    });
  }, [activeMenu, currentUser]);

  /* ─── Real-time: today's location ─── */
  useEffect(() => {
    if (!currentUser) {
      setLoadingLocation(false);
      return;
    }
    const q = query(
      collection(db, CollectionName.LUNCH_LOCATIONS),
      where('userId', '==', currentUser.uid),
      where('data', '==', todayISO),
      limit(1),
    );
    return onSnapshot(q, snap => {
      if (!snap.empty) {
        setTodayLocation({ id: snap.docs[0].id, ...snap.docs[0].data() } as LunchLocation);
      } else {
        setTodayLocation(null);
      }
      setLoadingLocation(false);
    });
  }, [currentUser, todayISO]);

  /* ─── Submit choices ─── */
  const handleSubmitChoices = async () => {
    if (!currentUser || !userProfile || !activeMenu) return;
    setSubmitting(true);
    try {
      const escolhas: LunchChoice['escolhas'] = {};
      for (const day of DAY_KEYS) {
        const pratoId = selections[day];
        if (pratoId) {
          const prato = activeMenu.pratos.find(p => p.id === pratoId);
          if (prato) {
            escolhas[day] = { pratoId: prato.id, pratoNome: prato.nome };
          }
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

  /* ─── GPS location ─── */
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada pelo seu navegador.');
      return;
    }
    setGettingGPS(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        // Reverse geocoding via Nominatim (free)
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );
          const data = await res.json();
          if (data.display_name) {
            setAddress(data.display_name);
          }
        } catch (err) {
          console.error('Erro ao buscar endereço:', err);
        }
        setGettingGPS(false);
      },
      (err) => {
        console.error('Erro de GPS:', err);
        alert('Não foi possível obter sua localização. Verifique as permissões do navegador.');
        setGettingGPS(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  /* ─── Submit location ─── */
  const handleSubmitLocation = async (tipo: LunchLocationType) => {
    if (!currentUser || !userProfile) return;
    setSubmittingLoc(true);
    try {
      await addDoc(collection(db, CollectionName.LUNCH_LOCATIONS), {
        userId: currentUser.uid,
        userName: userProfile.nomeCompleto || userProfile.displayName,
        data: todayISO,
        tipo,
        endereco: tipo === 'campo' ? address : undefined,
        clienteNome: tipo === 'campo' ? clientName : undefined,
        coordenadas: tipo === 'campo' && coords ? coords : undefined,
        informadoEm: Timestamp.now(),
        menuId: activeMenu?.id || '',
      });
    } catch (err) {
      console.error('Erro ao enviar localização:', err);
      alert('Erro ao enviar localização.');
    } finally {
      setSubmittingLoc(false);
      setShowForaCidadeConfirm(false);
    }
  };

  /* ─── Reset location (re-inform) ─── */
  const handleResetLocation = async () => {
    if (!todayLocation) return;
    if (!confirm('Deseja alterar sua localização de hoje? A informação anterior será removida.')) return;
    try {
      await deleteDoc(doc(db, CollectionName.LUNCH_LOCATIONS, todayLocation.id));
      setLocationType('');
      setAddress('');
      setClientName('');
      setCoords(null);
    } catch (err) {
      console.error('Erro ao resetar localização:', err);
      alert('Erro ao resetar localização.');
    }
  };

  /* ════════════════════════════════════════════════════════════════
     RENDER STATES
     ════════════════════════════════════════════════════════════════ */

  const isLoading = loadingMenu || loadingChoice || loadingLocation;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-gray-400">
          <UtensilsCrossed size={24} className="animate-pulse" />
          <span className="text-sm">Carregando...</span>
        </div>
      </div>
    );
  }

  // ── No active menu ──
  if (!activeMenu) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className="text-center bg-white rounded-2xl border border-gray-200 shadow-sm p-10 space-y-4">
          <UtensilsCrossed size={48} className="mx-auto text-gray-300" />
          <h2 className="text-xl font-bold text-gray-800">Nenhum cardápio disponível</h2>
          <p className="text-gray-500 text-sm">
            O cardápio da semana ainda não foi cadastrado pela gestão. Aguarde a publicação.
          </p>
        </div>
      </div>
    );
  }

  // ── Success screen ──
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
          <button
            onClick={() => setSubmitted(false)}
            className="mt-4 px-6 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium text-sm"
          >
            Ir para Localização do Dia
          </button>
        </div>
      </div>
    );
  }

  // ── Already chose: show location form ──
  if (existingChoice) {
    const weekDays = `${activeMenu.weekStart.split('-').reverse().join('/')} a ${activeMenu.weekEnd.split('-').reverse().join('/')}`;

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UtensilsCrossed className="text-orange-500" /> Meu Almoço
          </h1>
          <p className="text-gray-500 text-sm mt-1">Semana {weekDays}</p>
        </div>

        {/* Your choices summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Seus pratos da semana</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DAY_KEYS.map(day => {
              const choice = existingChoice.escolhas[day];
              return (
                <div key={day} className="flex items-center gap-2 bg-orange-50/50 rounded-lg px-3 py-2 border border-orange-100">
                  <span className="text-xs font-bold text-orange-400 w-14">{DAY_LABELS[day].split('-')[0]}</span>
                  <span className="text-sm text-gray-700 flex-1">
                    {choice ? `🍽️ ${choice.pratoNome}` : <span className="text-gray-400">—</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── LOCATION SECTION ── */}
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
                {isPastDeadline
                  ? `⚠️ O prazo para informar (${horarioLimite}) já passou!`
                  : `Informe até as ${horarioLimite}`}
              </span>
            </div>
          </div>

          {/* Warning banner */}
          <div className="mx-5 mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong>ATENÇÃO:</strong> Se estiver fora da cidade e <strong>NÃO informar</strong>, sua marmita será pedida normalmente e você <strong>perderá o direito ao vale-alimentação</strong> para refeições fora da cidade.
              </p>
            </div>
          </div>

          <div className="p-5">
            {/* Already informed today */}
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
                  <button
                    onClick={handleResetLocation}
                    className="mt-3 flex items-center gap-2 mx-auto px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                  >
                    <Pencil size={14} />
                    Reinformar Localização
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 font-medium">Onde você vai almoçar hoje?</p>

                {/* Option buttons */}
                <div className="grid grid-cols-1 gap-3">

                  {/* GPS / Manual location */}
                  <div
                    className={`rounded-xl border-2 transition-all cursor-pointer ${
                      locationType === 'campo'
                        ? 'border-green-400 bg-green-50/50 shadow-sm'
                        : 'border-gray-200 hover:border-green-300 hover:bg-green-50/30'
                    }`}
                    onClick={() => setLocationType('campo')}
                  >
                    <div className="flex items-center gap-3 p-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        locationType === 'campo' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-600'
                      }`}>
                        <MapPin size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-800">📍 Estou em campo</p>
                        <p className="text-xs text-gray-500">Informar endereço e nome do cliente</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        locationType === 'campo' ? 'border-green-500 bg-green-500' : 'border-gray-300'
                      }`}>
                        {locationType === 'campo' && <Check size={12} className="text-white" />}
                      </div>
                    </div>

                    {locationType === 'campo' && (
                      <div className="px-4 pb-4 space-y-3 border-t border-green-100 pt-3">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleGetLocation(); }}
                            disabled={gettingGPS}
                            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors text-sm font-medium"
                          >
                            <Navigation size={14} />
                            {gettingGPS ? 'Buscando GPS...' : 'Usar Minha Localização'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowMapPicker(true); }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                          >
                            <MapIcon size={14} />
                            Abrir Mapa
                          </button>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Endereço</label>
                          <input
                            type="text"
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            placeholder="Rua, número, bairro, cidade..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-300 focus:border-green-400 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Nome do Cliente</label>
                          <input
                            type="text"
                            value={clientName}
                            onChange={e => setClientName(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            placeholder="Ex: Supermercado Bom Preço"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-300 focus:border-green-400 outline-none"
                          />
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSubmitLocation('campo'); }}
                          disabled={submittingLoc || (!address && !clientName)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-bold"
                        >
                          <Send size={14} /> {submittingLoc ? 'Enviando...' : 'Confirmar Localização'}
                        </button>
                      </div>
                    )}

                    {/* Google Maps Picker Modal */}
                    {showMapPicker && (
                      <GoogleMapPicker
                        initialLat={coords?.lat}
                        initialLng={coords?.lng}
                        title="Selecionar Localização em Campo"
                        onConfirm={(data: MapPickerResult) => {
                          setAddress(data.address);
                          setCoords({ lat: data.lat, lng: data.lng });
                          setShowMapPicker(false);
                        }}
                        onCancel={() => setShowMapPicker(false)}
                      />
                    )}
                  </div>

                  {/* Sede */}
                  <button
                    onClick={() => handleSubmitLocation('sede')}
                    disabled={submittingLoc}
                    className="rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 p-4 flex items-center gap-3 transition-all text-left"
                  >
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
                  <div
                    className={`rounded-xl border-2 transition-all ${
                      showForaCidadeConfirm
                        ? 'border-orange-400 bg-orange-50/50'
                        : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/30'
                    }`}
                  >
                    <button
                      onClick={() => setShowForaCidadeConfirm(!showForaCidadeConfirm)}
                      className="w-full p-4 flex items-center gap-3 text-left"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        showForaCidadeConfirm ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600'
                      }`}>
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
                        <button
                          onClick={() => handleSubmitLocation('fora_cidade')}
                          disabled={submittingLoc}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors text-sm font-bold"
                        >
                          <Plane size={14} /> {submittingLoc ? 'Enviando...' : 'Confirmar — Estou Fora da Cidade'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Selection form: choose weekly meals ──
  const formatDateBR = (iso: string): string => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  const weekDays = `${formatDateBR(activeMenu.weekStart)} a ${formatDateBR(activeMenu.weekEnd)}`;

  const hasAnySelection = DAY_KEYS.some(d => selections[d]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <UtensilsCrossed className="text-orange-500" /> Meu Almoço
        </h1>
        <p className="text-gray-500 text-sm mt-1">Escolha seus pratos para a semana {weekDays}</p>
      </div>

      {/* Menu overview */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <UtensilsCrossed size={16} className="text-orange-500" />
          Cardápio da Semana
        </h3>
        <div className="flex flex-wrap gap-2">
          {activeMenu.pratos.map(p => (
            <div key={p.id} className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
              <p className="text-sm font-medium text-orange-800">🍽️ {p.nome}</p>
              {p.descricao && (
                <p className="text-xs text-orange-600 mt-0.5">{p.descricao}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Day-by-day selection */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-orange-50 px-5 py-4 border-b border-orange-100">
          <h3 className="text-sm font-bold text-orange-800">
            Escolha seu prato para cada dia da semana
          </h3>
          <p className="text-xs text-orange-600 mt-1">
            Selecione o prato desejado ou deixe em branco se não for almoçar naquele dia
          </p>
        </div>

        <div className="divide-y divide-gray-50">
          {DAY_KEYS.map(day => (
            <div key={day} className="px-5 py-4">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {DAY_EMOJIS[day]} {DAY_LABELS[day]}
              </label>
              <select
                value={selections[day]}
                onChange={e => setSelections(prev => ({ ...prev, [day]: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none bg-white appearance-none"
              >
                <option value="">— Selecione o prato —</option>
                {activeMenu.pratos.map(p => (
                  <option key={p.id} value={p.id}>🍽️ {p.nome}</option>
                ))}
                <option value="nao_almoco">❌ Não vou almoçar neste dia</option>
              </select>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={handleSubmitChoices}
            disabled={submitting || !hasAnySelection}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold text-sm shadow-sm"
          >
            <Send size={16} /> {submitting ? 'Enviando...' : 'Enviar Escolhas da Semana'}
          </button>
          {!hasAnySelection && (
            <p className="text-center text-xs text-gray-400 mt-2">
              Selecione ao menos um prato para enviar
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper icon — checklist for choice options
const Check: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default MyLunch;
