import React, { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, Timestamp, getDocs, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  CollectionName, Survey, SurveyQuestion, SurveyQuestionType, SurveyKpiType,
  SurveyType, SurveyStatus, SurveyResponse,
} from '../types';
import {
  ClipboardList, Plus, Trash2, Edit, Play, Square, ChevronDown, ChevronRight,
  Users, BarChart3, AlertTriangle, X, CheckCircle2, Loader2, Eye, Copy,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────────────────────── */

const TIPO_LABELS: Record<SurveyType, string> = {
  pulso:    '📊 Pulso Mensal',
  transicao:'🔄 Transição / Linha de Base',
  inovacao: '🚀 Avaliação de Inovação',
};

const QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  enps:               'eNPS (Escala 0–10 com Motor)',
  escala_0_10:        'Escala Numérica (0–10)',
  multipla_ordenada:  'Múltipla Escolha Ordenada (pior→melhor)',
  multipla_categorica:'Múltipla Escolha Categórica (sem ordem)',
  satisfacao:         'Escala de Satisfação (Muito Insatisfeito→Muito Satisfeito)',
  dificuldade_1_5:    'Escala de Dificuldade (1–5)',
  campo_livre:        'Campo Livre (texto)',
};

const KPI_AUTO: Record<SurveyQuestionType, SurveyKpiType> = {
  enps:               'enps_score',
  escala_0_10:        'media_numerica',
  multipla_ordenada:  'percentual_favoravel',
  multipla_categorica:'distribuicao_categorica',
  satisfacao:         'taxa_satisfacao',
  dificuldade_1_5:    'indice_friccao',
  campo_livre:        'mural_qualitativo',
};

const INOVACAO_TEMPLATE: Omit<SurveyQuestion, 'id'>[] = [
  { texto: 'Pensando no processo antigo (como era feito antes desta mudança), que nota você daria para a eficiência e praticidade daquele formato?', tipo: 'escala_0_10', kpiTipo: 'delta_melhoria_antes', obrigatorio: true, ordem: 1 },
  { texto: 'Pensando no processo atual (com a nova mudança implementada), que nota você dá para a eficiência e praticidade de como está agora?',      tipo: 'escala_0_10', kpiTipo: 'delta_melhoria_depois', obrigatorio: true, ordem: 2 },
  {
    texto: 'Qual foi o seu nível de dificuldade para entender e se adaptar a essa nova mudança/ferramenta?',
    tipo: 'dificuldade_1_5', kpiTipo: 'indice_friccao', obrigatorio: true, ordem: 3,
    opcoes: ['1 — Muito Difícil (Ainda não consegui me adaptar)', '2 — Difícil (Tive muita dificuldade, mas estou conseguindo)', '3 — Moderado (Exigiu esforço, mas foi tranquilo)', '4 — Fácil (Adaptação rápida)', '5 — Muito Fácil (Intuitivo desde o primeiro dia)'],
  },
  {
    texto: 'No geral, qual é o seu nível de satisfação com essa mudança específica?',
    tipo: 'satisfacao', kpiTipo: 'taxa_satisfacao', obrigatorio: true, ordem: 4,
    opcoes: ['Muito Insatisfeito', 'Insatisfeito', 'Neutro', 'Satisfeito', 'Muito Satisfeito'],
  },
  { texto: 'Encontrou algum erro? Tem alguma ideia para melhorar essa mudança? Conta pra gente.', tipo: 'campo_livre', kpiTipo: 'mural_qualitativo', obrigatorio: false, ordem: 5 },
];

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */
function uid(): string { return Math.random().toString(36).slice(2, 10); }

function statusBadge(status: SurveyStatus) {
  const map: Record<SurveyStatus, { label: string; cls: string }> = {
    rascunho:  { label: '✏️ Rascunho',  cls: 'bg-gray-100 text-gray-600' },
    ativo:     { label: '🟢 Ativo',      cls: 'bg-green-100 text-green-700' },
    encerrado: { label: '🔴 Encerrado',  cls: 'bg-red-100 text-red-700' },
  };
  const { label, cls } = map[status];
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

/* ─────────────────────────────────────────────────────────────────────────────
   BLANK QUESTION FACTORY
───────────────────────────────────────────────────────────────────────────── */
function blankQuestion(): SurveyQuestion {
  return { id: uid(), texto: '', tipo: 'escala_0_10', kpiTipo: 'media_numerica', obrigatorio: true, ordem: 0, opcoes: [] };
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */
const SurveyManagement: React.FC = () => {
  const { currentUser } = useAuth();

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Survey | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [titulo,   setTitulo]   = useState('');
  const [descricao,setDescricao]= useState('');
  const [tipo,     setTipo]     = useState<SurveyType>('pulso');
  const [perguntas,setPerguntas]= useState<SurveyQuestion[]>([]);

  /* ── Load surveys ── */
  useEffect(() => {
    const q = query(collection(db, CollectionName.SURVEYS), orderBy('criadoEm', 'desc'));
    return onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Survey);
      setSurveys(docs);
      setLoading(false);
      // load response counts
      docs.forEach(async sv => {
        const rq = query(collection(db, CollectionName.SURVEY_RESPONSES), where('surveyId', '==', sv.id));
        const rs = await getDocs(rq);
        setResponseCounts(prev => ({ ...prev, [sv.id]: rs.size }));
      });
    }, () => setLoading(false));
  }, []);

  /* ── Open form ── */
  const openNew = () => {
    setEditTarget(null);
    setTitulo(''); setDescricao(''); setTipo('pulso'); setPerguntas([]);
    setShowForm(true);
  };

  const openEdit = (sv: Survey) => {
    setEditTarget(sv);
    setTitulo(sv.titulo); setDescricao(sv.descricao ?? ''); setTipo(sv.tipo);
    setPerguntas(sv.perguntas.map(q => ({ ...q, opcoes: q.opcoes ? [...q.opcoes] : [] })));
    setShowForm(true);
  };

  /* ── Auto-generate questions for inovacao template ── */
  useEffect(() => {
    if (tipo === 'inovacao' && perguntas.length === 0 && !editTarget) {
      setPerguntas(INOVACAO_TEMPLATE.map(q => ({ ...q, id: uid() })));
    }
  }, [tipo]);

  /* ── Question helpers ── */
  const addQuestion = () => setPerguntas(p => [...p, { ...blankQuestion(), ordem: p.length + 1 }]);
  const removeQuestion = (id: string) => setPerguntas(p => p.filter(q => q.id !== id));
  const updateQuestion = (id: string, patch: Partial<SurveyQuestion>) =>
    setPerguntas(p => p.map(q => q.id === id ? { ...q, ...patch } : q));

  const handleTypeChange = (id: string, newTipo: SurveyQuestionType) => {
    const kpiTipo = KPI_AUTO[newTipo];
    const defaultOpcoes: Record<string, string[]> = {
      satisfacao:         ['Muito Insatisfeito','Insatisfeito','Neutro','Satisfeito','Muito Satisfeito'],
      dificuldade_1_5:    ['1 — Muito Difícil','2 — Difícil','3 — Moderado','4 — Fácil','5 — Muito Fácil'],
    };
    updateQuestion(id, { tipo: newTipo, kpiTipo, opcoes: defaultOpcoes[newTipo] ?? [] });
  };

  /* ── Save survey ── */
  const handleSave = async () => {
    if (!titulo.trim() || !currentUser) return;
    setSaving(true);
    try {
      const payload = {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        tipo,
        status: 'rascunho' as SurveyStatus,
        perguntas: perguntas.map((q, i) => ({ ...q, ordem: i + 1 })),
        criadoPor: currentUser.uid,
        criadoEm: Timestamp.now(),
      };
      if (editTarget) {
        await updateDoc(doc(db, CollectionName.SURVEYS, editTarget.id), { ...payload, criadoEm: editTarget.criadoEm });
      } else {
        await addDoc(collection(db, CollectionName.SURVEYS), payload);
      }
      setShowForm(false);
    } catch (err) {
      console.error('Erro ao salvar pesquisa:', err);
      alert('Erro ao salvar. Tente novamente.');
    } finally { setSaving(false); }
  };

  /* ── Publish / Close ── */
  const setStatus = async (id: string, status: SurveyStatus) => {
    const patch: Record<string, unknown> = { status };
    if (status === 'encerrado') patch.encerradoEm = Timestamp.now();
    await updateDoc(doc(db, CollectionName.SURVEYS, id), patch);
  };

  /* ── Delete ── */
  const handleDelete = async (sv: Survey) => {
    if (!confirm(`Excluir a pesquisa "${sv.titulo}"? Esta ação não pode ser desfeita.`)) return;
    await deleteDoc(doc(db, CollectionName.SURVEYS, sv.id));
  };

  /* ─────────────────────────────────────────────────── */
  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px] text-gray-400">
      <Loader2 size={24} className="animate-spin mr-2" /> Carregando pesquisas...
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="text-violet-500" size={28} /> Pesquisas Internas
          </h1>
          <p className="text-gray-500 text-sm mt-1">People Analytics — Clima, eNPS e Avaliações de Inovação</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2.5 rounded-xl hover:bg-violet-700 transition-colors font-bold text-sm shadow-sm">
          <Plus size={18} /> Nova Pesquisa
        </button>
      </div>

      {/* Surveys list */}
      <div className="space-y-3">
        {surveys.length === 0 && (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center text-gray-400">
            <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma pesquisa criada ainda.</p>
            <p className="text-sm mt-1">Clique em "Nova Pesquisa" para começar.</p>
          </div>
        )}
        {surveys.map(sv => (
          <div key={sv.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {/* Survey header row */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <button onClick={() => setExpanded(expanded === sv.id ? null : sv.id)} className="flex-1 flex items-center gap-3 text-left">
                {expanded === sv.id ? <ChevronDown size={18} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{sv.titulo}</p>
                  <p className="text-xs text-gray-500">{TIPO_LABELS[sv.tipo]} · {responseCounts[sv.id] ?? 0} respostas</p>
                </div>
              </button>
              {statusBadge(sv.status)}
              {/* Action buttons */}
              <div className="flex items-center gap-1.5 ml-2">
                {sv.status === 'rascunho' && (
                  <button onClick={() => setStatus(sv.id, 'ativo')} title="Publicar"
                    className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1">
                    <Play size={14} /> Publicar
                  </button>
                )}
                {sv.status === 'ativo' && (
                  <button onClick={() => setStatus(sv.id, 'encerrado')} title="Encerrar"
                    className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1">
                    <Square size={14} /> Encerrar
                  </button>
                )}
                <button onClick={() => openEdit(sv)} title="Editar"
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Edit size={16} />
                </button>
                <button onClick={() => handleDelete(sv)} title="Excluir"
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {/* Expanded: perguntas */}
            {expanded === sv.id && (
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
                {sv.perguntas.length === 0 && <p className="text-xs text-gray-400">Esta pesquisa não tem perguntas.</p>}
                {sv.perguntas.map((q, i) => (
                  <div key={q.id} className="flex items-start gap-3 bg-white border border-gray-100 rounded-lg px-3 py-2.5">
                    <span className="text-xs font-bold text-violet-500 bg-violet-50 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 leading-snug">{q.texto}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{QUESTION_TYPE_LABELS[q.tipo]} · KPI: <span className="font-mono">{q.kpiTipo}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── FORM MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editTarget ? 'Editar Pesquisa' : 'Nova Pesquisa'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Privacy notice */}
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle size={16} className="text-violet-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-violet-800 leading-relaxed">
                  <strong>Aviso de privacidade</strong> será exibido obrigatoriamente no topo desta pesquisa para todos os colaboradores. As respostas são <strong>100% anônimas</strong>.
                </p>
              </div>

              {/* Título */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Título da Pesquisa *</label>
                <input value={titulo} onChange={e => setTitulo(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400"
                  placeholder="Ex: Avaliação de Mudança — Novo Módulo de O.S." />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Descrição (opcional)</label>
                <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400 resize-none"
                  placeholder="Contexto ou instrução adicional para os respondentes..." />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Tipo de Pesquisa *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(Object.keys(TIPO_LABELS) as SurveyType[]).map(t => (
                    <button key={t} onClick={() => setTipo(t)}
                      className={`text-sm px-3 py-2 rounded-xl border-2 text-left transition-all font-medium ${tipo === t ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:border-violet-300'}`}>
                      {TIPO_LABELS[t]}
                    </button>
                  ))}
                </div>
                {tipo === 'inovacao' && (
                  <p className="text-xs text-violet-600 mt-2 flex items-center gap-1">
                    <CheckCircle2 size={12} /> As 5 perguntas padrão de avaliação de mudança foram geradas automaticamente abaixo.
                  </p>
                )}
              </div>

              {/* Perguntas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-700">Perguntas</label>
                  <button onClick={addQuestion}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-bold bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1.5 transition-colors">
                    <Plus size={13} /> Adicionar Pergunta
                  </button>
                </div>
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {perguntas.map((q, idx) => (
                    <QuestionEditor key={q.id} q={q} idx={idx}
                      onChange={patch => updateQuestion(q.id, patch)}
                      onChangeType={t => handleTypeChange(q.id, t)}
                      onDelete={() => removeQuestion(q.id)} />
                  ))}
                  {perguntas.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
                      Nenhuma pergunta adicionada. Clique em "+ Adicionar Pergunta".
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || !titulo.trim()}
                className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-40 transition-colors text-sm font-bold flex items-center justify-center gap-2">
                {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : <><CheckCircle2 size={16} /> Salvar como Rascunho</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   QUESTION EDITOR (sub-component)
───────────────────────────────────────────────────────────────────────────── */
interface QuestionEditorProps {
  q: SurveyQuestion;
  idx: number;
  onChange: (patch: Partial<SurveyQuestion>) => void;
  onChangeType: (tipo: SurveyQuestionType) => void;
  onDelete: () => void;
}
const QuestionEditor: React.FC<QuestionEditorProps> = ({ q, idx, onChange, onChangeType, onDelete }) => {
  const needsOpcoes = ['multipla_ordenada','multipla_categorica','satisfacao','dificuldade_1_5'].includes(q.tipo);
  const [opcoesText, setOpcoesText] = useState((q.opcoes ?? []).join('\n'));

  const handleOpcoesBlur = () => {
    const arr = opcoesText.split('\n').map(s => s.trim()).filter(Boolean);
    onChange({ opcoes: arr });
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-violet-500 bg-violet-50 rounded-full px-2 py-0.5">Pergunta {idx + 1}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-gray-400">KPI: {q.kpiTipo}</span>
          <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"><Trash2 size={14} /></button>
        </div>
      </div>
      {/* Texto */}
      <textarea value={q.texto} onChange={e => onChange({ texto: e.target.value })} rows={2}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400 resize-none bg-white"
        placeholder="Digite o enunciado da pergunta..." />
      {/* Tipo */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase">Tipo de resposta</label>
          <select value={q.tipo} onChange={e => onChangeType(e.target.value as SurveyQuestionType)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-violet-400 mt-0.5">
            {(Object.keys(QUESTION_TYPE_LABELS) as SurveyQuestionType[]).map(t => (
              <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col items-center justify-end gap-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase">Obrigatório</label>
          <button onClick={() => onChange({ obrigatorio: !q.obrigatorio })}
            className={`w-10 h-5 rounded-full transition-colors ${q.obrigatorio ? 'bg-violet-500' : 'bg-gray-200'}`}>
            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform mx-0.5 ${q.obrigatorio ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
      {/* Opções */}
      {needsOpcoes && (
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase">Opções (uma por linha)</label>
          <textarea value={opcoesText} onChange={e => setOpcoesText(e.target.value)} onBlur={handleOpcoesBlur} rows={3}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-violet-400 resize-none mt-0.5"
            placeholder={'Opção 1\nOpção 2\nOpção 3'} />
        </div>
      )}
      {/* Outro */}
      {['multipla_ordenada','multipla_categorica'].includes(q.tipo) && (
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={!!q.permitirOutro} onChange={e => onChange({ permitirOutro: e.target.checked })}
            className="rounded accent-violet-600" />
          Permitir campo "Outro (descreva)"
        </label>
      )}
    </div>
  );
};

export default SurveyManagement;
