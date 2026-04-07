/**
 * components/ProjectAdendoMudancas.tsx — Sprint E3
 *
 * Adendo de mudanças formal para O.S. já emitidas.
 * Quando uma O.S. vinculada a um projeto sofre alteração após emissão,
 * o gestor pode registrar um adendo formal documentando a mudança.
 *
 * Fluxo:
 * 1. Gestor seleciona qual O.S. sofreu mudança
 * 2. Descreve o que mudou (campo, valor anterior, valor novo, motivo)
 * 3. Confirma → adendo salvo no Firestore vinculado ao projeto e à O.S.
 * 4. Adendos aparecem no Relatório Final
 */
import React, { useState, useCallback } from 'react';
import {
  Plus, X, Check, Loader2, FileText, AlertTriangle,
  ChevronDown, ChevronUp, Edit3, Calendar, User,
  ClipboardList, Clock,
} from 'lucide-react';
import {
  collection, addDoc, doc, updateDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useProjectOS } from '../hooks/useProjectOS';
import { CollectionName } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AdendoMudanca {
  id: string;
  projectId: string;
  osId: string;
  osTitulo: string;
  campo: string;              // o que mudou
  valorAnterior: string;      // valor antes da mudança
  valorNovo: string;          // valor novo aprovado
  motivo: string;             // justificativa da mudança
  impacto: 'sem_custo' | 'custo_adicional' | 'reducao_custo' | 'prazo' | 'escopo';
  valorImpacto?: number;      // se custo adicional/redução
  aprovadoPor: string;        // uid do gestor
  aprovadoPorNome: string;
  criadoEm: Timestamp;
  numero: number;             // sequencial: Adendo #1, #2...
}

const CAMPOS_MUDANCA = [
  'Escopo do serviço',
  'Equipe responsável',
  'Data de execução',
  'Materiais utilizados',
  'Valor cobrado',
  'Prazo de conclusão',
  'Localização do serviço',
  'Especificação técnica',
  'Outro',
];

const IMPACTO_CONFIG: Record<AdendoMudanca['impacto'], { label: string; cor: string }> = {
  sem_custo:       { label: 'Sem impacto financeiro', cor: 'bg-gray-100 text-gray-600 border-gray-200' },
  custo_adicional: { label: 'Custo adicional',         cor: 'bg-red-100 text-red-700 border-red-200' },
  reducao_custo:   { label: 'Redução de custo',        cor: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  prazo:           { label: 'Impacto no prazo',        cor: 'bg-amber-100 text-amber-700 border-amber-200' },
  escopo:          { label: 'Mudança de escopo',       cor: 'bg-blue-100 text-blue-700 border-blue-200' },
};

const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return format(d, "dd/MM/yy 'às' HH:mm", { locale: ptBR });
  } catch { return '—'; }
};

// ── Formulário de criação de adendo ──────────────────────────────────────────
interface NovoAdendoForm {
  osId: string;
  campo: string;
  valorAnterior: string;
  valorNovo: string;
  motivo: string;
  impacto: AdendoMudanca['impacto'];
  valorImpacto: string;
}

const FORM_INICIAL: NovoAdendoForm = {
  osId: '',
  campo: '',
  valorAnterior: '',
  valorNovo: '',
  motivo: '',
  impacto: 'sem_custo',
  valorImpacto: '',
};

// ── Componente principal ──────────────────────────────────────────────────────
interface Props {
  projectId: string;
  adendos: AdendoMudanca[];
  onAdendoSalvo?: () => void;
}

const ProjectAdendoMudancas: React.FC<Props> = ({ projectId, adendos, onAdendoSalvo }) => {
  const { currentUser, userProfile } = useAuth();
  const { ordens } = useProjectOS(projectId);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState<NovoAdendoForm>(FORM_INICIAL);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const setField = (field: keyof NovoAdendoForm, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const isFormValid = form.osId && form.campo && form.valorAnterior && form.valorNovo && form.motivo;

  const salvarAdendo = useCallback(async () => {
    if (!isFormValid || !currentUser) return;
    setSaving(true);
    try {
      const osSelecionada = ordens.find(o => o.id === form.osId);
      const nextNumber = (adendos.length || 0) + 1;

      const adendo: Omit<AdendoMudanca, 'id'> = {
        projectId,
        osId: form.osId,
        osTitulo: osSelecionada?.title || form.osId,
        campo: form.campo,
        valorAnterior: form.valorAnterior,
        valorNovo: form.valorNovo,
        motivo: form.motivo,
        impacto: form.impacto,
        ...(form.valorImpacto ? { valorImpacto: parseFloat(form.valorImpacto) } : {}),
        aprovadoPor: currentUser.uid,
        aprovadoPorNome: userProfile?.displayName || currentUser.email || '',
        criadoEm: Timestamp.now(),
        numero: nextNumber,
      };

      // Salva na sub-coleção do projeto
      const adendoRef = await addDoc(
        collection(db, CollectionName.PROJECTS_V2, projectId, 'adendos'),
        adendo
      );

      // Registra referência na O.S. original
      if (form.osId) {
        await updateDoc(doc(db, CollectionName.TASKS, form.osId), {
          adendos: [...(osSelecionada as any)?.adendos || [], { adendoId: adendoRef.id, numero: nextNumber, resumo: `${form.campo}: ${form.valorNovo}`, criadoEm: adendo.criadoEm }],
          atualizadoEm: serverTimestamp(),
        }).catch(() => {}); // silencioso se a O.S. não tiver o campo
      }

      setMostrarForm(false);
      setForm(FORM_INICIAL);
      onAdendoSalvo?.();
    } finally { setSaving(false); }
  }, [form, currentUser, userProfile, projectId, ordens, adendos, isFormValid, onAdendoSalvo]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-orange-600" /> Adendos de Mudanças
            {adendos.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 bg-orange-100 text-orange-700 border border-orange-200 rounded-full">
                {adendos.length} adendo{adendos.length !== 1 ? 's' : ''}
              </span>
            )}
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Registre formalmente alterações em O.S. já emitidas. Cada adendo é rastreado e incluso no relatório final.
          </p>
        </div>
        <button onClick={() => setMostrarForm(!mostrarForm)}
          className="flex items-center gap-1.5 px-3 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Novo Adendo
        </button>
      </div>

      {/* Formulário de criação */}
      {mostrarForm && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-extrabold text-orange-800 flex items-center gap-1.5">
              <Edit3 className="w-4 h-4" /> Novo Adendo #{(adendos.length || 0) + 1}
            </p>
            <button onClick={() => { setMostrarForm(false); setForm(FORM_INICIAL); }}
              className="p-1 rounded-lg hover:bg-orange-100 text-orange-500">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* O.S. afetada */}
          <div>
            <label className="text-[10px] font-bold text-gray-600 block mb-1">O.S. Afetada *</label>
            <select value={form.osId} onChange={e => setField('osId', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-400 bg-white">
              <option value="">Selecione a O.S...</option>
              {ordens.map(os => (
                <option key={os.id} value={os.id}>{os.code ? `#${os.code} — ` : ''}{os.title}</option>
              ))}
            </select>
          </div>

          {/* Campo que mudou */}
          <div>
            <label className="text-[10px] font-bold text-gray-600 block mb-1">Campo Alterado *</label>
            <select value={form.campo} onChange={e => setField('campo', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-400 bg-white">
              <option value="">Selecione o campo...</option>
              {CAMPOS_MUDANCA.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Valores */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-600 block mb-1">Valor Anterior *</label>
              <textarea value={form.valorAnterior} onChange={e => setField('valorAnterior', e.target.value)}
                rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none"
                placeholder="O que estava definido antes..." />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 block mb-1">Valor Novo *</label>
              <textarea value={form.valorNovo} onChange={e => setField('valorNovo', e.target.value)}
                rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none"
                placeholder="Como ficou acordado..." />
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="text-[10px] font-bold text-gray-600 block mb-1">Motivo / Justificativa *</label>
            <textarea value={form.motivo} onChange={e => setField('motivo', e.target.value)}
              rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none"
              placeholder="Por que essa mudança foi necessária?" />
          </div>

          {/* Impacto */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-600 block mb-1">Tipo de Impacto</label>
              <select value={form.impacto} onChange={e => setField('impacto', e.target.value as AdendoMudanca['impacto'])}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
                {Object.entries(IMPACTO_CONFIG).map(([val, cfg]) => (
                  <option key={val} value={val}>{cfg.label}</option>
                ))}
              </select>
            </div>
            {(form.impacto === 'custo_adicional' || form.impacto === 'reducao_custo') && (
              <div>
                <label className="text-[10px] font-bold text-gray-600 block mb-1">Valor (R$)</label>
                <input type="number" step="0.01" value={form.valorImpacto}
                  onChange={e => setField('valorImpacto', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
                  placeholder="0,00" />
              </div>
            )}
          </div>

          {/* Aviso */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Este adendo ficará vinculado à O.S. e será incluído automaticamente no <strong>Relatório Final</strong> do projeto.
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => { setMostrarForm(false); setForm(FORM_INICIAL); }}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={salvarAdendo} disabled={saving || !isFormValid}
              className="px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Registrar Adendo
            </button>
          </div>
        </div>
      )}

      {/* Lista de adendos */}
      {adendos.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-xs text-gray-400">Nenhum adendo registrado.</p>
          <p className="text-[10px] text-gray-300 mt-0.5">
            Adendos são necessários quando uma O.S. já emitida sofre alterações.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {adendos.map(adendo => {
            const impactoCfg = IMPACTO_CONFIG[adendo.impacto];
            const isExpanded = expandedId === adendo.id;
            return (
              <div key={adendo.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <button onClick={() => setExpandedId(isExpanded ? null : adendo.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                  <span className="text-[10px] font-extrabold text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 flex-shrink-0">
                    Adendo #{adendo.numero}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{adendo.campo}</p>
                    <p className="text-[10px] text-gray-400 truncate">{adendo.osTitulo}</p>
                  </div>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${impactoCfg.cor}`}>
                    {impactoCfg.label}
                  </span>
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                        <p className="text-[9px] font-bold text-red-500 uppercase tracking-wide mb-1">Antes</p>
                        <p className="text-xs text-gray-700">{adendo.valorAnterior}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                        <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide mb-1">Depois</p>
                        <p className="text-xs text-gray-700">{adendo.valorNovo}</p>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wide mb-1">Motivo</p>
                      <p className="text-xs text-gray-700">{adendo.motivo}</p>
                    </div>
                    {adendo.valorImpacto && (
                      <p className="text-xs text-gray-500">
                        Impacto financeiro: <strong>R$ {adendo.valorImpacto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-gray-400">
                      <span className="flex items-center gap-0.5"><User className="w-3 h-3" />{adendo.aprovadoPorNome}</span>
                      <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{fmtDate(adendo.criadoEm)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProjectAdendoMudancas;
