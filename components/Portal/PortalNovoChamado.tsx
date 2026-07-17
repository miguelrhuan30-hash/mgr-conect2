/**
 * components/Portal/PortalNovoChamado.tsx
 * Formulário do cliente para abrir um chamado de contrato SLA.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CollectionName, ContratoSLA, PrioridadeSLA } from '../../types';
import { ArrowLeft, Loader2, Send, AlertTriangle } from 'lucide-react';

const PRIORIDADES: { valor: PrioridadeSLA; label: string; desc: string; cor: string }[] = [
  { valor: 'P1', label: 'P1 — Crítico', desc: 'Parada total, risco imediato', cor: 'border-red-300 bg-red-50 text-red-700' },
  { valor: 'P2', label: 'P2 — Urgente', desc: 'Impacto alto, sem parada total', cor: 'border-orange-300 bg-orange-50 text-orange-700' },
  { valor: 'P3', label: 'P3 — Moderado', desc: 'Impacto parcial', cor: 'border-amber-300 bg-amber-50 text-amber-700' },
  { valor: 'P4', label: 'P4 — Baixo', desc: 'Sem urgência', cor: 'border-gray-300 bg-gray-50 text-gray-600' },
];

export default function PortalNovoChamado() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const clientId = (userProfile as any)?.clientId as string | undefined;

  const [contratos, setContratos] = useState<ContratoSLA[]>([]);
  const [contratoSlaId, setContratoSlaId] = useState('');
  const [loadingContratos, setLoadingContratos] = useState(true);

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<PrioridadeSLA>('P3');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!clientId) { setLoadingContratos(false); return; }
    (async () => {
      const q = query(
        collection(db, CollectionName.CONTRATOS_SLA),
        where('clientId', '==', clientId),
        where('status', '==', 'ativo'),
      );
      const snap = await getDocs(q);
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() } as ContratoSLA));
      setContratos(lista);
      if (lista.length === 1) setContratoSlaId(lista[0].id);
      setLoadingContratos(false);
    })();
  }, [clientId]);

  const contratoSelecionado = contratos.find(c => c.id === contratoSlaId);
  const prazoHoras = contratoSelecionado?.prazosPrioridade?.[prioridade];

  const handleSubmit = async () => {
    setErro('');
    if (!clientId) { setErro('Seu usuário não está vinculado a um cliente.'); return; }
    if (!titulo.trim()) { setErro('Informe um título para o chamado.'); return; }
    if (!descricao.trim()) { setErro('Descreva o problema.'); return; }
    if (contratos.length > 1 && !contratoSlaId) { setErro('Selecione o contrato relacionado.'); return; }

    setSaving(true);
    try {
      const nomeCliente = userProfile!.nomeCompleto || userProfile!.displayName || 'Cliente';
      await addDoc(collection(db, CollectionName.CHAMADOS_SLA), {
        clientId,
        clientName: (userProfile as any)?.clientName || '',
        contratoSlaId: contratoSlaId || contratos[0]?.id || null,
        criadoPorUid: userProfile!.uid,
        criadoPorNome: nomeCliente,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        prioridade,
        status: 'aberto',
        createdAt: serverTimestamp(),
      });
      // Notificação aos gestores é disparada server-side (Cloud Function
      // `notificarGestoresNovoChamadoSla`) — o cliente não tem permissão de
      // leitura ampla sobre `users` para montar a lista de destinatários.
      navigate('/portal');
    } catch (err: any) {
      setErro(err?.message || 'Erro ao abrir chamado.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/portal')} className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-600">
        <ArrowLeft className="w-3.5 h-3.5" /> Voltar
      </button>
      <h1 className="text-lg font-extrabold text-gray-900">Novo Chamado</h1>

      {!loadingContratos && contratos.length === 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          Não encontramos um contrato ativo vinculado ao seu cadastro. Entre em contato com a MGR antes de abrir o chamado.
        </div>
      )}

      {contratos.length > 1 && (
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1 block">Contrato</label>
          <select value={contratoSlaId} onChange={e => setContratoSlaId(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white">
            <option value="">Selecione...</option>
            {contratos.map(c => (
              <option key={c.id} value={c.id}>{c.identificador || `Contrato ${c.id.slice(0, 6)}`}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="text-xs font-bold text-gray-500 mb-1 block">Título</label>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Ar-condicionado sem gelar"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl" />
      </div>

      <div>
        <label className="text-xs font-bold text-gray-500 mb-1 block">Descrição</label>
        <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={4}
          placeholder="Descreva o problema com o máximo de detalhes possível"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none" />
      </div>

      <div>
        <label className="text-xs font-bold text-gray-500 mb-1.5 block">Prioridade</label>
        <div className="grid grid-cols-2 gap-2">
          {PRIORIDADES.map(p => (
            <button key={p.valor} type="button" onClick={() => setPrioridade(p.valor)}
              className={`text-left p-2.5 rounded-xl border-2 transition-colors ${prioridade === p.valor ? p.cor : 'border-gray-100 bg-white text-gray-400'}`}>
              <p className="text-xs font-extrabold">{p.label}</p>
              <p className="text-[10px] opacity-80">{p.desc}</p>
            </button>
          ))}
        </div>
        {typeof prazoHoras === 'number' && (
          <p className="text-[11px] text-gray-400 mt-2">Prazo de resposta contratual para {prioridade}: <strong>{prazoHoras}h</strong></p>
        )}
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <button onClick={handleSubmit} disabled={saving || contratos.length === 0}
        className="w-full py-3 bg-brand-600 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Enviar Chamado
      </button>
    </div>
  );
}
