/**
 * FieldPonto — módulo de ponto para o app de campo (APK Android)
 * Replica fielmente a lógica de Ponto.tsx: câmera, GPS, biometria IA,
 * máquina de 4 estados, timers de almoço e jornada, schema idêntico.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  addDoc, collection, serverTimestamp, getDocs,
  query, where, orderBy, limit, onSnapshot, doc, updateDoc, Timestamp,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { CollectionName, WorkLocation, TimeEntry } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { GoogleGenAI } from '@google/genai';
import {
  Clock, MapPin, ShieldCheck, Loader2, AlertTriangle,
  Coffee, LogOut, LogIn, CheckCircle2, X, WifiOff,
  UtensilsCrossed, ScanFace, Camera, Bell,
} from 'lucide-react';
import { useCamera } from '../../src/hooks/useCamera';
import { useGPS } from '../../src/hooks/useGPS';
import { checkPontoRateLimit } from '../../src/hooks/usePontoRateLimit';
import { fetchImageAsBase64, sanitizeUserAgent, sanitizeErrorForLog } from '../../utils/imageUtils';
import { logEvent } from '../../utils/logger';
import { registrarAtividade, ActivityTipo } from '../../services/activityFeedService';
import { criarNotificacao } from '../../services/notificationService';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type ActionType = 'entry' | 'lunch_start' | 'lunch_end' | 'exit';

interface ActionState {
  type: ActionType;
  label: string;
  icon: React.ElementType;
  colorClass: string;
  description: string;
}

interface PhotoResult {
  photo: { base64: string; dataOnly: string } | null;
  photoStatus: 'ok' | 'unavailable' | 'camera_error';
  photoErrorDetail: any;
}

interface LocationResult {
  loc: { lat: number; lng: number; accuracy: number; source: string } | null;
  gpsStatus: 'ok' | 'best_effort' | 'unavailable';
  gpsErrorDetail: any;
  isBestEffort: boolean;
}

const BIOMETRIC_CONSENT_KEY = 'mgr_biometric_consent_v1';

/**
 * Cobrança de check de veículo (M3). Se o colaborador é responsável fixo
 * por algum veículo ativo e ainda não abriu NENHUM veículo hoje, dispara
 * notificação em tela + som pedindo o registro. Fire-and-forget.
 */
async function verificarChecklistVeiculo(uid: string) {
  try {
    const veiculosSnap = await getDocs(query(
      collection(db, CollectionName.VEHICLES),
      where('responsavelId', '==', uid),
      where('ativo', '==', true),
    ));
    if (veiculosSnap.empty) return;

    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const checksSnap = await getDocs(query(
      collection(db, CollectionName.VEHICLE_CHECKS),
      where('userId', '==', uid),
      where('timestamp', '>=', Timestamp.fromDate(hoje)),
    ));
    if (!checksSnap.empty) return; // já abriu algum veículo hoje

    const placas = veiculosSnap.docs.map(d => d.data().placa).join(', ');
    criarNotificacao({
      destinatarioId: uid,
      tipo: 'veiculo_check_pendente',
      canal: 'veiculo',
      titulo: '🚗 Abertura de veículo pendente',
      corpo: `Você é responsável pelo(s) veículo(s) ${placas} e ainda não registrou a abertura hoje.`,
      som: true,
      prioridade: 'alta',
      rota: '/campo/veiculo',
    });
  } catch {
    // silencioso — não deve bloquear o fluxo de ponto
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const calcQuality = (ps: PhotoResult, ls: LocationResult): 'ok' | 'partial' | 'emergency' => {
  const photoOk = ps.photoStatus === 'ok';
  const locOk   = ls.gpsStatus === 'ok' || ls.gpsStatus === 'best_effort';
  if (photoOk && locOk) return 'ok';
  if (photoOk || locOk) return 'partial';
  return 'emergency';
};

// ─── Componente ───────────────────────────────────────────────────────────────
export default function FieldPonto() {
  const { currentUser, userProfile } = useAuth();
  const camera = useCamera({ width: 480, height: 640, facingMode: 'user' });
  const gps    = useGPS();

  const [history, setHistory]           = useState<TimeEntry[]>([]);
  const [processing, setProcessing]     = useState(false);
  const [processMessage, setProcessMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [hora, setHora]                 = useState(new Date());
  const [lunchCountdown, setLunchCountdown] = useState<string | null>(null);
  const [entryCountdown, setEntryCountdown] = useState<string | null>(null);
  const [showBiometricConsent, setShowBiometricConsent] = useState(false);
  const [allowedLocations, setAllowedLocations] = useState<WorkLocation[]>([]);
  const [detectedLocation, setDetectedLocation] = useState<WorkLocation | null>(null);

  const countdownRef    = useRef<ReturnType<typeof setInterval>>();
  const entryTimerRef   = useRef<ReturnType<typeof setInterval>>();
  const autoRedirectRef = useRef<ReturnType<typeof setTimeout>>();

  // Relógio em tempo real
  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Consentimento biométrico LGPD
  useEffect(() => {
    if (!localStorage.getItem(BIOMETRIC_CONSENT_KEY)) setShowBiometricConsent(true);
  }, []);

  // Liga câmera ao montar (se consentimento dado)
  useEffect(() => {
    if (!showBiometricConsent && !successMessage) {
      camera.restart();
    } else {
      camera.stop();
    }
    return () => { camera.stop(); };
  }, [showBiometricConsent, successMessage]);

  // Histórico de hoje em tempo real
  useEffect(() => {
    if (!currentUser) return;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, CollectionName.TIME_ENTRIES),
      where('userId', '==', currentUser.uid),
      where('timestamp', '>=', Timestamp.fromDate(hoje)),
      orderBy('timestamp', 'desc'),
      limit(20),
    );
    return onSnapshot(q, snap => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as TimeEntry)));
    });
  }, [currentUser]);

  // Carregar locais permitidos + detectar perímetro
  useEffect(() => {
    if (!currentUser || !userProfile) return;
    const loadLocations = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, CollectionName.WORK_LOCATIONS), where('active', '==', true))
        );
        const locs = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkLocation));
        const allowed = userProfile.allowedLocationIds?.length
          ? locs.filter(l => userProfile.allowedLocationIds!.includes(l.id))
          : locs;
        setAllowedLocations(allowed);

        if (userProfile.role === 'admin') {
          setDetectedLocation({ id: 'admin', name: 'Acesso Admin (Global)' } as WorkLocation);
          return;
        }
        try {
          const pos = await gps.getFreshLocation();
          const found = allowed.find(l =>
            getDistanceInMeters(pos.lat, pos.lng, l.latitude, l.longitude) <= l.radius
          );
          if (found) setDetectedLocation(found);
        } catch { /* GPS falhou — vai tentar no momento do registro */ }
      } catch (err) {
        console.warn('[FieldPonto] Erro ao carregar locais:', err);
      }
    };
    loadLocations();
  }, [currentUser, userProfile]);

  // ── Máquina de estados ────────────────────────────────────────────────────
  const lastEntry = history[0];

  const getNextAction = useCallback((): ActionState => {
    if (!lastEntry) return { type: 'entry', label: 'REGISTRAR ENTRADA', icon: LogIn, colorClass: 'bg-emerald-600 active:bg-emerald-700', description: 'Iniciar jornada de trabalho' };
    switch (lastEntry.type) {
      case 'entry':      return { type: 'lunch_start', label: 'INICIAR ALMOÇO',     icon: Coffee,          colorClass: 'bg-yellow-600 active:bg-yellow-700',  description: 'Pausa para refeição' };
      case 'lunch_start':return { type: 'lunch_end',   label: 'VOLTA DO ALMOÇO',    icon: UtensilsCrossed, colorClass: 'bg-orange-600 active:bg-orange-700',  description: 'Retorno da pausa' };
      case 'lunch_end':  return { type: 'exit',        label: 'ENCERRAR EXPEDIENTE',icon: LogOut,          colorClass: 'bg-red-600 active:bg-red-700',        description: 'Finalizar dia de trabalho' };
      case 'exit':       return { type: 'entry',       label: 'EXPEDIENTE ENCERRADO', icon: CheckCircle2,    colorClass: 'bg-gray-600 cursor-not-allowed',       description: 'Novo registro disponível amanhã' };
      default:           return { type: 'entry',       label: 'REGISTRAR ENTRADA',   icon: LogIn,           colorClass: 'bg-emerald-600 active:bg-emerald-700', description: 'Iniciar jornada' };
    }
  }, [lastEntry]);

  const nextAction = getNextAction();

  // ── Timer de almoço (1h mínimo) ──────────────────────────────────────────
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (nextAction.type !== 'lunch_end') { setLunchCountdown(null); return; }
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const lunchStart = history
      .filter(e => e.type === 'lunch_start' && e.timestamp?.toDate?.() >= hoje)
      .sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime())[0];
    if (!lunchStart?.timestamp) { setLunchCountdown(null); return; }
    const entryHoje = history
      .filter(e => e.type === 'entry' && e.timestamp?.toDate?.() >= hoje)
      .sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime())[0];
    const workedBeforeLunchMs = entryHoje?.timestamp
      ? lunchStart.timestamp.toDate().getTime() - entryHoje.timestamp.toDate().getTime()
      : 6 * 60 * 60 * 1000;
    const TOTAL = workedBeforeLunchMs < 6 * 60 * 60 * 1000 ? 15 * 60 * 1000 : 60 * 60 * 1000;
    const tick = () => {
      const rem = Math.max(0, TOTAL - (Date.now() - lunchStart.timestamp.toDate().getTime()));
      if (rem === 0) { setLunchCountdown(null); clearInterval(countdownRef.current); return; }
      const m = Math.floor(rem / 60000), s = Math.floor((rem % 60000) / 1000);
      setLunchCountdown(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => clearInterval(countdownRef.current);
  }, [history, lastEntry]);

  // ── Timer de jornada (20 min pós-entrada) ────────────────────────────────
  useEffect(() => {
    if (entryTimerRef.current) clearInterval(entryTimerRef.current);
    if (lastEntry?.type !== 'entry') { setEntryCountdown(null); return; }
    const entryTime = lastEntry.timestamp?.toDate?.();
    if (!entryTime) return;
    const TOTAL = 20 * 60 * 1000;
    const tick = () => {
      const rem = Math.max(0, TOTAL - (Date.now() - entryTime.getTime()));
      if (rem === 0) { setEntryCountdown(null); clearInterval(entryTimerRef.current); return; }
      const m = Math.floor(rem / 60000), s = Math.floor((rem % 60000) / 1000);
      setEntryCountdown(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    entryTimerRef.current = setInterval(tick, 1000);
    return () => clearInterval(entryTimerRef.current);
  }, [lastEntry]);

  // ── Validação tempo mínimo almoço ────────────────────────────────────────
  const validateLunchMinTime = (): { valid: boolean; remaining?: string } => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const ls = history
      .filter(e => e.type === 'lunch_start' && e.timestamp?.toDate?.() >= hoje)
      .sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime())[0];
    if (!ls?.timestamp) return { valid: true };

    // CLT: jornada até 6h → 15 min; acima de 6h → 1h
    const entryHoje = history
      .filter(e => e.type === 'entry' && e.timestamp?.toDate?.() >= hoje)
      .sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime())[0];
    const workedBeforeLunchMs = entryHoje?.timestamp
      ? ls.timestamp.toDate().getTime() - entryHoje.timestamp.toDate().getTime()
      : 6 * 60 * 60 * 1000;
    const minPauseMs = workedBeforeLunchMs < 6 * 60 * 60 * 1000
      ? 15 * 60 * 1000
      : 60 * 60 * 1000;

    const diff = Date.now() - ls.timestamp.toDate().getTime();
    if (diff < minPauseMs) {
      const rem = minPauseMs - diff;
      return { valid: false, remaining: `${String(Math.floor(rem / 60000)).padStart(2, '0')}:${String(Math.floor((rem % 60000) / 1000)).padStart(2, '0')}` };
    }
    return { valid: true };
  };

  // ── Processamento biométrico em background ────────────────────────────────
  const processInBackground = async (docId: string, photoBase64: string, photoDataOnly: string, uid: string) => {
    try {
      const storageRef = ref(storage, `time_entries/${uid}_${docId}.jpg`);
      await uploadString(storageRef, photoBase64, 'data_url');
      const photoURL = await getDownloadURL(storageRef);
      let aiValidation = null;
      const refPhotoUrl = userProfile?.avatar || userProfile?.photoURL;
      if (refPhotoUrl) {
        try {
          const refPhoto = await fetchImageAsBase64(refPhotoUrl);
          const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY as string });
          const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: { parts: [
              { inlineData: { mimeType: 'image/jpeg', data: photoDataOnly } },
              { inlineData: { mimeType: 'image/jpeg', data: refPhoto.dataOnly } },
              { text: 'Compare estas duas fotos de rosto. São a mesma pessoa? Responda APENAS com JSON: {"match": boolean, "confidence": number}' },
            ]},
            config: { responseMimeType: 'application/json' },
          });
          aiValidation = JSON.parse(response.text ?? 'null');
        } catch (aiErr) {
          aiValidation = { error: sanitizeErrorForLog(aiErr) };
        }
      }
      await updateDoc(doc(db, CollectionName.TIME_ENTRIES, docId), {
        photoURL,
        aiValidation,
        biometricVerified: (aiValidation as any)?.match === true,
        processingStatus: 'done',
      });
    } catch (bgErr) {
      try {
        await updateDoc(doc(db, CollectionName.TIME_ENTRIES, docId), {
          processingStatus: 'failed',
          aiValidation: { error: sanitizeErrorForLog(bgErr) },
        });
      } catch { /* silencioso */ }
    }
  };

  // ── Handler principal de registro ────────────────────────────────────────
  const handleRegister = async (forceExit?: boolean) => {
    if (processing || successMessage || !currentUser) return;

    // Bloqueia nova entrada após expediente já encerrado no mesmo dia
    if (!forceExit && lastEntry?.type === 'exit') {
      setErrorMessage('Expediente já encerrado hoje. Novo registro só permitido amanhã.');
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }

    // Consentimento biométrico
    if (!localStorage.getItem(BIOMETRIC_CONSENT_KEY)) {
      setShowBiometricConsent(true);
      return;
    }

    // Rate limit (30s)
    const rateCheck = checkPontoRateLimit(currentUser.uid);
    if (!rateCheck.allowed) {
      setErrorMessage(`Aguarde ${rateCheck.remainingSeconds}s antes de registrar novamente.`);
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }

    // Regra CLT para turno especial sem almoço
    if (forceExit) {
      const entryEntry = history.find(e => e.type === 'entry');
      const workedMin = entryEntry?.timestamp
        ? (Date.now() - entryEntry.timestamp.toDate().getTime()) / 60000
        : 0;
      if (workedMin >= 360) {
        setErrorMessage('Jornada acima de 6h — intervalo de almoço é obrigatório por lei (CLT Art. 71). Registre o almoço antes de encerrar.');
        setTimeout(() => setErrorMessage(''), 6000);
        return;
      }
      if (workedMin >= 240) {
        setErrorMessage('Jornada entre 4h e 6h — pausa de 15 min obrigatória por lei. Registre a pausa antes de encerrar.');
        setTimeout(() => setErrorMessage(''), 6000);
        return;
      }
    }

    // Validação almoço mínimo (apenas no fluxo normal)
    if (!forceExit && nextAction.type === 'lunch_end') {
      const check = validateLunchMinTime();
      if (!check.valid) {
        setErrorMessage(`Almoço mínimo de 1h. Retorne em ${check.remaining}.`);
        setTimeout(() => setErrorMessage(''), 5000);
        return;
      }
    }

    setProcessing(true);
    setErrorMessage('');
    setProcessMessage('Capturando foto...');

    // 1. Capturar foto (nunca bloqueia)
    const photoResult: PhotoResult = (() => {
      if (!camera.isReady || camera.error) {
        return { photo: null, photoStatus: 'camera_error' as const, photoErrorDetail: { message: camera.error ?? 'Câmera indisponível' } };
      }
      try {
        const p = camera.capturePhoto();
        return { photo: { base64: p.base64, dataOnly: p.dataOnly }, photoStatus: 'ok' as const, photoErrorDetail: null };
      } catch (err: any) {
        return { photo: null, photoStatus: 'camera_error' as const, photoErrorDetail: { message: err?.message } };
      }
    })();

    setProcessMessage('Obtendo localização...');

    // 2. Capturar GPS (nunca bloqueia)
    const locationResult: LocationResult = await (async () => {
      try {
        const loc = await gps.getFreshLocation();
        return { loc, gpsStatus: 'ok' as const, gpsErrorDetail: null, isBestEffort: false };
      } catch (err: any) {
        const fallback = gps.lastKnownLocation;
        if (fallback && Date.now() - fallback.timestamp <= 10 * 60 * 1000) {
          return { loc: { ...fallback, source: 'cached' }, gpsStatus: 'best_effort' as const, gpsErrorDetail: { message: err?.message }, isBestEffort: true };
        }
        return { loc: null, gpsStatus: 'unavailable' as const, gpsErrorDetail: { message: err?.message }, isBestEffort: false };
      }
    })();

    // Tipo efetivo do registro (forceExit sobrescreve a máquina de estados)
    const effectiveType: ActionType = forceExit ? 'exit' : nextAction.type;

    // 3. Validar perímetro
    let perimeterStatus: TimeEntry['perimeterStatus'] = 'skipped_gps_fail';
    let resolvedLocation = detectedLocation;

    if (userProfile?.role === 'admin') {
      perimeterStatus = 'skipped_admin';
      resolvedLocation = resolvedLocation ?? ({ name: 'Acesso Admin (Global)' } as WorkLocation);
    } else if (locationResult.loc) {
      const requiresLocation = effectiveType === 'entry' || effectiveType === 'exit';
      const hasRestricted = (userProfile?.allowedLocationIds?.length ?? 0) > 0;
      if (requiresLocation && hasRestricted) {
        const found = allowedLocations.find(l =>
          getDistanceInMeters(locationResult.loc!.lat, locationResult.loc!.lng, l.latitude, l.longitude) <= l.radius
        );
        perimeterStatus = found ? 'verified' : (resolvedLocation ? 'verified' : 'outside_warning');
        if (found) resolvedLocation = found;
      } else {
        perimeterStatus = 'skipped_gps_fail';
      }
    }

    // 4. Qualidade do registro
    const quality = calcQuality(photoResult, locationResult);
    setProcessMessage('Gravando registro...');

    try {
      const docRef = await addDoc(collection(db, CollectionName.TIME_ENTRIES), {
        userId:           currentUser.uid,
        type:             effectiveType,
        timestamp:        serverTimestamp(),
        locationId:       resolvedLocation?.id ?? 'unknown',
        locationName:     resolvedLocation?.name ?? (locationResult.loc ? 'Capturado via GPS (App)' : 'GPS Indisponível'),
        locationVerified: perimeterStatus === 'verified',
        gpsCoords:        locationResult.loc ? { lat: locationResult.loc.lat, lng: locationResult.loc.lng, accuracy: locationResult.loc.accuracy } : null,
        gpsSource:        locationResult.loc?.source ?? null,
        registrationQuality: quality,
        photoStatus:      photoResult.photoStatus,
        photoErrorDetail: photoResult.photoErrorDetail,
        gpsStatus:        locationResult.gpsStatus,
        gpsErrorDetail:   locationResult.gpsErrorDetail,
        gpsBestEffortCoords: locationResult.isBestEffort && locationResult.loc
          ? { lat: locationResult.loc.lat, lng: locationResult.loc.lng, accuracy: locationResult.loc.accuracy, ageMs: 0 }
          : null,
        perimeterStatus,
        isManual:         false,
        userAgent:        sanitizeUserAgent(navigator.userAgent),
        biometricVerified: false,
        photoURL:         null,
        aiValidation:     null,
        processingStatus: photoResult.photo ? 'pending' : 'skipped_no_photo',
        source:           'field_app',
      });

      const labels: Record<string, string> = {
        entry: '✅ ENTRADA REGISTRADA!', lunch_start: '✅ ALMOÇO INICIADO!',
        lunch_end: '✅ RETORNO REGISTRADO!', exit: '✅ SAÍDA REGISTRADA!',
      };
      setSuccessMessage(labels[effectiveType] ?? '✅ Registrado!');
      if (autoRedirectRef.current) clearTimeout(autoRedirectRef.current);
      autoRedirectRef.current = setTimeout(() => setSuccessMessage(''), 4000);

      logEvent(currentUser.uid, currentUser.email, 'ponto_register_success', quality === 'ok' ? 'success' : 'warning',
        `Ponto (app): ${effectiveType}${forceExit ? ' [turno especial]' : ''} quality=${quality}`);

      const PONTO_TIPO: Record<string, ActivityTipo> = {
        entry:       'ponto_entrada',
        lunch_start: 'ponto_almoco_inicio',
        lunch_end:   'ponto_almoco_fim',
        exit:        'ponto_saida',
      };
      const PONTO_TITULO: Record<string, string> = {
        entry:       'Ponto de entrada registrado',
        lunch_start: 'Almoço iniciado',
        lunch_end:   'Retorno do almoço registrado',
        exit:        'Ponto de saída registrado',
      };
      const displayName = userProfile?.nomeCompleto || userProfile?.displayName || 'Técnico';
      registrarAtividade({
        tipo:      PONTO_TIPO[effectiveType] ?? 'ponto_entrada',
        autorId:   currentUser.uid,
        autorNome: displayName,
        titulo:    PONTO_TITULO[effectiveType] ?? 'Ponto registrado',
        endereco:  resolvedLocation?.name ?? undefined,
        lat:       locationResult.loc?.lat ?? undefined,
        lng:       locationResult.loc?.lng ?? undefined,
      });

      // Cobrança de check de veículo: se o colaborador é responsável fixo por
      // algum carro e ainda não abriu nenhum veículo hoje, cobra o registro.
      if (effectiveType === 'entry') {
        verificarChecklistVeiculo(currentUser.uid);
      }

      // Biometria em background
      if (photoResult.photo) {
        processInBackground(docRef.id, photoResult.photo.base64, photoResult.photo.dataOnly, currentUser.uid);
      }
    } catch (err: any) {
      setErrorMessage('Erro ao salvar registro. Tente novamente.');
      setTimeout(() => setErrorMessage(''), 5000);
      logEvent(currentUser.uid, currentUser.email, 'ponto_register_error', 'error', err?.message);
    } finally {
      setProcessing(false);
      setProcessMessage('');
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  const horaStr = hora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dataStr = hora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const isLunchBlocked = lunchCountdown !== null && nextAction.type === 'lunch_end';
  // history já filtrado para hoje — se o último foi 'exit', o dia está encerrado
  const isDayComplete = lastEntry?.type === 'exit';

  // Regra CLT para "Encerrar Turno Especial" — só válido quando último registro é 'entry'
  const entryForSpecial = lastEntry?.type === 'entry' ? lastEntry : null;
  const workedMinutes = entryForSpecial?.timestamp
    ? (hora.getTime() - entryForSpecial.timestamp.toDate().getTime()) / 60000
    : 0;
  // até 4h: livre | 4-6h: recomenda 15min | acima de 6h: almoço obrigatório
  const specialExitCLT: 'free' | 'warn_15' | 'blocked' =
    workedMinutes < 240 ? 'free' : workedMinutes < 360 ? 'warn_15' : 'blocked';
  const showSpecialExit = !!entryForSpecial && !isDayComplete;
  const ActionIcon = nextAction.icon;

  const labelTipo = (t: string) => ({ entry: 'Entrada', lunch_start: 'Ini. Almoço', lunch_end: 'Volta Almoço', exit: 'Saída' }[t] ?? t);
  const corBadge  = (t: string) => ({
    entry: 'bg-emerald-500/20 text-emerald-400', lunch_start: 'bg-yellow-500/20 text-yellow-400',
    lunch_end: 'bg-orange-500/20 text-orange-400', exit: 'bg-red-500/20 text-red-400',
  }[t] ?? 'bg-gray-700 text-gray-400');

  // ── Modal: consentimento biométrico ──────────────────────────────────────
  if (showBiometricConsent) {
    return (
      <div className="fixed inset-0 z-50 flex items-end bg-black/80 backdrop-blur-sm">
        <div className="bg-gray-900 rounded-t-3xl w-full p-6 pb-8 space-y-4">
          <div className="flex items-center gap-3">
            <ScanFace className="text-emerald-400 w-8 h-8 flex-shrink-0" />
            <div>
              <h2 className="text-white font-bold text-base">Verificação Facial (LGPD)</h2>
              <p className="text-gray-400 text-xs">Consentimento obrigatório para uso da câmera</p>
            </div>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">
            O sistema MGR captura uma selfie no momento do registro de ponto para validação biométrica via IA.
            A foto é enviada para o Firebase Storage e processada pelo Google Gemini para comparação facial.
            Seus dados são protegidos conforme a <strong className="text-white">LGPD (Lei 13.709/2018)</strong>.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { localStorage.setItem(BIOMETRIC_CONSENT_KEY, '1'); setShowBiometricConsent(false); }}
              className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-bold text-base flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={20} /> Concordo e Continuar
            </button>
            <button
              onClick={() => setShowBiometricConsent(false)}
              className="w-full py-3 rounded-2xl bg-gray-800 text-gray-400 font-semibold text-sm"
            >
              Registrar sem câmera (modo emergencial)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col px-4 py-4 gap-4 pb-6">

      {/* Hora e data */}
      <div className="text-center pt-2">
        <p className="text-4xl font-black text-white tracking-tight tabular-nums">{horaStr}</p>
        <p className="text-xs text-gray-500 capitalize mt-1">{dataStr}</p>
        {detectedLocation && (
          <div className="flex items-center justify-center gap-1 mt-2">
            <ShieldCheck size={12} className="text-emerald-400" />
            <span className="text-xs text-emerald-400 font-semibold truncate max-w-[220px]">{detectedLocation.name}</span>
          </div>
        )}
      </div>

      {/* Câmera — selfie para biometria */}
      <div className="relative bg-black rounded-2xl overflow-hidden w-full" style={{ aspectRatio: '3/4' }}>
        <video
          ref={camera.videoRef}
          autoPlay playsInline muted
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
        />

        {/* Overlay: erro de câmera */}
        {camera.error && !successMessage && !processing && (
          <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center gap-3 p-4">
            <Camera size={36} className="text-gray-600" />
            <p className="text-gray-400 text-sm text-center">{camera.error}</p>
            <button onClick={camera.restart} className="px-5 py-2 bg-emerald-700 text-white rounded-xl text-sm font-bold">
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Overlay: processando */}
        {processing && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3">
            <Loader2 size={40} className="text-emerald-400 animate-spin" />
            <p className="text-white font-semibold text-sm">{processMessage || 'Processando...'}</p>
          </div>
        )}

        {/* Overlay: sucesso */}
        {successMessage && !processing && (
          <div className="absolute inset-0 bg-emerald-900/95 flex flex-col items-center justify-center gap-3">
            <CheckCircle2 size={56} className="text-emerald-400" />
            <p className="text-white font-black text-lg text-center px-4">{successMessage}</p>
            <p className="text-emerald-300 text-xs">
              {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        )}

        {/* Badge câmera pronta */}
        {camera.isReady && !processing && !successMessage && !camera.error && (
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-black/60 rounded-full px-2 py-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-[10px] font-bold">CÂMERA ATIVA</span>
          </div>
        )}
      </div>

      {/* Expediente encerrado */}
      {isDayComplete && (
        <div className="bg-emerald-950/60 border border-emerald-800/50 rounded-2xl p-4 text-center">
          <p className="text-2xl mb-1">✅</p>
          <p className="text-sm font-black text-emerald-400">Expediente encerrado!</p>
          <p className="text-[11px] text-gray-500 mt-1">Novo registro disponível amanhã.</p>
        </div>
      )}

      {/* Timer almoço */}
      {isLunchBlocked && lunchCountdown && (
        <div className="bg-orange-950/60 border border-orange-800/50 rounded-2xl p-4 text-center">
          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1">Aguarde para retornar do almoço</p>
          <p className="text-4xl font-black text-orange-400 font-mono tabular-nums">{lunchCountdown}</p>
          <p className="text-[10px] text-gray-500 mt-1">Almoço mínimo de 1 hora obrigatório</p>
        </div>
      )}

      {/* Timer jornada — bom dia! */}
      {entryCountdown && nextAction.type !== 'entry' && (
        <div className="bg-amber-950/60 border border-amber-800/50 rounded-2xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Coffee size={16} className="text-amber-400" />
            <span className="text-sm font-extrabold text-amber-400 uppercase">Bom dia! ☀️</span>
          </div>
          <p className="text-[11px] text-amber-300/70 mb-2">Tome seu café e prepare-se para iniciar!</p>
          <p className="text-3xl font-black text-amber-400 font-mono tabular-nums">{entryCountdown}</p>
        </div>
      )}

      {/* Erro */}
      {errorMessage && (
        <div className="flex items-center gap-2 bg-red-950/70 border border-red-800/50 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm font-semibold">{errorMessage}</p>
        </div>
      )}

      {/* Botão de ação */}
      <button
        onClick={() => handleRegister()}
        disabled={processing || !!successMessage || isLunchBlocked || isDayComplete}
        className={`flex items-center justify-center gap-3 w-full py-5 rounded-2xl font-black text-base transition-all active:scale-95 text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed ${nextAction.colorClass}`}
      >
        {processing
          ? <Loader2 size={22} className="animate-spin" />
          : <ActionIcon size={22} />
        }
        {processing ? processMessage || 'Processando...' : nextAction.label}
      </button>
      <p className="text-center text-[11px] text-gray-600 -mt-2">{nextAction.description}</p>

      {/* Encerrar Turno Especial — apenas quando lastEntry é 'entry' (sem almoço ainda) */}
      {showSpecialExit && (
        <div className="border-t border-dashed border-gray-800 pt-4 space-y-2">
          {/* Aviso CLT 4-6h — pausa de 15 min obrigatória */}
          {specialExitCLT === 'warn_15' && (
            <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-800/50 rounded-xl px-3 py-2.5">
              <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-300 leading-snug">
                <strong>Jornada entre 4h e 6h</strong> — pausa de 15 min obrigatória por lei. Use o botão "Iniciar Almoço" acima para registrar a pausa.
              </p>
            </div>
          )}
          {/* Bloqueio CLT acima de 6h */}
          {specialExitCLT === 'blocked' && (
            <div className="flex items-start gap-2 bg-red-950/50 border border-red-800/50 rounded-xl px-3 py-2.5">
              <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-300 leading-snug">
                <strong>Jornada acima de 6h</strong> — intervalo de almoço obrigatório por lei (CLT Art. 71). Registre o almoço antes de encerrar.
              </p>
            </div>
          )}
          <button
            onClick={() => handleRegister(true)}
            disabled={processing || !!successMessage || specialExitCLT !== 'free'}
            className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-bold text-sm border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed
              ${specialExitCLT !== 'free'
                ? 'text-gray-500 border-gray-800 bg-gray-900/30 cursor-not-allowed'
                : 'text-red-400 border-red-900/60 bg-red-950/30 active:bg-red-950/60'}`}
          >
            <LogOut size={16} />
            Encerrar Turno Especial
          </button>
          <p className="text-center text-[10px] text-gray-600 leading-snug px-2">
            Utilize para encerrar turnos de meio período em que não foi realizado almoço ou pausa, independente do horário.
          </p>
        </div>
      )}

      {/* Histórico do dia */}
      {history.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2">Registros de hoje</p>
          <div className="space-y-2">
            {history.map(r => (
              <div key={r.id} className="flex items-center gap-3 bg-gray-900/80 border border-gray-800 rounded-xl px-3 py-2.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${corBadge(r.type)}`}>
                  {r.type === 'entry'       && <LogIn size={14} />}
                  {r.type === 'lunch_start' && <Coffee size={14} />}
                  {r.type === 'lunch_end'   && <UtensilsCrossed size={14} />}
                  {r.type === 'exit'        && <LogOut size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">{labelTipo(r.type)}</p>
                  <div className="flex items-center gap-1 text-[10px] mt-0.5">
                    {r.locationVerified
                      ? <><ShieldCheck size={9} className="text-emerald-400" /><span className="text-emerald-400 font-semibold truncate">{r.locationName ?? 'Verificado'}</span></>
                      : r.coordinates
                        ? <><MapPin size={9} className="text-gray-500" /><span className="text-gray-500">GPS registrado</span></>
                        : <><WifiOff size={9} className="text-orange-400" /><span className="text-orange-400">Sem GPS</span></>
                    }
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400 font-mono tabular-nums">
                    {r.timestamp?.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {r.biometricVerified && <p className="text-[9px] text-emerald-400 font-bold">✓ Biometria</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
