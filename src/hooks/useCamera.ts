import { useRef, useState, useCallback, useEffect } from 'react';

export interface CapturedPhoto {
  base64: string;
  dataOnly: string;
  takenAt: Date;
}

export interface UseCameraOptions {
  width?: number;
  height?: number;
  facingMode?: 'user' | 'environment';
}

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  capturePhoto: () => CapturedPhoto;
  isReady: boolean;
  error: string | null;
  restart: () => Promise<void>;
  stop: () => void;
}

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const { width = 640, height = 480, facingMode = 'user' } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStartingRef = useRef(false);
  const mountedRef = useRef(true);

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopInternal = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (mountedRef.current) setIsReady(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Para stream sem chamar setState (componente desmontado)
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, []);

  const start = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    stopInternal();
    if (mountedRef.current) setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: width },
          height: { ideal: height },
        },
        audio: false,
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) return reject(new Error('videoRef null'));
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().then(resolve).catch(reject);
          };
          videoRef.current.onerror = () => reject(new Error('video error'));
        });
      }

      if (mountedRef.current) setIsReady(true);

    } catch (err: any) {
      if (!mountedRef.current) return;
      let msg = 'Erro ao acessar câmera. Recarregue a página.';
      if (err.name === 'NotAllowedError')
        msg = 'Permissão de câmera negada. Verifique as configurações do navegador.';
      else if (err.name === 'NotFoundError')
        msg = 'Nenhuma câmera encontrada neste dispositivo.';
      else if (err.name === 'NotReadableError')
        msg = 'Câmera em uso por outro aplicativo. Feche e tente novamente.';
      setError(msg);
      setIsReady(false);
    } finally {
      isStartingRef.current = false;
    }
  }, [facingMode, width, height, stopInternal]);

  const capturePhoto = useCallback((): CapturedPhoto => {
    if (!videoRef.current || !isReady || !streamRef.current?.active) {
      throw new Error('Câmera não está pronta. Aguarde ou recarregue a página.');
    }

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      throw new Error('Câmera ainda inicializando. Tente novamente.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Falha interna de canvas.');

    // Espelhar horizontalmente (câmera frontal)
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);

    // Timestamp no frame
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, height - 28, width, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(new Date().toLocaleString('pt-BR'), 8, height - 9);

    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    return {
      base64,
      dataOnly: base64.split(',')[1],
      takenAt: new Date(),
    };
  }, [isReady, width, height]);

  return {
    videoRef,
    capturePhoto,
    isReady,
    error,
    restart: start,
    stop: stopInternal,
  };
}
