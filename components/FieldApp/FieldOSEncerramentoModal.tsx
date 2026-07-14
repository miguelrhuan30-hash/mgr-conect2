import React, { useState, useRef } from 'react';
import { Camera, Image, X, Check, Loader2, ChevronRight, AlertTriangle, MessageSquare, Video } from 'lucide-react';
import { uploadMedia, isVideoFile, isVideoUrl } from './photoUtils';

type Step = 'fotos' | 'pendencia' | 'recomendacao' | 'confirmacao';

export interface RelatorioFinal {
  fotosFinais: string[];
  pendencia: string | null;
  recomendacao: string | null;
}

interface MediaItem {
  file: File;
  preview: string;
  isVideo: boolean;
}

interface Props {
  taskId: string;
  titulo: string;
  uid: string;
  onConfirmar: (relatorio: RelatorioFinal) => Promise<void>;
  onCancelar: () => void;
}

const STEPS: Step[]      = ['fotos', 'pendencia', 'recomendacao', 'confirmacao'];
const STEP_LABELS        = ['Mídias finais', 'Pendências', 'Recomendações', 'Confirmar'];

export default function FieldOSEncerramentoModal({ taskId, titulo, uid, onConfirmar, onCancelar }: Props) {
  const [step, setStep]         = useState<Step>('fotos');
  const [items, setItems]       = useState<MediaItem[]>([]);
  const [tevePendencia, setTevePendencia]       = useState<boolean | null>(null);
  const [textoPendencia, setTextoPendencia]     = useState('');
  const [teveRecomendacao, setTeveRecomendacao] = useState<boolean | null>(null);
  const [textoRecomendacao, setTextoRecomendacao] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progresso, setProgresso] = useState('');
  const [erro, setErro]           = useState('');
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

  const avancar = () => {
    setErro('');
    if (step === 'fotos') {
      if (items.length === 0) { setErro('Adicione pelo menos 1 foto ou vídeo de finalização.'); return; }
      setStep('pendencia');
    } else if (step === 'pendencia') {
      if (tevePendencia === null) { setErro('Selecione uma opção.'); return; }
      if (tevePendencia && !textoPendencia.trim()) { setErro('Descreva a pendência.'); return; }
      setStep('recomendacao');
    } else if (step === 'recomendacao') {
      if (teveRecomendacao === null) { setErro('Selecione uma opção.'); return; }
      if (teveRecomendacao && !textoRecomendacao.trim()) { setErro('Descreva a recomendação.'); return; }
      setStep('confirmacao');
    }
  };

  const voltar = () => {
    setErro('');
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const confirmar = async () => {
    setUploading(true); setErro('');
    try {
      const ts = Date.now();
      const fotosFinais = await uploadMedia(
        items.map(m => m.file),
        (i, ext) => `os_evidencias/${taskId}/fim/${uid}_${ts}_${i}.${ext}`,
        (done, total) => setProgresso(`${done}/${total}`),
      );
      await onConfirmar({
        fotosFinais,
        pendencia:    tevePendencia    ? textoPendencia.trim()    : null,
        recomendacao: teveRecomendacao ? textoRecomendacao.trim() : null,
      });
    } catch {
      setErro('Erro ao enviar. Tente novamente.');
      setUploading(false);
    }
  };

  const stepIdx = STEPS.indexOf(step);

  const MediaGrid = () => (
    <>
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-3">
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
              <button onClick={() => remover(i)} className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-1">
                <X size={14} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => cameraRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 py-5 rounded-xl border-2 border-dashed border-gray-700 bg-gray-800/50 active:bg-gray-800"
        >
          <Camera size={22} className="text-emerald-400" />
          <span className="text-xs text-gray-400">Câmera</span>
        </button>
        <button
          onClick={() => galeriaRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 py-5 rounded-xl border-2 border-dashed border-gray-700 bg-gray-800/50 active:bg-gray-800"
        >
          <Image size={22} className="text-blue-400" />
          <span className="text-xs text-gray-400">Galeria / Vídeo</span>
        </button>
      </div>
      <input ref={cameraRef}  type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
      <input ref={galeriaRef} type="file" accept="image/*,video/*" multiple className="hidden"
        onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
    </>
  );

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gray-950">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-900 border-b border-gray-800 safe-area-top">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onCancelar} disabled={uploading} className="p-2 -ml-2 rounded-full active:bg-gray-800">
            <X size={20} className="text-gray-400" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">Encerramento da O.S.</p>
            <h2 className="text-sm font-bold text-white truncate">{titulo}</h2>
          </div>
        </div>
        {/* Barra de progresso por etapas */}
        <div className="flex items-center gap-1">
          {STEP_LABELS.map((label, i) => (
            <React.Fragment key={i}>
              <div className="flex items-center gap-1">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                  i < stepIdx  ? 'bg-blue-600 border-blue-600 text-white' :
                  i === stepIdx ? 'border-blue-400 text-blue-400' :
                                  'border-gray-700 text-gray-600'
                }`}>{i + 1}</div>
                <span className={`text-[9px] font-medium hidden xs:block ${i <= stepIdx ? 'text-blue-400' : 'text-gray-600'}`}>{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`flex-1 h-px ${i < stepIdx ? 'bg-blue-600' : 'bg-gray-700'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Conteúdo por etapa */}
      <div className="flex-1 overflow-y-auto px-4 py-4">

        {/* Etapa 1 — Mídias finais */}
        {step === 'fotos' && (
          <div className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
              <p className="text-sm text-emerald-300 leading-relaxed">
                Registre o estado <strong>final</strong> do local e/ou equipamento após a execução. Foto ou vídeo.
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Mídias de finalização <span className="text-red-400">*</span>
              </p>
              <MediaGrid />
            </div>
          </div>
        )}

        {/* Etapa 2 — Pendência */}
        {step === 'pendencia' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle size={22} className="text-orange-400 flex-shrink-0" />
              <h3 className="text-base font-bold text-white">Houve alguma pendência?</h3>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Algo que não foi resolvido ou que necessita de atenção futura?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTevePendencia(false)}
                className={`py-4 rounded-2xl border font-bold text-sm transition-all ${
                  tevePendencia === false
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300 active:bg-gray-700'
                }`}
              >Não</button>
              <button
                onClick={() => setTevePendencia(true)}
                className={`py-4 rounded-2xl border font-bold text-sm transition-all ${
                  tevePendencia === true
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300 active:bg-gray-700'
                }`}
              >Sim</button>
            </div>
            {tevePendencia === true && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">
                  Descreva a pendência <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={textoPendencia}
                  onChange={e => setTextoPendencia(e.target.value)}
                  placeholder="O que ficou pendente? Qual é o próximo passo necessário?"
                  rows={4}
                  spellCheck autoCorrect="on" autoCapitalize="sentences"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-orange-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Etapa 3 — Recomendação */}
        {step === 'recomendacao' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <MessageSquare size={22} className="text-blue-400 flex-shrink-0" />
              <h3 className="text-base font-bold text-white">Deixar recomendação?</h3>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Existe algum cuidado futuro ou necessidade que o proprietário deve saber?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTeveRecomendacao(false)}
                className={`py-4 rounded-2xl border font-bold text-sm transition-all ${
                  teveRecomendacao === false
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300 active:bg-gray-700'
                }`}
              >Não</button>
              <button
                onClick={() => setTeveRecomendacao(true)}
                className={`py-4 rounded-2xl border font-bold text-sm transition-all ${
                  teveRecomendacao === true
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300 active:bg-gray-700'
                }`}
              >Sim</button>
            </div>
            {teveRecomendacao === true && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">
                  Recomendação ao proprietário <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={textoRecomendacao}
                  onChange={e => setTextoRecomendacao(e.target.value)}
                  placeholder="Descreva os cuidados necessários ou o que deve ser observado futuramente..."
                  rows={4}
                  spellCheck autoCorrect="on" autoCapitalize="sentences"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Etapa 4 — Confirmação */}
        {step === 'confirmacao' && (
          <div className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
              <p className="text-sm text-emerald-300 leading-relaxed">
                Revise o resumo e confirme. A O.S. será encerrada e o relatório ficará disponível no painel web.
              </p>
            </div>
            <div className="space-y-2.5">
              <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">Mídias de finalização</p>
                <p className="text-sm font-bold text-white">
                  {items.filter(m => !m.isVideo).length} foto{items.filter(m => !m.isVideo).length !== 1 ? 's' : ''}
                  {items.filter(m => m.isVideo).length > 0 && ` + ${items.filter(m => m.isVideo).length} vídeo${items.filter(m => m.isVideo).length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <div className={`border rounded-xl px-4 py-3 ${tevePendencia ? 'bg-orange-500/10 border-orange-500/20' : 'bg-gray-800/60 border-gray-700/60'}`}>
                <p className="text-xs text-gray-500 mb-1">Pendência</p>
                <p className={`text-sm font-bold ${tevePendencia ? 'text-orange-300' : 'text-white'}`}>{tevePendencia ? 'Sim' : 'Não'}</p>
                {tevePendencia && <p className="text-xs text-gray-400 mt-1 leading-snug">{textoPendencia}</p>}
              </div>
              <div className={`border rounded-xl px-4 py-3 ${teveRecomendacao ? 'bg-blue-500/10 border-blue-500/20' : 'bg-gray-800/60 border-gray-700/60'}`}>
                <p className="text-xs text-gray-500 mb-1">Recomendação ao proprietário</p>
                <p className={`text-sm font-bold ${teveRecomendacao ? 'text-blue-300' : 'text-white'}`}>{teveRecomendacao ? 'Sim' : 'Não'}</p>
                {teveRecomendacao && <p className="text-xs text-gray-400 mt-1 leading-snug">{textoRecomendacao}</p>}
              </div>
            </div>
          </div>
        )}

        {erro && <p className="mt-4 text-sm text-red-400">{erro}</p>}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 bg-gray-900 border-t border-gray-800 space-y-2.5 safe-area-bottom">
        {uploading && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin" /> Enviando {progresso}...
          </div>
        )}
        <div className={`grid gap-2.5 ${step !== 'fotos' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {step !== 'fotos' && (
            <button
              onClick={voltar}
              disabled={uploading}
              className="py-4 bg-gray-800 text-gray-300 rounded-2xl font-bold text-sm disabled:opacity-50 active:bg-gray-700"
            >
              Voltar
            </button>
          )}
          {step !== 'confirmacao' ? (
            <button
              onClick={avancar}
              disabled={uploading}
              className="flex items-center justify-center gap-2 py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm disabled:opacity-50 active:bg-blue-700"
            >
              Próximo <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={confirmar}
              disabled={uploading}
              className="flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-sm disabled:opacity-50 active:bg-emerald-700"
            >
              {uploading
                ? <><Loader2 size={16} className="animate-spin" /> Finalizando...</>
                : <><Check size={16} /> Encerrar O.S.</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
