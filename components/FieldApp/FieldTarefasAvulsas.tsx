/**
 * FieldTarefasAvulsas — Hub de Tarefas do Projeto, lado técnico (M1).
 * Lista tarefas do backlog (status: 'backlog') de qualquer projeto.
 * Ao "pegar" uma, cria automaticamente uma O.S. mínima com essa única
 * tarefa, já atribuída ao técnico — permite adiantar serviço sem esperar
 * uma O.S. formal ser aberta para aquele trabalho específico.
 */
import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CollectionName, BacklogTarefa, WorkflowStatus } from '../../types';
import { gerarNumeroOS } from '../../services/osService';
import { registrarAtividade } from '../../services/activityFeedService';
import { ListTodo, Loader2, Briefcase, XCircle, Hand } from 'lucide-react';

export default function FieldTarefasAvulsas() {
  const { currentUser, userProfile } = useAuth();
  const [itens, setItens]     = useState<BacklogTarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [pegando, setPegando] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, CollectionName.PROJECT_TASK_BACKLOG), where('status', '==', 'backlog'));
    return onSnapshot(q, snap => {
      setItens(snap.docs.map(d => ({ id: d.id, ...d.data() } as BacklogTarefa)));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const pegarTarefa = async (item: BacklogTarefa) => {
    if (!currentUser || !userProfile) return;
    if (!confirm(`Pegar a tarefa "${item.descricao}"? Uma O.S. será criada automaticamente para você executá-la.`)) return;
    setPegando(item.id);
    try {
      const nome = (userProfile as any).nomeCompleto || userProfile.displayName || 'Técnico';
      const numeroOS = await gerarNumeroOS();
      const novaOS = {
        numeroOS,
        title: `${numeroOS} — ${item.descricao}`,
        description: 'Tarefa avulsa adiantada a partir do backlog do projeto.',
        status: 'pending',
        priority: 'medium',
        workflowStatus: WorkflowStatus.AGUARDANDO_APROVACAO,
        clientId: item.clientId || '',
        clientName: item.clientName || '',
        projectId: item.projectId,
        projectName: item.projectName || '',
        assignedTo: currentUser.uid,
        assigneeName: nome,
        assignedUsers: [currentUser.uid],
        assignedUserNames: [nome],
        tarefasOS: [{
          id: `tarefa_${Date.now()}`,
          descricao: item.descricao,
          status: 'pendente',
          backlogId: item.id,
        }],
        createdAt: Timestamp.now(),
      };
      const ref = await addDoc(collection(db, CollectionName.TASKS), novaOS);

      await updateDoc(doc(db, CollectionName.PROJECT_TASK_BACKLOG, item.id), {
        status: 'em_os',
        osDestinoId: ref.id,
        executorId: currentUser.uid,
        executorNome: nome,
      });

      registrarAtividade({
        tipo: 'os_aberta',
        autorId: currentUser.uid,
        autorNome: nome,
        titulo: `O.S. avulsa criada: ${item.descricao}`,
        osId: ref.id,
        osNumero: numeroOS,
        osTitulo: item.descricao,
        clienteNome: item.clientName,
        meta: { ambiente: 'app_tecnico', backlogId: item.id },
      });
    } catch {
      alert('Erro ao pegar tarefa. Tente novamente.');
    } finally {
      setPegando(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 size={22} className="animate-spin text-gray-500" />
    </div>
  );

  if (itens.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-gray-600">
      <ListTodo size={36} className="mb-3 opacity-30" />
      <p className="text-sm font-semibold text-gray-500">Nenhuma tarefa avulsa disponível</p>
      <p className="text-xs mt-1 text-gray-600">Tarefas do backlog dos projetos aparecerão aqui</p>
    </div>
  );

  return (
    <div className="p-4 space-y-2.5">
      {itens.map(item => (
        <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-3.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Briefcase size={11} className="text-gray-500" />
            <span className="text-[10px] text-gray-500 truncate">{item.projectName || 'Projeto'}</span>
            {item.origem === 'nao_concluida' && (
              <span className="ml-auto text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <XCircle size={9} /> retomada
              </span>
            )}
          </div>
          <p className="text-sm text-gray-200 mb-2.5">{item.descricao}</p>
          {item.motivoNaoConclusao && (
            <p className="text-[11px] text-gray-500 mb-2.5">Motivo anterior: {item.motivoNaoConclusao}</p>
          )}
          <button
            onClick={() => pegarTarefa(item)}
            disabled={pegando === item.id}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs disabled:opacity-50 active:bg-emerald-700"
          >
            {pegando === item.id ? <Loader2 size={13} className="animate-spin" /> : <Hand size={13} />}
            {pegando === item.id ? 'Criando O.S...' : 'Pegar tarefa'}
          </button>
        </div>
      ))}
    </div>
  );
}
