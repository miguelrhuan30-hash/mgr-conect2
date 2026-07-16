import React, { useState, useEffect } from 'react';
import { doc, updateDoc, addDoc, collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { WorkflowStatus, CollectionName, Task } from '../../types';
import { OSField } from './FieldOS';
import FieldOSInicioModal from './FieldOSInicioModal';
import FieldOSTarefaDetalhe, { TarefaComEvidencia } from './FieldOSTarefaDetalhe';
import FieldOSEncerramentoModal, { RelatorioFinal } from './FieldOSEncerramentoModal';
import { registrarAtividade, marcarFotoApagada } from '../../services/activityFeedService';
import { isVideoUrl } from './photoUtils';
import OSSuporteChat from '../OSSuporteChat';
import {
  User, MapPin, Wrench, CheckCircle2, Play, CheckSquare, Square,
  XSquare, ArrowLeft, FileText, Calendar, UserPlus, Camera, Plus, Clock, Paperclip, Headphones,
} from 'lucide-react';

interface Props {
  os: OSField;
  onClose: () => void;
  onUpdate: (updated: OSField) => void;
}

type FlowState = 'idle' | 'inicio' | 'tarefa' | 'encerramento';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  'pending':     { label: 'Pendente',     color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  'in-progress': { label: 'Em andamento', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  'completed':   { label: 'Concluída',    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  'open':        { label: 'Aberta',       color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
};

export default function FieldOSDetail({ os, onClose, onUpdate }: Props) {
  const { currentUser, userProfile } = useAuth();

  const [tarefas, setTarefas] = useState<TarefaComEvidencia[]>(() =>
    (os.tarefasOS ?? []).map((t: any) => ({
      id:        t.id ?? String(Math.random()),
      descricao: t.descricao ?? t.text ?? '',
      status:    t.status === 'concluida' ? 'concluida' :
                 t.status === 'nao_executada' ? 'nao_executada' : 'pendente',
      fotos:     Array.isArray(t.fotosApp) ? t.fotosApp : [],  // fotosApp = fotos do app de campo
      observacao: t.observacaoApp ?? '',                         // observacaoApp = texto do app
    } as TarefaComEvidencia))
  );

  const [flow, setFlow]           = useState<FlowState>('idle');
  const [tarefaSel, setTarefaSel] = useState<TarefaComEvidencia | null>(null);
  const [pegarFlag, setPegarFlag] = useState(false);
  const [erro, setErro]           = useState('');
  const [showNovaTarefa, setShowNovaTarefa] = useState(false);
  const [novaTarefaDesc, setNovaTarefaDesc] = useState('');
  const [criandoTarefa, setCriandoTarefa]   = useState(false);
  const [lightboxArquivo, setLightboxArquivo] = useState<string | null>(null);
  const [showSuporte, setShowSuporte] = useState(false);
  const [naoLidasSuporte, setNaoLidasSuporte] = useState(0);

  // Contagem de mensagens de suporte não lidas pelo técnico nesta O.S.
  useEffect(() => {
    const q = query(
      collection(db, CollectionName.OS_SUPORTE_MSGS),
      where('osId', '==', os.id),
      where('leitoPorTecnico', '==', false),
    );
    const unsub = onSnapshot(q, snap => setNaoLidasSuporte(snap.size), () => {});
    return unsub;
  }, [os.id]);

  const tituloOS  = os.title ?? 'Sem título';
  const cliente   = os.clientName ?? null;
  const local     = os.localizacao ?? null;
  const descricao = os.description ?? null;
  const infoAdicionais = (os as any).informacoesAdicionais as { texto?: string; arquivos: { url: string; nome: string; tipo: string }[] } | undefined;
  const dataStr   = os.startDate
    ? os.startDate.toDate().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    : null;
  const statusCfg = STATUS_LABEL[os.status ?? ''] ?? STATUS_LABEL['open'];

  const semResponsavel   = !os.assignedTo || os.assignedTo === '';
  const euSouResponsavel = os.assignedTo === currentUser?.uid
    || (os.assignedUsers ?? []).includes(currentUser?.uid ?? '');
  const podePegar    = semResponsavel && os.status !== 'completed';
  const podeIniciar  = !semResponsavel && euSouResponsavel && (os.status === 'pending' || os.status === 'open');
  const podeConcluir = euSouResponsavel && os.status === 'in-progress';
  const emExecucao   = os.status === 'in-progress';

  const totalTarefas      = tarefas.length;
  const concluidasTarefas = tarefas.filter(t => t.status === 'concluida').length;
  const todasConcluidas   = totalTarefas > 0 && concluidasTarefas === totalTarefas;

  const salvarTarefasFirestore = async (novas: TarefaComEvidencia[]) => {
    // Mapa dos dados originais do Firestore (preserva campos do web: fotos Record, fotoSlots, etc.)
    const rawMap: Record<string, any> = Object.fromEntries(
      (os.tarefasOS ?? []).map((t: any) => [t.id, t])
    );
    await updateDoc(doc(db, 'tasks', os.id), {
      tarefasOS: novas.map(t => {
        const raw = rawMap[t.id] ?? {};
        // Fase de evidência: ao mudar de um status definitivo (concluida/nao_executada)
        // para outro, arquiva a fase anterior (fotos+motivo) em vez de sobrescrever —
        // refazer a tarefa nunca apaga o que já foi registrado.
        const statusAnteriorDefinitivo = raw.status === 'concluida' || raw.status === 'nao_executada';
        const mudouStatus = raw.status && raw.status !== t.status;
        const fasesAnteriores = Array.isArray(raw.fasesAnteriores) ? raw.fasesAnteriores : [];
        const novasFasesAnteriores = (mudouStatus && statusAnteriorDefinitivo)
          ? [...fasesAnteriores, {
              status: raw.status,
              fotos: raw.fotosApp ?? [],
              observacao: raw.observacaoApp ?? '',
              finalizadaEm: raw.concluidaEm ?? Timestamp.now(),
            }]
          : fasesAnteriores;
        return {
          ...raw,                            // preserva fotos Record, fotoSlots, iniciadaEm, etc.
          id: t.id,
          descricao: t.descricao,
          status: t.status,
          fotosApp: t.fotos ?? [],            // campo exclusivo do app de campo (string[]) — fase ATUAL
          observacaoApp: t.observacao ?? '',  // campo exclusivo do app de campo — fase ATUAL
          concluidaEm: t.status !== 'pendente' ? Timestamp.now() : null,
          fasesAnteriores: novasFasesAnteriores,
        };
      }),
    });
  };

  /* ─── Iniciar (com fotos) ─────────────────────────── */
  const handleInicioConfirmado = async (fotosIniciais: string[]) => {
    if (!currentUser || !userProfile) return;
    const nome = userProfile.nomeCompleto || userProfile.displayName || 'Técnico';
    const campos: any = {
      status: 'in-progress',
      workflowStatus: WorkflowStatus.EM_EXECUCAO,
      fotosIniciais,
      'execution.checkIn': Timestamp.now(),
      'execution.actualStartTime': Timestamp.now(),
    };
    if (pegarFlag) {
      campos.assignedTo        = currentUser.uid;
      campos.assigneeName      = nome;
      campos.assignedUsers     = [currentUser.uid];
      campos.assignedUserNames = [nome];
      campos.startDate         = Timestamp.now();
    } else {
      campos.startDate = os.startDate ?? Timestamp.now();
    }
    await updateDoc(doc(db, 'tasks', os.id), campos);

    const osBaseInicio = {
      autorId: currentUser.uid,
      autorNome: nome,
      osId: os.id,
      osNumero: (os as any).numeroOS ?? undefined,
      osTitulo: os.title ?? undefined,
      clienteNome: os.clientName ?? undefined,
    };

    registrarAtividade({
      ...osBaseInicio,
      tipo: 'os_iniciada',
      titulo: `O.S. iniciada: ${os.title ?? 'Sem título'}`,
    });

    // Cada evidência de início (foto/vídeo) gera um card no feed
    for (const url of fotosIniciais ?? []) {
      if (isVideoUrl(url)) {
        registrarAtividade({
          ...osBaseInicio,
          tipo: 'video_gravado',
          titulo: `Evidência de início: ${os.title ?? 'O.S.'}`,
          videoUrl: url,
        });
      } else {
        registrarAtividade({
          ...osBaseInicio,
          tipo: 'foto_tarefa',
          titulo: `Evidência de início: ${os.title ?? 'O.S.'}`,
          fotoUrl: url,
        });
      }
    }

    onUpdate({
      ...os,
      status: 'in-progress',
      assignedTo: pegarFlag ? currentUser.uid : os.assignedTo,
      startDate: os.startDate ?? Timestamp.now(),
    });
    setFlow('idle');
  };

  /* ─── Tarefa concluída / não executada ───────────── */
  const handleTarefaSalva = async (tarefaAtualizada: TarefaComEvidencia, fotosApagadas: string[]) => {
    const novas = tarefas.map(t => t.id === tarefaAtualizada.id ? tarefaAtualizada : t);
    setTarefas(novas);
    await salvarTarefasFirestore(novas);

    if (currentUser && userProfile) {
      const nome = (userProfile as any).nomeCompleto || (userProfile as any).displayName || 'Técnico';

      // Marcar fotos apagadas no feed (soft delete — post fica vermelho)
      for (const url of fotosApagadas) {
        marcarFotoApagada(url);
      }

      // Compute new media vs old
      const tarefaOriginal = tarefas.find(t => t.id === tarefaAtualizada.id);
      const fotosAntigas   = tarefaOriginal?.fotos ?? [];
      const midiaNovas     = (tarefaAtualizada.fotos ?? []).filter(u => !fotosAntigas.includes(u));
      const videosNovos    = midiaNovas.filter(u => isVideoUrl(u));
      const fotosNovas     = midiaNovas.filter(u => !isVideoUrl(u));

      const osBase = {
        autorId:     currentUser.uid,
        autorNome:   nome,
        osId:        os.id,
        osNumero:    (os as any).numeroOS ?? undefined,
        osTitulo:    os.title ?? undefined,
        clienteNome: os.clientName ?? undefined,
      };

      // Cada foto nova gera post independente no feed (permite soft-delete por foto)
      for (const fotoUrl of fotosNovas) {
        registrarAtividade({
          ...osBase,
          tipo:      'foto_tarefa',
          titulo:    `Evidência adicionada: ${tarefaAtualizada.descricao}`,
          descricao: tarefaAtualizada.observacao || undefined,
          fotoUrl,
        });
      }

      // Cada vídeo novo gera post independente
      for (const videoUrl of videosNovos) {
        registrarAtividade({
          ...osBase,
          tipo:  'video_gravado',
          titulo: `Vídeo gravado: ${tarefaAtualizada.descricao}`,
          videoUrl,
        });
      }

      // tarefa_concluida somente na transição pendente → concluída sem mídia nova
      if (
        tarefaAtualizada.status === 'concluida' &&
        tarefaOriginal?.status !== 'concluida' &&
        fotosNovas.length === 0 &&
        videosNovos.length === 0
      ) {
        registrarAtividade({
          ...osBase,
          tipo:      'tarefa_concluida',
          titulo:    `Tarefa concluída: ${tarefaAtualizada.descricao}`,
          descricao: tarefaAtualizada.observacao || undefined,
        });
      }

      // Tarefa marcada como não concluída: sempre gera post com o motivo,
      // para o gestor conseguir redistribuir/criar nova O.S. a partir dela.
      if (
        tarefaAtualizada.status === 'nao_executada' &&
        tarefaOriginal?.status !== 'nao_executada'
      ) {
        registrarAtividade({
          ...osBase,
          tipo:      'tarefa_nao_concluida',
          titulo:    `Tarefa não concluída: ${tarefaAtualizada.descricao}`,
          descricao: tarefaAtualizada.observacao || 'Sem motivo informado',
          meta:      { tarefaId: tarefaAtualizada.id },
        });

        // Hub de Tarefas do Projeto: se a O.S. pertence a um projeto, a tarefa
        // volta automaticamente ao backlog para o gestor redistribuir.
        const projId = (os as any).projectId;
        if (projId) {
          addDoc(collection(db, CollectionName.PROJECT_TASK_BACKLOG), {
            projectId: projId,
            projectName: (os as any).projectName || '',
            clientId: (os as any).clientId || '',
            clientName: os.clientName || '',
            descricao: tarefaAtualizada.descricao,
            status: 'backlog',
            origem: 'nao_concluida',
            osOrigemId: os.id,
            motivoNaoConclusao: tarefaAtualizada.observacao || 'Sem motivo informado',
            criadoEm: Timestamp.now(),
            criadoPor: currentUser.uid,
            criadoPorNome: nome,
          }).catch(() => {});
        }
      }
    }
    setFlow('idle');
    setTarefaSel(null);
  };

  /* ─── Nova Tarefa criada pelo técnico ────────────── */
  const handleNovaTarefa = async () => {
    if (!novaTarefaDesc.trim() || !currentUser || !userProfile) return;
    setCriandoTarefa(true);
    try {
      const nome = (userProfile as any).nomeCompleto || (userProfile as any).displayName || 'Técnico';
      const novaTarefa: TarefaComEvidencia = {
        id:         'tecnico_' + Date.now(),
        descricao:  novaTarefaDesc.trim(),
        status:     'pendente',
        fotos:      [],
        observacao: '',
      };
      const novas = [...tarefas, novaTarefa];
      setTarefas(novas);
      await salvarTarefasFirestore(novas);
      registrarAtividade({
        tipo: 'tarefa_criada_tecnico',
        autorId: currentUser.uid,
        autorNome: nome,
        titulo: `Nova tarefa criada: ${novaTarefa.descricao}`,
        osId: os.id,
        osNumero: (os as any).numeroOS ?? undefined,
        osTitulo: os.title ?? undefined,
        clienteNome: os.clientName ?? undefined,
      });
      setNovaTarefaDesc('');
      setShowNovaTarefa(false);
    } catch {
      // silent
    } finally {
      setCriandoTarefa(false);
    }
  };

  /* ─── Encerramento da O.S. ───────────────────────── */
  const handleEncerramentoConfirmado = async (relatorio: RelatorioFinal) => {
    // Mesmo gate usado em Pipeline.tsx (moveTask) e OSExecution.tsx: O.S. de
    // projeto com faturamento pelo projeto pula direto para CONCLUIDO; O.S.
    // avulsa entra em AGUARDANDO_FATURAMENTO para alimentar o financeiro (Billing.tsx).
    const skipBilling = (os as any).faturamentoPeloProjeto === true || (os as any).tipoOrigemOS === 'contrato_sla';
    const workflowDestino = skipBilling ? WorkflowStatus.CONCLUIDO : WorkflowStatus.AGUARDANDO_FATURAMENTO;

    await updateDoc(doc(db, 'tasks', os.id), {
      status: 'completed',
      workflowStatus: workflowDestino,
      fotosFinais: relatorio.fotosFinais,
      relatorioFinal: {
        pendencia:    relatorio.pendencia,
        recomendacao: relatorio.recomendacao,
        finalizadoEm: Timestamp.now(),
      },
      // Toda O.S. concluída (avulsa, de projeto ou de contrato) gera relatório individual —
      // independente do gate de faturamento, que só decide o destino do workflowStatus.
      relatorioOSEnvio: { status: 'aguardando_relatorio' },
      'execution.checkOut':    Timestamp.now(),
      'execution.actualEndTime': Timestamp.now(),
    });
    if (currentUser && userProfile) {
      const nome = (userProfile as any).nomeCompleto || (userProfile as any).displayName || 'Técnico';
      registrarAtividade({
        tipo: 'os_concluida',
        autorId: currentUser.uid,
        autorNome: nome,
        titulo: `O.S. concluída: ${os.title ?? 'Sem título'}`,
        descricao: relatorio.pendencia ? `Pendência: ${relatorio.pendencia}` : undefined,
        osId: os.id,
        osNumero: (os as any).numeroOS ?? undefined,
        osTitulo: os.title ?? undefined,
        clienteNome: os.clientName ?? undefined,
        fotoUrl: relatorio.fotosFinais?.[0] ?? undefined,
      });
    }
    onUpdate({ ...os, status: 'completed' });
    onClose();
  };

  /* ─── Encerrar parcialmente (dia parcial) ──────────
   * A O.S. NÃO é concluída — volta para 'pending' com o que já foi feito
   * preservado (cada tarefa mantém seu status/evidência individual).
   * Ao retomar, o técnico continua de onde parou; tarefas 'nao_executada'
   * podem ser refeitas sem perder o histórico (ver salvarTarefasFirestore). */
  const handleEncerrarParcial = async () => {
    if (!currentUser || !userProfile) return;
    if (!confirm(`Encerrar o dia com ${concluidasTarefas}/${totalTarefas} tarefas concluídas? A O.S. ficará pendente para retomar depois.`)) return;
    const nome = (userProfile as any).nomeCompleto || (userProfile as any).displayName || 'Técnico';
    await updateDoc(doc(db, 'tasks', os.id), {
      status: 'pending',
      'execution.checkOut': Timestamp.now(),
    });
    registrarAtividade({
      tipo: 'os_status_mudou',
      autorId: currentUser.uid,
      autorNome: nome,
      titulo: `O.S. encerrada parcialmente: ${os.title ?? 'Sem título'}`,
      descricao: `${concluidasTarefas}/${totalTarefas} tarefas concluídas — retomar depois`,
      osId: os.id,
      osNumero: (os as any).numeroOS ?? undefined,
      osTitulo: os.title ?? undefined,
      clienteNome: os.clientName ?? undefined,
    });
    onUpdate({ ...os, status: 'pending' });
    onClose();
  };

  const abrirTarefa = (t: TarefaComEvidencia) => {
    if (!emExecucao) return;
    setTarefaSel(t);
    setFlow('tarefa');
  };

  return (
    <>
      {/* Tela principal da O.S. */}
      <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 safe-area-top">
          <button onClick={onClose} className="p-2 -ml-2 rounded-full active:bg-gray-800">
            <ArrowLeft size={20} className="text-gray-400" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-500 font-mono">
              {(os as any).numeroOS ?? (os as any).code ?? os.id.slice(0, 8).toUpperCase()}
            </p>
            <h1 className="text-sm font-bold text-white truncate">{tituloOS}</h1>
          </div>
          <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto">
          {/* Banner: sem responsável */}
          {semResponsavel && (
            <div className="mx-4 mt-4 flex items-start gap-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2.5">
              <UserPlus size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-300 leading-snug">
                <strong>Sem responsável.</strong> Ao clicar em "Pegar e Iniciar" você se torna responsável e a execução começa agora.
              </p>
            </div>
          )}

          {/* Infos principais */}
          <div className="px-4 py-4 space-y-2 border-b border-gray-800">
            {cliente && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <User size={14} className="text-gray-500 flex-shrink-0" /> {cliente}
              </div>
            )}
            {local && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <MapPin size={14} className="text-gray-500 flex-shrink-0" /> {local}
              </div>
            )}
            {dataStr && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Calendar size={14} className="text-gray-500 flex-shrink-0" /> {dataStr}
              </div>
            )}
            {(os as any).tipoServico && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Wrench size={14} className="text-gray-500 flex-shrink-0" /> {(os as any).tipoServico}
              </div>
            )}
          </div>

          {/* Descrição */}
          {descricao && (
            <div className="px-4 py-4 border-b border-gray-800">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <FileText size={11} /> Descrição
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">{descricao}</p>
            </div>
          )}

          {/* Informações Adicionais — instrução + arquivos de apoio (fotos, vídeos, plantas) */}
          {(infoAdicionais?.texto || (infoAdicionais?.arquivos?.length ?? 0) > 0) && (
            <div className="px-4 py-4 border-b border-gray-800 bg-blue-500/5">
              <p className="text-xs font-bold text-blue-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Paperclip size={11} /> Informações Adicionais
              </p>
              {infoAdicionais?.texto && (
                <p className="text-sm text-gray-300 leading-relaxed mb-3">{infoAdicionais.texto}</p>
              )}
              {(infoAdicionais?.arquivos?.length ?? 0) > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {infoAdicionais!.arquivos.map((a, i) => (
                    <button
                      key={i}
                      onClick={() => a.tipo === 'imagem' || a.tipo === 'video' ? setLightboxArquivo(a.url) : window.open(a.url, '_blank')}
                      className="relative aspect-square rounded-xl overflow-hidden bg-gray-800 border border-gray-700 flex items-center justify-center"
                    >
                      {a.tipo === 'video'
                        ? <video src={a.url} className="w-full h-full object-cover" muted playsInline />
                        : a.tipo === 'imagem'
                        ? <img src={a.url} alt={a.nome} className="w-full h-full object-cover" />
                        : <FileText size={24} className="text-gray-500" />
                      }
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">{a.nome}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tarefas */}
          {tarefas.length > 0 && (
            <div className="px-4 py-4 border-b border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <CheckSquare size={11} /> Tarefas
                </p>
                <div className="flex items-center gap-3">
                  {emExecucao && (
                    <button
                      onClick={() => setShowNovaTarefa(true)}
                      className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 active:opacity-70"
                    >
                      <Plus size={14} /> Nova tarefa
                    </button>
                  )}
                  <span className={`text-xs font-bold ${todasConcluidas ? 'text-emerald-400' : 'text-gray-500'}`}>
                    {concluidasTarefas}/{totalTarefas}
                  </span>
                </div>
              </div>

              {/* Barra de progresso */}
              <div className="h-1.5 bg-gray-800 rounded-full mb-3 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${totalTarefas > 0 ? (concluidasTarefas / totalTarefas) * 100 : 0}%` }}
                />
              </div>

              {emExecucao && (
                <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                  <Camera size={11} /> Toque em uma tarefa para registrar foto e conclusão
                </p>
              )}

              <div className="space-y-2">
                {tarefas.map(t => (
                  <button
                    key={t.id}
                    onClick={() => abrirTarefa(t)}
                    disabled={!emExecucao}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all disabled:cursor-default ${
                      t.status === 'concluida'
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : t.status === 'nao_executada'
                        ? 'bg-orange-500/5 border-orange-500/20'
                        : 'bg-gray-800/60 border-gray-700/60 active:bg-gray-800'
                    }`}
                  >
                    {t.status === 'concluida'
                      ? <CheckSquare size={16} className="text-emerald-400 flex-shrink-0" />
                      : t.status === 'nao_executada'
                      ? <XSquare size={16} className="text-orange-400 flex-shrink-0" />
                      : <Square size={16} className="text-gray-500 flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm leading-snug ${
                        t.status === 'concluida'    ? 'text-gray-500 line-through' :
                        t.status === 'nao_executada' ? 'text-orange-400/80' : 'text-gray-200'
                      }`}>
                        {t.descricao}
                      </span>
                      {t.observacao && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{t.observacao}</p>
                      )}
                    </div>
                    {(t.fotos?.length ?? 0) > 0 && (
                      <span className="flex-shrink-0 flex items-center gap-0.5 text-xs text-gray-500">
                        <Camera size={10} /> {t.fotos!.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="h-36" />
        </div>

        {/* FAB: Suporte — só quando o técnico é responsável e a O.S. não está concluída */}
        {euSouResponsavel && os.status !== 'completed' && (
          <button
            onClick={() => setShowSuporte(true)}
            className="fixed bottom-32 right-4 z-40 flex items-center gap-2 bg-purple-600 active:bg-purple-700 text-white px-4 py-3 rounded-2xl shadow-xl font-bold text-sm"
          >
            <Headphones size={18} />
            Suporte
            {naoLidasSuporte > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center -ml-1">
                {naoLidasSuporte}
              </span>
            )}
          </button>
        )}

        {/* Botões de ação */}
        <div className="px-4 py-4 bg-gray-900 border-t border-gray-800 space-y-2.5 safe-area-bottom">
          {erro && <p className="text-xs text-red-400 text-center">{erro}</p>}

          {podePegar && (
            <button
              onClick={() => { setPegarFlag(true); setErro(''); setFlow('inicio'); }}
              className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 text-white rounded-2xl font-bold text-base active:bg-blue-700"
            >
              <UserPlus size={18} /> Pegar e Iniciar O.S.
            </button>
          )}

          {podeIniciar && (
            <button
              onClick={() => { setPegarFlag(false); setErro(''); setFlow('inicio'); }}
              className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-base active:bg-emerald-700"
            >
              <Play size={18} fill="currentColor" /> Iniciar O.S.
            </button>
          )}

          {podeConcluir && (
            <button
              onClick={() => { setErro(''); setFlow('encerramento'); }}
              className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-base active:bg-emerald-700"
            >
              <CheckCircle2 size={18} /> Concluir O.S.
            </button>
          )}

          {podeConcluir && !todasConcluidas && (
            <button
              onClick={handleEncerrarParcial}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-2xl font-bold text-sm active:bg-orange-500/20"
            >
              <Clock size={16} /> Encerrar por hoje (retomar depois)
            </button>
          )}

          {os.status === 'completed' && (
            <div className="flex items-center justify-center gap-2 py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
              <CheckCircle2 size={18} className="text-emerald-400" />
              <span className="text-emerald-400 font-bold text-sm">O.S. Concluída</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Fotos iniciais */}
      {flow === 'inicio' && (
        <FieldOSInicioModal
          taskId={os.id}
          titulo={tituloOS}
          uid={currentUser?.uid ?? ''}
          onConfirmar={handleInicioConfirmado}
          onCancelar={() => setFlow('idle')}
        />
      )}

      {/* Modal: Execução de tarefa */}
      {flow === 'tarefa' && tarefaSel && (
        <FieldOSTarefaDetalhe
          tarefa={tarefaSel}
          taskId={os.id}
          uid={currentUser?.uid ?? ''}
          onSalvar={handleTarefaSalva}
          onCancelar={() => { setFlow('idle'); setTarefaSel(null); }}
        />
      )}

      {/* Modal: Encerramento */}
      {flow === 'encerramento' && (
        <FieldOSEncerramentoModal
          taskId={os.id}
          titulo={tituloOS}
          uid={currentUser?.uid ?? ''}
          onConfirmar={handleEncerramentoConfirmado}
          onCancelar={() => setFlow('idle')}
        />
      )}

      {/* Modal: Nova Tarefa */}
      {showNovaTarefa && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex items-end">
          <div className="w-full bg-gray-900 rounded-t-3xl p-6 space-y-4">
            <h3 className="text-base font-black text-white">Nova Tarefa</h3>
            <p className="text-xs text-gray-400">Descreva a tarefa adicional que identificou como necessária.</p>
            <textarea
              value={novaTarefaDesc}
              onChange={e => setNovaTarefaDesc(e.target.value)}
              placeholder="Ex: Troca de válvula de alívio..."
              rows={3}
              spellCheck autoCorrect="on" autoCapitalize="sentences"
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-emerald-500"
            />
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setShowNovaTarefa(false); setNovaTarefaDesc(''); }}
                disabled={criandoTarefa}
                className="py-3.5 bg-gray-800 text-gray-300 rounded-2xl font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleNovaTarefa}
                disabled={criandoTarefa || !novaTarefaDesc.trim()}
                className="py-3.5 bg-emerald-600 text-white rounded-2xl font-bold text-sm disabled:opacity-50"
              >
                {criandoTarefa ? 'Salvando...' : 'Criar Tarefa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox: arquivos de Informações Adicionais */}
      {lightboxArquivo && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxArquivo(null)}
        >
          {infoAdicionais?.arquivos.find(a => a.url === lightboxArquivo)?.tipo === 'video'
            ? <video src={lightboxArquivo} controls autoPlay className="max-w-full max-h-full rounded-xl" />
            : <img src={lightboxArquivo} alt="" className="max-w-full max-h-full rounded-xl object-contain" />}
        </div>
      )}

      {/* Modal: Suporte */}
      {showSuporte && (
        <OSSuporteChat
          task={os as unknown as Task}
          onClose={() => setShowSuporte(false)}
          variant="dark"
        />
      )}
    </>
  );
}
