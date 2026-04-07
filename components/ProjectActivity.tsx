/**
 * components/ProjectActivity.tsx — Sprint 12
 *
 * Feed de atividades + comentários do projeto.
 * - Timeline cronológica (mais recente primeiro)
 * - Caixa de comentário com suporte a nota interna
 * - Upload de arquivo avulso
 * - Emojis de tipo: 💬 Comentário, 🔄 Fase, 📎 Arquivo, 🔒 Nota Interna
 * - Delete de comentário próprio (ou admin)
 */
import React, { useState, useRef } from 'react';
import {
  MessageSquare, Lock, Paperclip, RefreshCw, Send,
  Trash2, Loader2, Upload, ArrowRight, Check,
} from 'lucide-react';
import { useProjectActivity, AtividadeTipo, ProjectAtividade } from '../hooks/useProjectActivity';
import { useAuth } from '../contexts/AuthContext';
import { PROJECT_PHASE_LABELS } from '../types';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  projectId: string;
}

// ── Helpers ──
const toDate = (ts: any): Date | null => {
  if (!ts) return null;
  try { return ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000); } catch { return null; }
};

const fmtRelative = (ts: any) => {
  const d = toDate(ts);
  if (!d) return '—';
  try { return formatDistanceToNow(d, { addSuffix: true, locale: ptBR }); } catch { return '—'; }
};

const fmtFull = (ts: any) => {
  const d = toDate(ts);
  if (!d) return '—';
  return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
};

// ── Ícone + cor por tipo ──
const TIPO_CONFIG: Record<AtividadeTipo, { emoji: string; color: string; label: string }> = {
  comentario:    { emoji: '💬', color: 'bg-blue-100 text-blue-700',    label: 'Comentário' },
  fase_avancada: { emoji: '🔄', color: 'bg-emerald-100 text-emerald-700', label: 'Fase' },
  arquivo_anexo: { emoji: '📎', color: 'bg-purple-100 text-purple-700', label: 'Arquivo' },
  nota_interna:  { emoji: '🔒', color: 'bg-amber-100 text-amber-700',  label: 'Nota interna' },
};

// ── Card de item do feed ──
const FeedItem: React.FC<{
  atividade: ProjectAtividade;
  currentUid?: string;
  isAdmin?: boolean;
  onDelete: (id: string) => void;
}> = ({ atividade, currentUid, isAdmin, onDelete }) => {
  const cfg = TIPO_CONFIG[atividade.tipo];
  const canDelete = atividade.criadoPorUid === currentUid || isAdmin;
  const data = toDate(atividade.criadoEm);

  return (
    <div className={`flex gap-3 group ${atividade.tipo === 'fase_avancada' ? 'opacity-80' : ''}`}>
      {/* Avatar / Emoji */}
      <div className="flex-shrink-0 flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${cfg.color}`}>
          {atividade.criadoPorFoto
            ? <img src={atividade.criadoPorFoto} alt="" className="w-8 h-8 rounded-full object-cover" />
            : cfg.emoji
          }
        </div>
        {/* Linha vertical conectora */}
        <div className="w-px flex-1 bg-gray-100 mt-2" />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 pb-5 min-w-0">
        {/* Cabeçalho */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-extrabold text-gray-900 truncate">
            {atividade.criadoPorNome}
          </span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cfg.color}`}>
            {cfg.label}
          </span>
          <span className="text-[10px] text-gray-400 ml-auto whitespace-nowrap" title={data ? fmtFull(atividade.criadoEm) : ''}>
            {fmtRelative(atividade.criadoEm)}
          </span>
          {canDelete && atividade.tipo !== 'fase_avancada' && (
            <button onClick={() => onDelete(atividade.id)}
              className="opacity-0 group-hover:opacity-100 ml-1 p-1 rounded hover:bg-red-50 text-red-400 transition-all">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Corpo */}
        {atividade.tipo === 'fase_avancada' ? (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="font-medium">{(PROJECT_PHASE_LABELS as Record<string, string>)[atividade.faseAnterior || ''] || atividade.faseAnterior}</span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />
            <span className="font-extrabold text-emerald-700">{(PROJECT_PHASE_LABELS as Record<string, string>)[atividade.faseNova || ''] || atividade.faseNova}</span>
          </div>
        ) : atividade.tipo === 'arquivo_anexo' ? (
          <div className="space-y-1">
            {atividade.texto !== atividade.arquivoNome && (
              <p className="text-sm text-gray-700">{atividade.texto}</p>
            )}
            <a href={atividade.arquivoUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-brand-600 hover:bg-brand-50 hover:border-brand-200 transition-colors">
              <Paperclip className="w-3 h-3" />
              {atividade.arquivoNome || 'Ver arquivo'}
            </a>
          </div>
        ) : (
          <p className={`text-sm leading-relaxed ${
            atividade.tipo === 'nota_interna' ? 'text-amber-800 font-medium' : 'text-gray-700'
          }`}>
            {atividade.texto}
          </p>
        )}
      </div>
    </div>
  );
};

// ── Componente principal ──
const ProjectActivity: React.FC<Props> = ({ projectId }) => {
  const { currentUser, userProfile } = useAuth();
  const { atividades, loading, posting, addComentario, deleteComentario, addArquivo } = useProjectActivity(projectId);
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<'comentario' | 'nota_interna'>('comentario');
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'developer';

  const handleSubmit = async () => {
    if (!texto.trim() || posting) return;
    await addComentario(texto, tipo);
    setTexto('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await addArquivo(file);
    e.target.value = '';
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remover este item do feed?')) return;
    await deleteComentario(id);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand-600" />
          Atividades & Comentários
        </h3>
        <span className="text-xs text-gray-400 font-medium">{atividades.length} entrada{atividades.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Caixa de entrada */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Tipo selector */}
        <div className="flex border-b border-gray-100">
          {([
            { key: 'comentario',   label: '💬 Comentário' },
            { key: 'nota_interna', label: '🔒 Nota Interna' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTipo(t.key)}
              className={`px-4 py-2.5 text-xs font-bold transition-colors ${
                tipo === t.key
                  ? 'bg-brand-50 text-brand-700 border-b-2 border-brand-500'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={handleKey}
          rows={3}
          placeholder={
            tipo === 'comentario'
              ? 'Adicione um comentário... (Ctrl+Enter para enviar)'
              : 'Nota interna — visível apenas para a equipe...'
          }
          className={`w-full px-4 py-3 text-sm resize-none outline-none ${
            tipo === 'nota_interna' ? 'bg-amber-50/40 text-amber-900 placeholder:text-amber-400' : 'bg-white'
          }`}
        />

        {/* Footer da caixa */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={posting}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
            >
              <Upload className="w-3 h-3" /> Arquivo
            </button>
            <span className="text-[10px] text-gray-400">Ctrl+Enter para enviar</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!texto.trim() || posting}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              saved
                ? 'bg-emerald-500 text-white'
                : 'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40'
            }`}
          >
            {posting ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Check className="w-3 h-3" /> : <Send className="w-3 h-3" />}
            {saved ? 'Enviado!' : 'Enviar'}
          </button>
        </div>
      </div>

      {/* Input de arquivo oculto */}
      <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />

      {/* Feed */}
      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="w-5 h-5 animate-spin text-brand-600" />
        </div>
      ) : atividades.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-medium">Nenhuma atividade ainda.</p>
          <p className="text-xs mt-1">Adicione um comentário ou avance a fase para começar o histórico.</p>
        </div>
      ) : (
        <div className="space-y-0">
          {atividades.map(a => (
            <FeedItem
              key={a.id}
              atividade={a}
              currentUid={currentUser?.uid}
              isAdmin={isAdmin}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectActivity;
