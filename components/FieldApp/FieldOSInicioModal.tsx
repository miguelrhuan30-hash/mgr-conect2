import React, { useState, useRef } from 'react';
import { Camera, Image, X, Check, Loader2, Video } from 'lucide-react';
import { uploadMedia, isVideoFile, isVideoUrl } from './photoUtils';

interface MediaItem {
  file: File;
  preview: string;
  isVideo: boolean;
}

interface Props {
  taskId: string;
  titulo: string;
  uid: string;
  onConfirmar: (mediasURLs: string[]) => Promise<void>;
  onCancelar: () => void;
}

export default function FieldOSInicioModal({ taskId, titulo, uid, onConfirmar, onCancelar }: Props) {
  const [items, setItems]         = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progresso, setProgresso] = useState('');
  const [erro, setErro]           = useState('');
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const novos: MediaItem[] = Array.from(fileList).map(f => ({
      file: f,
      preview: URL.createObjectURL(f),
      isVideo: isVideoFile(f),
    }));
    setItems(prev => [...prev, ...novos]);
  };

  const remover = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const confirmar = async () => {
    if (items.length === 0) { setErro('Adicione pelo menos 1 foto ou vídeo antes de iniciar.'); return; }
    setUploading(true); setErro('');
    try {
      const ts = Date.now();
      const urls = await uploadMedia(
        items.map(m => m.file),
        (i, ext) => `os_evidencias/${taskId}/inicio/${uid}_${ts}_${i}.${ext}`,
        (done, total) => setProgresso(`${done}/${total}`),
      );
      await onConfirmar(urls);
    } catch {
      setErro('Erro ao enviar. Tente novamente.');
      setUploading(false);
    }
  };

  const totalLabel = `${items.length} mídia${items.length !== 1 ? 's' : ''}`;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 safe-area-top">
        <button onClick={onCancelar} disabled={uploading} className="p-2 -ml-2 rounded-full active:bg-gray-800">
          <X size={20} className="text-gray-400" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500">Evidências iniciais obrigatórias</p>
          <h2 className="text-sm font-bold text-white truncate">{titulo}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
          <p className="text-sm text-blue-300 leading-relaxed">
            Registre o estado inicial do local e/ou equipamento <strong>antes de iniciar</strong>. Foto ou vídeo.
          </p>
        </div>

        {/* Grid de mídias */}
        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {items.map((m, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-800 border border-gray-700">
                {m.isVideo
                  ? <video src={m.preview} className="w-full h-full object-cover" muted playsInline />
                  : <img src={m.preview} alt="" className="w-full h-full object-cover" />
                }
                {m.isVideo && (
                  <div className="absolute top-1.5 left-1.5 bg-black/60 rounded-full p-1">
                    <Video size={12} className="text-white" />
                  </div>
                )}
                {!uploading && (
                  <button onClick={() => remover(i)} className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-1">
                    <X size={14} className="text-white" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Botões de captura */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-2 py-5 rounded-xl border-2 border-dashed border-gray-700 bg-gray-800/50 active:bg-gray-800 disabled:opacity-50"
          >
            <Camera size={22} className="text-emerald-400" />
            <span className="text-xs text-gray-400">Câmera</span>
          </button>
          <button
            onClick={() => galeriaRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-2 py-5 rounded-xl border-2 border-dashed border-gray-700 bg-gray-800/50 active:bg-gray-800 disabled:opacity-50"
          >
            <Image size={22} className="text-blue-400" />
            <span className="text-xs text-gray-400">Galeria / Vídeo</span>
          </button>
        </div>

        <input ref={cameraRef}  type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
        <input ref={galeriaRef} type="file" accept="image/*,video/*" multiple className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />

        {erro && <p className="text-sm text-red-400 text-center">{erro}</p>}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 bg-gray-900 border-t border-gray-800 safe-area-bottom">
        <button
          onClick={confirmar}
          disabled={uploading || items.length === 0}
          className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-base disabled:opacity-50 active:bg-emerald-700"
        >
          {uploading
            ? <><Loader2 size={18} className="animate-spin" /> Enviando {progresso}...</>
            : <><Check size={18} /> Confirmar e Iniciar ({totalLabel})</>
          }
        </button>
      </div>
    </div>
  );
}
