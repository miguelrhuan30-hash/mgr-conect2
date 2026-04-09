import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addDoc, collection, serverTimestamp, getDocs,
  query, where, orderBy, limit, onSnapshot, doc, updateDoc
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { CollectionName, WorkLocation, TimeEntry, ErrorDetail } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { GoogleGenAI } from '@google/genai';
import {
  Clock, MapPin, ShieldCheck, Loader2, AlertTriangle,
  History, ScanFace, Camera, Coffee, LogOut, LogIn,
  CheckCircle2, Car, Bell, X, WifiOff
} from 'lucide-react';
import { logEvent } from '../utils/logger';
import { Analytics } from '../utils/mgr-analytics';
import { useCamera } from '../src/hooks/useCamera';
import { useGPS } from '../src/hooks/useGPS';
import { checkPontoRateLimit } from '../src/hooks/usePontoRateLimit';
import { fetchImageAsBase64, sanitizeUserAgent, sanitizeErrorForLog } from '../utils/imageUtils';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type ActionType = 'entry' | 'lunch_start' | 'lunch_end' | 'exit';

interface ActionState {
  type: ActionType;
  label: string;
  icon: React.ElementType;
  colorClass: string;
  description: string;
}

const actionLabels: Record<string, string> = {
  entry: '✅ ENTRADA REGISTRADA!',
  lunch_start: '✅ ALMOÇO INICIADO!',
  lunch_end: '✅ RETORNO REGISTRADO!',
  exit: '✅ SAÍDA REGISTRADA!',
};

const BIOMETRIC_CONSENT_KEY = 'mgr_biometric_consent_v1';

// ─── Helper: Google Calendar URL ──────────────────────────────────────────────
const buildCalendarReminderUrl = (title: string, minutesFromNow: number): string => {
  const start = new Date(Date.now() + minutesFromNow * 60000);
  const end = new Date(start.getTime() + 10 * 60000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return (
    `https://www.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${fmt(start)}/${fmt(end)}` +
    `&details=${encodeURIComponent('Lembrete automático — MGR Connect')}` +
    `&sf=true`
  );
};

// ─── Helper: distância GPS ────────────────────────────────────────────────────
const getDistanceInMeters = (
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ═════════════════════════════════════════════════════════════════════════════
const Ponto: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  // ── Hooks de hardware ──
  const camera = useCamera({ width: 640, height: 480, facingMode: 'user' });
  const gps = useGPS();

  // ── UI State ──
  const [activeTab, setActiveTab] = useState<'register' | 'history'>('register');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [processing, setProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showBiometricConsent, setShowBiometricConsent] = useState(false);
  const [showVehiclePrompt, setShowVehiclePrompt] = useState(false);

  // ── Data State ──
  const [loadingData, setLoadingData] = useState(true);
  const [allowedLocations, setAllowedLocations] = useState<WorkLocation[]>([]);
  const [detectedLocation, setDetectedLocation] = useState<WorkLocation | null>(null);
  const [history, setHistory] = useState<TimeEntry[]>([]);
  const [lastEntry, setLastEntry] = useState<TimeEntry | null>(null);
  const [lunchCountdown, setLunchCountdown] = useState<string | null>(null);
  const [entryCountdown, setEntryCountdown] = useState<string | null>(null);

  // ── Refs de timers ──
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const entryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoRedirectRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Cleanup no unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (entryTimerRef.current) clearInterval(entryTimerRef.current);
      if (autoRedirectRef.current) clearTimeout(autoRedirectRef.current);
    };
  }, []);

  // ─── Relógio ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ─── Câmera: ligar/desligar apenas por troca de aba ──────────────────────
  useEffect(() => {
    if (activeTab === 'register' && !showBiometricConsent) {
      camera.restart();
    } else {
      camera.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, showBiometricConsent]);

  // ─── Verificar consentimento biométrico ──────────────────────────────────
  useEffect(() => {
    const consent = localStorage.getItem(BIOMETRIC_CONSENT_KEY);
    if (!consent) setShowBiometricConsent(true);
  }, []);

  // ─── Carregar locais e GPS inicial ───────────────────────────────────────
  useEffect(() => {
    if (!currentUser || !userProfile) return;
    loadLocationsAndCheckPerimeter();
  }, [currentUser, userProfile]);

  const loadLocationsAndCheckPerimeter = async () => {
    if (!userProfile) return;

    let locs: WorkLocation[] = [];

    if (userProfile.allowedLocationIds?.length) {
      const snap = await getDocs(collection(db, CollectionName.WORK_LOCATIONS));
      snap.forEach(d => {
        if (userProfile.allowedLocationIds?.includes(d.id)) {
          locs.push({ id: d.id, ...(d.data() as any) });
        }
      });
    } else {
      const snap = await getDocs(collection(db, CollectionName.WORK_LOCATIONS));
      locs = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) } as WorkLocation))
        .filter(l => l.active !== false);
    }

    setAllowedLocations(locs);

    if (
      userProfile.role === 'admin' &&
      !userProfile.allowedLocationIds?.length
    ) {
      setDetectedLocation({ name: 'Acesso Admin (Global)' } as WorkLocation);
      return;
    }

    try {
      const loc = await gps.getFreshLocation();
      const found = locs.find(
        l => getDistanceInMeters(loc.lat, loc.lng, l.latitude, l.longitude) <= l.radius
      );
      if (found) {
        setDetectedLocation(found);
      } else {
        const osLocal = await verificarOSComoPonto(currentUser!.uid);
        setDetectedLocation(osLocal ? ({ id: osLocal.id, name: osLocal.name } as WorkLocation) : null);
      }
    } catch {
      setDetectedLocation(null);
    }
  };

  // ─── O.S. como local de ponto válido ─────────────────────────────────────
  const verificarOSComoPonto = async (
    uid: string
  ): Promise<{ name: string; id: string } | null> => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const snap = await getDocs(
        query(
          collection(db, CollectionName.TASKS),
          where('assignedTo', '==', uid),
          where('workflowStatus', '==', 'EM_EXECUCAO')
        )
      );
      for (const d of snap.docs) {
        const t = d.data() as any;
        if (!t.ponto?.permiteEntrada) continue;
        const checkin = t.checkinOS;
        if (checkin?.feito && checkin?.timestamp) {
          const checkinDate = checkin.timestamp.toDate?.();
          if (checkinDate && checkinDate >= today) {
            return { id: d.id, name: `Cliente: ${t.clientName || 'Cliente'} (OS)` };
          }
        }
      }
    } catch { /* silent */ }
    return null;
  };

  // ─── Histórico real-time ─────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, CollectionName.TIME_ENTRIES),
      where('userId', '==', currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, snapshot => {
      if (snapshot.metadata.hasPendingWrites) return;

      const entries = snapshot.docs
        .map(d => ({ id: d.id, ...(d.data() as any) } as TimeEntry))
        .filter(e => !!e.timestamp?.seconds && !e.excluido);

      setHistory(entries);
      setLoadingData(false);

      const todaysEntries = entries.filter(
        e => e.timestamp.toDate() >= today
      );
      setLastEntry(todaysEntries.length > 0 ? todaysEntries[0] : null);
    }, err => {
      console.error('History error:', err);
      setLoadingData(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // ─── Cronômetro de almoço ─────────────────────────────────────────────────
  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    const nextAction = getNextAction();
    if (nextAction.type !== 'lunch_end') {
      setLunchCountdown(null);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lunchStart = history
      .filter(e => e.type === 'lunch_start' && e.timestamp?.toDate?.() >= today)
      .sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime())[0];

    if (!lunchStart?.timestamp) { setLunchCountdown(null); return; }

    const TOTAL_MS = 60 * 60 * 1000;
    const tick = () => {
      const remaining = Math.max(
        0,
        TOTAL_MS - (Date.now() - lunchStart.timestamp.toDate().getTime())
      );
      if (remaining === 0) {
        setLunchCountdown(null);
        if (countdownRef.current) clearInterval(countdownRef.current);
        return;
      }
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setLunchCountdown(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };

    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [history, lastEntry]);

  // ─── Cronômetro de boas-vindas (20 min após entrada) ─────────────────────
  useEffect(() => {
    if (entryTimerRef.current) clearInterval(entryTimerRef.current);

    if (lastEntry?.type !== 'entry') {
      setEntryCountdown(null);
      return;
    }

    const entryTime = lastEntry.timestamp?.toDate?.();
    if (!entryTime) return;

    const TOTAL_MS = 20 * 60 * 1000;
    const tick = () => {
      const remaining = Math.max(0, TOTAL_MS - (Date.now() - entryTime.getTime()));
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setEntryCountdown(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };

    tick();
    entryTimerRef.current = setInterval(tick, 1000);
    return () => { if (entryTimerRef.current) clearInterval(entryTimerRef.current); };
  }, [lastEntry]);

  // ─── State Machine: próxima ação ─────────────────────────────────────────
  const getNextAction = (): ActionState => {
    if (!lastEntry) return {
      type: 'entry', label: 'REGISTRAR ENTRADA',
      icon: LogIn, colorClass: 'bg-green-600 hover:bg-green-700',
      description: 'Iniciar jornada de trabalho',
    };
    switch (lastEntry.type) {
      case 'entry': return {
        type: 'lunch_start', label: 'INICIAR ALMOÇO',
        icon: Coffee, colorClass: 'bg-yellow-600 hover:bg-yellow-700',
        description: 'Pausa para refeição',
      };
      case 'lunch_start': return {
        type: 'lunch_end', label: 'VOLTA DO ALMOÇO',
        icon: Clock, colorClass: 'bg-orange-600 hover:bg-orange-700',
        description: 'Retorno da pausa',
      };
      case 'lunch_end': return {
        type: 'exit', label: 'ENCERRAR EXPEDIENTE',
        icon: LogOut, colorClass: 'bg-red-600 hover:bg-red-700',
        description: 'Finalizar dia de trabalho',
      };
      case 'exit': return {
        type: 'entry', label: 'NOVA ENTRADA',
        icon: LogIn, colorClass: 'bg-blue-600 hover:bg-blue-700',
        description: 'Iniciar novo turno (Extra)',
      };
      default: return {
        type: 'entry', label: 'REGISTRAR ENTRADA',
        icon: LogIn, colorClass: 'bg-green-600 hover:bg-green-700',
        description: 'Iniciar jornada',
      };
    }
  };

  // ─── Validação tempo mínimo de almoço ────────────────────────────────────
  const validateLunchMinTime = (): { valid: boolean; remaining?: string } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lunchStart = history
      .filter(e => e.type === 'lunch_start' && e.timestamp?.toDate?.() >= today)
      .sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime())[0];

    if (!lunchStart?.timestamp) return { valid: true };

    const diffMs = Date.now() - lunchStart.timestamp.toDate().getTime();
    if (diffMs < 60 * 60 * 1000) {
      const rem = 60 * 60 * 1000 - diffMs;
      return {
        valid: false,
        remaining: `${String(Math.floor(rem / 60000)).padStart(2, '0')}:${String(Math.floor((rem % 60000) / 1000)).padStart(2, '0')}`,
      };
    }
    return { valid: true };
  };

  // ─── Helper: captura erro estruturado igual ao DevTools ──────────────────
  const buildErrorDetail = useCallback((err: any): ErrorDetail => {
    const nav = navigator as any;
    return {
      name:    err?.name    ?? 'UnknownError',
      message: err?.message ?? String(err),
      code:    err?.code    !== undefined ? Number(err.code) : undefined,
      stack:   err?.stack   ? String(err.stack).slice(0, 300) : undefined,
      deviceContext: {
        connection: nav.connection?.effectiveType ?? nav.connection?.type ?? undefined,
        screenW:    window.screen?.width,
        screenH:    window.screen?.height,
        platform:   nav.userAgentData?.platform ?? nav.platform ?? undefined,
      },
    };
  }, []);

  // ─── Interfaces dos helpers safe ──────────────────────────────────────────
  interface PhotoResult {
    photo: import('../src/hooks/useCamera').CapturedPhoto | null;
    photoStatus: 'ok' | 'unavailable' | 'camera_error';
    photoErrorDetail: ErrorDetail | null;
  }
  interface LocationResult {
    loc: import('../src/hooks/useGPS').GPSLocation | null;
    gpsStatus: 'ok' | 'best_effort' | 'unavailable';
    gpsErrorDetail: ErrorDetail | null;
    isBestEffort: boolean;
  }

  // ─── Helper: foto nunca trava ─────────────────────────────────────────────
  const capturePhotoSafe = useCallback((): PhotoResult => {
    if (!camera.isReady || camera.error) {
      const syntheticErr = { name: 'CameraNotReady', message: camera.error ?? 'Câmera não inicializada' };
      return { photo: null, photoStatus: 'camera_error', photoErrorDetail: buildErrorDetail(syntheticErr) };
    }
    try {
      const photo = camera.capturePhoto();
      return { photo, photoStatus: 'ok', photoErrorDetail: null };
    } catch (err: any) {
      return { photo: null, photoStatus: 'camera_error', photoErrorDetail: buildErrorDetail(err) };
    }
  }, [camera, buildErrorDetail]);

  // ─── Helper: GPS nunca trava ──────────────────────────────────────────────
  const getLocationSafe = useCallback(async (): Promise<LocationResult> => {
    try {
      const loc = await gps.getFreshLocation();
      return { loc, gpsStatus: 'ok', gpsErrorDetail: null, isBestEffort: false };
    } catch (err: any) {
      const errorDetail = buildErrorDetail(err);
      // Fallback: última localização conhecida (até 10 min de tolerância)
      const fallback = gps.lastKnownLocation;
      if (fallback) {
        const ageMs = Date.now() - fallback.timestamp;
        if (ageMs <= 10 * 60 * 1000) {
          return { loc: { ...fallback, source: 'cached' }, gpsStatus: 'best_effort', gpsErrorDetail: errorDetail, isBestEffort: true };
        }
      }
      return { loc: null, gpsStatus: 'unavailable', gpsErrorDetail: errorDetail, isBestEffort: false };
    }
  }, [gps, buildErrorDetail]);

  // ─── Helper: qualidade do registro ───────────────────────────────────────
  const calcQuality = (ps: PhotoResult, ls: LocationResult): 'ok' | 'partial' | 'emergency' => {
    const photoOk = ps.photoStatus === 'ok';
    const locOk   = ls.gpsStatus === 'ok' || ls.gpsStatus === 'best_effort';
    if (photoOk && locOk) return 'ok';
    if (photoOk || locOk) return 'partial';
    return 'emergency';
  };

  // ─── Background: upload foto + biometria ─────────────────────────────────
  const processInBackground = useCallback(async (
    docId: string,
    photoBase64: string,
    photoDataOnly: string,
    uid: string
  ) => {
    try {
      const storageRef = ref(
        storage,
        `${CollectionName.TIME_ENTRIES}/${uid}_${docId}.jpg`
      );
      await uploadString(storageRef, photoBase64, 'data_url');
      const photoURL = await getDownloadURL(storageRef);

      let aiValidation: { match: boolean; confidence: number } | { error: string } | null = null;
      const refPhotoUrl = userProfile?.avatar || userProfile?.photoURL;

      if (refPhotoUrl) {
        try {
          const refPhoto = await fetchImageAsBase64(refPhotoUrl);
          const ai = new GoogleGenAI({
            apiKey: import.meta.env.VITE_GEMINI_API_KEY as string,
          });
          const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: {
              parts: [
                { inlineData: { mimeType: 'image/jpeg', data: photoDataOnly } },
                { inlineData: { mimeType: 'image/jpeg', data: refPhoto.dataOnly } },
                {
                  text: 'Compare these two face photos. Are they the same person? Respond ONLY with valid JSON: {"match": boolean, "confidence": number}',
                },
              ],
            },
            config: { responseMimeType: 'application/json' },
          });
          aiValidation = JSON.parse(response.text ?? 'null');
        } catch (aiErr) {
          aiValidation = { error: sanitizeErrorForLog(aiErr) };
          logEvent(
            uid, userProfile?.displayName,
            'ponto_ai_validation_failed', 'warning',
            `IA falhou para doc ${docId}`,
            { extra: { error: sanitizeErrorForLog(aiErr) } }
          );
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
      } catch { /* silent */ }
      logEvent(
        uid, userProfile?.displayName,
        'ponto_background_processing_failed', 'warning',
        `Background falhou para doc ${docId}`,
        { extra: { error: sanitizeErrorForLog(bgErr) } }
      );
    }
  }, [userProfile]);

  // ─── REGISTRO PRINCIPAL (Modo Emergencial — nunca trava) ─────────────────
  const handleRegister = async () => {
    if (processing) return;
    const nextAction = getNextAction();

    if (!localStorage.getItem(BIOMETRIC_CONSENT_KEY)) {
      setShowBiometricConsent(true);
      return;
    }

    const rateCheck = checkPontoRateLimit(currentUser!.uid);
    if (!rateCheck.allowed) {
      setErrorMessage(`Aguarde ${rateCheck.remainingSeconds}s antes de registrar novamente.`);
      logEvent(currentUser!.uid, userProfile?.displayName, 'ponto_blocked_rate_limit', 'warning',
        `Tentativa bloqueada por rate limit: ${nextAction.type} — aguardar ${rateCheck.remainingSeconds}s`,
        { extra: { actionType: nextAction.type, remainingSeconds: rateCheck.remainingSeconds } }
      );
      return;
    }

    // ── Validação de almoço (regra de negócio, não hardware — mantida) ──────
    if (nextAction.type === 'lunch_end') {
      const check = validateLunchMinTime();
      if (!check.valid) {
        setErrorMessage(`Almoço mínimo de 1h não cumprido. Retorne em ${check.remaining}.`);
        logEvent(currentUser!.uid, userProfile?.displayName, 'ponto_blocked_lunch_min', 'warning',
          `Tentativa de retorno de almoço bloqueada — tempo mínimo não cumprido. Faltam ${check.remaining}`,
          { extra: { actionType: 'lunch_end', remaining: check.remaining } }
        );
        return;
      }
    }

    setProcessing(true);
    setErrorMessage('');
    setProcessMessage('Capturando foto...');

    // ── [1] Foto — nunca lança exceção ────────────────────────────────────────
    const photoResult = capturePhotoSafe();

    // ── [2] GPS — nunca lança exceção ─────────────────────────────────────────
    setProcessMessage('Verificando localização...');
    const locationResult = await getLocationSafe();

    // ── [3] Perímetro — só valida se GPS funcionou ────────────────────────────
    let perimeterStatus: TimeEntry['perimeterStatus'] = 'skipped_gps_fail';
    let resolvedLocation = detectedLocation;

    if (userProfile?.role === 'admin' && !userProfile?.allowedLocationIds?.length) {
      perimeterStatus = 'skipped_admin';
      resolvedLocation = resolvedLocation ?? ({ name: 'Acesso Admin (Global)' } as WorkLocation);
    } else if (locationResult.loc) {
      const requiresLocation = nextAction.type === 'entry' || nextAction.type === 'exit';
      const hasRestrictedPerimeter = userProfile?.allowedLocationIds && userProfile.allowedLocationIds.length > 0;

      if (requiresLocation && hasRestrictedPerimeter) {
        const found = allowedLocations.find(
          l => getDistanceInMeters(locationResult.loc!.lat, locationResult.loc!.lng, l.latitude, l.longitude) <= l.radius
        );
        if (found) {
          resolvedLocation = found;
          perimeterStatus = 'verified';
        } else if (resolvedLocation) {
          perimeterStatus = 'verified';
        } else {
          // Fora do perímetro: modo emergencial → avisa mas não bloqueia
          perimeterStatus = 'outside_warning';
        }
      } else {
        perimeterStatus = resolvedLocation ? 'verified' : 'skipped_gps_fail';
      }
    }

    // ── [4] Qualidade do registro ─────────────────────────────────────────────
    const quality = calcQuality(photoResult, locationResult);

    setProcessMessage('Gravando registro...');
    if (!currentUser) { setProcessing(false); return; }

    try {
      const docRef = await addDoc(collection(db, CollectionName.TIME_ENTRIES), {
        userId: currentUser.uid,
        type: nextAction.type,
        timestamp: serverTimestamp(),

        // Localização
        locationId: resolvedLocation?.id ?? 'unknown',
        locationName: resolvedLocation?.name ?? (locationResult.loc ? 'Capturado via GPS' : 'GPS Indisponível'),
        locationVerified: perimeterStatus === 'verified',
        gpsCoords: locationResult.loc
          ? { lat: locationResult.loc.lat, lng: locationResult.loc.lng, accuracy: locationResult.loc.accuracy }
          : null,
        gpsSource: locationResult.loc?.source ?? null,

        // Diagnóstico estruturado
        registrationQuality: quality,
        photoStatus: photoResult.photoStatus,
        photoErrorDetail: photoResult.photoErrorDetail,
        gpsStatus: locationResult.gpsStatus,
        gpsErrorDetail: locationResult.gpsErrorDetail,
        gpsBestEffortCoords: locationResult.isBestEffort && locationResult.loc
          ? {
              lat: locationResult.loc.lat,
              lng: locationResult.loc.lng,
              accuracy: locationResult.loc.accuracy,
              ageMs: Date.now() - (locationResult.loc.timestamp ?? Date.now()),
            }
          : null,
        perimeterStatus,

        // Biometria / controle
        isManual: false,
        userAgent: sanitizeUserAgent(navigator.userAgent),
        biometricVerified: false,
        photoURL: null,
        aiValidation: null,
        processingStatus: photoResult.photo ? 'pending' : 'skipped_no_photo',
      });

      // Analytics
      if (nextAction.type === 'entry') {
        Analytics.logEvent({ eventType: 'ponto_entrada', area: 'rh', userId: currentUser.uid, entityId: docRef.id, payload: { tipo: 'entry', locationId: resolvedLocation?.id, quality } });
      } else if (nextAction.type === 'exit') {
        Analytics.logEvent({ eventType: 'ponto_saida', area: 'rh', userId: currentUser.uid, entityId: docRef.id, payload: { tipo: 'exit', locationId: resolvedLocation?.id, quality } });
      }

      // Logs de auditoria por qualidade
      if (quality === 'ok') {
        logEvent(currentUser.uid, userProfile?.displayName, 'ponto_register_success', 'success',
          `Ponto gravado: ${nextAction.label}`,
          { extra: { docId: docRef.id, gpsSource: locationResult.loc?.source } }
        );
      } else if (quality === 'partial') {
        logEvent(currentUser.uid, userProfile?.displayName, 'ponto_register_partial', 'warning',
          `Ponto parcial: ${nextAction.label} — photo=${photoResult.photoStatus} gps=${locationResult.gpsStatus}`,
          { extra: { docId: docRef.id, photoError: photoResult.photoErrorDetail, gpsError: locationResult.gpsErrorDetail } }
        );
      } else {
        logEvent(currentUser.uid, userProfile?.displayName, 'ponto_register_emergency', 'error',
          `Ponto EMERGENCIAL: ${nextAction.label} — sem foto e sem GPS`,
          { extra: { docId: docRef.id, photoError: photoResult.photoErrorDetail, gpsError: locationResult.gpsErrorDetail } }
        );
      }

      const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setSuccessMessage(`${actionLabels[nextAction.type]}\n${timeStr}`);
      setProcessing(false);

      if (autoRedirectRef.current) clearTimeout(autoRedirectRef.current);
      autoRedirectRef.current = setTimeout(() => { setSuccessMessage(''); setActiveTab('history'); }, 4000);

      if (nextAction.type === 'entry') setTimeout(() => setShowVehiclePrompt(true), 2000);

      // Background: só processa foto se tiver foto capturada
      if (photoResult.photo) {
        processInBackground(docRef.id, photoResult.photo.base64, photoResult.photo.dataOnly, currentUser.uid);
      }

    } catch (err: any) {
      setProcessing(false);
      setErrorMessage(err.message ?? 'Erro ao salvar no servidor. Tente novamente.');
      logEvent(currentUser.uid, userProfile?.displayName, 'ponto_register_firestore_fail', 'error',
        `Falha ao salvar ponto: ${err.message}`, { extra: { error: sanitizeErrorForLog(err) } }
      );
    }
  };

  // ─── Helpers de UI ────────────────────────────────────────────────────────
  const getActionLabel = (type: string) => {
    switch (type) {
      case 'entry':      return { text: 'Entrada',      icon: LogIn,  color: 'text-green-600' };
      case 'lunch_start':return { text: 'Início Almoço',icon: Coffee, color: 'text-yellow-600' };
      case 'lunch_end':  return { text: 'Fim Almoço',   icon: Clock,  color: 'text-orange-600' };
      case 'exit':       return { text: 'Saída',        icon: LogOut, color: 'text-red-600' };
      default:           return { text: type,           icon: CheckCircle2, color: 'text-gray-600' };
    }
  };

  const LocationBadge = ({ entry }: { entry: TimeEntry }) => {
    const isLunch = entry.type === 'lunch_start' || entry.type === 'lunch_end';
    if (isLunch && (entry as any).mapsUrl) {
      return (
        <a href={(entry as any).mapsUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-blue-600 font-bold hover:underline"
          onClick={e => e.stopPropagation()}>
          <MapPin size={10} /> Ver no Mapa
        </a>
      );
    }
    if (entry.locationVerified) {
      return (
        <div className="flex items-center gap-1 text-[10px] text-green-600 font-bold">
          <ShieldCheck size={10} /> {entry.locationName || 'Verificado'}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-[10px] text-orange-500 font-bold">
        <AlertTriangle size={10} /> Fora do Perímetro
      </div>
    );
  };

  // ─── Computed ─────────────────────────────────────────────────────────────
  const nextAction = getNextAction();
  const isLunchBlocked = lunchCountdown !== null && nextAction.type === 'lunch_end';
  const isBlocked =
    processing ||
    !!successMessage ||
    !!errorMessage ||
    isLunchBlocked ||
    showBiometricConsent;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>
      <div className="max-w-xl mx-auto space-y-4 animate-in fade-in duration-500 pb-20">

        {/* Header: relógio + localização */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Hora Certa</span>
            <div className="text-2xl font-mono font-bold text-gray-900 leading-none">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
          <div className="text-right flex flex-col items-end">
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider flex items-center gap-1">
              <MapPin size={10} /> Localização
            </span>
            <div className={`text-sm font-bold flex items-center gap-1 ${detectedLocation ? 'text-green-600' : 'text-red-500'}`}>
              {detectedLocation
                ? <><ShieldCheck size={14} /> {detectedLocation.name}</>
                : gps.isLoading
                  ? <><Loader2 size={14} className="animate-spin" /> Verificando...</>
                  : 'Fora do Perímetro'
              }
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-gray-200 rounded-lg">
          {(['register', 'history'] as const).map(tab => (
            <button key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === tab ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'}`}>
              {tab === 'register' ? <><ScanFace size={16} /> Registrar</> : <><History size={16} /> Histórico</>}
            </button>
          ))}
        </div>

        {/* ── TAB: REGISTRAR ── */}
        {activeTab === 'register' && (
          <div className="flex flex-col gap-4">

            {/* Câmera */}
            <div className="relative bg-black rounded-2xl overflow-hidden shadow-lg aspect-[4/3]">

              <video ref={camera.videoRef} autoPlay playsInline muted
                className="absolute inset-0 w-full h-full object-cover" />

              {camera.error && !successMessage && (
                <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center z-20 text-white px-6 text-center">
                  <Camera className="w-12 h-12 text-gray-400 mb-3" />
                  <p className="text-sm font-bold mb-4">{camera.error}</p>
                  <button onClick={() => camera.restart()}
                    className="px-4 py-2 bg-white text-gray-900 rounded-lg text-sm font-bold">
                    Tentar Novamente
                  </button>
                </div>
              )}

              {successMessage && (
                <div className="absolute inset-0 bg-green-50 flex flex-col items-center justify-center z-30 animate-in zoom-in">
                  <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
                    <CheckCircle2 className="w-14 h-14 text-green-600" />
                  </div>
                  {successMessage.split('\n').map((line, i) => (
                    <h3 key={i} className={`font-bold text-center px-4 ${i === 0 ? 'text-2xl text-green-800' : 'text-lg text-green-600 font-mono mt-1'}`}>
                      {line}
                    </h3>
                  ))}
                  <p className="text-sm text-green-500 mt-3">Registro confirmado com sucesso!</p>
                </div>
              )}

              {processing && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 text-white">
                  <Loader2 className="w-12 h-12 animate-spin text-brand-400 mb-4" />
                  <p className="text-lg font-bold">{processMessage}</p>
                </div>
              )}

              {errorMessage && (
                <div className="absolute inset-0 bg-red-900/90 backdrop-blur-sm flex flex-col items-center justify-center z-20 text-white px-6 text-center">
                  <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
                  <p className="font-bold mb-4 whitespace-pre-line">{errorMessage}</p>
                  <button
                    onClick={() => { setErrorMessage(''); camera.restart(); }}
                    className="px-4 py-2 bg-white text-red-900 rounded-lg text-sm font-bold">
                    Tentar Novamente
                  </button>
                </div>
              )}

              {!camera.isReady && !camera.error && !successMessage && !processing && !errorMessage && (
                <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              )}
            </div>

            {/* Botão de ação */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">

              {isLunchBlocked && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center mb-4">
                  <div className="text-[10px] text-orange-600 font-bold uppercase tracking-wider mb-2">
                    ⏱ AGUARDE PARA RETORNAR DO ALMOÇO
                  </div>
                  <div className="text-4xl font-black text-orange-600 font-mono">{lunchCountdown}</div>
                  <div className="text-[10px] text-gray-400 mt-2">Almoço mínimo de 1 hora obrigatório</div>
                  <a href={buildCalendarReminderUrl('Retorno do Almoço — MGR', 60)}
                    target="_blank" rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-lg hover:bg-orange-700">
                    <Bell size={14} /> 🔔 Criar lembrete de retorno
                  </a>
                </div>
              )}

              {entryCountdown && nextAction.type !== 'entry' && (
                <div className="mt-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 text-center mb-4">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Coffee className="w-5 h-5 text-amber-600" />
                    <span className="text-sm font-extrabold text-amber-800 uppercase tracking-wide">Bom dia! ☀️</span>
                    <Coffee className="w-5 h-5 text-amber-600" />
                  </div>
                  <p className="text-xs text-amber-700 mb-4 leading-relaxed">
                    Tome seu café, arrume suas ferramentas<br />e prepare-se para iniciar as atividades!
                  </p>
                  <div className="w-28 h-28 rounded-full border-4 border-amber-300 bg-white shadow-inner flex flex-col items-center justify-center mx-auto mb-2">
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-0.5">preparo</span>
                    <span className="text-3xl font-black text-amber-700 font-mono">{entryCountdown}</span>
                  </div>
                  <a href={buildCalendarReminderUrl('Fim do Café — Iniciar Atividades', 20)}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700">
                    <Bell size={14} /> 🔔 Criar lembrete fim do café
                  </a>
                </div>
              )}

              <button onClick={handleRegister} disabled={isBlocked}
                className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${nextAction.colorClass}`}>
                {processing
                  ? <Loader2 className="animate-spin" />
                  : <nextAction.icon size={24} />
                }
                {processing
                  ? 'PROCESSANDO...'
                  : isLunchBlocked
                    ? `🍽️ Retornar em ${lunchCountdown}`
                    : nextAction.label
                }
              </button>
              <p className="text-center text-xs text-gray-500 mt-2">{nextAction.description}</p>
            </div>

            {lastEntry && (
              <div className="text-center text-xs text-gray-400">
                Último registro: {getActionLabel(lastEntry.type).text} às{' '}
                {lastEntry.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? '--:--'}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: HISTÓRICO ── */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-700">Registros de Hoje</h3>
              <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-bold">
                {new Date().toLocaleDateString()}
              </span>
            </div>
            {loadingData ? (
              <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-brand-600" /></div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {history.length === 0 && (
                  <p className="p-8 text-center text-gray-400 italic">Nenhum registro hoje.</p>
                )}
                {history.map(entry => {
                  const style = getActionLabel(entry.type);
                  return (
                    <div key={entry.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-gray-50 ${style.color}`}>
                          <style.icon size={20} />
                        </div>
                        <div>
                          <p className={`font-bold text-sm ${style.color}`}>{style.text}</p>
                          <LocationBadge entry={entry} />
                          {/* Qualidade do registro emergencial */}
                          {(entry as any).registrationQuality === 'partial' && (
                            <span className="text-[10px] text-yellow-600 flex items-center gap-1 font-bold">
                              <AlertTriangle size={8} />
                              Parcial
                              {(entry as any).photoStatus !== 'ok' && ' · sem foto'}
                              {(entry as any).gpsStatus === 'unavailable' && ' · sem GPS'}
                            </span>
                          )}
                          {(entry as any).registrationQuality === 'emergency' && (
                            <span className="text-[10px] text-red-600 flex items-center gap-1 font-bold">
                              <AlertTriangle size={8} /> Emergencial — revisão necessária
                            </span>
                          )}
                          {(entry as any).processingStatus === 'pending' && (entry as any).registrationQuality !== 'emergency' && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Loader2 size={8} className="animate-spin" /> Processando biometria...
                            </span>
                          )}
                          {(entry as any).processingStatus === 'failed' && (
                            <span className="text-[10px] text-orange-500 flex items-center gap-1">
                              <AlertTriangle size={8} /> Biometria pendente (revisão manual)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-gray-900 text-lg">
                          {entry.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? '--:--'}
                        </div>
                        {entry.biometricVerified && (
                          <div className="flex items-center justify-end gap-1 text-[10px] text-green-600 font-bold">
                            <ShieldCheck size={10} /> Validado
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL: Consentimento Biométrico (LGPD) ── */}
      {showBiometricConsent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-gray-800 text-center mb-3">
              Verificação Biométrica
            </h3>
            <p className="text-sm text-gray-600 text-center mb-4 leading-relaxed">
              Ao registrar ponto, sua foto será capturada e comparada com sua foto de perfil
              usando inteligência artificial para verificação de identidade,
              conforme a <strong>LGPD Art. 11</strong>.
            </p>
            <p className="text-xs text-gray-400 text-center mb-6">
              Os dados biométricos são usados exclusivamente para controle de ponto
              e não são compartilhados com terceiros.
            </p>
            <button
              onClick={() => {
                localStorage.setItem(BIOMETRIC_CONSENT_KEY, String(Date.now()));
                setShowBiometricConsent(false);
                setTimeout(() => camera.restart(), 300);
              }}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.97] transition-all">
              Entendi e aceito
            </button>
          </div>
        </div>
      )}

      {/* ── POPUP: Veículo ── */}
      {showVehiclePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 relative animate-in fade-in zoom-in-95 duration-300">
            <button onClick={() => setShowVehiclePrompt(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Car className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-gray-800 text-center mb-2">Vai sair com algum veículo?</h3>
            <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
              Não esqueça de fazer a abertura do veículo antes de iniciar o deslocamento.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowVehiclePrompt(false);
                  if (autoRedirectRef.current) clearTimeout(autoRedirectRef.current);
                  setSuccessMessage('');
                  navigate('/app/veiculos');
                }}
                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97] transition-all flex items-center justify-center gap-2 shadow-md">
                <Car className="w-4 h-4" /> Sim, realizar abertura
              </button>
              <button onClick={() => setShowVehiclePrompt(false)}
                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 active:scale-[0.97] transition-all flex items-center justify-center gap-2">
                Não, hoje vou sair sem veículos
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Ponto;
