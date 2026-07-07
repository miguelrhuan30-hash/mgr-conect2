import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, Task } from '../types';
import {
  calcularMetricasDia, fmtDuracao, MetricasDia,
} from '../services/trackerService';
import {
  Route, Loader2, Clock, Gauge, Calendar, User, ClipboardList, TrendingUp,
} from 'lucide-react';

interface UserOption { id: string; nome: string; }

const todayISO = () => new Date().toISOString().split('T')[0];

export default function TrackerColaborador() {
  const [users, setUsers]           = useState<UserOption[]>([]);
  const [userId, setUserId]         = useState('');
  const [data, setData]             = useState(todayISO());
  const [metricas, setMetricas]     = useState<MetricasDia | null>(null);
  const [loading, setLoading]       = useState(false);
  const [carregouUsers, setCarregouUsers] = useState(false);

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

      const m = await calcularMetricasDia(userId, data, tasksDoDia);
      setMetricas(m);
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

      {metricas && (
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
    </div>
  );
}
