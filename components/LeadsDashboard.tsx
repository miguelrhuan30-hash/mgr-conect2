/**
 * components/LeadsDashboard.tsx — CRM Funil de Vendas (Fase 0)
 *
 * Mini-CRM integrado ao MGRConnect.
 * - Aba Kanban: funil visual com 4 colunas (Novo → Contatado → Em Negociação → Convertido/Descartado)
 * - Aba Lista: visão detalhada com filtros e ações
 * - Aba Configurações: e-mail de notificação + lead manual (somente admin)
 * - KPI Bar: total, taxa de conversão, tempo médio de resposta
 */
import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, Search, Loader2, Phone, Mail, MapPin,
  CheckCircle2, XCircle, ArrowRight, Filter, Briefcase,
  AlertCircle, ExternalLink, Clock, Download, Settings,
  Plus, MessageSquare, Save, ToggleLeft, ToggleRight,
  TrendingUp, Users, Target, ChevronRight, X, Send,
  KanbanSquare, List,
} from 'lucide-react';
import { useProjectLeads, useLeadsConfig } from '../hooks/useProjectLeads';
import { useAuth } from '../contexts/AuthContext';
import {
  LeadStatus, LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, PROJECT_TYPES, ProjectLead,
} from '../types';
import { format, differenceInHours, differenceInDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return format(d, 'dd/MM/yy HH:mm', { locale: ptBR });
  } catch { return '—'; }
};

const tipoLabel = (slug: string) =>
  PROJECT_TYPES.find((t) => t.slug === slug)?.label || slug;

// ── Colunas do Kanban ─────────────────────────────────────────────────────────

const KANBAN_COLS: { status: LeadStatus; label: string; cor: string; corBg: string; corBorder: string }[] = [
  { status: 'novo',          label: 'Novos',           cor: 'text-violet-700', corBg: 'bg-violet-50',  corBorder: 'border-violet-200' },
  { status: 'contatado',     label: 'Contatados',      cor: 'text-blue-700',   corBg: 'bg-blue-50',    corBorder: 'border-blue-200' },
  { status: 'em_negociacao', label: 'Em Negociação',   cor: 'text-amber-700',  corBg: 'bg-amber-50',   corBorder: 'border-amber-200' },
  { status: 'convertido',    label: 'Convertidos',     cor: 'text-emerald-700',corBg: 'bg-emerald-50', corBorder: 'border-emerald-200' },
];

// ── Componente de Card do Kanban ──────────────────────────────────────────────

const KanbanCard: React.FC<{
  lead: ProjectLead;
  onAvancar: () => void;
  onAbrir: () => void;
  atualizando: boolean;
}> = ({ lead, onAvancar, onAbrir, atualizando }) => {
  const now = new Date();
  const horas = (() => {
    try {
      const d = (lead as any).criadoEm?.toDate?.();
      return d ? differenceInHours(now, d) : null;
    } catch { return null; }
  })();

  const urgencia = horas !== null
    ? horas > 48 ? 'border-l-red-500' : horas > 24 ? 'border-l-orange-400' : horas > 4 ? 'border-l-yellow-400' : 'border-l-emerald-400'
    : 'border-l-gray-200';

  const proximoStatus: Record<LeadStatus, LeadStatus | null> = {
    novo: 'contatado',
    contatado: 'em_negociacao',
    em_negociacao: 'convertido',
    convertido: null,
    descartado: null,
  };
  const prox = proximoStatus[lead.status];

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${urgencia} p-3 shadow-sm hover:shadow-md transition-all cursor-pointer group`}
      onClick={onAbrir}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{lead.nomeContato}</p>
          {lead.empresa && <p className="text-[10px] text-gray-400 truncate">{lead.empresa}</p>}
        </div>
        {horas !== null && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 flex items-center gap-0.5 ${
            horas > 48 ? 'bg-red-50 text-red-600' : horas > 24 ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-500'
          }`}>
            <Clock className="w-2.5 h-2.5" />
            {horas < 24 ? `${horas}h` : `${differenceInDays(now, (lead as any).criadoEm.toDate())}d`}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-2 flex-wrap">
        <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{lead.telefone}</span>
        {lead.localizacao && <span className="flex items-center gap-0.5 truncate max-w-[80px]"><MapPin className="w-3 h-3" />{lead.localizacao}</span>}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md font-medium">
          {tipoLabel(lead.tipoProjetoSlug)}
        </span>
        {prox && (
          <button
            onClick={(e) => { e.stopPropagation(); onAvancar(); }}
            disabled={atualizando}
            className="flex items-center gap-0.5 text-[9px] font-bold px-2 py-1 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors"
          >
            {atualizando ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <ChevronRight className="w-2.5 h-2.5" />}
            {LEAD_STATUS_LABELS[prox]}
          </button>
        )}
      </div>

      {lead.notas && (
        <p className="mt-2 text-[9px] text-gray-400 italic truncate border-t border-gray-100 pt-1">
          📝 {lead.notas}
        </p>
      )}
    </div>
  );
};

// ── Modal de Detalhes do Lead ─────────────────────────────────────────────────

const LeadModal: React.FC<{
  lead: ProjectLead;
  onClose: () => void;
  onAtualizarStatus: (status: LeadStatus) => Promise<void>;
  onSalvarNota: (nota: string) => Promise<void>;
  onConverter: () => Promise<void>;
  onDescartar: (motivo: string) => Promise<void>;
  canEdit: boolean;
}> = ({ lead, onClose, onAtualizarStatus, onSalvarNota, onConverter, onDescartar, canEdit }) => {
  const [nota, setNota] = useState(lead.notas || '');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const STATUS_SEQ: LeadStatus[] = ['novo', 'contatado', 'em_negociacao', 'convertido'];
  const statusIdx = STATUS_SEQ.indexOf(lead.status as any);

  const handleSalvarNota = async () => {
    setSaving(true);
    await onSalvarNota(nota);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-6 py-5 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-white">{lead.nomeContato}</h2>
              {lead.empresa && <p className="text-xs text-white/70">{lead.empresa}</p>}
            </div>
            <button onClick={onClose} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors">
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
                {i < STATUS_SEQ.length - 1 && <ChevronRight className="w-3 h-3 text-white/30 flex-shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Dados de contato */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Telefone</p>
              <a href={`https://wa.me/55${lead.telefone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                className="text-sm font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />{lead.telefone}
              </a>
            </div>
            {lead.email && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">E-mail</p>
                <a href={`mailto:${lead.email}`} className="text-sm font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1 truncate">
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
                <p className="text-sm font-bold text-gray-800 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-400" />{lead.localizacao}</p>
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${LEAD_STATUS_COLORS[lead.status]}`}>
              {LEAD_STATUS_LABELS[lead.status]}
            </span>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
              {({'formulario_site':'🌐 Site','anuncio_meta':'📘 Meta','anuncio_google':'🔍 Google','manual':'✋ Manual','homepage-mgr-refrigeracao':'🏠 Homepage'} as any)[lead.origem as string] || lead.origem}
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

          {lead.motivoDescarte && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-[9px] font-bold text-red-500 uppercase mb-1">Motivo do Descarte</p>
              <p className="text-sm text-gray-700">{lead.motivoDescarte}</p>
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
              <button onClick={handleSalvarNota} disabled={saving}
                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-bold hover:bg-gray-900 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Salvar Nota
              </button>
            </div>
          )}

          {/* Ações */}
          {canEdit && lead.status !== 'descartado' && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              {lead.status !== 'convertido' && (
                <button onClick={onConverter}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors">
                  <ArrowRight className="w-4 h-4" /> Converter em Projeto
                </button>
              )}
              {lead.status === 'convertido' && lead.projectId && (
                <button onClick={() => navigate(`/app/projetos-v2/${lead.projectId}`)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 transition-colors">
                  <Briefcase className="w-4 h-4" /> Ver Projeto
                </button>
              )}
              <button onClick={() => {
                const motivo = window.prompt('Motivo do descarte:');
                if (motivo) { onDescartar(motivo); onClose(); }
              }}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-500 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors">
                <XCircle className="w-4 h-4" /> Descartar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Aba Kanban ────────────────────────────────────────────────────────────────

const KanbanView: React.FC<{
  leads: ProjectLead[];
  onAtualizarStatus: (leadId: string, status: LeadStatus) => Promise<void>;
  onOpenLead: (lead: ProjectLead) => void;
  canEdit: boolean;
}> = ({ leads, onAtualizarStatus, onOpenLead, canEdit }) => {
  const [atualizando, setAtualizando] = useState<string | null>(null);

  const handleAvancar = async (leadId: string, novoStatus: LeadStatus) => {
    setAtualizando(leadId);
    await onAtualizarStatus(leadId, novoStatus);
    setAtualizando(null);
  };

  const proximoStatus: Record<LeadStatus, LeadStatus | null> = {
    novo: 'contatado',
    contatado: 'em_negociacao',
    em_negociacao: 'convertido',
    convertido: null,
    descartado: null,
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {KANBAN_COLS.map((col) => {
          const colLeads = leads.filter((l) => l.status === col.status);
          return (
            <div key={col.status} className="w-72 flex-shrink-0">
              <div className={`flex items-center justify-between mb-3 px-1`}>
                <span className={`text-xs font-extrabold ${col.cor} flex items-center gap-1.5`}>
                  <span className={`w-2 h-2 rounded-full ${col.corBg.replace('bg-', 'bg-').replace('50', '500')}`} />
                  {col.label}
                </span>
                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${col.corBg} ${col.cor} border ${col.corBorder}`}>
                  {colLeads.length}
                </span>
              </div>
              <div className={`min-h-[200px] rounded-2xl ${col.corBg} border ${col.corBorder} p-2 space-y-2`}>
                {colLeads.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-[10px] text-gray-400">
                    Nenhum lead aqui
                  </div>
                )}
                {colLeads.map((lead) => {
                  const prox = proximoStatus[lead.status];
                  return (
                    <KanbanCard
                      key={lead.id}
                      lead={lead}
                      onAvancar={() => prox && handleAvancar(lead.id, prox)}
                      onAbrir={() => onOpenLead(lead)}
                      atualizando={atualizando === lead.id}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Aba Configurações ─────────────────────────────────────────────────────────

const ConfigTab: React.FC<{ onAdicionarLead: (dados: any) => Promise<string>; isAdmin: boolean }> = ({ onAdicionarLead, isAdmin }) => {
  const { config, configLoading, saving, salvarConfig } = useLeadsConfig();
  const [email, setEmail] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [emailErr, setEmailErr] = useState('');
  const [savedOk, setSavedOk] = useState(false);

  // Form lead manual
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
      await onAdicionarLead({ nomeContato: nome, telefone, email: emailLead || undefined, empresa: empresa || undefined, tipoProjetoSlug: tipo, localizacao: localizacao || undefined, notas: notasLead || undefined });
      setNome(''); setTelefone(''); setEmailLead(''); setEmpresa(''); setTipo(''); setLocalizacao(''); setNotasLead('');
      setAdicionadoOk(true);
      setTimeout(() => setAdicionadoOk(false), 3000);
    } finally {
      setAdicionando(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Configuração de e-mail */}
      {isAdmin && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-violet-600" /> Notificações de Novos Leads
          </h3>
          {configLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">E-mail para receber notificações</label>
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
                <button onClick={() => setAtivo(!ativo)} className={`transition-colors ${ativo ? 'text-violet-600' : 'text-gray-300'}`}>
                  {ativo ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                </button>
              </div>
              <button onClick={handleSalvar} disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Configuração
              </button>
              {savedOk && <p className="text-xs text-emerald-600 font-bold">✅ Configuração salva com sucesso!</p>}
            </div>
          )}
        </div>
      )}

      {/* Adicionar lead manual */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-violet-600" /> Adicionar Lead Manual
        </h3>
        <form onSubmit={handleAdicionarLead} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Nome *</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 outline-none" placeholder="Nome do contato" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Telefone *</label>
              <input value={telefone} onChange={(e) => setTelefone(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 outline-none" placeholder="(19) 99999-9999" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">E-mail</label>
              <input type="email" value={emailLead} onChange={(e) => setEmailLead(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 outline-none" placeholder="email@empresa.com" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Empresa</label>
              <input value={empresa} onChange={(e) => setEmpresa(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 outline-none" placeholder="Razão social" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Tipo de Projeto *</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 outline-none">
                <option value="">Selecione...</option>
                {PROJECT_TYPES.map((t) => <option key={t.slug} value={t.slug}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Localização</label>
              <input value={localizacao} onChange={(e) => setLocalizacao(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 outline-none" placeholder="Cidade, Estado" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Notas</label>
            <textarea value={notasLead} onChange={(e) => setNotasLead(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-violet-400 outline-none"
              placeholder="Contexto inicial do lead..." />
          </div>
          <button type="submit" disabled={adicionando}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors">
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

type TabId = 'kanban' | 'lista' | 'config';

const LeadsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { leads, loading, leadsNovos, atualizarStatus, salvarNota, adicionarLead, converterEmProjeto, descartarLead } = useProjectLeads();
  const [tab, setTab] = useState<TabId>('kanban');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'todos'>('todos');
  const [origemFilter, setOrigemFilter] = useState<string>('todos');
  const [periodoFilter, setPeriodoFilter] = useState<7 | 30 | 90 | 0>(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [leadModal, setLeadModal] = useState<ProjectLead | null>(null);
  const now = new Date();

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'developer';
  const canEdit = isAdmin || userProfile?.role === 'manager' || !!userProfile?.permissions?.canManageSettings;

  // ── KPIs ──
  const kpis = useMemo(() => {
    const novo = leads.filter((l) => l.status === 'novo').length;
    const contatado = leads.filter((l) => l.status === 'contatado').length;
    const em_negociacao = leads.filter((l) => l.status === 'em_negociacao').length;
    const convertido = leads.filter((l) => l.status === 'convertido').length;
    const descartado = leads.filter((l) => l.status === 'descartado').length;
    const total = leads.length;
    const taxaConversao = total > 0 ? Math.round((convertido / total) * 100) : 0;

    const tempos = leads
      .filter((l) => l.status !== 'novo')
      .map((l) => {
        try {
          const criadoEm = (l as any).criadoEm?.toDate?.();
          const contatadoEm = (l as any).contatadoEm?.toDate?.();
          return criadoEm && contatadoEm ? differenceInHours(contatadoEm, criadoEm) : null;
        } catch { return null; }
      })
      .filter((t): t is number => t !== null);

    const tempoMedio = tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null;

    return { novo, contatado, em_negociacao, convertido, descartado, total, taxaConversao, tempoMedio };
  }, [leads]);

  // ── Filtros para aba Lista ──
  const filtered = useMemo(() => {
    let result = leads;
    if (statusFilter !== 'todos') result = result.filter((l) => l.status === statusFilter);
    if (origemFilter !== 'todos') result = result.filter((l) => (l as any).origem === origemFilter);
    if (periodoFilter > 0) {
      const cutoff = subDays(now, periodoFilter);
      result = result.filter((l) => {
        const d = (l as any).criadoEm?.toDate ? (l as any).criadoEm.toDate() : null;
        return d && d >= cutoff;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) => l.nomeContato.toLowerCase().includes(q) || l.empresa?.toLowerCase().includes(q) || l.telefone.includes(q),
      );
    }
    return result.sort((a, b) => {
      if (a.status === 'novo' && b.status !== 'novo') return -1;
      if (b.status === 'novo' && a.status !== 'novo') return 1;
      return 0;
    });
  }, [leads, statusFilter, origemFilter, periodoFilter, search]);

  // ── Ações ──
  const handleAtualizarStatus = async (leadId: string, novoStatus: LeadStatus) => {
    setActionLoading(leadId + '_status');
    await atualizarStatus(leadId, novoStatus);
    setActionLoading(null);
  };

  const handleSalvarNota = async (leadId: string, nota: string) => {
    await salvarNota(leadId, nota);
  };

  const handleConverter = async (leadId: string) => {
    setActionLoading(leadId + '_converter');
    try {
      const projectId = await converterEmProjeto(leadId);
      navigate(`/app/projetos-v2/${projectId}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDescartar = async (leadId: string, motivo: string) => {
    await descartarLead(leadId, motivo);
  };

  const exportarCSV = () => {
    const rows = [
      ['Nome', 'Empresa', 'Telefone', 'Email', 'Tipo', 'Origem', 'Status', 'Data', 'Localização', 'Notas'],
      ...filtered.map((l: any) => [
        l.nomeContato, l.empresa || '', l.telefone, l.email || '',
        tipoLabel(l.tipoProjetoSlug), l.origem || 'manual', l.status,
        l.criadoEm?.toDate ? format(l.criadoEm.toDate(), 'dd/MM/yyyy HH:mm') : '',
        l.localizacao || '', l.notas || '',
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `leads_${format(now, 'yyyyMMdd')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const STATUS_TABS: { value: LeadStatus | 'todos'; label: string; count: number }[] = [
    { value: 'todos', label: 'Todos', count: leads.length },
    { value: 'novo', label: 'Novos', count: kpis.novo },
    { value: 'contatado', label: 'Contatados', count: kpis.contatado },
    { value: 'em_negociacao', label: 'Em Negociação', count: kpis.em_negociacao },
    { value: 'convertido', label: 'Convertidos', count: kpis.convertido },
    { value: 'descartado', label: 'Descartados', count: kpis.descartado },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-violet-600" />
            CRM — Funil de Leads
            {leadsNovos > 0 && (
              <span className="bg-violet-600 text-white text-xs font-extrabold px-2 py-0.5 rounded-full animate-pulse">
                {leadsNovos} {leadsNovos === 1 ? 'novo' : 'novos'}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500">Pipeline de captação → negociação → projeto</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportarCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={() => window.open('/solicitar-projeto', '_blank')}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700">
            <ExternalLink className="w-4 h-4" /> Ver Formulário
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total de Leads', value: kpis.total, icon: Users, color: 'bg-gray-50 text-gray-700', dot: 'bg-gray-400' },
          { label: 'Novos', value: kpis.novo, icon: UserPlus, color: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
          { label: 'Taxa de Conversão', value: `${kpis.taxaConversao}%`, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
          { label: 'Tempo Médio Resposta', value: kpis.tempoMedio !== null ? (kpis.tempoMedio < 24 ? `${kpis.tempoMedio}h` : `${Math.round(kpis.tempoMedio/24)}d`) : '—', icon: Clock, color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
        ].map((k) => (
          <div key={k.label} className={`${k.color} rounded-2xl p-4 border border-current/10`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${k.dot}`} />
              <span className="text-[10px] font-bold uppercase tracking-wide">{k.label}</span>
            </div>
            <p className="text-2xl font-extrabold">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: 'kanban', label: 'Kanban', icon: KanbanSquare },
          { id: 'lista', label: 'Lista', icon: List },
          { id: 'config', label: 'Config', icon: Settings },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as TabId)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Aba Kanban */}
      {tab === 'kanban' && (
        <KanbanView
          leads={leads.filter((l) => l.status !== 'descartado')}
          onAtualizarStatus={handleAtualizarStatus}
          onOpenLead={setLeadModal}
          canEdit={canEdit}
        />
      )}

      {/* Aba Lista */}
      {tab === 'lista' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex p-1 gap-0.5 bg-gray-100/80 rounded-xl overflow-x-auto flex-shrink-0">
                {STATUS_TABS.map((t) => (
                  <button key={t.value} onClick={() => setStatusFilter(t.value)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-1 ${
                      statusFilter === t.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {t.label}
                    <span className="text-[9px] bg-gray-200 px-1.5 rounded-full font-extrabold">{t.count}</span>
                  </button>
                ))}
              </div>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input type="text" placeholder="Buscar lead..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-gray-400 flex items-center gap-1"><Filter className="w-3 h-3" /> Origem:</span>
              {(['todos', 'formulario_site', 'anuncio_meta', 'anuncio_google', 'manual', 'homepage-mgr-refrigeracao'] as const).map((o) => {
                const labels: Record<string, string> = { 'todos': 'Todas', 'formulario_site': '🌐 Site', 'anuncio_meta': '📘 Meta', 'anuncio_google': '🔍 Google', 'manual': '✋ Manual', 'homepage-mgr-refrigeracao': '🏠 Homepage' };
                return (
                  <button key={o} onClick={() => setOrigemFilter(o)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${origemFilter === o ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                    {labels[o]}
                  </button>
                );
              })}
              <span className="ml-3 text-xs font-bold text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Período:</span>
              {([0, 7, 30, 90] as const).map((p) => (
                <button key={p} onClick={() => setPeriodoFilter(p)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${periodoFilter === p ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                  {p === 0 ? 'Todos' : `${p}d`}
                </button>
              ))}
            </div>
          </div>

          {/* Lista */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
              <UserPlus className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">Nenhum lead encontrado.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((lead) => (
                <div key={lead.id} className="bg-white rounded-2xl border border-gray-200 p-4 md:p-5 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => setLeadModal(lead)}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900">{lead.nomeContato}</h3>
                        {lead.empresa && <span className="text-xs text-gray-500">({lead.empresa})</span>}
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${LEAD_STATUS_COLORS[lead.status]}`}>
                          {LEAD_STATUS_LABELS[lead.status]}
                        </span>
                        {(lead as any).origem && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                            {({'formulario_site':'🌐 Site','anuncio_meta':'📘 Meta','anuncio_google':'🔍 Google','manual':'✋ Manual','homepage-mgr-refrigeracao':'🏠 Homepage'} as any)[(lead as any).origem] || (lead as any).origem}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.telefone}</span>
                        {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
                        {lead.localizacao && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.localizacao}</span>}
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtDate(lead.criadoEm)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="bg-gray-100 px-2 py-0.5 rounded-lg text-xs font-medium text-gray-600">{tipoLabel(lead.tipoProjetoSlug)}</span>
                    {lead.notas && <span className="text-[10px] text-gray-400 italic truncate max-w-[200px]">📝 {lead.notas}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Aba Config */}
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
            await handleAtualizarStatus(leadModal.id, status);
            setLeadModal((prev) => prev ? { ...prev, status } : null);
          }}
          onSalvarNota={async (nota) => {
            await handleSalvarNota(leadModal.id, nota);
            setLeadModal((prev) => prev ? { ...prev, notas: nota } : null);
          }}
          onConverter={() => handleConverter(leadModal.id)}
          onDescartar={(motivo) => handleDescartar(leadModal.id, motivo)}
        />
      )}
    </div>
  );
};

export default LeadsDashboard;
