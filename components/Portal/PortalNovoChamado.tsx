/**
 * components/Portal/PortalNovoChamado.tsx
 * Formulário do cliente para abrir um chamado de contrato SLA.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CollectionName, ContratoSLA, PrioridadeSLA, TipoChamadoSLA, TIPO_CHAMADO_LABEL } from '../../types';
import { ArrowLeft, Loader2, Send, AlertTriangle, Camera, X } from 'lucide-react';

const PRIORIDADES: { valor: PrioridadeSLA; label: string; desc: string; cor: string }[] = [
  { valor: 'P1', label: 'P1 — Crítico', desc: 'Parada total, risco imediato', cor: 'border-red-300 bg-red-50 text-red-700' },
  { valor: 'P2', label: 'P2 — Urgente', desc: 'Impacto alto, sem parada total', cor: 'border-orange-300 bg-orange-50 text-orange-700' },
  { valor: 'P3', label: 'P3 — Moderado', desc: 'Impacto parcial', cor: 'border-amber-300 bg-amber-50 text-amber-700' },
  { valor: 'P4', label: 'P4 — Baixo', desc: 'Sem urgência', cor: 'border-gray-300 bg-gray-50 text-gray-600' },
];

const TIPOS: TipoChamadoSLA[] = ['falha_parada', 'manutencao_preventiva', 'duvida_tecnica', 'solicitacao_visita', 'outro'];

export default function PortalNovoChamado() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const clientId = (userProfile as any)?.clientId as string | undefined;

  const [contratos, setContratos] = useState<ContratoSLA[]>([]);
  const [contratoSlaId, setContratoSlaId] = useState('');
  const [loadingContratos, setLoadingContratos] = useState(true);

  const [ativos, setAtivos] = useState<{ id: string; nome: string }[]>([]);
  const [ativoId, setAtivoId] = useState('');

  const [tipo, setTipo] = useState<TipoChamadoSLA>('falha_parada');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<PrioridadeSLA>('P3');
  const [fotos, setFotos] = useState<string[]>([]);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if ((userProfile as any)?.podeAbrirChamado === false) navigate('/portal', { replace: true });
  }, [userProfile, navigate]);

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

  useEffect(() => {
    if (!clientId) return;
    getDocs(query(collection(db, CollectionName.ASSETS), where('clientId', '==', clientId)))
      .then(snap => setAtivos(snap.docs.map(d => ({ id: d.id, nome: (d.data() as any).nome || d.id }))))
      .catch(() => setAtivos([]));
  }, [clientId]);

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clientId) return;
    setUploadingFoto(true);
    try {
      const path = `chamados_sla/${clientId}/${Date.now()}_${file.name}`;
      const snap = await uploadBytes(ref(storage, path), file);
      const url = await getDownloadURL(snap.ref);
      setFotos(prev => [...prev, url]);
    } finally {
      setUploadingFoto(false);
      e.target.value = '';
    }
  };

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
      const ativoSelecionado = ativos.find(a => a.id === ativoId);
      await addDoc(collection(db, CollectionName.CHAMADOS_SLA), {
        clientId,
        clientName: (userProfile as any)?.clientName || '',
        contratoSlaId: contratoSlaId || contratos[0]?.id || null,
        criadoPorUid: userProfile!.uid,
        criadoPorNome: nomeCliente,
        tipo,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        prioridade,
        ...(typeof prazoHoras === 'number' ? {
          prazoSlaLimite: Timestamp.fromDate(new Date(Date.now() + prazoHoras * 3600 * 1000)),
        } : {}),
        ...(ativoId ? { ativoId, ativoNome: ativoSelecionado?.nome || '' } : {}),
        ...(fotos.length ? { fotos } : {}),
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
        <label className="text-xs font-bold text-gray-500 mb-1 block">Tipo de chamado</label>
        <select value={tipo} onChange={e => setTipo(e.target.value as TipoChamadoSLA)}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white">
          {TIPOS.map(t => <option key={t} value={t}>{TIPO_CHAMADO_LABEL[t]}</option>)}
        </select>
      </div>

      {ativos.length > 0 && (
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1 block">Qual equipamento? (opcional)</label>
          <select value={ativoId} onChange={e => setAtivoId(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white">
            <option value="">Não sei / não se aplica</option>
            {ativos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
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
        <label className="text-xs font-bold text-gray-500 mb-1 block">Fotos (opcional)</label>
        <div className="flex items-center gap-2 flex-wrap">
          {fotos.map((url, i) => (
            <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setFotos(prev => prev.filter((_, j) => j !== i))}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center">
                <X className="w-2.5 h-2.5 text-white" />
              </button>
            </div>
          ))}
          <label className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer text-gray-400 hover:border-brand-300 hover:text-brand-500">
            {uploadingFoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            <input type="file" accept="image/*" capture="environment" onChange={handleFotoUpload} disabled={uploadingFoto} className="hidden" />
          </label>
        </div>
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
