/**
 * components/ProjectProposta.tsx
 *
 * Módulo completo de Proposta Comercial — fluxo inline no Flow de Atendimento:
 *  1. Valores auto-calculados (materiais das cotações selecionadas + MO do plano de execução)
 *  2. Formulário da proposta (condições, prazo, validade, observações ao cliente)
 *  3. Geração de mensagem WhatsApp formatada com todos os dados
 *  4. Vinculação opcional a apresentação do módulo de Apresentações
 *  5. Status: rascunho → enviado → aprovado | revisão
 *  6. Aprovação: avança para Contrato
 *  7. Revisão: volta para Cotação ou Prancheta para ajustes
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Save, Check, Loader2, Send, Copy, ExternalLink, Link2,
  MessageCircle, ArrowRight, ArrowLeft, RefreshCw, AlertCircle,
  DollarSign, Calendar, FileText, ChevronDown, ChevronUp,
  Plus, History, X,
} from 'lucide-react';
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, arrayUnion, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useProject } from '../hooks/useProject';
import { useProjectCotacao } from '../hooks/useProjectCotacao';
import {
  CollectionName, ProjectV2, ProjectPhase,
  PropostaDados, PropostaStatus, ProjectV2PropostaVersao,
} from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  project: ProjectV2;
  // Legacy callbacks do ProjectDetail (mantidos para compatibilidade, não usados no inline)
  onSinalizarEnviado?: () => Promise<void>;
  onConverterProposta?: () => Promise<void>;
}

interface Apresentacao {
  id: string;
  title?: string;
  nome?: string;
  slug?: string;
  clienteNome?: string;
  updatedAt?: Timestamp;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const fmtCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return format(d, "dd/MM/yy 'às' HH:mm", { locale: ptBR });
  } catch { return '—'; }
};

const fmtDateBr = (iso: string) => {
  try { return format(new Date(iso + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }); }
  catch { return iso; }
};

const STATUS_CONFIG: Record<PropostaStatus, { label: string; color: string; dot: string }> = {
  rascunho: { label: 'Rascunho',             color: 'bg-gray-100 text-gray-600 border-gray-200',       dot: 'bg-gray-400'    },
  enviado:  { label: 'Enviado ao Cliente',   color: 'bg-blue-100 text-blue-700 border-blue-200',       dot: 'bg-blue-500'    },
  aprovado: { label: 'Aprovado ✓',           color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  revisao:  { label: 'Revisão Solicitada',   color: 'bg-amber-100 text-amber-700 border-amber-200',    dot: 'bg-amber-500'   },
};

// ── Componente Principal ──────────────────────────────────────────────────────
const ProjectProposta: React.FC<Props> = ({ project }) => {
  const { projects, advancePhase, updateProject } = useProject();
  const { cotacoes } = useProjectCotacao(project.id);

  // ── Valores auto-calculados da prancheta + cotações ──
  const totalMateriaisAuto = useMemo(
    () => cotacoes.filter(c => c.selecionada).reduce((s, c) => s + c.valorTotal, 0),
    [cotacoes],
  );
  const totalMdoAuto = useMemo(
    () => (project.prancheta?.servicosExecucao || []).reduce(
      (s, srv) => s + (srv.valorMaoDeObra || 0), 0,
    ),
    [project.prancheta?.servicosExecucao],
  );
  const totalDiasAuto = useMemo(
    () => (project.prancheta?.servicosExecucao || []).reduce(
      (s, srv) => s + srv.fases.reduce((a, f) => a + (f.diasExecucao || 0), 0), 0,
    ),
    [project.prancheta?.servicosExecucao],
  );

  // ── Estado do formulário — pré-preenchido com dados salvos ou auto-calculados ──
  const [dados, setDados] = useState<PropostaDados>({
    valorMateriais: 0,
    valorMaoDeObra: 0,
    desconto: 0,
    valorTotal: 0,
    condicoesPagamento: '',
    prazoExecucao: '',
    validadeAte: '',
    observacoesCliente: '',
    status: 'rascunho',
    ...project.propostaDados,
  });

  // Preenche com auto-valores quando carregam (apenas se não houver dados salvos)
  useEffect(() => {
    if (!project.propostaDados && (totalMateriaisAuto > 0 || totalMdoAuto > 0)) {
      setDados(prev => ({
        ...prev,
        valorMateriais: totalMateriaisAuto,
        valorMaoDeObra: totalMdoAuto,
        valorTotal: totalMateriaisAuto + totalMdoAuto,
        prazoExecucao: totalDiasAuto > 0 ? `${totalDiasAuto} dias corridos` : prev.prazoExecucao,
      }));
    }
  }, [totalMateriaisAuto, totalMdoAuto, totalDiasAuto, project.propostaDados]);

  const calcTotal = (mat: number, mdo: number, desc: number) =>
    Math.round((mat + mdo) * (1 - (desc || 0) / 100) * 100) / 100;

  const updateDados = (field: keyof PropostaDados, value: any) => {
    setDados(prev => {
      const next = { ...prev, [field]: value };
      if (['valorMateriais', 'valorMaoDeObra', 'desconto'].includes(field as string)) {
        next.valorTotal = calcTotal(
          Number(next.valorMateriais || 0),
          Number(next.valorMaoDeObra || 0),
          Number(next.desconto || 0),
        );
      }
      return next;
    });
    setSavedLocal(false);
  };

  // ── UI state ──────────────────────────────────────────────────────────────
  const [savedLocal, setSavedLocal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [secaoValores, setSecaoValores] = useState(true);
  const [secaoEnvio, setSecaoEnvio] = useState(true);
  const [secaoApresentacao, setSecaoApresentacao] = useState(false);
  const [copied, setCopied] = useState(false);
  const [avancandoContrato, setAvancandoContrato] = useState(false);
  const [contratoAvancado, setContratoAvancado] = useState(false);
  const [voltando, setVoltando] = useState(false);
  const [showVoltarOpcoes, setShowVoltarOpcoes] = useState(false);
  const [revisaoMotivo, setRevisaoMotivo] = useState('');
  const [telefoneWa, setTelefoneWa] = useState(
    (project.leadData?.telefone || '').replace(/\D/g, ''),
  );

  // Apresentações (carregadas ao abrir a seção)
  const [apresentacoes, setApresentacoes] = useState<Apresentacao[]>([]);
  const [loadingApres, setLoadingApres] = useState(false);
  const [selectedApresId, setSelectedApresId] = useState(project.apresentacaoId || '');
  const [savingApres, setSavingApres] = useState(false);
  const [apResSaved, setApResSaved] = useState(false);

  useEffect(() => {
    if (!secaoApresentacao) return;
    setLoadingApres(true);
    const q = query(collection(db, CollectionName.PRESENTATIONS), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setApresentacoes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Apresentacao)));
      setLoadingApres(false);
    }, () => setLoadingApres(false));
    return () => unsub();
  }, [secaoApresentacao]);

  const apresentacaoVinculada = apresentacoes.find(
    a => a.id === (project.apresentacaoId || selectedApresId),
  );
  const linkApresentacao = apresentacaoVinculada?.slug
    ? `${window.location.origin}/#/apresentacao/${apresentacaoVinculada.slug}`
    : apresentacaoVinculada
    ? `${window.location.origin}/#/apresentacao/${apresentacaoVinculada.id}`
    : null;

  const versoes: ProjectV2PropostaVersao[] = project.propostaVersoes || [];

  // Fase atual via onSnapshot (projects sempre atualizado)
  const projectAtual = projects?.find(p => p.id === project.id);
  const faseAtual = projectAtual?.fase || project.fase;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProject(project.id, { propostaDados: dados } as any);
      setSavedLocal(true);
    } finally { setSaving(false); }
  };

  const generateMessage = () => {
    const servicos = project.prancheta?.servicosExecucao || [];
    const linhas: string[] = [
      `Olá${project.clientName ? `, *${project.clientName}*` : ''}! 👋`,
      '',
      `Segue a proposta comercial para o seu projeto *${project.nome}*:`,
      '',
    ];

    if (servicos.length > 0) {
      linhas.push('🔧 *Serviços previstos:*');
      servicos.forEach((srv, i) => {
        const dias = srv.fases.reduce((a, f) => a + (f.diasExecucao || 0), 0);
        linhas.push(`  ${i + 1}. ${srv.nome}${dias > 0 ? ` — ${dias} dia${dias !== 1 ? 's' : ''}` : ''}`);
      });
      linhas.push('');
    }

    linhas.push('💰 *Resumo financeiro:*');
    if (dados.valorMateriais && dados.valorMateriais > 0)
      linhas.push(`  • Materiais: ${fmtCurrency(dados.valorMateriais)}`);
    if (dados.valorMaoDeObra && dados.valorMaoDeObra > 0)
      linhas.push(`  • Mão de obra: ${fmtCurrency(dados.valorMaoDeObra)}`);
    if (dados.desconto && dados.desconto > 0)
      linhas.push(`  • Desconto aplicado: ${dados.desconto}%`);
    linhas.push(`  • *Total: ${fmtCurrency(dados.valorTotal || 0)}*`);
    linhas.push('');

    if (dados.condicoesPagamento)
      linhas.push(`💳 *Condições de pagamento:* ${dados.condicoesPagamento}`);
    if (dados.prazoExecucao)
      linhas.push(`📅 *Prazo de execução:* ${dados.prazoExecucao}`);
    if (dados.validadeAte)
      linhas.push(`⏰ *Validade da proposta:* ${fmtDateBr(dados.validadeAte)}`);

    if (dados.observacoesCliente?.trim()) {
      linhas.push('');
      linhas.push(`📋 *Observações:*`);
      linhas.push(dados.observacoesCliente.trim());
    }

    if (linkApresentacao) {
      linhas.push('');
      linhas.push(`🎨 *Apresentação completa:* ${linkApresentacao}`);
    }

    linhas.push('');
    linhas.push('Aguardamos sua aprovação. Qualquer dúvida, estou à disposição! 🙏');
    return linhas.join('\n');
  };

  const handleEnviarWhatsApp = async () => {
    const msg = generateMessage();
    const tel = telefoneWa.replace(/\D/g, '');
    const url = tel
      ? `https://wa.me/${tel.startsWith('55') ? tel : '55' + tel}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');

    const novoDados: PropostaDados = {
      ...dados,
      status: 'enviado',
      enviadoEm: Timestamp.now() as any,
    };
    setDados(novoDados);
    await updateProject(project.id, { propostaDados: novoDados } as any);
    setSavedLocal(true);
  };

  const handleCopyMessage = async () => {
    await navigator.clipboard.writeText(generateMessage());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleVincularApres = async () => {
    if (!selectedApresId) return;
    setSavingApres(true);
    try {
      const apres = apresentacoes.find(a => a.id === selectedApresId);
      const novaVersao: ProjectV2PropostaVersao = {
        versao: versoes.length + 1,
        apresentacaoId: selectedApresId,
        slug: apres?.slug || undefined,
        criadaEm: Timestamp.now(),
      };
      await updateDoc(doc(db, CollectionName.PROJECTS_V2, project.id), {
        apresentacaoId: selectedApresId,
        propostaVersoes: arrayUnion(novaVersao),
        updatedAt: serverTimestamp(),
      });
      setApResSaved(true);
      setTimeout(() => setApResSaved(false), 3000);
    } finally { setSavingApres(false); }
  };

  const handleAvançarContrato = async () => {
    if (!window.confirm('Confirmar aprovação do cliente? O projeto avançará para a fase de Contrato.')) return;
    setAvancandoContrato(true);
    try {
      const novoDados: PropostaDados = {
        ...dados,
        status: 'aprovado',
        aprovadoEm: Timestamp.now() as any,
      };
      await updateProject(project.id, { propostaDados: novoDados } as any);
      setDados(novoDados);

      const result = await advancePhase(
        project.id,
        'contrato_enviado',
        'Proposta aprovada pelo cliente — avançando para Contrato',
      );
      if (!result.success) {
        alert(`Não foi possível avançar: ${result.error || 'Erro desconhecido'}`);
        return;
      }
      setContratoAvancado(true);
    } catch (err: any) { alert(`Erro: ${err?.message || String(err)}`); }
    finally { setAvancandoContrato(false); }
  };

  const handleVoltar = async (fase: ProjectPhase) => {
    if (!revisaoMotivo.trim()) {
      alert('Descreva brevemente o que o cliente pediu para ajustar.');
      return;
    }
    setVoltando(true);
    try {
      const novoDados: PropostaDados = {
        ...dados,
        status: 'revisao',
        revisaoMotivo,
      };
      await updateProject(project.id, { propostaDados: novoDados } as any);
      setDados(novoDados);

      const label = fase === 'cotacao_recebida' ? 'Cotação' : 'Prancheta';
      const result = await advancePhase(
        project.id,
        fase,
        `Revisão solicitada pelo cliente — retornando para ${label}: ${revisaoMotivo}`,
      );
      if (!result.success) alert(`Erro ao retornar: ${result.error}`);
    } catch (err: any) { alert(`Erro: ${err?.message || String(err)}`); }
    finally { setVoltando(false); setShowVoltarOpcoes(false); }
  };

  const statusCfg = STATUS_CONFIG[dados.status || 'rascunho'];

  // ── Confirmação final ──────────────────────────────────────────────────────
  if (contratoAvancado) {
    return (
      <div className="rounded-2xl p-6 bg-emerald-50 border border-emerald-300 flex items-center gap-4">
        <Check className="w-8 h-8 text-emerald-600 flex-shrink-0" />
        <div>
          <p className="text-base font-extrabold text-emerald-800">🎉 Proposta aprovada! Projeto avançado para Contrato.</p>
          <p className="text-sm text-emerald-600 mt-1">Acesse a fase de Contrato para gerar e enviar o contrato ao cliente.</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm py-2 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-extrabold text-gray-900 flex items-center gap-2 text-base">
            🎨 Proposta Comercial
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">{project.nome} · {project.clientName}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${statusCfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusCfg.dot}`} />
            {statusCfg.label}
          </span>
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              savedLocal ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-brand-600 text-white hover:bg-brand-700'
            }`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" />
              : savedLocal ? <Check className="w-4 h-4" />
              : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : savedLocal ? 'Salvo ✓' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* ── Banner de revisão ── */}
      {dados.status === 'revisao' && dados.revisaoMotivo && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 flex items-start gap-3">
          <RefreshCw className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">Proposta em revisão</p>
            <p className="text-xs text-amber-700 mt-0.5">{dados.revisaoMotivo}</p>
          </div>
        </div>
      )}

      {/* ══ SEÇÃO 1: Valores e Condições ══ */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button onClick={() => setSecaoValores(!secaoValores)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <span className="text-sm font-bold text-gray-800">Valores e Condições da Proposta</span>
            {(dados.valorTotal ?? 0) > 0 && (
              <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">
                {fmtCurrency(dados.valorTotal!)}
              </span>
            )}
          </div>
          {secaoValores ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {secaoValores && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">

            {/* Banner auto-valores */}
            {(totalMateriaisAuto > 0 || totalMdoAuto > 0) && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <RefreshCw className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <div className="text-xs text-blue-700 flex-1">
                  <strong>Importado automaticamente das fases anteriores:</strong>
                  {totalMateriaisAuto > 0 && <span className="ml-2">Materiais: <strong>{fmtCurrency(totalMateriaisAuto)}</strong></span>}
                  {totalMdoAuto > 0 && <span className="ml-2">· Mão de obra: <strong>{fmtCurrency(totalMdoAuto)}</strong></span>}
                  {totalDiasAuto > 0 && <span className="ml-2">· <strong>{totalDiasAuto} dias</strong></span>}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Materiais */}
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">
                  Valor Materiais (R$)
                  {totalMateriaisAuto > 0 && (
                    <button onClick={() => updateDados('valorMateriais', totalMateriaisAuto)}
                      className="ml-2 text-[9px] text-blue-600 font-bold hover:underline">
                      ↺ usar auto ({fmtCurrency(totalMateriaisAuto)})
                    </button>
                  )}
                </label>
                <input type="number" min={0} step={100}
                  value={dados.valorMateriais || ''}
                  onChange={e => updateDados('valorMateriais', Number(e.target.value))}
                  placeholder="0,00"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400" />
              </div>

              {/* Mão de obra */}
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">
                  Valor Mão de Obra (R$)
                  {totalMdoAuto > 0 && (
                    <button onClick={() => updateDados('valorMaoDeObra', totalMdoAuto)}
                      className="ml-2 text-[9px] text-blue-600 font-bold hover:underline">
                      ↺ usar auto ({fmtCurrency(totalMdoAuto)})
                    </button>
                  )}
                </label>
                <input type="number" min={0} step={100}
                  value={dados.valorMaoDeObra || ''}
                  onChange={e => updateDados('valorMaoDeObra', Number(e.target.value))}
                  placeholder="0,00"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400" />
              </div>

              {/* Desconto */}
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">Desconto (%)</label>
                <input type="number" min={0} max={100} step={1}
                  value={dados.desconto || ''}
                  onChange={e => updateDados('desconto', Number(e.target.value))}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400" />
              </div>

              {/* Total */}
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">Valor Total da Proposta</label>
                <div className="w-full border-2 border-emerald-300 rounded-xl px-3 py-2.5 text-base font-extrabold text-emerald-700 bg-emerald-50">
                  {fmtCurrency(dados.valorTotal || 0)}
                </div>
              </div>

              {/* Condições */}
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">Condições de Pagamento</label>
                <input
                  value={dados.condicoesPagamento || ''}
                  onChange={e => updateDados('condicoesPagamento', e.target.value)}
                  placeholder="Ex: 30% na assinatura, 70% na conclusão"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400" />
              </div>

              {/* Prazo */}
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">
                  Prazo de Execução
                  {totalDiasAuto > 0 && (
                    <button onClick={() => updateDados('prazoExecucao', `${totalDiasAuto} dias corridos`)}
                      className="ml-2 text-[9px] text-blue-600 font-bold hover:underline">
                      ↺ usar auto ({totalDiasAuto} dias)
                    </button>
                  )}
                </label>
                <input
                  value={dados.prazoExecucao || ''}
                  onChange={e => updateDados('prazoExecucao', e.target.value)}
                  placeholder="Ex: 23 dias corridos após aprovação"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400" />
              </div>

              {/* Validade */}
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">Validade da Proposta</label>
                <input type="date"
                  value={dados.validadeAte || ''}
                  onChange={e => updateDados('validadeAte', e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400" />
              </div>

              {/* Observações */}
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-600 block mb-1.5">Observações para o Cliente</label>
                <textarea
                  value={dados.observacoesCliente || ''}
                  onChange={e => updateDados('observacoesCliente', e.target.value)}
                  rows={3}
                  placeholder="Ex: Proposta inclui materiais e mão de obra. Alterações no escopo serão renegociadas."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ SEÇÃO 2: Envio ao Cliente ══ */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button onClick={() => setSecaoEnvio(!secaoEnvio)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-3.5 h-3.5 text-green-600" />
            </div>
            <span className="text-sm font-bold text-gray-800">Envio ao Cliente</span>
            {dados.status === 'enviado' && dados.enviadoEm && (
              <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">
                Enviado em {fmtDate(dados.enviadoEm)}
              </span>
            )}
          </div>
          {secaoEnvio ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {secaoEnvio && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">

            {/* Preview da mensagem */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-600">Prévia da Mensagem WhatsApp</p>
                <button onClick={handleCopyMessage}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                    copied ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                           : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}>
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copiado!' : 'Copiar texto'}
                </button>
              </div>

              {/* Bolha de preview estilo WhatsApp */}
              <div className="bg-[#e9edef] rounded-2xl p-4 max-h-56 overflow-y-auto">
                <div className="bg-white rounded-xl p-3.5 text-xs text-gray-800 whitespace-pre-wrap leading-relaxed shadow-sm">
                  {generateMessage()}
                </div>
              </div>
            </div>

            {/* Telefone + botão enviar */}
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1.5">
                WhatsApp do Cliente
                <span className="text-gray-400 font-normal ml-1">(opcional — sem número abre sem destinatário)</span>
              </label>
              <div className="flex gap-2 flex-wrap">
                <input
                  value={telefoneWa}
                  onChange={e => setTelefoneWa(e.target.value)}
                  placeholder="5511999999999 (com DDI 55)"
                  className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-400" />
                <button onClick={handleEnviarWhatsApp}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors shadow-sm flex-shrink-0">
                  <MessageCircle className="w-4 h-4" /> Enviar via WhatsApp
                </button>
              </div>
            </div>

            {/* Link da apresentação (se vinculada) */}
            {linkApresentacao && (
              <div className="flex items-center gap-3 p-3 bg-brand-50 border border-brand-200 rounded-xl">
                <Link2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
                <span className="text-xs text-brand-700 flex-1 truncate font-mono">{linkApresentacao}</span>
                <a href={linkApresentacao} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-brand-100 text-brand-600 transition-colors flex-shrink-0">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ SEÇÃO 3: Apresentação/Slides (opcional) ══ */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button onClick={() => setSecaoApresentacao(!secaoApresentacao)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-brand-100 rounded-lg flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-brand-600" />
            </div>
            <span className="text-sm font-bold text-gray-800">Apresentação / Slides</span>
            <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">Opcional</span>
            {project.apresentacaoId && (
              <span className="text-[9px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full font-bold">✓ Vinculada</span>
            )}
          </div>
          {secaoApresentacao ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {secaoApresentacao && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs text-gray-500">
              Vincule uma apresentação criada no módulo de Apresentações — o link será incluído automaticamente na mensagem WhatsApp.
            </p>

            {loadingApres ? (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando apresentações...
              </div>
            ) : apresentacoes.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-yellow-800">Nenhuma apresentação encontrada</p>
                  <a href="#/app/apresentacoes"
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-xs font-bold hover:bg-yellow-700">
                    <Plus className="w-3.5 h-3.5" /> Criar no módulo de Apresentações
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <select value={selectedApresId} onChange={e => setSelectedApresId(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400 bg-white min-w-0">
                  <option value="">— Selecione uma apresentação —</option>
                  {apresentacoes.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.title || a.nome || a.id}{a.clienteNome ? ` (${a.clienteNome})` : ''}
                    </option>
                  ))}
                </select>
                <button onClick={handleVincularApres}
                  disabled={!selectedApresId || savingApres || selectedApresId === project.apresentacaoId}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40 flex-shrink-0 ${
                    apResSaved ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-600 text-white hover:bg-brand-700'
                  }`}>
                  {savingApres ? <Loader2 className="w-4 h-4 animate-spin" />
                    : apResSaved ? <Check className="w-4 h-4" />
                    : <Link2 className="w-4 h-4" />}
                  {apResSaved ? 'Vinculado!' : 'Vincular'}
                </button>
              </div>
            )}

            {/* Histórico de versões */}
            {versoes.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                  <History className="w-3 h-3" /> Versões vinculadas
                </p>
                {[...versoes].reverse().slice(0, 3).map((v, i) => {
                  const apres = apresentacoes.find(a => a.id === v.apresentacaoId);
                  return (
                    <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-xs">
                      <span className="w-6 h-6 rounded bg-brand-100 flex items-center justify-center text-[10px] font-extrabold text-brand-700">v{v.versao}</span>
                      <span className="flex-1 truncate text-gray-700">{apres?.title || apres?.nome || v.apresentacaoId}</span>
                      <span className="text-gray-400 text-[9px]">{fmtDate(v.criadaEm)}</span>
                      {v.apresentacaoId && (
                        <a href={`#/app/apresentacoes/${v.apresentacaoId}`}
                          className="p-1 rounded hover:bg-gray-200 text-gray-400 transition-colors">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ SEÇÃO 4: Aprovação e Próximos Passos ══ */}
      {faseAtual === 'proposta_enviada' && dados.status !== 'aprovado' && (
        <div className="space-y-3">

          {/* Aprovação → Contrato */}
          <div className="rounded-2xl p-5 bg-emerald-50 border border-emerald-200 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-900">✅ Cliente aprovou a proposta?</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Registre a aprovação para avançar para a fase de Contrato.
                </p>
              </div>
            </div>
            <button onClick={handleAvançarContrato} disabled={avancandoContrato}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm active:scale-[0.99]">
              {avancandoContrato
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Avançando...</>
                : <><ArrowRight className="w-4 h-4" /> Cliente Aprovou — Avançar para Contrato</>}
            </button>
          </div>

          {/* Revisão → Voltar */}
          <div className="rounded-2xl p-5 bg-amber-50 border border-amber-200 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-900">🔄 Cliente pediu ajustes?</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Volte para a fase adequada, faça as alterações e gere uma nova proposta.
                </p>
              </div>
            </div>

            {!showVoltarOpcoes ? (
              <button onClick={() => setShowVoltarOpcoes(true)}
                className="flex items-center gap-2 px-4 py-2.5 border border-amber-300 text-amber-700 bg-white rounded-xl text-sm font-bold hover:bg-amber-100 transition-colors">
                <RefreshCw className="w-4 h-4" /> Solicitar Revisão
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-amber-800 block mb-1.5">
                    O que o cliente pediu para ajustar? *
                  </label>
                  <textarea
                    value={revisaoMotivo}
                    onChange={e => setRevisaoMotivo(e.target.value)}
                    rows={2}
                    placeholder="Ex: Cliente quer materiais de melhor qualidade; Prazo de pagamento diferente..."
                    className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => handleVoltar('cotacao_recebida')} disabled={voltando || !revisaoMotivo.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 text-white rounded-xl text-sm font-bold hover:bg-cyan-700 disabled:opacity-50 transition-colors">
                    {voltando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeft className="w-4 h-4" />}
                    ← Revisar Cotações
                  </button>
                  <button onClick={() => handleVoltar('em_levantamento')} disabled={voltando || !revisaoMotivo.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {voltando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeft className="w-4 h-4" />}
                    ← Revisar Prancheta
                  </button>
                  <button onClick={() => { setShowVoltarOpcoes(false); setRevisaoMotivo(''); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                    <X className="w-4 h-4" /> Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status aprovado */}
      {dados.status === 'aprovado' && (
        <div className="rounded-2xl p-4 bg-emerald-50 border border-emerald-200 flex items-center gap-3">
          <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-800">Proposta aprovada pelo cliente</p>
            {dados.aprovadoEm && (
              <p className="text-xs text-emerald-600 mt-0.5">{fmtDate(dados.aprovadoEm)}</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default ProjectProposta;
