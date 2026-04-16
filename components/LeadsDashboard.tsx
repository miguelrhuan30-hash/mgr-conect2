/**
 * components/LeadsDashboard.tsx — CRM Funil de Vendas (Fase 0)
 *
 * Funil visual simplificado com 2 estágios:
 *   1. Leads Recebidos (status: novo) — retângulo maior
 *   2. Contato Inicial (status: contatado) — retângulo menor
 *
 * Após converter o lead, ele vai para a Fase 1 (Prancheta) e aparece
 * no FunilConversao. Analytics detalhados ficam no BIDashboard.
 */
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, Phone, Mail, MapPin, CheckCircle2, XCircle, ArrowRight,
  Clock, Settings, Plus, MessageSquare, Save, ToggleLeft, ToggleRight,
  Briefcase, X, ChevronDown, Loader2, Send,
} from 'lucide-react';
import { useProjectLeads, useLeadsConfig } from '../hooks/useProjectLeads';
import { useAuth } from '../contexts/AuthContext';
import {
  LeadStatus, LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, PROJECT_TYPES, ProjectLead,
} from '../types';
import { format, differenceInHours, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Tipos locais ───────────────────────────────────────────────────────────────

type FlowFaseId =
  | 'leads' | 'prancheta' | 'cotacao' | 'proposta' | 'contrato'
  | 'gantt' | 'os' | 'execucao' | 'relatorio' | 'faturamento'
  | 'historico' | 'nao_aprovados';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return format(d, 'dd/MM/yy HH:mm', { locale: ptBR });
  } catch { return '—'; }
};

const tipoLabel = (slug: string) =>
  PROJECT_TYPES.find((t) => t.slug === slug)?.label || slug;

// ── Card compacto de lead no funil ────────────────────────────────────────────

const LeadFunilCard: React.FC<{
  lead: ProjectLead;
  onAbrir: () => void;
  onRegistrarContato?: () => void;
  atualizando: boolean;
}> = ({ lead, onAbrir, onRegistrarContato, atualizando }) => {
  const now = new Date();
  const horas = (() => {
    try {
      const d = (lead as any).criadoEm?.toDate?.();
      return d ? differenceInHours(now, d) : null;
    } catch { return null; }
  })();

  const urgencia =
    horas !== null
      ? horas > 48
        ? 'border-l-red-500'
        : horas > 24
          ? 'border-l-orange-400'
          : horas > 4
            ? 'border-l-yellow-400'
            : 'border-l-emerald-400'
      : 'border-l-gray-200';

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 border-l-4 ${urgencia} p-3 shadow-sm hover:shadow-md transition-all cursor-pointer group`}
      onClick={onAbrir}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{lead.nomeContato}</p>
          {lead.empresa && <p className="text-[10px] text-gray-400 truncate">{lead.empresa}</p>}
        </div>
        {horas !== null && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 flex items-center gap-0.5 ${
            horas > 48
              ? 'bg-red-50 text-red-600'
              : horas > 24
                ? 'bg-orange-50 text-orange-600'
                : 'bg-gray-50 text-gray-500'
          }`}>
            <Clock className="w-2.5 h-2.5" />
            {horas < 24 ? `${horas}h` : `${differenceInDays(now, (lead as any).criadoEm.toDate())}d`}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-2 flex-wrap">
        <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{lead.telefone}</span>
        {lead.localizacao && (
          <span className="flex items-center gap-0.5 truncate max-w-[80px]">
            <MapPin className="w-3 h-3" />{lead.localizacao}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md font-medium">
          {tipoLabel(lead.tipoProjetoSlug)}
        </span>
        {onRegistrarContato && (
          <button
            onClick={(e) => { e.stopPropagation(); onRegistrarContato(); }}
            disabled={atualizando}
            className="flex items-center gap-0.5 text-[9px] font-bold px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {atualizando
              ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
              : <CheckCircle2 className="w-2.5 h-2.5" />}
            Registrar Contato
          </button>
        )}
      </div>

      {lead.notas && (
        <p className="mt-1.5 text-[9px] text-gray-400 italic truncate border-t border-gray-100 pt-1">
          📝 {lead.notas}
        </p>
      )}
    </div>
  );
};

// ── Funil visual de 2 estágios ─────────────────────────────────────────────────

const FunilVisualLeads: React.FC<{
  leads: ProjectLead[];
  onOpenLead: (lead: ProjectLead) => void;
  onRegistrarContato: (leadId: string) => Promise<void>;
  canEdit: boolean;
}> = ({ leads, onOpenLead, onRegistrarContato, canEdit }) => {
  const [atualizando, setAtualizando] = useState<string | null>(null);

  const novos = leads.filter((l) => l.status === 'novo');
  const contatados = leads.filter((l) => l.status === 'contatado');

  const handleRegistrar = async (leadId: string) => {
    setAtualizando(leadId);
    await onRegistrarContato(leadId);
    setAtualizando(null);
  };

  const STAGES = [
    {
      status: 'novo' as LeadStatus,
      label: 'Leads Recebidos',
      descricao: 'Aguardando primeiro contato',
      cor: 'bg-violet-600',
      corBg: 'bg-violet-50',
      corBorder: 'border-violet-200',
      corText: 'text-violet-700',
      items: novos,
      widthClass: 'w-full',
      showRegistrar: canEdit,
    },
    {
      status: 'contatado' as LeadStatus,
      label: 'Contato Inicial',
      descricao: 'Primeiro contato realizado',
      cor: 'bg-blue-600',
      corBg: 'bg-blue-50',
      corBorder: 'border-blue-200',
      corText: 'text-blue-700',
      items: contatados,
      widthClass: 'w-4/5 mx-auto',
      showRegistrar: false,
    },
  ];

  return (
    <div className="space-y-1">
      {STAGES.map((stage, idx) => (
        <div key={stage.status} className="flex flex-col items-center">
          {/* Conector */}
          {idx > 0 && (
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-3 bg-gray-200" />
              <ChevronDown className="w-3 h-3 text-gray-300 -mt-1" />
            </div>
          )}

          {/* Retângulo do estágio */}
          <div className={`rounded-2xl border ${stage.corBorder} ${stage.corBg} overflow-hidden ${stage.widthClass}`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-2.5 ${stage.cor}`}>
              <div>
                <p className="text-sm font-extrabold text-white">{stage.label}</p>
                <p className="text-[10px] text-white/70">{stage.descricao}</p>
              </div>
              <span className="text-lg font-extrabold text-white bg-white/20 rounded-xl px-3 py-1">
                {stage.items.length}
              </span>
            </div>

            {/* Cards */}
            <div className="p-3">
              {stage.items.length === 0 ? (
                <p className={`text-center text-xs py-3 ${stage.corText} opacity-50`}>
                  {stage.status === 'novo' ? 'Nenhum lead novo' : 'Nenhum contato pendente de conversão'}
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {stage.items.map((lead) => (
                    <LeadFunilCard
                      key={lead.id}
                      lead={lead}
                      onAbrir={() => onOpenLead(lead)}
                      onRegistrarContato={stage.showRegistrar ? () => handleRegistrar(lead.id) : undefined}
                      atualizando={atualizando === lead.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Indicador de saída do funil */}
      <div className="flex flex-col items-center">
        <div className="w-0.5 h-3 bg-gray-200" />
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700">
          <ArrowRight className="w-3.5 h-3.5" />
          Converter → Fase 1 Prancheta
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          Leads convertidos entram no funil de conversão abaixo
        </p>
      </div>
    </div>
  );
};

// ── Modal de Detalhes do Lead ──────────────────────────────────────────────────

const LeadModal: React.FC<{
  lead: ProjectLead;
  onClose: () => void;
  onAtualizarStatus: (status: LeadStatus) => Promise<void>;
  onSalvarNota: (nota: string) => Promise<void>;
  onConverter: () => Promise<void>;
  onDescartar: (motivo: string) => Promise<void>;
  onNaoAprovar: (motivo: string) => Promise<void>;
  canEdit: boolean;
}> = ({ lead, onClose, onAtualizarStatus, onSalvarNota, onConverter, onDescartar, onNaoAprovar, canEdit }) => {
  const [nota, setNota] = useState(lead.notas || '');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const STATUS_SEQ: LeadStatus[] = ['novo', 'contatado', 'convertido'];
  const statusIdx = STATUS_SEQ.indexOf(lead.status as any);

  const handleSalvarNota = async () => {
    setSaving(true);
    await onSalvarNota(nota);
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-6 py-5 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-white">{lead.nomeContato}</h2>
              {lead.empresa && <p className="text-xs text-white/70">{lead.empresa}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Pipeline visual */}
          <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1">
            {STATUS_SEQ.map((s, i) => (
              <React.Fragment key={s}>
                <button
                  onClick={() => canEdit && lead.status !== s && onAtualizarStatus(s)}
                  className={`text-[9px] font-bold px-2.5 py-1 rounded-full transition-all whitespace-nowrap ${
                    lead.status === s
                      ? 'bg-white text-violet-700 shadow-sm'
                      : i < statusIdx
                        ? 'bg-white/30 text-white cursor-pointer hover:bg-white/40'
                        : 'bg-white/10 text-white/50 cursor-pointer hover:bg-white/20'
                  }`}
                >
                  {LEAD_STATUS_LABELS[s]}
                </button>
                {i < STATUS_SEQ.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-white/30 flex-shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Dados de contato */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Telefone</p>
              <a
                href={`https://wa.me/55${lead.telefone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1"
              >
                <Phone className="w-3.5 h-3.5" />{lead.telefone}
              </a>
            </div>
            {lead.email && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">E-mail</p>
                <a
                  href={`mailto:${lead.email}`}
                  className="text-sm font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1 truncate"
                >
                  <Mail className="w-3.5 h-3.5" />{lead.email}
                </a>
              </div>
            )}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Tipo de Projeto</p>
              <p className="text-sm font-bold text-gray-800">{tipoLabel(lead.tipoProjetoSlug)}</p>
            </div>
            {lead.localizacao && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Localização</p>
                <p className="text-sm font-bold text-gray-800 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />{lead.localizacao}
                </p>
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${LEAD_STATUS_COLORS[lead.status]}`}>
              {LEAD_STATUS_LABELS[lead.status]}
            </span>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
              {(
                {
                  formulario_site: '🌐 Site',
                  anuncio_meta: '📘 Meta',
                  anuncio_google: '🔍 Google',
                  manual: '✋ Manual',
                  'homepage-mgr-refrigeracao': '🏠 Homepage',
                } as any
              )[(lead as any).origem] || (lead as any).origem}
            </span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />{fmtDate(lead.criadoEm)}
            </span>
          </div>

          {lead.observacoes && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-[9px] font-bold text-blue-500 uppercase mb-1">Mensagem do Cliente</p>
              <p className="text-sm text-gray-700">{lead.observacoes}</p>
            </div>
          )}

          {lead.medidasAproximadas && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Medidas Aproximadas</p>
              <p className="text-sm text-gray-700">{lead.medidasAproximadas}</p>
            </div>
          )}

          {lead.motivoDescarte && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-[9px] font-bold text-red-500 uppercase mb-1">Motivo do Descarte</p>
              <p className="text-sm text-gray-700">{lead.motivoDescarte}</p>
            </div>
          )}

          {lead.motivoNaoAprovado && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-[9px] font-bold text-red-600 uppercase mb-1">❌ Motivo — Não Aprovado</p>
              <p className="text-sm text-gray-700">{lead.motivoNaoAprovado}</p>
            </div>
          )}

          {/* Notas internas */}
          {canEdit && (
            <div>
              <label className="text-xs font-bold text-gray-600 flex items-center gap-1 mb-2">
                <MessageSquare className="w-3.5 h-3.5" /> Notas Internas
              </label>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Anotações sobre este lead (negociação, necessidades, próximos passos)..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-violet-400 outline-none"
              />
              <button
                onClick={handleSalvarNota}
                disabled={saving}
                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-bold hover:bg-gray-900 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Salvar Nota
              </button>
            </div>
          )}

          {/* Ações */}
          {canEdit && lead.status !== 'descartado' && lead.status !== 'nao_aprovado' && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              {lead.status !== 'convertido' && (
                <button
                  onClick={onConverter}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
                >
                  <ArrowRight className="w-4 h-4" /> Converter em Projeto
                </button>
              )}
              {lead.status === 'convertido' && lead.projectId && (
                <button
                  onClick={() => navigate(`/app/projetos-v2/${lead.projectId}`)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 transition-colors"
                >
                  <Briefcase className="w-4 h-4" /> Ver Projeto
                </button>
              )}
              <button
                onClick={() => {
                  const motivo = window.prompt('Motivo do descarte:');
                  if (motivo) { onDescartar(motivo); onClose(); }
                }}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-500 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
              >
                <XCircle className="w-4 h-4" /> Descartar
              </button>
              <button
                onClick={() => {
                  const motivo = window.prompt('Motivo — Não Aprovado:');
                  if (motivo) { onNaoAprovar(motivo); onClose(); }
                }}
                className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors"
              >
                <XCircle className="w-4 h-4" /> Não Aprovado
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Aba Configurações ──────────────────────────────────────────────────────────

const ConfigTab: React.FC<{
  onAdicionarLead: (dados: any) => Promise<string>;
  isAdmin: boolean;
}> = ({ onAdicionarLead, isAdmin }) => {
  const { config, configLoading, saving, salvarConfig } = useLeadsConfig();
  const [email, setEmail] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [emailErr, setEmailErr] = useState('');
  const [savedOk, setSavedOk] = useState(false);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [emailLead, setEmailLead] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [tipo, setTipo] = useState('');
  const [localizacao, setLocalizacao] = useState('');
  const [notasLead, setNotasLead] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [adicionadoOk, setAdicionadoOk] = useState(false);

  React.useEffect(() => {
    if (config) {
      setEmail(config.emailNotificacao || '');
      setAtivo(config.notificacaoAtiva ?? true);
    }
  }, [config]);

  const handleSalvar = async () => {
    setEmailErr('');
    try {
      await salvarConfig(email, ativo);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (e: any) {
      setEmailErr(e.message || 'Erro ao salvar');
    }
  };

  const handleAdicionarLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim() || !tipo) return;
    setAdicionando(true);
    try {
      await onAdicionarLead({
        nomeContato: nome, telefone, email: emailLead || undefined,
        empresa: empresa || undefined, tipoProjetoSlug: tipo,
        localizacao: localizacao || undefined, notas: notasLead || undefined,
      });
      setNome(''); setTelefone(''); setEmailLead(''); setEmpresa('');
      setTipo(''); setLocalizacao(''); setNotasLead('');
      setAdicionadoOk(true);
      setTimeout(() => setAdicionadoOk(false), 3000);
    } finally {
      setAdicionando(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {isAdmin && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-violet-600" /> Notificações de Novos Leads
          </h3>
          {configLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">
                  E-mail para receber notificações
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="comercial@mgrrefrigeracao.com.br"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 outline-none"
                />
                {emailErr && <p className="text-xs text-red-600 mt-1">{emailErr}</p>}
              </div>
              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                <div>
                  <p className="text-sm font-bold text-gray-800">Notificações ativas</p>
                  <p className="text-xs text-gray-400">Receber e-mail quando um novo lead chegar</p>
                </div>
                <button
                  onClick={() => setAtivo(!ativo)}
                  className={`transition-colors ${ativo ? 'text-violet-600' : 'text-gray-300'}`}
                >
                  {ativo ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                </button>
              </div>
              <button
                onClick={handleSalvar}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Configuração
              </button>
              {savedOk && <p className="text-xs text-emerald-600 font-bold">✅ Configuração salva com sucesso!</p>}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-violet-600" /> Adicionar Lead Manual
        </h3>
        <form onSubmit={handleAdicionarLead} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Nome *</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 outline-none"
                placeholder="Nome do contato"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Telefone *</label>
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 outline-none"
                placeholder="(19) 99999-9999"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">E-mail</label>
              <input
                type="email"
                value={emailLead}
                onChange={(e) => setEmailLead(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 outline-none"
                placeholder="email@empresa.com"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Empresa</label>
              <input
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 outline-none"
                placeholder="Razão social"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Tipo de Projeto *</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 outline-none"
              >
                <option value="">Selecione...</option>
                {PROJECT_TYPES.map((t) => (
                  <option key={t.slug} value={t.slug}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Localização</label>
              <input
                value={localizacao}
                onChange={(e) => setLocalizacao(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 outline-none"
                placeholder="Cidade, Estado"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Notas</label>
            <textarea
              value={notasLead}
              onChange={(e) => setNotasLead(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-violet-400 outline-none"
              placeholder="Contexto inicial do lead..."
            />
          </div>
          <button
            type="submit"
            disabled={adicionando}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {adicionando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Adicionar Lead
          </button>
          {adicionadoOk && <p className="text-xs text-emerald-600 font-bold">✅ Lead adicionado com sucesso ao funil!</p>}
        </form>
      </div>
    </div>
  );
};

// ── Componente Principal ──────────────────────────────────────────────────────

type TabId = 'funil' | 'config';

export interface LeadsDashboardProps {
  initialTab?: TabId | 'kanban' | 'lista'; // backward compat com 'kanban' e 'lista'
  onNavigateToFlow?: (faseId: FlowFaseId) => void;
}

const LeadsDashboard: React.FC<LeadsDashboardProps> = ({ initialTab, onNavigateToFlow }) => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const {
    leads, loading, leadsNovos,
    marcarContatado, atualizarStatus, salvarNota,
    adicionarLead, converterEmProjeto, descartarLead, marcarNaoAprovado,
  } = useProjectLeads();

  // Mapeia tabs antigas para novas (backward compat)
  const resolveTab = (t?: string): TabId => {
    if (t === 'config') return 'config';
    return 'funil';
  };

  const [tab, setTab] = useState<TabId>(resolveTab(initialTab));
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [leadModal, setLeadModal] = useState<ProjectLead | null>(null);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'developer';
  const canEdit = isAdmin || userProfile?.role === 'manager' || !!userProfile?.permissions?.canManageSettings;

  const handleConverter = useCallback(async (leadId: string) => {
    setActionLoading(leadId + '_converter');
    try {
      const projectId = await converterEmProjeto(leadId);
      setLeadModal(null);
      if (onNavigateToFlow) {
        onNavigateToFlow('prancheta');
      } else {
        navigate(`/app/projetos-v2/${projectId}`);
      }
    } finally {
      setActionLoading(null);
    }
  }, [converterEmProjeto, navigate, onNavigateToFlow]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-violet-600" />
            Funil de Leads
            {leadsNovos > 0 && (
              <span className="bg-violet-600 text-white text-xs font-extrabold px-2 py-0.5 rounded-full animate-pulse">
                {leadsNovos} {leadsNovos === 1 ? 'novo' : 'novos'}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500">Captação → Contato → Conversão em projeto</p>
        </div>
        <button
          onClick={() => window.open('/solicitar-projeto', '_blank')}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50"
        >
          Ver Formulário Público
        </button>
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: 'funil' as TabId, label: 'Funil', icon: UserPlus },
          { id: 'config' as TabId, label: 'Config', icon: Settings },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Funil visual */}
      {tab === 'funil' && (
        <FunilVisualLeads
          leads={leads.filter((l) => l.status === 'novo' || l.status === 'contatado')}
          onOpenLead={setLeadModal}
          onRegistrarContato={marcarContatado}
          canEdit={canEdit}
        />
      )}

      {/* Config */}
      {tab === 'config' && (
        <ConfigTab onAdicionarLead={adicionarLead} isAdmin={isAdmin} />
      )}

      {/* Modal */}
      {leadModal && (
        <LeadModal
          lead={leadModal}
          onClose={() => setLeadModal(null)}
          canEdit={canEdit}
          onAtualizarStatus={async (status) => {
            await atualizarStatus(leadModal.id, status);
            setLeadModal((prev) => (prev ? { ...prev, status } : null));
          }}
          onSalvarNota={async (nota) => {
            await salvarNota(leadModal.id, nota);
            setLeadModal((prev) => (prev ? { ...prev, notas: nota } : null));
          }}
          onConverter={() => handleConverter(leadModal.id)}
          onDescartar={(motivo) => descartarLead(leadModal.id, motivo)}
          onNaoAprovar={async (motivo) => {
            await marcarNaoAprovado(leadModal.id, motivo);
            setLeadModal(null);
          }}
        />
      )}
    </div>
  );
};

export default LeadsDashboard;
