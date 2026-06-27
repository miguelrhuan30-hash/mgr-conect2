import { auth } from '../firebase';
import * as LocationTracker from './LocationTracker';

const isNative = (): boolean =>
  typeof (window as any).Capacitor !== 'undefined' &&
  (window as any).Capacitor.isNativePlatform?.() === true;

async function getNativeLocationPlugin() {
  if (!isNative()) return null;
  try {
    const { Plugins } = await import('@capacitor/core');
    return (Plugins as any).LocationPlugin ?? null;
  } catch {
    return null;
  }
}

async function getUserIdToken(): Promise<string> {
  try {
    return (await auth.currentUser?.getIdToken()) ?? '';
  } catch {
    return '';
  }
}

// Solicita permissão de localização antes de iniciar o serviço nativo.
// Retorna true se concedida (ou se não for ambiente nativo).
async function requestLocationPermission(): Promise<boolean> {
  if (!isNative()) return true;
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const status = await Geolocation.requestPermissions();
    const granted =
      status.location === 'granted' || status.coarseLocation === 'granted';
    if (!granted) {
      console.warn('[FieldBootstrap] Permissão de localização negada.');
    }
    return granted;
  } catch (err) {
    console.warn('[FieldBootstrap] Erro ao solicitar permissão de localização:', err);
    return false;
  }
}

// ── API pública ───────────────────────────────────────────────────────────────

export async function startFieldServices(uid: string, displayName: string) {
  // 1. Solicitar permissão de localização — obrigatório antes do serviço nativo
  const hasPermission = await requestLocationPermission();

  // 2. Inicia rastreio JS (funciona quando app está minimizado)
  LocationTracker.start(uid, displayName);

  // 3. Inicia Foreground Service nativo apenas se permissão concedida
  if (hasPermission) {
    const plugin = await getNativeLocationPlugin();
    if (plugin) {
      const idToken = await getUserIdToken();
      try {
        await plugin.startTracking({ userId: uid, userName: displayName, idToken });
        console.info('[FieldBootstrap] Foreground Service iniciado.');
      } catch (err) {
        console.warn('[FieldBootstrap] Falha ao iniciar Foreground Service:', err);
      }
    }
  }
}

export async function stopFieldServices() {
  LocationTracker.stop();

  const plugin = await getNativeLocationPlugin();
  if (plugin) {
    try {
      await plugin.stopTracking();
    } catch { /* silencioso */ }
  }
}
