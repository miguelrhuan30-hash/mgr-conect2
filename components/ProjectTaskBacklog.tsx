/**
 * ProjectTaskBacklog — Hub de Tarefas do Projeto (M1)
 *
 * Pool de tarefas do projeto, independente de O.S. específica:
 *  - Gestor cadastra tarefas ao planejar (status: 'backlog')
 *  - Ao criar uma O.S. para o projeto (OSCreationModal), o gestor pode
 *    selecionar itens daqui para distribuir (status vira 'em_os')
 *  - Tarefas marcadas "não concluída" em qualquer O.S. do projeto retornam
 *    aqui automaticamente (origem: 'nao_concluida') para redistribuição
 *  - Técnicos podem "pegar" uma tarefa avulsa direto no app de campo,
 *    o que cria uma O.S. mínima automaticamente
 */
import React, { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot, addDoc, deleteDoc, doc, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName, BacklogTarefa } from '../types';
import { ListTodo, Plus, Trash2, Loader2, CheckCircle2, ClipboardList, XCircle } from 'lucide-react';

interface Props {
  projectId: string;
  projectName?: string;
  clientId?: string;
  clientName?: string;
}

const STATUS_CFG: Record<BacklogTarefa['status'], { label: string; cls: string; icon: React.ReactNode }> = {
  backlog:  { label: 'No backlog',   cls: 'bg-gray-100 text-gray-600',       icon: <ListTodo size={11} /> },
  em_os:    { label: 'Em O.S.',      cls: 'bg-blue-100 text-blue-700',       icon: <ClipboardList size={11} /> },
  concluida:{ label: 'Concluída',    cls: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 size={11} /> },
};

export default function ProjectTaskBacklog({ projectId, projectName, clientId, clientName }: Props) {
  const { currentUser, userProfile } = useAuth();
  const [itens, setItens]       = useState<BacklogTarefa[]>([]);
  const [loading, setLoading]   = useState(true);
  const [novaDesc, setNovaDesc] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const q = query(collection(db, CollectionName.PROJECT_TASK_BACKLOG), where('projectId', '==', projectId));
    return onSnapshot(q, snap => {
      setItens(snap.docs.map(d => ({ id: d.id, ...d.data() } as BacklogTarefa)));
      setLoading(false);
    }, () => setLoading(false));
  }, [projectId]);

  const adicionar = async () => {
    if (!novaDesc.trim() || !currentUser) return;
    setSalvando(true);
    try {
      const nome = (userProfile as any)?.nomeCompleto || userProfile?.displayName || 'Gestor';
      await addDoc(collection(db, CollectionName.PROJECT_TASK_BACKLOG), {
        projectId, projectName: projectName || '', clientId: clientId || '', clientName: clientName || '',
        descricao: novaDesc.trim(),
        status: 'backlog',
        origem: 'planejada',
        criadoEm: Timestamp.now(),
        criadoPor: currentUser.uid,
        criadoPorNome: nome,
      });
      setNovaDesc('');
    } catch {
      alert('Erro ao adicionar tarefa ao backlog.');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id: string) => {
    if (!confirm('Remover esta tarefa do backlog?')) return;
    await deleteDoc(doc(db, CollectionName.PROJECT_TASK_BACKLOG, id)).catch(() => {});
  };

  const backlogPendente = itens.filter(i => i.status === 'backlog');
  const emOS            = itens.filter(i => i.status === 'em_os');
  const concluidas       = itens.filter(i => i.status === 'concluida');

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <ListTodo size={13} /> Hub de Tarefas do Projeto ({itens.length})
      </h3>

      {/* Adicionar nova tarefa ao backlog */}
      <div className="flex gap-2 mb-4">
        <input
          type="text" value={novaDesc} onChange={e => setNovaDesc(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && adicionar()}
          placeholder="Descrever nova tarefa para o backlog do projeto..."
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
        <button onClick={adicionar} disabled={!novaDesc.trim() || salvando}
          className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
          {salvando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Adicionar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
      ) : itens.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Nenhuma tarefa cadastrada no backlog ainda.</p>
      ) : (
        <div className="space-y-4">
          {backlogPendente.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Disponíveis para distribuir ({backlogPendente.length})</p>
              <div className="space-y-1.5">
                {backlogPendente.map(it => (
                  <div key={it.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                    <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_CFG[it.status].cls}`}>
                      {STATUS_CFG[it.status].icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{it.descricao}</p>
                      {it.origem === 'nao_concluida' && it.motivoNaoConclusao && (
                        <p className="text-[10px] text-red-500 flex items-center gap-1 mt-0.5">
                          <XCircle size={9} /> Retornou: {it.motivoNaoConclusao}
                        </p>
                      )}
                    </div>
                    <button onClick={() => remover(it.id)} className="p-1.5 rounded-lg hover:bg-red-50 flex-shrink-0">
                      <Trash2 size={13} className="text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {emOS.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Distribuídas em O.S. ({emOS.length})</p>
              <div className="space-y-1.5">
                {emOS.map(it => (
                  <div key={it.id} className="flex items-center gap-2 bg-blue-50/60 rounded-xl px-3 py-2">
                    <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_CFG[it.status].cls}`}>
                      {STATUS_CFG[it.status].icon}
                    </span>
                    <p className="text-sm text-gray-600 flex-1 truncate">{it.descricao}</p>
                    {it.executorNome && <span className="text-[10px] text-gray-400 flex-shrink-0">{it.executorNome}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {concluidas.length > 0 && (
            <details>
              <summary className="text-[10px] font-bold text-gray-400 uppercase cursor-pointer">Concluídas ({concluidas.length})</summary>
              <div className="space-y-1.5 mt-1.5">
                {concluidas.map(it => (
                  <div key={it.id} className="flex items-center gap-2 bg-emerald-50/60 rounded-xl px-3 py-2">
                    <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_CFG[it.status].cls}`}>
                      {STATUS_CFG[it.status].icon}
                    </span>
                    <p className="text-sm text-gray-500 line-through flex-1 truncate">{it.descricao}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
