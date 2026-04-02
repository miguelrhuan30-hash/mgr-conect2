import { CapturedPhoto } from '../hooks/useCamera';

/**
 * Carrega uma imagem de URL como base64.
 * Tenta fetch com CORS primeiro, fallback via canvas.
 */
export async function fetchImageAsBase64(url: string): Promise<CapturedPhoto> {
  // Tentativa 1: fetch com CORS
  try {
    const res = await fetch(url, {
      mode: 'cors',
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
    return {
      base64,
      dataOnly: base64.split(',')[1],
      takenAt: new Date(),
    };
  } catch {
    // Tentativa 2: Image + canvas (fallback CORS)
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timeout = setTimeout(
        () => reject(new Error('Timeout ao carregar imagem de referência.')),
        8000
      );
      img.onload = () => {
        clearTimeout(timeout);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 640;
        canvas.height = img.naturalHeight || 480;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context failed'));
        ctx.drawImage(img, 0, 0);
        try {
          const base64 = canvas.toDataURL('image/jpeg', 0.9);
          resolve({
            base64,
            dataOnly: base64.split(',')[1],
            takenAt: new Date(),
          });
        } catch {
          reject(new Error('Canvas tainted — configure CORS no Firebase Storage.'));
        }
      };
      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Falha ao carregar foto de referência.'));
      };
      // Cache-bust para forçar CORS correto
      img.src = url.includes('?') ? url : `${url}?cb=${Date.now()}`;
    });
  }
}

/**
 * Sanitiza userAgent antes de gravar no Firestore
 */
export function sanitizeUserAgent(ua: string): string {
  return ua.replace(/[<>"'&]/g, '').substring(0, 200);
}

/**
 * Remove dados sensíveis de mensagens de erro para logs
 */
export function sanitizeErrorForLog(err: unknown): string {
  return String(err)
    .replace(/https?:\/\/\S+/g, '[URL]')
    .replace(/(-?\d{1,3}\.\d{4,})/g, '[COORD]')
    .replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]{20,}/g, '[BASE64]')
    .substring(0, 300);
}
