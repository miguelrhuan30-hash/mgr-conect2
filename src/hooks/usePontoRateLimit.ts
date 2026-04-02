const RATE_LIMIT_KEY = (uid: string) => `mgr_ponto_last_${uid}`;
const MIN_INTERVAL_MS = 30 * 1000; // 30 segundos

export function checkPontoRateLimit(uid: string): {
  allowed: boolean;
  remainingSeconds?: number;
} {
  const key = RATE_LIMIT_KEY(uid);
  const last = localStorage.getItem(key);

  if (last) {
    const elapsed = Date.now() - Number(last);
    if (elapsed < MIN_INTERVAL_MS) {
      const remaining = Math.ceil((MIN_INTERVAL_MS - elapsed) / 1000);
      return { allowed: false, remainingSeconds: remaining };
    }
  }

  localStorage.setItem(key, String(Date.now()));
  return { allowed: true };
}
