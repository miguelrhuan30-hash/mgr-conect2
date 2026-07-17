import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, Task } from '../types';
import {
  calcularMetricasDia, fmtDuracao, MetricasDia,
  buscarPingsDoDia, calcularKmPercorrido, LocationPing,
} from '../services/trackerService';
import LocationTimelineMap from './LocationTimelineMap';
import {
  Route, Loader2, Clock, Gauge, Calendar, User, ClipboardList, TrendingUp, MapPinned, Navigation,
} from 'lucide-react';

interface UserOption { id: string; nome: string; }

const todayISO = () => new Date().toISOString().split('T')[0];
const fmtHoraPing = (p: LocationPing) => {
  const d = p.timestamp?.toDate?.();
  return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
};

export default function TrackerColaborador() {
  const [users, setUsers]           = useState<UserOption[]>([]);
  const [userId, setUserId]         = useState('');
  const [data, setData]             = useState(todayISO());
  const [metricas, setMetricas]     = useState<MetricasDia | null>(null);
  const [pings, setPings]           = useState<LocationPing[] | null>(null);
  const [loading, setLoading]       = useState(false);
  const [carregouUsers, setCarregouUsers] = useState(false);
  const [tab, setTab]               = useState<'os' | 'timeline'>('os');

  useEffect(() => {
    getDocs(collection(db, CollectionName.USERS)).then(snap => {
      setUsers(snap.docs.map(d => {
        const u = d.data();
        return { id: d.id, nome: u.nomeCompleto || u.displayName || u.email || d.id };
      }).sort((a, b) => a.nome.localeCompare(b.nome)));
      setCarregouUsers(true);
    }).catch(() => setCarregouUsers(true));
  }, []);

  const carregar = async () => {
    if (!userId || !data) return;
    setLoading(true);
    setMetricas(null);
    setPings(null);
    try {
      // Tasks atribuídas ao colaborador (filtro por dia é feito client-side
      // sobre execution.actualStartTime, para não exigir índice composto novo)
      const snap = await getDocs(query(
        collection(db, CollectionName.TASKS),
        where('assignedTo', '==', userId),
      ));
      const inicioDia = new Date(`${data}T00:00:00`).getTime();
      const fimDia = new Date(`${data}T23:59:59`).getTime();
      const tasksDoDia = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Task & { id: string }))
        .filter(t => {
          const ts = (t as any).execution?.actualStartTime?.toMillis?.();
          return typeof ts === 'number' && ts >= inicioDia && ts <= fimDia;
        });

      const [m, pingsDoDia] = await Promise.all([
        calcularMetricasDia(userId, data, tasksDoDia),
        buscarPingsDoDia(userId, data),
      ]);
      setMetricas(m);
      setPings(pingsDoDia);
    } catch {
      alert('Erro ao calcular métricas. Verifique se o colaborador tem rastreamento ativo.');
    } finally {
      setLoading(false);
    }
  };

  const nomeSelecionado = useMemo(() => users.find(u => u.id === userId)?.nome, [users, userId]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <Route className="w-5 h-5 text-brand-600" /> Tracker do Colaborador
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Tempo e KM por O.S., a partir do rastreamento GPS já ativo no app de campo
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-wrap items-end gap-3 mb-6">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
            <User size={12} /> Colaborador
          </label>
          <select value={userId} onChange={e => setUserId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
            <option value="">{carregouUsers ? 'Selecione...' : 'Carregando...'}</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
            <Calendar size={12} /> Data
          </label>
          <input type="date" value={data} onChange={e => setData(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
        </div>
        <button onClick={carregar} disabled={!userId || loading}
          className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <TrendingUp size={15} />}
          {loading ? 'Calculando...' : 'Calcular'}
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <button onClick={() => setTab('os')}
          className={`px-4 py-2.5 text-sm font-bold rounded-t-xl flex items-center gap-2 transition-colors ${
            tab === 'os' ? 'bg-white border border-b-0 border-gray-200 text-brand-600' : 'text-gray-400 hover:text-gray-600'
          }`}>
          <ClipboardList size={15} /> Por O.S.
        </button>
        <button onClick={() => setTab('timeline')}
          className={`px-4 py-2.5 text-sm font-bold rounded-t-xl flex items-center gap-2 transition-colors ${
            tab === 'timeline' ? 'bg-white border border-b-0 border-gray-200 text-brand-600' : 'text-gray-400 hover:text-gray-600'
          }`}>
          <MapPinned size={15} /> Linha do Tempo GPS
        </button>
      </div>

      {tab === 'os' && metricas && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1"><Gauge size={12} /> KM total do dia</p>
              <p className="text-2xl font-black text-gray-900">{metricas.kmTotalDia} km</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1"><ClipboardList size={12} /> KM por O.S.</p>
              <p className="text-2xl font-black text-blue-600">{metricas.kmSomaOS} km</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1"><Route size={12} /> Deslocamento geral</p>
              <p className="text-2xl font-black text-orange-600">{metricas.kmDeslocamentoGeral} km</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-700">
                O.S. executadas por {nomeSelecionado} em {new Date(`${metricas.data}T12:00:00`).toLocaleDateString('pt-BR')}
              </p>
              <span className="text-xs text-gray-400">{fmtDuracao(metricas.tempoTotalExecucaoMin)} de execução</span>
            </div>
            {metricas.osMetrics.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-semibold">Nenhuma O.S. executada nesse dia</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {metricas.osMetrics.map(m => (
                  <div key={m.osId} className="px-4 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{m.osNumero ? `${m.osNumero} — ` : ''}{m.osTitulo || m.osId}</p>
                      <p className="text-xs text-gray-500">
                        {m.inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {' → '}
                        {m.fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                      <Clock size={13} className="text-gray-400" /> {fmtDuracao(m.tempoMinutos)}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                      <Gauge size={13} /> {m.kmPercorrido} km
                    </div>
                    {m.pingsCount < 2 && (
                      <span className="text-[10px] text-amber-500 font-semibold" title="Poucos pings de GPS neste intervalo — KM pode estar subestimado">
                        ⚠ poucos pings
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-400 px-1">
            KM calculado a partir dos pings de GPS gravados durante o intervalo de execução da O.S.
            (check-in → check-out). O deslocamento geral é o KM total do dia menos a soma do KM em O.S.
          </p>
        </div>
      )}

      {tab === 'timeline' && pings && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1"><Navigation size={12} /> Início</p>
              <p className="text-lg font-black text-emerald-600">{pings[0] ? fmtHoraPing(pings[0]) : '—'}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1"><MapPinned size={12} /> Fim</p>
              <p className="text-lg font-black text-red-600">{pings.length > 0 ? fmtHoraPing(pings[pings.length - 1]) : '—'}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1"><Gauge size={12} /> KM percorrido</p>
              <p className="text-lg font-black text-blue-600">{calcularKmPercorrido(pings)} km</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1"><Route size={12} /> Pings</p>
              <p className="text-lg font-black text-gray-900">{pings.length}</p>
            </div>
          </div>

          <LocationTimelineMap pings={pings} />

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-700">
                Trajeto de {nomeSelecionado} em {new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR')}
              </p>
            </div>
            {pings.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <MapPinned className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-semibold">Nenhum ping de GPS registrado nesse dia</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[360px] overflow-y-auto">
                {pings.map((p, i) => {
                  const isFirst = i === 0;
                  const isLast = i === pings.length - 1;
                  return (
                    <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isFirst ? 'bg-emerald-500' : isLast ? 'bg-red-500' : 'bg-blue-400'}`} />
                      <span className="text-sm font-bold text-gray-800 w-14 flex-shrink-0">{fmtHoraPing(p)}</span>
                      {isFirst && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">INÍCIO</span>}
                      {isLast && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">FIM</span>}
                      <span className="text-xs text-gray-400 font-mono truncate flex-1">{p.lat.toFixed(6)}, {p.lng.toFixed(6)}</span>
                      {p.accuracy != null && <span className="text-[10px] text-gray-400 flex-shrink-0">±{Math.round(p.accuracy)}m</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-400 px-1">
            Linha do tempo bruta de localização — sem vínculo com O.S. ou projeto. Pings gravados
            a cada ~3min de movimento (ou {'>'}50m de deslocamento) pelo rastreamento em background do app de campo.
          </p>
        </div>
      )}
    </div>
  );
}
