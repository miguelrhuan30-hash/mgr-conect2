// ═══════════════════════════════════════════════════════════════════════════
// MGR ACADEMY — Pré-visualização do módulo (como o colaborador verá)
// Modo TESTE: não grava progresso, não consome tentativa, não bloqueia.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { X, FileText, Video, Image as ImageIcon, ClipboardList, Eye, ChevronRight } from 'lucide-react';
import { AcademyModule, AcademyQuestion } from '../../types';
import { toEmbedUrl } from './academyHelpers';

interface Props {
  module: AcademyModule;
  questions: AcademyQuestion[];
  onClose: () => void;
}

type Step = 'pdf' | 'video' | 'infografico' | 'prova';

const ModulePreview: React.FC<Props> = ({ module, questions, onClose }) => {
  const steps: { key: Step; label: string; icon: React.ElementType; available: boolean }[] = [
    { key: 'pdf',         label: 'Conteúdo (PDF)', icon: FileText,      available: !!module.pdfUrl },
    { key: 'video',       label: 'Vídeo',          icon: Video,         available: !!module.videoUrl },
    { key: 'infografico', label: 'Infográfico',    icon: ImageIcon,     available: !!module.infographicUrl },
    { key: 'prova',       label: 'Prova',          icon: ClipboardList, available: module.exam.enabled && questions.length > 0 },
  ];
  const firstAvailable = steps.find(s => s.available)?.key ?? 'pdf';
  const [step, setStep] = useState<Step>(firstAvailable);

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-3 bg-gray-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Eye size={18} className="text-amber-300 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{module.title || 'Módulo sem título'}</p>
              <p className="text-[11px] text-amber-300 font-semibold">MODO PRÉ-VISUALIZAÇÃO — nada é gravado</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg"><X size={20} /></button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar de etapas */}
          <aside className="w-48 bg-gray-50 border-r border-gray-200 p-3 space-y-1 flex-shrink-0 overflow-y-auto">
            {steps.map(s => (
              <button
                key={s.key}
                onClick={() => s.available && setStep(s.key)}
                disabled={!s.available}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors
                  ${step === s.key ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'}
                  ${!s.available ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <s.icon size={16} className="flex-shrink-0" />
                <span className="flex-1 truncate">{s.label}</span>
                {step === s.key && <ChevronRight size={14} />}
              </button>
            ))}
          </aside>

          {/* Conteúdo */}
          <main className="flex-1 overflow-y-auto p-4 bg-gray-100">
            {step === 'pdf' && (
              module.pdfUrl
                ? <iframe title="PDF" src={module.pdfUrl} className="w-full h-full min-h-[500px] rounded-lg border border-gray-200 bg-white" />
                : <EmptyState label="Nenhum PDF enviado ainda." />
            )}

            {step === 'video' && (
              module.videoUrl
                ? (module.videoSource === 'upload'
                    ? <video src={module.videoUrl} controls className="w-full rounded-lg bg-black" />
                    : <div className="aspect-video w-full">
                        <iframe title="Vídeo" src={toEmbedUrl(module.videoUrl)} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full rounded-lg border border-gray-200 bg-black" />
                      </div>)
                : <EmptyState label="Nenhum vídeo enviado ainda." />
            )}

            {step === 'infografico' && (
              module.infographicUrl
                ? <img src={module.infographicUrl} alt="Infográfico" className="w-full rounded-lg border border-gray-200 bg-white" />
                : <EmptyState label="Nenhum infográfico enviado ainda." />
            )}

            {step === 'prova' && (
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-bold text-gray-900 mb-2">Regras da Prova</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{module.exam.rulesText}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>⏱️ {module.exam.durationMinutes} min</span>
                    <span>❓ {module.exam.questionsPerExam} de {questions.length} questões (sorteadas)</span>
                    <span>✅ Corte: {module.passingScore}%</span>
                  </div>
                </div>
                {questions.length === 0
                  ? <EmptyState label="Nenhuma questão cadastrada ainda." />
                  : <div className="space-y-3">
                      <p className="text-xs text-gray-500 font-medium">Amostra do banco (na prova real são sorteadas {module.exam.questionsPerExam}):</p>
                      {questions.map((q, i) => (
                        <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4">
                          <p className="font-semibold text-sm text-gray-900 mb-2">{i + 1}. {q.text}</p>
                          <div className="space-y-1.5">
                            {q.options.map((opt, oi) => (
                              <div key={oi} className={`text-sm px-3 py-2 rounded-lg border ${oi === q.correctIndex ? 'border-green-300 bg-green-50 text-green-800 font-medium' : 'border-gray-200 text-gray-600'}`}>
                                {String.fromCharCode(65 + oi)}) {opt}
                                {oi === q.correctIndex && <span className="ml-2 text-[10px] font-bold">✓ correta (oculta para o aluno)</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="h-full min-h-[300px] flex items-center justify-center">
    <p className="text-sm text-gray-400">{label}</p>
  </div>
);

export default ModulePreview;
