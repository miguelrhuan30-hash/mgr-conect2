/**
 * FieldPontoAvisoOS — aviso bloqueante ao tentar encerrar o ponto do dia
 * com O.S. em andamento (responsável ou colaborador). Técnico precisa ir
 * resolver a O.S. (concluir/encerrar por hoje) ou pedir reagendamento —
 * não dá pra bater saída sem dar algum parecer sobre a O.S. em aberto.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CollectionName, REAGENDAMENTO_MOTIVOS } from '../../types';
import { OSField } from './FieldOS';
import { registrarAtividade } from '../../services/activityFeedService';
import { notificarVarios } from '../../services/notificationService';
import { AlertTriangle, ClipboardList, Calendar, Loader2, CheckCircle2, X } from 'lucide-react';

interface Props {
  osList: OSField[];
  resolvidas: Set<string>;
  onResolver: (osId: string) => void;
  onClose: () => void;
}

export default function FieldPontoAvisoOS({ osList, resolvidas, onResolver, onClose }: Props) {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [abrindoForm, setAbrindoForm] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);

  const irParaOS = () => {
    navigate('/campo/os');
    onClose();
  };

  const pedirReagendamento = async (os: OSField) => {
    if (!currentUser || !motivo.trim() || enviando) return;
    setEnviando(true);
    try {
      const nome = (userProfile as any)?.nomeCompleto || userProfile?.displayName || 'Técnico';
      registrarAtividade({
        tipo: 'os_pedido_reagendamento',
        autorId: currentUser.uid,
        autorNome: nome,
        titulo: `Pedido de reagendamento: ${os.title ?? 'O.S.'}`,
        descricao: `${motivo}${observacao.trim() ? ` — ${observacao.trim()}` : ''}`,
        osId: os.id,
        osNumero: os.numeroOS,
        osTitulo: os.title,
        clienteNome: os.clientName,
        meta: { motivo },
      });

      const usersSnap = await getDocs(collection(db, CollectionName.USERS));
      const destinatarios = usersSnap.docs
        .filter(d => {
          const u: any = d.data();
          return ['admin', 'gestor', 'manager', 'developer'].includes(u.role || '') || u.permissions?.canViewFeed === true;
        })
        .map(d => d.id);
      notificarVarios(destinatarios, {
        tipo: 'os_pedido_reagendamento',
        canal: 'os',
        titulo: '📅 Pedido de reagendamento',
        corpo: `${nome} pediu reagendamento de "${os.title}" ao encerrar o ponto — ${motivo}`,
        som: true,
        prioridade: 'alta',
        osId: os.id,
        rota: '/app/pipeline',
      });

      onResolver(os.id);
      setAbrindoForm(null);
      setMotivo('');
      setObservacao('');
    } catch {
      alert('Erro ao enviar o pedido de reagendamento. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  const pendentes = osList.filter(os => !resolvidas.has(os.id));
  const todasResolvidas = pendentes.length === 0;

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-gray-950 w-full sm:max-w-md sm:rounded-2xl flex flex-col shadow-2xl" style={{ maxHeight: '85vh' }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-red-950/40">
          <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">O.S. em andamento</p>
            <p className="text-[11px] text-gray-400">Encerre a O.S. ou peça reagendamento antes de bater saída</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-300">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {osList.map(os => {
            const jaResolvida = resolvidas.has(os.id);
            return (
              <div key={os.id} className={`rounded-xl border p-3 ${jaResolvida ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-gray-900 border-gray-800'}`}>
                <div className="flex items-start gap-2">
                  <ClipboardList size={14} className={`flex-shrink-0 mt-0.5 ${jaResolvida ? 'text-emerald-400' : 'text-gray-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white leading-snug">{os.title ?? 'Sem título'}</p>
                    {os.clientName && <p className="text-xs text-gray-500 mt-0.5">{os.clientName}</p>}
                  </div>
                </div>

                {jaResolvida ? (
                  <p className="mt-2 text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Reagendamento solicitado
                  </p>
                ) : abrindoForm === os.id ? (
                  <div className="mt-2.5 space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Motivo</label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {REAGENDAMENTO_MOTIVOS.map(m => (
                        <button
                          key={m}
                          onClick={() => setMotivo(m)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors ${
                            motivo === m ? 'border-red-500 bg-red-500/10 text-red-300' : 'border-gray-700 bg-gray-800 text-gray-300'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={observacao}
                      onChange={e => setObservacao(e.target.value)}
                      placeholder="Detalhe (opcional)..."
                      rows={2}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-xs text-white placeholder-gray-600 resize-none focus:outline-none focus:border-red-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => pedirReagendamento(os)}
                        disabled={!motivo.trim() || enviando}
                        className="flex-1 py-2 bg-red-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {enviando ? <Loader2 size={12} className="animate-spin" /> : <Calendar size={12} />}
                        Enviar pedido
                      </button>
                      <button
                        onClick={() => { setAbrindoForm(null); setMotivo(''); setObservacao(''); }}
                        className="px-3 py-2 bg-gray-800 text-gray-400 rounded-lg text-xs font-bold"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2.5 flex gap-2">
                    <button
                      onClick={irParaOS}
                      className="flex-1 py-2 bg-emerald-600/90 text-white rounded-lg text-xs font-bold active:bg-emerald-700"
                    >
                      Ir para O.S.
                    </button>
                    <button
                      onClick={() => setAbrindoForm(os.id)}
                      className="flex-1 py-2 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg text-xs font-bold active:bg-gray-700"
                    >
                      Pedir reagendamento
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-gray-800">
          <button
            onClick={onClose}
            className={`w-full py-3 rounded-xl text-sm font-bold ${
              todasResolvidas ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {todasResolvidas ? 'Tudo certo — tentar encerrar ponto de novo' : 'Fechar (resolver depois)'}
          </button>
        </div>
      </div>
    </div>
  );
}
