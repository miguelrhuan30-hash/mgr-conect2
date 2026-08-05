/**
 * components/Portal/PortalNovoChamado.tsx
 * Formulário do cliente para abrir um chamado de contrato SLA.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, query, where, getDocs, getDoc, doc, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CollectionName, ContratoSLA, FleetVehicle, PrioridadeSLA, TipoChamadoSLA, TIPO_CHAMADO_LABEL } from '../../types';
import { ArrowLeft, Loader2, Send, AlertTriangle, Camera, X, QrCode, Truck } from 'lucide-react';
import EquipamentoScanModal, { EquipamentoResolvido } from '../EquipamentoScanModal';

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
  const [searchParams] = useSearchParams();
  const clientId = (userProfile as any)?.clientId as string | undefined;

  // Origem Frota — veio da tela de Manutenção (veículo com contrato ativo,
  // "Abrir Chamado" é o único caminho pra reportar necessidade). Mutuamente
  // exclusivo com o seletor de ativo de câmaras frias abaixo.
  const veiculoIdParam = searchParams.get('veiculoId') || '';
  const [veiculo, setVeiculo] = useState<FleetVehicle | null>(null);
  useEffect(() => {
    if (!veiculoIdParam) { setVeiculo(null); return; }
    getDoc(doc(db, CollectionName.FLEET_VEHICLES, veiculoIdParam))
      .then(snap => setVeiculo(snap.exists() ? ({ id: snap.id, ...snap.data() } as FleetVehicle) : null))
      .catch(() => setVeiculo(null));
  }, [veiculoIdParam]);

  const [contratos, setContratos] = useState<ContratoSLA[]>([]);
  const [contratoSlaId, setContratoSlaId] = useState('');
  const [loadingContratos, setLoadingContratos] = useState(true);

  useEffect(() => {
    if (veiculo?.contratoId) setContratoSlaId(veiculo.contratoId);
  }, [veiculo]);

  const [ativos, setAtivos] = useState<{ id: string; nome: string }[]>([]);
  const [maquinarios, setMaquinarios] = useState<{ id: string; nome: string; ativosFinaisAtendidos: string[] }[]>([]);
  const [ativoId, setAtivoId] = useState(''); // guarda o id escolhido, seja de um Ativo Final ou de um Maquinário
  const [mostrarScan, setMostrarScan] = useState(false);

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
    getDocs(query(collection(db, CollectionName.MAQUINARIOS), where('clientId', '==', clientId)))
      .then(snap => setMaquinarios(snap.docs.map(d => ({
        id: d.id, nome: (d.data() as any).nome || d.id, ativosFinaisAtendidos: (d.data() as any).ativosFinaisAtendidos || [],
      }))))
      .catch(() => setMaquinarios([]));
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

  const handleEquipamentoResolvido = (equip: EquipamentoResolvido) => {
    setMostrarScan(false);
    setAtivoId(equip.id);
    if (equip.tipo === 'ativo') {
      setAtivos(prev => prev.some(a => a.id === equip.id) ? prev : [...prev, { id: equip.id, nome: equip.nome }]);
    } else {
      setMaquinarios(prev => prev.some(m => m.id === equip.id) ? prev : [...prev, {
        id: equip.id, nome: equip.nome, ativosFinaisAtendidos: (equip.ativosVinculados || []).map(v => v.id),
      }]);
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
      const maquinarioSelecionado = maquinarios.find(m => m.id === ativoId);
      const ativoPaiDoMaquinario = maquinarioSelecionado
        ? ativos.find(a => a.id === maquinarioSelecionado.ativosFinaisAtendidos[0])
        : undefined;
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
        ...(veiculo ? { veiculoId: veiculo.id, veiculoPlaca: veiculo.placa, origemAtivoTipo: 'frota' } :
            maquinarioSelecionado ? {
              maquinarioId: maquinarioSelecionado.id,
              maquinarioNome: maquinarioSelecionado.nome,
              ...(ativoPaiDoMaquinario ? { ativoId: ativoPaiDoMaquinario.id, ativoNome: ativoPaiDoMaquinario.nome } : {}),
            } :
            ativoId ? { ativoId, ativoNome: ativoSelecionado?.nome || '' } : {}),
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

      {veiculo && (
        <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-800">
          <Truck className="w-4 h-4 shrink-0" />
          Chamado pro veículo <strong>{veiculo.placa}</strong> ({veiculo.marca} {veiculo.modelo}) — coberto por contrato de frota.
        </div>
      )}

      {!veiculo && contratos.length > 1 && (
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

      {!veiculo && (
      <div>
        <label className="text-xs font-bold text-gray-500 mb-1 block">Qual equipamento? (opcional)</label>
        <div className="flex gap-2">
          {(ativos.length > 0 || maquinarios.length > 0) ? (
            <select value={ativoId} onChange={e => setAtivoId(e.target.value)}
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white">
              <option value="">Não sei / não se aplica</option>
              {ativos.length > 0 && (
                <optgroup label="Ativos Finais">
                  {ativos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </optgroup>
              )}
              {maquinarios.length > 0 && (
                <optgroup label="Equipamentos / Peças">
                  {maquinarios.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </optgroup>
              )}
            </select>
          ) : (
            <p className="flex-1 text-xs text-gray-400 self-center">Nenhum equipamento cadastrado ainda.</p>
          )}
          <button type="button" onClick={() => setMostrarScan(true)}
            title="Ler QR Code ou digitar código do equipamento"
            className="shrink-0 w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:text-brand-600 hover:border-brand-300">
            <QrCode className="w-4 h-4" />
          </button>
        </div>
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

      {mostrarScan && (
        <EquipamentoScanModal
          escopoClientId={clientId}
          titulo="Qual equipamento?"
          onResolve={handleEquipamentoResolvido}
          onClose={() => setMostrarScan(false)}
        />
      )}
    </div>
  );
}
