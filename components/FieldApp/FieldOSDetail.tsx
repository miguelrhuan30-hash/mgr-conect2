import React, { useState } from 'react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { WorkflowStatus } from '../../types';
import { OSField } from './FieldOS';
import FieldOSInicioModal from './FieldOSInicioModal';
import FieldOSTarefaDetalhe, { TarefaComEvidencia } from './FieldOSTarefaDetalhe';
import FieldOSEncerramentoModal, { RelatorioFinal } from './FieldOSEncerramentoModal';
import { registrarAtividade } from '../../services/activityFeedService';
import {
  User, MapPin, Wrench, CheckCircle2, Play, CheckSquare, Square,
  XSquare, ArrowLeft, FileText, Calendar, UserPlus, Camera,
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

  const tituloOS  = os.title ?? 'Sem título';
  const cliente   = os.clientName ?? null;
  const local     = os.localizacao ?? null;
  const descricao = os.description ?? null;
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
      tarefasOS: novas.map(t => ({
        ...(rawMap[t.id] ?? {}),           // preserva fotos Record, fotoSlots, iniciadaEm, etc.
        id: t.id,
        descricao: t.descricao,
        status: t.status,
        fotosApp: t.fotos ?? [],           // campo exclusivo do app de campo (string[])
        observacaoApp: t.observacao ?? '', // campo exclusivo do app de campo
        concluidaEm: t.status !== 'pendente' ? Timestamp.now() : null,
      })),
    });
  };

  /* ─── Iniciar (com fotos) ─────────────────────────── */
  const handleInicioConfirmado = async (fotosIniciais: string[]) => {
    if (!currentUser || !userProfile) return;
    const nome = userProfile.nomeCompleto || userProfile.displayName || currentUser.email || 'Técnico';
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
    registrarAtividade({
      tipo: 'os_iniciada',
      autorId: currentUser.uid,
      autorNome: nome,
      titulo: `O.S. iniciada: ${os.title ?? 'Sem título'}`,
      osId: os.id,
      osNumero: (os as any).numeroOS ?? undefined,
      osTitulo: os.title ?? undefined,
      clienteNome: os.clientName ?? undefined,
    });
    onUpdate({
      ...os,
      status: 'in-progress',
      assignedTo: pegarFlag ? currentUser.uid : os.assignedTo,
      startDate: os.startDate ?? Timestamp.now(),
    });
    setFlow('idle');
  };

  /* ─── Tarefa concluída / não executada ───────────── */
  const handleTarefaSalva = async (tarefaAtualizada: TarefaComEvidencia) => {
    const novas = tarefas.map(t => t.id === tarefaAtualizada.id ? tarefaAtualizada : t);
    setTarefas(novas);
    await salvarTarefasFirestore(novas);
    if (tarefaAtualizada.status === 'concluida' && currentUser && userProfile) {
      const nome = (userProfile as any).nomeCompleto || (userProfile as any).displayName || currentUser.email || 'Técnico';
      registrarAtividade({
        tipo: tarefaAtualizada.fotos?.length ? 'foto_tarefa' : 'tarefa_concluida',
        autorId: currentUser.uid,
        autorNome: nome,
        titulo: `Tarefa concluída: ${tarefaAtualizada.descricao}`,
        descricao: tarefaAtualizada.observacao || undefined,
        osId: os.id,
        osNumero: (os as any).numeroOS ?? undefined,
        osTitulo: os.title ?? undefined,
        clienteNome: os.clientName ?? undefined,
        fotoUrl: tarefaAtualizada.fotos?.[0] ?? undefined,
      });
    }
    setFlow('idle');
    setTarefaSel(null);
  };

  /* ─── Encerramento da O.S. ───────────────────────── */
  const handleEncerramentoConfirmado = async (relatorio: RelatorioFinal) => {
    await updateDoc(doc(db, 'tasks', os.id), {
      status: 'completed',
      workflowStatus: WorkflowStatus.CONCLUIDO,
      fotosFinais: relatorio.fotosFinais,
      relatorioFinal: {
        pendencia:    relatorio.pendencia,
        recomendacao: relatorio.recomendacao,
        finalizadoEm: Timestamp.now(),
      },
      'execution.checkOut':    Timestamp.now(),
      'execution.actualEndTime': Timestamp.now(),
    });
    if (currentUser && userProfile) {
      const nome = (userProfile as any).nomeCompleto || (userProfile as any).displayName || currentUser.email || 'Técnico';
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

          {/* Tarefas */}
          {tarefas.length > 0 && (
            <div className="px-4 py-4 border-b border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <CheckSquare size={11} /> Tarefas
                </p>
                <span className={`text-xs font-bold ${todasConcluidas ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {concluidasTarefas}/{totalTarefas}
                </span>
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
    </>
  );
}
