import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName } from '../types';

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export type LogAction =
  | 'login_attempt' | 'login_success' | 'login_error' | 'logout'
  | 'page_view'
  | 'ponto_camera_start' | 'ponto_camera_error'
  | 'ponto_gps_check' | 'ponto_gps_denied' | 'ponto_gps_success' | 'ponto_gps_out_of_range'
  | 'ponto_biometric_start' | 'ponto_biometric_success' | 'ponto_biometric_fail'
  | 'ponto_register_attempt' | 'ponto_register_success' | 'ponto_register_error'
  | 'ponto_register_partial' | 'ponto_register_emergency' | 'ponto_register_firestore_fail'
  | 'ponto_location_blocked' | 'ponto_lunch_time_blocked' | 'ponto_lunch_gps_blocked'
  | 'ponto_blocked_rate_limit' | 'ponto_blocked_lunch_min'
  | 'ponto_upload_photo' | 'ponto_firestore_save'
  | 'ponto_ai_validation_failed' | 'ponto_background_processing_failed'
  | 'permission_denied' | 'system_error'
  | 'campaign_reward' | 'campaign_reset';

export interface LogMeta {
  actionType?: string;
  errorMessage?: string;
  errorStack?: string;
  gpsCoords?: { lat: number; lng: number; accuracy?: number | null };
  locationName?: string;
  locationId?: string;
  biometricConfidence?: number;
  biometricMatch?: boolean;
  page?: string;
  pageTitle?: string;
  fromPage?: string;
  lunchRemaining?: string;
  extra?: Record<string, unknown>;
}

export const logEvent = async (
  userId: string,
  userName: string | null | undefined,
  action: LogAction,
  level: LogLevel,
  description: string,
  meta?: LogMeta
): Promise<void> => {
  try {
    await addDoc(collection(db, CollectionName.SYSTEM_LOGS), {
      userId: userId || '',
      userName: userName || 'Anônimo',
      action,
      level,
      description,
      meta: meta ?? {},
      timestamp: serverTimestamp(),
      userAgent: typeof navigator !== 'undefined'
        ? navigator.userAgent.substring(0, 300)
        : 'unknown',
    });
  } catch {
    // Silencioso — nunca trava o fluxo principal
  }
};
