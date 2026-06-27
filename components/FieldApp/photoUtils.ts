import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';

const MAX_DIM = 1920;
const QUALITY = 0.75;

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/i.test(url);
}

function getExt(file: File): string {
  if (isVideoFile(file)) {
    const parts = file.name.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'mp4';
  }
  return 'jpg'; // imagens sempre comprimidas para JPEG
}

export function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        const r = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * r); height = Math.round(height * r);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas failed')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        b => b ? resolve(b) : reject(new Error('toBlob null')),
        'image/jpeg', QUALITY,
      );
    };
    img.onerror = () => reject(new Error('load failed'));
    img.src = URL.createObjectURL(file);
  });
}

async function uploadOnce(path: string, blob: Blob): Promise<string> {
  const r = ref(storage, path);
  await uploadBytes(r, blob);
  return getDownloadURL(r);
}

export async function uploadPhoto(file: File, storagePath: string): Promise<string> {
  let blob: Blob;
  try { blob = await compressImage(file); } catch { blob = file; }
  try {
    return await uploadOnce(storagePath, blob);
  } catch {
    await new Promise(r => setTimeout(r, 1500));
    return await uploadOnce(storagePath, blob);
  }
}

/**
 * Faz upload de mídias (fotos + vídeos).
 * Fotos: comprimidas para JPEG 75% / 1920px.
 * Vídeos: enviados sem compressão.
 * makeStoragePath recebe (index, extensão) — ex: (0, 'jpg') ou (1, 'mp4')
 */
export async function uploadMedia(
  files: File[],
  makeStoragePath: (i: number, ext: string) => string,
  onProgress?: (uploaded: number, total: number) => void,
): Promise<string[]> {
  let done = 0;
  const urls = await Promise.all(
    files.map(async (file, i) => {
      const ext  = getExt(file);
      const path = makeStoragePath(i, ext);
      const r    = ref(storage, path);

      let blob: Blob;
      if (isVideoFile(file)) {
        blob = file; // vídeos sem compressão
      } else {
        try { blob = await compressImage(file); } catch { blob = file; }
      }

      try { await uploadBytes(r, blob); }
      catch { await new Promise(res => setTimeout(res, 1500)); await uploadBytes(r, blob); }

      const url = await getDownloadURL(r);
      onProgress?.(++done, files.length);
      return url;
    })
  );
  return urls;
}

/** @deprecated use uploadMedia */
export async function uploadPhotos(
  files: File[],
  makeStoragePath: (i: number) => string,
  onProgress?: (uploaded: number, total: number) => void,
): Promise<string[]> {
  return uploadMedia(files, (i, ext) => makeStoragePath(i), onProgress);
}
