import React, { useState, useRef } from 'react';
import { Camera, Image, X, CheckCircle2, XCircle, Loader2, ArrowLeft, Video } from 'lucide-react';
import { uploadMedia, isVideoFile, isVideoUrl } from './photoUtils';

export interface TarefaComEvidencia {
  id: string;
  descricao: string;
  status: 'pendente' | 'concluida' | 'nao_executada';
  fotos?: string[];    // URLs já salvas (fotosApp no Firestore)
  observacao?: string; // observacaoApp no Firestore
}

interface MediaItem {
  file: File;
  preview: string;
  isVideo: boolean;
}

interface Props {
  tarefa: TarefaComEvidencia;
  taskId: string;
  uid: string;
  onSalvar: (tarefaAtualizada: TarefaComEvidencia) => Promise<void>;
  onCancelar: () => void;
}

export default function FieldOSTarefaDetalhe({ tarefa, taskId, uid, onSalvar, onCancelar }: Props) {
  const [items, setItems]           = useState<MediaItem[]>([]);
  const [observacao, setObservacao] = useState(tarefa.observacao ?? '');
  const [uploading, setUploading]   = useState(false);
  const [progresso, setProgresso]   = useState('');
  const [erro, setErro]             = useState('');
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const novos: MediaItem[] = Array.from(fileList).map(f => ({
      file: f, preview: URL.createObjectURL(f), isVideo: isVideoFile(f),
    }));
    setItems(prev => [...prev, ...novos]);
  };

  const remover = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const salvar = async (novoStatus: 'concluida' | 'nao_executada') => {
    setErro('');
    const jaTemMidia = (tarefa.fotos ?? []).length > 0;
    if (novoStatus === 'concluida' && items.length === 0 && !jaTemMidia) {
      setErro('Adicione pelo menos 1 foto ou vídeo como evidência da conclusão.'); return;
    }
    if (!observacao.trim()) {
      setErro(novoStatus === 'concluida' ? 'Descreva o que foi feito.' : 'Descreva o motivo de não execução.'); return;
    }
    setUploading(true);
    try {
      let midiaURLs: string[] = tarefa.fotos ?? [];
      if (items.length > 0) {
        const ts = Date.now();
        const novas = await uploadMedia(
          items.map(m => m.file),
          (i, ext) => `os_evidencias/${taskId}/tarefas/${tarefa.id}_${ts}_${i}.${ext}`,
          (done, total) => setProgresso(`${done}/${total}`),
        );
        midiaURLs = [...midiaURLs, ...novas];
      }
      await onSalvar({ ...tarefa, status: novoStatus, fotos: midiaURLs, observacao: observacao.trim() });
    } catch {
      setErro('Erro ao salvar. Tente novamente.');
      setUploading(false);
    }
  };

  const fotasSalvas = tarefa.fotos ?? [];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 safe-area-top">
        <button onClick={onCancelar} disabled={uploading} className="p-2 -ml-2 rounded-full active:bg-gray-800">
          <ArrowLeft size={20} className="text-gray-400" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Executar Tarefa</p>
          <h2 className="text-sm font-bold text-white leading-snug line-clamp-2">{tarefa.descricao}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* Mídias já salvas */}
        {fotasSalvas.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Evidências salvas</p>
            <div className="grid grid-cols-3 gap-2">
              {fotasSalvas.map((url, i) => (
                <div key={`s${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-gray-800 border border-emerald-600/30">
                  {isVideoUrl(url)
                    ? <video src={url} className="w-full h-full object-cover" muted playsInline />
                    : <img src={url} alt="" className="w-full h-full object-cover" />
                  }
                  {isVideoUrl(url) && (
                    <div className="absolute top-1 left-1 bg-black/60 rounded-full p-0.5">
                      <Video size={10} className="text-white" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-emerald-700/80 text-center py-0.5">
                    <span className="text-[9px] text-white font-bold">SALVA</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Novas mídias */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
            {fotasSalvas.length > 0 ? 'Adicionar mais' : 'Evidências'} <span className="text-red-400">*</span>
          </p>

          {items.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {items.map((m, i) => (
                <div key={`n${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-gray-800 border border-gray-700">
                  {m.isVideo
                    ? <video src={m.preview} className="w-full h-full object-cover" muted playsInline />
                    : <img src={m.preview} alt="" className="w-full h-full object-cover" />
                  }
                  {m.isVideo && (
                    <div className="absolute top-1 left-1 bg-black/60 rounded-full p-0.5">
                      <Video size={10} className="text-white" />
                    </div>
                  )}
                  {!uploading && (
                    <button onClick={() => remover(i)} className="absolute top-1 right-1 bg-black/60 rounded-full p-1">
                      <X size={12} className="text-white" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => cameraRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-700 bg-gray-800/50 active:bg-gray-800 disabled:opacity-50"
            >
              <Camera size={18} className="text-emerald-400" />
              <span className="text-xs text-gray-400">Câmera</span>
            </button>
            <button
              onClick={() => galeriaRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-700 bg-gray-800/50 active:bg-gray-800 disabled:opacity-50"
            >
              <Image size={18} className="text-blue-400" />
              <span className="text-xs text-gray-400">Galeria / Vídeo</span>
            </button>
          </div>

          <input ref={cameraRef}  type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={galeriaRef} type="file" accept="image/*,video/*" multiple className="hidden"
            onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
        </div>

        {/* Observação */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">
            Observação / Conclusão <span className="text-red-400">*</span>
          </label>
          <textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            placeholder="Descreva o que foi feito, resultado ou motivo de não execução..."
            rows={4}
            disabled={uploading}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>

        {erro && <p className="text-sm text-red-400">{erro}</p>}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 bg-gray-900 border-t border-gray-800 space-y-2.5 safe-area-bottom">
        {uploading && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin" /> Enviando {progresso}...
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => salvar('nao_executada')}
            disabled={uploading}
            className="flex items-center justify-center gap-1.5 py-3.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-2xl font-bold text-sm disabled:opacity-50 active:bg-orange-500/20"
          >
            <XCircle size={16} /> Não Executada
          </button>
          <button
            onClick={() => salvar('concluida')}
            disabled={uploading}
            className="flex items-center justify-center gap-1.5 py-3.5 bg-emerald-600 text-white rounded-2xl font-bold text-sm disabled:opacity-50 active:bg-emerald-700"
          >
            <CheckCircle2 size={16} /> Concluída
          </button>
        </div>
      </div>
    </div>
  );
}
