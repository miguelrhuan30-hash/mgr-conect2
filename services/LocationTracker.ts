/**
 * LocationTracker — rastreio de localização em background
 *
 * Camada JS: funciona com app minimizado.
 * Para app fechado: o Foreground Service nativo (LocationForegroundService.java)
 * assume o controle via plugin Capacitor.
 *
 * Estratégia de bateria: envia ao Firestore a cada SEND_INTERVAL_MS,
 * mas coleta posição a cada WATCH_INTERVAL_MS para manter precisão.
 */

import { collection, addDoc, Timestamp, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// ── Configuração ──────────────────────────────────────────────────────────────
const SEND_INTERVAL_MS  = 3 * 60 * 1000;  // envia ao Firestore a cada 3 min
const STALE_THRESHOLD_M = 50;              // ignora posição se movimento < 50 m

// ── Estado interno ────────────────────────────────────────────────────────────
let watchId: number | null = null;
let sendTimer: ReturnType<typeof setInterval> | null = null;
let lastSent: { lat: number; lng: number } | null = null;
let currentPos: GeolocationPosition | null = null;
let userId: string | null = null;
let userName: string | null = null;
let isRunning = false;

// ── Helpers ───────────────────────────────────────────────────────────────────
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
    Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function sendPosition() {
  if (!currentPos || !userId) return;

  const { latitude: lat, longitude: lng, accuracy, speed } = currentPos.coords;

  // Não envia se não houve movimento significativo
  if (lastSent && distanceMeters(lastSent, { lat, lng }) < STALE_THRESHOLD_M) return;

  const payload = {
    userId,
    userName: userName ?? 'Desconhecido',
    lat,
    lng,
    accuracy: accuracy ?? null,
    speed: speed ?? null,
    timestamp: Timestamp.now(),
    source: 'js_tracker',
  };

  try {
    // Documento de posição atual (sobrescreve — só 1 doc por usuário)
    await setDoc(doc(db, 'localizacoes_atual', userId), payload);

    // Histórico completo (append-only)
    await addDoc(collection(db, 'localizacoes_historico'), payload);

    lastSent = { lat, lng };
  } catch (err) {
    console.warn('[LocationTracker] Erro ao enviar:', err);
  }
}

// ── API pública ───────────────────────────────────────────────────────────────

export function start(uid: string, name: string) {
  if (isRunning) return;
  userId   = uid;
  userName = name;
  isRunning = true;

  if (!navigator.geolocation) {
    console.warn('[LocationTracker] Geolocalização não disponível.');
    return;
  }

  // Coleta posição contínua
  watchId = navigator.geolocation.watchPosition(
    (pos) => { currentPos = pos; },
    (err) => console.warn('[LocationTracker] watchPosition error:', err.message),
    { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
  );

  // Envia ao Firestore no intervalo configurado
  sendTimer = setInterval(sendPosition, SEND_INTERVAL_MS);

  // Envia imediatamente na primeira vez
  navigator.geolocation.getCurrentPosition(
    (pos) => { currentPos = pos; sendPosition(); },
    () => {},
    { enableHighAccuracy: true, timeout: 10_000 }
  );

  console.info('[LocationTracker] Iniciado para:', uid);
}

export function stop() {
  if (!isRunning) return;
  isRunning = false;

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (sendTimer !== null) {
    clearInterval(sendTimer);
    sendTimer = null;
  }
  currentPos = null;
  lastSent   = null;
  console.info('[LocationTracker] Parado.');
}

export function getStatus() {
  return { isRunning, hasPosition: !!currentPos, lastSent };
}
