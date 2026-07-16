/**
 * FieldGestaoOSDetail — painel de gerenciamento admin de uma O.S.
 * Full-screen modal: visualiza todos os dados + editar / reagendar / reatribuir / mudar status / excluir.
 */
import React, { useState, useEffect } from 'react';
import {
  doc, updateDoc, deleteDoc, collection, getDocs, addDoc, Timestamp,
} from 'firebase/firestore';
import { CollectionName, WorkflowStatus, REAGENDAMENTO_MOTIVOS } from '../../types';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { OSField } from './FieldOS';
import FieldOSEditModal from './FieldOSEditModal';
import { registrarAtividade } from '../../services/activityFeedService';
import { gerarNumeroOS } from '../../services/osService';
import { isVideoUrl } from './photoUtils';
import CalendarioPicker from './CalendarioPicker';
import {
  X, ChevronLeft, User, CalendarDays, AlertCircle, CheckCircle2, Wrench, Clock,
  MapPin, ClipboardList, Trash2, Pencil, Calendar, UserCog, RefreshCw,
  CheckSquare, Square, Loader2, AlertTriangle, ChevronRight, Tag,
  Camera, FileText, MessageCircle, XCircle,
} from 'lucide-react';

interface Props {
  os: OSField;
  onClose: () => void;
  onUpdate: (updated: OSField) => void;
  onDelete: () => void;
}

/** Lista compacta de observações vinculadas a UMA evidência específica. */
function ObsDaEvidencia({ observacoes }: { observacoes: { id: string; texto: string; autorNome: string }[] }) {
  if (observacoes.length === 0) return null;
  return (
    <div className="space-y-1.5 mt-2">
      {observacoes.map(obs => (
        <div key={obs.id} className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2.5 py-1.5">
          <p className="text-[11px] text-indigo-200">{obs.texto}</p>
          <p className="text-[9px] text-indigo-400/70 mt-0.5">{obs.autorNome}</p>
        </div>
      ))}
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: 'open',        label: 'Aberta',       color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',          icon: <Clock size={11} /> },
  { value: 'pending',     label: 'Pendente',      color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',    icon: <AlertCircle size={11} /> },
  { value: 'in-progress', label: 'Em andamento',  color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',   icon: <Wrench size={11} /> },
  { value: 'completed',   label: 'Concluída',     color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <CheckCircle2 size={11} /> },
];

const PRIORITY_OPTIONS = [
  { value: 'baixa',  label: 'Baixa',    color: 'border-emerald-500 bg-emerald-500/10 text-emerald-400' },
  { value: 'media',  label: 'Média',    color: 'border-yellow-500 bg-yellow-500/10 text-yellow-400'   },
  { value: 'alta',   label: 'Alta',     color: 'border-red-500 bg-red-500/10 text-red-400'            },
  { value: 'critica', label: 'Crítica', color: 'border-red-700 bg-red-700/20 text-red-300'            },
];

const tsToLocal = (ts: Timestamp | undefined): string => {
  if (!ts) return '';
  const d = ts.toDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const localToTs = (v: string): Timestamp | null => {
  if (!v) return null;
  return Timestamp.fromDate(new Date(v));
};

const diasEmAberto = (os: OSField): number => {
  const criado = (os as any).criadoEm?.toDate?.() ?? (os as any).createdAt?.toDate?.();
  if (!criado) return 0;
  return Math.floor((Date.now() - criado.getTime()) / 86400000);
};

type Painel = 'none' | 'status' | 'reagendar' | 'reagendar_motivo' | 'reatribuir' | 'excluir';

export default function FieldGestaoOSDetail({ os, onClose, onUpdate, onDelete }: Props) {
  const { currentUser, userProfile } = useAuth();
  const [painel, setPainel]     = useState<Painel>('none');
  const [saving, setSaving]     = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // ── Reagendar ──
  const [novaStart, setNovaStart] = useState(tsToLocal(os.startDate));
  const [novaEnd, setNovaEnd]     = useState(tsToLocal((os as any).endDate));

  // ── Reatribuir ──
  const [users, setUsers]         = useState<{ uid: string; nome: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [novoResp, setNovoResp]   = useState<{ uid: string; nome: string } | null>(null);

  // ── Status ──
  const [novoStatus, setNovoStatus] = useState(os.status ?? 'pending');

  // ── Reagendar com motivo (cria nova O.S., encerra a atual como REAGENDAR) ──
  const [motivoReagendamento, setMotivoReagendamento] = useState('');
  const [motivoOutro, setMotivoOutro]                 = useState('');
  const [dataReagendamento, setDataReagendamento]     = useState('');
  const [reagendando, setReagendando]                 = useState(false);

  useEffect(() => {
    if (painel !== 'reatribuir' || users.length > 0) return;
    setLoadingUsers(true);
    getDocs(collection(db, CollectionName.USERS)).then(snap => {
      const list = snap.docs.map(d => {
        const data = d.data() as any;
        return { uid: d.id, nome: data.nomeCompleto || data.displayName || data.email || d.id };
      });
      list.sort((a, b) => a.nome.localeCompare(b.nome));
      setUsers(list);
      setLoadingUsers(false);
    }).catch(() => setLoadingUsers(false));
  }, [painel]);

  const save = async (updates: Record<string, any>, label: string) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'tasks', os.id), {
        ...updates,
        atualizadoPor: currentUser?.uid,
        atualizadoEm: Timestamp.now(),
      });

      const autorNome = (userProfile as any)?.nomeCompleto || (userProfile as any)?.displayName || 'Gestor';
      const osBase = {
        autorId: currentUser?.uid ?? '',
        autorNome,
        osId: os.id, osNumero: os.numeroOS, osTitulo: os.title,
        clienteNome: os.clientName, meta: { ambiente: 'app_gestor' },
      };
      if ('status' in updates) {
        registrarAtividade({ ...osBase, tipo: 'os_status_mudou',
          titulo: `Status alterado → ${updates.status}`, descricao: os.title });
      } else if ('assignedTo' in updates) {
        registrarAtividade({ ...osBase, tipo: 'os_atribuida',
          titulo: updates.assignedTo ? `O.S. atribuída a ${updates.assigneeName}` : 'O.S. sem responsável',
          descricao: os.title });
      } else if ('startDate' in updates || 'endDate' in updates) {
        registrarAtividade({ ...osBase, tipo: 'os_reagendada',
          titulo: `O.S. reagendada`, descricao: os.title });
      } else {
        registrarAtividade({ ...osBase, tipo: 'os_editada',
          titulo: `O.S. editada: ${os.title}` });
      }

      onUpdate({ ...os, ...updates } as OSField);
      setPainel('none');
    } catch (e) {
      console.error(`[FieldGestaoOSDetail] ${label}:`, e);
      alert(`Erro ao ${label}. Tente novamente.`);
    } finally {
      setSaving(false);
    }
  };

  const handleExcluir = async () => {
    setSaving(true);
    try {
      registrarAtividade({
        tipo: 'os_excluida',
        autorId: currentUser?.uid ?? '',
        autorNome: (userProfile as any)?.nomeCompleto || (userProfile as any)?.displayName || 'Gestor',
        titulo: `O.S. excluída: ${os.title}`,
        osId: os.id, osNumero: os.numeroOS, osTitulo: os.title,
        clienteNome: os.clientName, meta: { ambiente: 'app_gestor' },
      });
      await deleteDoc(doc(db, 'tasks', os.id));
      onDelete();
    } catch (e) {
      console.error('[FieldGestaoOSDetail] excluir:', e);
      alert('Erro ao excluir. Tente novamente.');
      setSaving(false);
    }
  };

  /* ─── Reagendar com motivo ──────────────────────────
   * Para O.S. não concluídas: cria uma NOVA O.S. carregando as tarefas
   * ainda pendentes/não executadas, e encerra a atual como REAGENDAR
   * (mesma lógica usada no web em OSEditModal.handleReagendar). */
  const handleReagendarComMotivo = async () => {
    if (!currentUser) return;
    const motivo = motivoReagendamento === 'Outro' ? motivoOutro : motivoReagendamento;
    if (!motivo.trim()) { alert('Selecione ou descreva o motivo do reagendamento.'); return; }
    setReagendando(true);
    try {
      const tarefasPendentes = (os.tarefasOS ?? [])
        .filter((t: any) => t.status !== 'concluida')
        .map((t: any) => ({
          ...t,
          id: `tarefa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          status: 'pendente',
          fotosApp: [],
          observacaoApp: '',
        }));

      const numeroOS = await gerarNumeroOS();
      const novaOS: Record<string, any> = {
        numeroOS,
        title: `${numeroOS} — [Reag.] ${os.title ?? ''}`,
        description: os.description || '',
        status: 'pending',
        priority: (os as any).priority || 'medium',
        clientId: (os as any).clientId || '',
        clientName: os.clientName || '',
        assignedTo: os.assignedTo || '',
        assigneeName: os.assigneeName || '',
        projectId: (os as any).projectId || '',
        projectName: (os as any).projectName || '',
        tipoServico: os.tipoServico || '',
        ...(dataReagendamento ? { startDate: Timestamp.fromDate(new Date(`${dataReagendamento}T09:00:00`)) } : {}),
        tarefasOS: tarefasPendentes.length > 0 ? tarefasPendentes : undefined,
        reagendamentoDe: os.id,
        reagendamentoMotivo: motivo,
        workflowStatus: WorkflowStatus.AGUARDANDO_APROVACAO,
        createdAt: Timestamp.now(),
      };
      const novaRef = await addDoc(collection(db, CollectionName.TASKS), novaOS);

      await updateDoc(doc(db, 'tasks', os.id), {
        status: 'completed',
        statusOS: 'REAGENDAR',
        workflowStatus: WorkflowStatus.CONCLUIDO, // encerra a O.S. antiga no Kanban/Flow — substituída pela nova
        reagendamentoMotivo: motivo,
        reagendamentoPara: novaRef.id,
        atualizadoEm: Timestamp.now(),
      });

      const autorNome = (userProfile as any)?.nomeCompleto || (userProfile as any)?.displayName || 'Gestor';
      registrarAtividade({
        tipo: 'os_reagendada',
        autorId: currentUser.uid,
        autorNome,
        titulo: dataReagendamento
          ? `O.S. reagendada para ${new Date(`${dataReagendamento}T12:00:00`).toLocaleDateString('pt-BR')}`
          : 'O.S. reagendada (sem data definida)',
        descricao: motivo,
        osId: os.id, osNumero: os.numeroOS, osTitulo: os.title,
        clienteNome: os.clientName,
        meta: { ambiente: 'app_gestor', novaOsId: novaRef.id, motivo },
      });

      onUpdate({ ...os, status: 'completed' } as OSField);
      setPainel('none');
    } catch (e) {
      console.error('[FieldGestaoOSDetail] reagendar com motivo:', e);
      alert('Erro ao reagendar. Tente novamente.');
    } finally {
      setReagendando(false);
    }
  };

  const statusCfg = STATUS_OPTIONS.find(s => s.value === os.status) ?? STATUS_OPTIONS[0];
  const dias      = diasEmAberto(os);

  // Observações do feed vinculadas a uma evidência específica (fotoUrl) —
  // cada seção de evidência mostra só as observações daquela foto/vídeo;
  // o que sobra (sem fotoUrl) vai para "Observações gerais".
  const observacoesTodas = ((os as any).observacoes ?? []) as { id: string; texto: string; autorNome: string; fotoUrl?: string }[];
  const obsPara = (urls: string[]) => observacoesTodas.filter(o => o.fotoUrl && urls.includes(o.fotoUrl));
  const observacoesGerais = observacoesTodas.filter(o => !o.fotoUrl);

  const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) =>
    value ? (
      <div className="flex items-start gap-3 py-2.5 border-b border-gray-800/60">
        <span className="text-gray-600 mt-0.5 flex-shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-[9px] text-gray-600 uppercase font-bold tracking-wide">{label}</p>
          <p className="text-sm text-gray-200 mt-0.5">{value}</p>
        </div>
      </div>
    ) : null;

  return (
    <>
    {showEditModal && (
      <FieldOSEditModal
        os={os}
        onClose={() => setShowEditModal(false)}
        onSaved={updates => {
          onUpdate({ ...os, ...updates } as OSField);
          setShowEditModal(false);
        }}
      />
    )}
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <button onClick={onClose} className="p-1.5 rounded-lg bg-gray-800 active:bg-gray-700">
          <ChevronLeft size={18} className="text-gray-300" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-orange-400 font-bold uppercase tracking-wide">Gestão de O.S.</p>
          {os.numeroOS && <p className="text-xs text-gray-500">{os.numeroOS}</p>}
        </div>
        {dias > 0 && (
          <span className={`text-[10px] font-black px-2 py-1 rounded-full border ${
            dias > 14 ? 'bg-red-500/20 text-red-400 border-red-500/30'
            : dias > 7  ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
            :              'bg-gray-800 text-gray-500 border-gray-700'
          }`}>
            {dias}d em aberto
          </span>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Hero */}
        <div className="px-4 pt-5 pb-4 border-b border-gray-800">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h1 className="text-xl font-black text-white leading-snug flex-1">{os.title ?? 'Sem título'}</h1>
            <span className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold flex-shrink-0 ${statusCfg.color}`}>
              {statusCfg.icon} {statusCfg.label}
            </span>
          </div>
          {os.description && (
            <p className="text-sm text-gray-400 leading-relaxed">{os.description}</p>
          )}
        </div>

        {/* Info */}
        <div className="px-4 py-2">
          <InfoRow icon={<User size={14} />}        label="Responsável"   value={os.assigneeName ?? (os.assignedUserNames?.[0] ?? null)} />
          <InfoRow icon={<User size={14} />}        label="Cliente"       value={os.clientName} />
          <InfoRow icon={<Tag size={14} />}         label="Tipo de serviço" value={os.tipoServico} />
          <InfoRow icon={<CalendarDays size={14} />} label="Data agendada" value={
            os.startDate
              ? os.startDate.toDate().toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : null
          } />
          {os.assignedUserNames && os.assignedUserNames.length > 0 && (
            <div className="flex items-start gap-3 py-2.5 border-b border-gray-800/60">
              <span className="text-gray-600 mt-0.5 flex-shrink-0"><User size={14} /></span>
              <div>
                <p className="text-[9px] text-gray-600 uppercase font-bold tracking-wide">Colaboradores</p>
                <p className="text-sm text-gray-200 mt-0.5">{os.assignedUserNames.join(', ')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Informações Adicionais — instrução + arquivos de apoio anexados na criação */}
        {((os as any).informacoesAdicionais?.texto || (os as any).informacoesAdicionais?.arquivos?.length > 0) && (
          <div className="px-4 py-4 border-t border-gray-800 bg-blue-500/5">
            <p className="text-[10px] text-blue-400 uppercase font-bold tracking-wide mb-3 flex items-center gap-1.5">
              <Tag size={11} /> Informações Adicionais
            </p>
            {(os as any).informacoesAdicionais?.texto && (
              <p className="text-sm text-gray-300 leading-relaxed mb-3">{(os as any).informacoesAdicionais.texto}</p>
            )}
            {(os as any).informacoesAdicionais?.arquivos?.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {(os as any).informacoesAdicionais.arquivos.map((a: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => (a.tipo === 'imagem' || a.tipo === 'video') ? setLightbox(a.url) : window.open(a.url, '_blank')}
                    className="relative aspect-square rounded-xl overflow-hidden bg-gray-800 border border-gray-700 flex items-center justify-center"
                  >
                    {a.tipo === 'video'
                      ? <video src={a.url} className="w-full h-full object-cover" muted playsInline />
                      : a.tipo === 'imagem'
                      ? <img src={a.url} alt={a.nome} className="w-full h-full object-cover" />
                      : <FileText size={20} className="text-gray-500" />
                    }
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">{a.nome}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Evidências de abertura (fotos/vídeos do início da execução) */}
        {(os as any).fotosIniciais?.length > 0 && (
          <div className="px-4 py-4 border-t border-gray-800">
            <p className="text-[10px] text-gray-600 uppercase font-bold tracking-wide mb-3 flex items-center gap-1.5">
              <Camera size={11} /> Evidência de início
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(os as any).fotosIniciais.map((url: string, i: number) => (
                <button key={i} onClick={() => setLightbox(url)} className="relative aspect-square rounded-xl overflow-hidden bg-gray-800 border border-gray-700">
                  {isVideoUrl(url)
                    ? <video src={url} className="w-full h-full object-cover" muted playsInline />
                    : <img src={url} alt="" className="w-full h-full object-cover" />}
                </button>
              ))}
            </div>
            <ObsDaEvidencia observacoes={obsPara((os as any).fotosIniciais)} />
          </div>
        )}

        {/* Tarefas com estado real + evidências (foto/vídeo/observação) */}
        {os.tarefasOS && os.tarefasOS.length > 0 && (() => {
          const tarefasNorm = os.tarefasOS.map((t: any, i: number) => ({
            id: t.id ?? String(i),
            descricao: t.descricao ?? t.text ?? `Tarefa ${i + 1}`,
            status: t.status === 'concluida' ? 'concluida' : t.status === 'nao_executada' ? 'nao_executada' : 'pendente',
            fotos: Array.isArray(t.fotosApp) ? t.fotosApp as string[] : [],
            observacao: t.observacaoApp ?? '',
            fasesAnteriores: Array.isArray(t.fasesAnteriores) ? t.fasesAnteriores as {
              status: string; fotos: string[]; observacao: string; finalizadaEm?: any;
            }[] : [],
          }));
          const concluidas = tarefasNorm.filter(t => t.status === 'concluida').length;
          return (
            <div className="px-4 py-4 border-t border-gray-800">
              <p className="text-[10px] text-gray-600 uppercase font-bold tracking-wide mb-3">
                Tarefas ({concluidas}/{tarefasNorm.length} concluídas)
              </p>
              <div className="space-y-3">
                {tarefasNorm.map(t => (
                  <div key={t.id} className="bg-gray-900/60 border border-gray-800 rounded-xl p-3">
                    <div className="flex items-start gap-2">
                      {t.status === 'concluida' && <CheckSquare size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />}
                      {t.status === 'nao_executada' && <XCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />}
                      {t.status === 'pendente' && <Square size={14} className="text-gray-600 flex-shrink-0 mt-0.5" />}
                      <span className={`text-xs flex-1 ${t.status === 'concluida' ? 'text-gray-300' : t.status === 'nao_executada' ? 'text-red-300 font-semibold' : 'text-gray-400'}`}>
                        {t.descricao}
                      </span>
                    </div>
                    {t.observacao && (
                      <p className="text-[11px] text-gray-500 mt-1.5 pl-6 leading-relaxed">
                        {t.status === 'nao_executada' ? '⚠️ Motivo: ' : ''}{t.observacao}
                      </p>
                    )}
                    {t.fotos.length > 0 && (
                      <div className="grid grid-cols-4 gap-1.5 mt-2 pl-6">
                        {t.fotos.map((url, j) => (
                          <button key={j} onClick={() => setLightbox(url)} className="relative aspect-square rounded-lg overflow-hidden bg-gray-800 border border-gray-700">
                            {isVideoUrl(url)
                              ? <video src={url} className="w-full h-full object-cover" muted playsInline />
                              : <img src={url} alt="" className="w-full h-full object-cover" />}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="pl-6">
                      <ObsDaEvidencia observacoes={obsPara(t.fotos)} />
                    </div>
                    {t.fasesAnteriores.length > 0 && (
                      <details className="mt-2 pl-6">
                        <summary className="text-[10px] text-gray-600 font-bold cursor-pointer">
                          Histórico anterior ({t.fasesAnteriores.length} fase{t.fasesAnteriores.length > 1 ? 's' : ''})
                        </summary>
                        <div className="mt-2 space-y-2">
                          {t.fasesAnteriores.map((fase, k) => (
                            <div key={k} className="bg-gray-950/60 border border-gray-800 rounded-lg p-2">
                              <p className={`text-[10px] font-bold ${fase.status === 'nao_executada' ? 'text-red-400' : 'text-emerald-400'}`}>
                                {fase.status === 'nao_executada' ? '⚠️ Não concluída' : '✓ Concluída'}
                              </p>
                              {fase.observacao && <p className="text-[10px] text-gray-500 mt-0.5">{fase.observacao}</p>}
                              {fase.fotos?.length > 0 && (
                                <div className="grid grid-cols-4 gap-1 mt-1.5">
                                  {fase.fotos.map((url, m) => (
                                    <button key={m} onClick={() => setLightbox(url)} className="relative aspect-square rounded overflow-hidden bg-gray-800 border border-gray-700">
                                      {isVideoUrl(url)
                                        ? <video src={url} className="w-full h-full object-cover" muted playsInline />
                                        : <img src={url} alt="" className="w-full h-full object-cover" />}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <ObsDaEvidencia observacoes={obsPara(fase.fotos ?? [])} />
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Relatório final (fotos finais + pendências/recomendações) */}
        {((os as any).fotosFinais?.length > 0 || (os as any).relatorioFinal) && (
          <div className="px-4 py-4 border-t border-gray-800">
            <p className="text-[10px] text-gray-600 uppercase font-bold tracking-wide mb-3 flex items-center gap-1.5">
              <FileText size={11} /> Relatório final
            </p>
            {(os as any).fotosFinais?.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {(os as any).fotosFinais.map((url: string, i: number) => (
                    <button key={i} onClick={() => setLightbox(url)} className="relative aspect-square rounded-xl overflow-hidden bg-gray-800 border border-gray-700">
                      {isVideoUrl(url)
                        ? <video src={url} className="w-full h-full object-cover" muted playsInline />
                        : <img src={url} alt="" className="w-full h-full object-cover" />}
                    </button>
                  ))}
                </div>
                <ObsDaEvidencia observacoes={obsPara((os as any).fotosFinais)} />
              </>
            )}
            {(os as any).relatorioFinal?.pendencia && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 mb-2">
                <p className="text-[10px] font-bold text-orange-400 uppercase mb-1">Pendência</p>
                <p className="text-xs text-orange-300">{(os as any).relatorioFinal.pendencia}</p>
              </div>
            )}
            {(os as any).relatorioFinal?.recomendacao && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Recomendação</p>
                <p className="text-xs text-blue-300">{(os as any).relatorioFinal.recomendacao}</p>
              </div>
            )}
          </div>
        )}

        {/* Observações gerais (sem vínculo a uma evidência específica) */}
        {observacoesGerais.length > 0 && (
          <div className="px-4 py-4 border-t border-gray-800">
            <p className="text-[10px] text-gray-600 uppercase font-bold tracking-wide mb-3 flex items-center gap-1.5">
              <MessageCircle size={11} /> Observações gerais
            </p>
            <div className="space-y-2">
              {observacoesGerais.map((obs: any) => (
                <div key={obs.id} className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3">
                  <p className="text-xs text-indigo-200">{obs.texto}</p>
                  <p className="text-[10px] text-indigo-400/70 mt-1">{obs.autorNome}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Painéis de ação ── */}

        {/* Mudar status */}
        {painel === 'status' && (
          <div className="mx-4 my-4 bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-white">Mudar status</p>
            {STATUS_OPTIONS.map(s => (
              <button
                key={s.value}
                onClick={() => setNovoStatus(s.value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                  novoStatus === s.value
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-gray-700 bg-gray-800'
                }`}
              >
                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${s.color}`}>
                  {s.icon} {s.label}
                </span>
                {novoStatus === s.value && <CheckCircle2 size={14} className="text-orange-400 ml-auto" />}
              </button>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  // Ao marcar "Concluída" manualmente aqui, sincroniza workflowStatus
                  // (mesmo gate de FieldOSDetail.tsx/Pipeline.tsx/OSExecution.tsx) — sem
                  // isso a O.S. aparece "Concluída" no app mas fica presa em "Aguardando
                  // Agendamento" no Kanban/Flow web, que leem workflowStatus, não status.
                  const skipBilling = (os as any).faturamentoPeloProjeto === true || (os as any).tipoOrigemOS === 'contrato_sla';
                  const extra = novoStatus === 'completed'
                    ? {
                        workflowStatus: skipBilling ? WorkflowStatus.CONCLUIDO : WorkflowStatus.AGUARDANDO_FATURAMENTO,
                        relatorioOSEnvio: { status: 'aguardando_relatorio' },
                      }
                    : {};
                  save({ status: novoStatus, ...extra }, 'mudar status');
                }}
                disabled={saving}
                className="flex-1 py-2.5 bg-orange-600 text-white font-bold text-xs rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Confirmar status
              </button>
              <button onClick={() => setPainel('none')} disabled={saving}
                className="px-4 py-2.5 bg-gray-800 text-gray-400 font-bold text-xs rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Reagendar */}
        {painel === 'reagendar' && (
          <div className="mx-4 my-4 bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-4">
            <p className="text-xs font-bold text-white">Reagendar O.S.</p>
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold">Data / hora de início</label>
              <input
                type="datetime-local"
                value={novaStart}
                onChange={e => setNovaStart(e.target.value)}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold">Data / hora de encerramento</label>
              <input
                type="datetime-local"
                value={novaEnd}
                onChange={e => setNovaEnd(e.target.value)}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  const updates: Record<string, any> = {};
                  const ts = localToTs(novaStart);
                  const te = localToTs(novaEnd);
                  if (ts) updates.startDate = ts;
                  if (te) updates.endDate   = te;
                  if (Object.keys(updates).length === 0) return;
                  save(updates, 'reagendar');
                }}
                disabled={saving || !novaStart}
                className="flex-1 py-2.5 bg-orange-600 text-white font-bold text-xs rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Calendar size={13} />}
                Confirmar datas
              </button>
              <button onClick={() => setPainel('none')} disabled={saving}
                className="px-4 py-2.5 bg-gray-800 text-gray-400 font-bold text-xs rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Reagendar com motivo — para O.S. não concluídas: cria nova O.S. */}
        {painel === 'reagendar_motivo' && (
          <div className="mx-4 my-4 bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-4">
            <div>
              <p className="text-xs font-bold text-white">Reagendar O.S. (com motivo)</p>
              <p className="text-[10px] text-gray-500 mt-1">
                Cria uma nova O.S. com as tarefas pendentes e encerra esta como "Reagendada".
              </p>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold">Motivo *</label>
              <div className="grid grid-cols-1 gap-1.5 mt-1.5">
                {REAGENDAMENTO_MOTIVOS.map(m => (
                  <button
                    key={m}
                    onClick={() => setMotivoReagendamento(m)}
                    className={`w-full text-left px-3 py-2 rounded-xl border text-xs transition-all ${
                      motivoReagendamento === m ? 'border-orange-500 bg-orange-500/10 text-orange-300' : 'border-gray-700 bg-gray-800 text-gray-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {motivoReagendamento === 'Outro' && (
                <textarea
                  value={motivoOutro}
                  onChange={e => setMotivoOutro(e.target.value)}
                  placeholder="Descreva o motivo..."
                  rows={2}
                  spellCheck autoCorrect="on" autoCapitalize="sentences"
                  className="w-full mt-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 resize-none"
                />
              )}
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 block">
                Nova data prevista <span className="text-gray-600 font-normal normal-case">(opcional)</span>
              </label>
              <CalendarioPicker
                value={dataReagendamento}
                onChange={setDataReagendamento}
                accentClass="bg-orange-500 border-orange-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleReagendarComMotivo}
                disabled={reagendando || !motivoReagendamento}
                className="flex-1 py-2.5 bg-orange-600 text-white font-bold text-xs rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {reagendando ? <Loader2 size={13} className="animate-spin" /> : <Calendar size={13} />}
                Confirmar reagendamento
              </button>
              <button onClick={() => setPainel('none')} disabled={reagendando}
                className="px-4 py-2.5 bg-gray-800 text-gray-400 font-bold text-xs rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Reatribuir */}
        {painel === 'reatribuir' && (
          <div className="mx-4 my-4 bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-white">Reatribuir O.S.</p>
            {loadingUsers ? (
              <div className="flex justify-center py-4">
                <Loader2 size={20} className="text-orange-400 animate-spin" />
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-1">
                <button
                  onClick={() => setNovoResp({ uid: '', nome: 'Sem responsável' })}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                    novoResp?.uid === '' ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700 bg-gray-800'
                  }`}
                >
                  <User size={13} className="text-gray-500" />
                  <span className="text-sm text-gray-300">Sem responsável</span>
                  {novoResp?.uid === '' && <CheckCircle2 size={13} className="text-orange-400 ml-auto" />}
                </button>
                {users.map(u => (
                  <button
                    key={u.uid}
                    onClick={() => setNovoResp(u)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                      novoResp?.uid === u.uid ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700 bg-gray-800'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-black text-gray-300">{u.nome[0].toUpperCase()}</span>
                    </div>
                    <span className="text-sm text-gray-300 flex-1 text-left">{u.nome}</span>
                    {novoResp?.uid === u.uid && <CheckCircle2 size={13} className="text-orange-400" />}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  if (!novoResp) return;
                  save({
                    assignedTo:   novoResp.uid || null,
                    assigneeName: novoResp.uid ? novoResp.nome : null,
                  }, 'reatribuir');
                }}
                disabled={saving || !novoResp}
                className="flex-1 py-2.5 bg-orange-600 text-white font-bold text-xs rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <UserCog size={13} />}
                Confirmar atribuição
              </button>
              <button onClick={() => setPainel('none')} disabled={saving}
                className="px-4 py-2.5 bg-gray-800 text-gray-400 font-bold text-xs rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Confirmar exclusão */}
        {painel === 'excluir' && (
          <div className="mx-4 my-4 bg-red-900/20 border border-red-700/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400" />
              <p className="text-sm font-bold text-red-300">Excluir O.S.?</p>
            </div>
            <p className="text-xs text-red-400/80">
              Esta ação é irreversível. A O.S. <strong>{os.title}</strong> e todos os seus dados serão permanentemente removidos.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleExcluir}
                disabled={saving}
                className="flex-1 py-2.5 bg-red-700 text-white font-bold text-xs rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Excluir definitivamente
              </button>
              <button onClick={() => setPainel('none')} disabled={saving}
                className="px-4 py-2.5 bg-gray-800 text-gray-400 font-bold text-xs rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="h-32" />
      </div>

      {/* ── Action bar ── */}
      {painel === 'none' && (
        <div className="flex-shrink-0 px-4 py-4 bg-gray-900 border-t border-gray-800 space-y-2 safe-area-bottom">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-800 border border-gray-700 text-gray-200 font-bold text-xs rounded-xl active:bg-gray-700"
            >
              <Pencil size={13} /> Editar
            </button>
            <button
              onClick={() => { setNovoStatus(os.status ?? 'pending'); setPainel('status'); }}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-800 border border-gray-700 text-gray-200 font-bold text-xs rounded-xl active:bg-gray-700"
            >
              <RefreshCw size={13} /> Status
            </button>
            <button
              onClick={() => { setNovaStart(tsToLocal(os.startDate)); setNovaEnd(tsToLocal((os as any).endDate)); setPainel('reagendar'); }}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-800 border border-gray-700 text-gray-200 font-bold text-xs rounded-xl active:bg-gray-700"
            >
              <Calendar size={13} /> Reagendar
            </button>
            <button
              onClick={() => { setNovoResp(null); setPainel('reatribuir'); }}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-800 border border-gray-700 text-gray-200 font-bold text-xs rounded-xl active:bg-gray-700"
            >
              <UserCog size={13} /> Reatribuir
            </button>
          </div>

          {os.status !== 'completed' && (
            <button
              onClick={() => { setMotivoReagendamento(''); setMotivoOutro(''); setDataReagendamento(''); setPainel('reagendar_motivo'); }}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 font-bold text-xs rounded-xl active:bg-orange-500/20"
            >
              <Calendar size={13} /> Reagendar O.S. (com motivo)
            </button>
          )}

          <button
            onClick={() => setPainel('excluir')}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-red-900/30 border border-red-700/40 text-red-400 font-bold text-xs rounded-xl active:bg-red-900/50"
          >
            <Trash2 size={13} /> Excluir O.S.
          </button>
        </div>
      )}
    </div>

    {/* Lightbox de evidências */}
    {lightbox && (
      <div
        className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
        onClick={() => setLightbox(null)}
      >
        {isVideoUrl(lightbox)
          ? <video src={lightbox} controls autoPlay className="max-w-full max-h-full rounded-xl" />
          : <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl object-contain" />}
      </div>
    )}
    </>
  );
}
