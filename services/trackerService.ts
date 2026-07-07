/**
 * trackerService — Tracker do Colaborador (M2)
 *
 * Camada de ANÁLISE sobre a infraestrutura de rastreamento que já existe
 * (LocationTracker.ts / LocationForegroundService.java gravam pings a cada
 * 3 min ou >50m em `localizacoes_historico`). Aqui apenas cruzamos esses
 * pings com os timestamps de execução da O.S. (`execution.actualStartTime`/
 * `actualEndTime`) para medir tempo e KM por O.S., e o KM total do dia para
 * isolar o deslocamento geral (entre O.S., ponto, almoço etc.).
 */
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { Task } from '../types';

// Coleção gravada pelo tracker nativo/JS — sem prefixo de ambiente (ver LocationTracker.ts).
const LOCATIONS_HISTORY = 'localizacoes_historico';

export interface LocationPing {
  userId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  source?: string;
  timestamp: Timestamp;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export async function buscarPings(userId: string, inicio: Date, fim: Date): Promise<LocationPing[]> {
  const snap = await getDocs(query(
    collection(db, LOCATIONS_HISTORY),
    where('userId', '==', userId),
    where('timestamp', '>=', Timestamp.fromDate(inicio)),
    where('timestamp', '<=', Timestamp.fromDate(fim)),
    orderBy('timestamp', 'asc'),
  )).catch(() => null);
  if (!snap) return [];
  return snap.docs.map(d => d.data() as LocationPing);
}

/** Soma a distância entre pings consecutivos (sequência temporal). */
export function calcularKmPercorrido(pings: LocationPing[]): number {
  let total = 0;
  for (let i = 1; i < pings.length; i++) total += haversineKm(pings[i - 1], pings[i]);
  return Math.round(total * 10) / 10;
}

export interface MetricasOS {
  osId: string;
  osTitulo?: string;
  osNumero?: string;
  inicio: Date;
  fim: Date;
  tempoMinutos: number;
  kmPercorrido: number;
  pingsCount: number;
}

/** Métricas de tempo/KM de UMA O.S., a partir do check-in/check-out gravado na execução. */
export async function calcularMetricasOS(task: Task & { id: string }): Promise<MetricasOS | null> {
  const exec: any = (task as any).execution;
  const uid = task.assignedTo;
  if (!exec?.actualStartTime || !exec?.actualEndTime || !uid) return null;

  const inicio: Date = exec.actualStartTime.toDate();
  const fim: Date = exec.actualEndTime.toDate();
  const pings = await buscarPings(uid, inicio, fim);

  return {
    osId: task.id,
    osTitulo: task.title,
    osNumero: (task as any).numeroOS,
    inicio, fim,
    tempoMinutos: Math.max(0, Math.round((fim.getTime() - inicio.getTime()) / 60000)),
    kmPercorrido: calcularKmPercorrido(pings),
    pingsCount: pings.length,
  };
}

export interface MetricasDia {
  userId: string;
  data: string; // ISO yyyy-mm-dd
  kmTotalDia: number;
  osMetrics: MetricasOS[];
  kmSomaOS: number;
  kmDeslocamentoGeral: number; // kmTotalDia - kmSomaOS (nunca negativo)
  tempoTotalExecucaoMin: number;
}

/**
 * Métricas consolidadas do dia para um colaborador: KM total do dia (do
 * primeiro ao último ping), quebra por O.S. executada nesse dia, e o
 * "deslocamento geral" — o que sobra do KM total ao descontar o que foi
 * gasto durante as execuções de O.S. (inclui ida/volta, almoço, etc.).
 */
export async function calcularMetricasDia(
  userId: string,
  dataISO: string,
  tasksDoDia: (Task & { id: string })[],
): Promise<MetricasDia> {
  const inicio = new Date(`${dataISO}T00:00:00`);
  const fim = new Date(`${dataISO}T23:59:59`);
  const pingsDia = await buscarPings(userId, inicio, fim);
  const kmTotalDia = calcularKmPercorrido(pingsDia);

  const osMetrics: MetricasOS[] = [];
  for (const t of tasksDoDia) {
    const m = await calcularMetricasOS(t);
    if (m) osMetrics.push(m);
  }
  const kmSomaOS = Math.round(osMetrics.reduce((s, m) => s + m.kmPercorrido, 0) * 10) / 10;
  const tempoTotalExecucaoMin = osMetrics.reduce((s, m) => s + m.tempoMinutos, 0);

  return {
    userId, data: dataISO, kmTotalDia, osMetrics, kmSomaOS,
    kmDeslocamentoGeral: Math.max(0, Math.round((kmTotalDia - kmSomaOS) * 10) / 10),
    tempoTotalExecucaoMin,
  };
}

/** Formata minutos como "Xh Ymin". */
export function fmtDuracao(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}
