import React, { useState, useEffect, useRef } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, Timestamp, getDocs, where, setDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  CollectionName, Survey, SurveyQuestion, SurveyQuestionType, SurveyKpiType,
  SurveyType, SurveyStatus, SurveyResponse, SurveyTemplate, SurveyAccessKey,
} from '../types';
import {
  ClipboardList, Plus, Trash2, Edit, Play, Square, ChevronDown, ChevronRight,
  Users, BarChart3, AlertTriangle, X, CheckCircle2, Loader2, Eye, Copy,
  LayoutTemplate, RefreshCw, Rocket, FileText, Save, PlusCircle,
  ArrowUp, ArrowDown, Key, Printer, Link, ShieldCheck, QrCode,
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

/* ─────────────────────────────────────────────────────────────────────────────
   3 TEMPLATES PRÉ-CADASTRADOS (BUILT-IN)
───────────────────────────────────────────────────────────────────────────── */

const TEMPLATE_TRANSICAO: Omit<SurveyQuestion, 'id'>[] = [
  {
    texto: 'Pensando no início do ano, antes da atual reestruturação, como você avalia o nível de organização e clareza dos processos do seu setor hoje?',
    tipo: 'multipla_ordenada', kpiTipo: 'percentual_favoravel', obrigatorio: true, ordem: 1,
    opcoes: ['Piorou consideravelmente', 'Piorou um pouco', 'Permaneceu igual', 'Melhorou um pouco', 'Melhorou consideravelmente'],
    permitirOutro: true,
  },
  {
    texto: 'Como você se sente em relação às recentes mudanças e novas ferramentas (como o sistema MGR-conect) que estão sendo implementadas?',
    tipo: 'multipla_ordenada', kpiTipo: 'percentual_favoravel', obrigatorio: true, ordem: 2,
    opcoes: [
      'Sinto-me sobrecarregado(a) e confuso(a) com as mudanças.',
      'Entendo o motivo, mas ainda tenho dificuldades na adaptação.',
      'Estou neutro(a) em relação às mudanças.',
      'Sinto-me otimista e percebo melhorias no dia a dia.',
      'Sinto-me muito motivado(a) e engajado(a) com a nova estrutura.',
    ],
    permitirOutro: true,
  },
  {
    texto: 'O que você considerava muito positivo na empresa no início do ano e que sente que NÃO devemos perder com essa reestruturação?',
    tipo: 'multipla_categorica', kpiTipo: 'distribuicao_categorica', obrigatorio: true, ordem: 3,
    opcoes: [
      'A flexibilidade nas decisões.',
      'O clima informal de trabalho.',
      'A proximidade com os colegas/liderança.',
      'A autonomia para realizar minhas tarefas.',
      'Não sinto que perdemos nada positivo.',
    ],
    permitirOutro: true,
  },
  {
    texto: 'Este espaço é seu. Compartilhe conosco ideias, sugestões de melhoria, novas funcionalidades para o sistema, ou qualquer satisfação/insatisfação que julgue importante para construirmos uma MGR melhor. (Lembre-se: seu sigilo é absoluto).',
    tipo: 'campo_livre', kpiTipo: 'mural_qualitativo', obrigatorio: true, ordem: 4,
  },
];

const TEMPLATE_PULSO: Omit<SurveyQuestion, 'id'>[] = [
  {
    texto: 'Em uma escala de 0 a 10, qual a probabilidade de você recomendar a empresa como um bom lugar para se trabalhar a um amigo ou familiar?',
    tipo: 'enps', kpiTipo: 'enps_score', obrigatorio: true, ordem: 1,
  },
  {
    texto: 'Neste último mês, você sentiu que teve os recursos, direcionamento e ferramentas necessárias para executar seu trabalho com excelência?',
    tipo: 'multipla_ordenada', kpiTipo: 'percentual_favoravel', obrigatorio: true, ordem: 2,
    opcoes: [
      'Não, faltaram muitos recursos/direcionamento.',
      'Às vezes, mas tive que improvisar em vários momentos.',
      'Na maioria das vezes sim.',
      'Sim, tive tudo o que precisei.',
    ],
    permitirOutro: true,
  },
  {
    texto: 'Como você avalia o seu volume de trabalho e nível de estresse nas últimas 4 semanas?',
    tipo: 'multipla_ordenada', kpiTipo: 'percentual_favoravel', obrigatorio: true, ordem: 3,
    opcoes: [
      'Volume excessivo, me sinto esgotado(a).',
      'Volume alto, um pouco acima do ideal.',
      'Volume adequado e equilibrado.',
      'Volume baixo, poderia assumir mais demandas.',
    ],
    permitirOutro: true,
  },
  {
    texto: 'Se você cometesse um erro não intencional hoje, você se sentiria seguro(a) para comunicá-lo à sua liderança imediatamente?',
    tipo: 'multipla_ordenada', kpiTipo: 'percentual_favoravel', obrigatorio: true, ordem: 4,
    opcoes: [
      'Definitivamente não.',
      'Provavelmente não.',
      'Provavelmente sim.',
      'Definitivamente sim.',
    ],
    permitirOutro: true,
  },
  {
    texto: 'O que aconteceu neste último mês que te deixou feliz ou frustrado? Tem alguma ideia nova para nossos processos ou algo que a gestão precisa saber? Este espaço é livre e seguro.',
    tipo: 'campo_livre', kpiTipo: 'mural_qualitativo', obrigatorio: true, ordem: 5,
  },
];

const TEMPLATE_INOVACAO: Omit<SurveyQuestion, 'id'>[] = [
  {
    texto: 'Pensando no processo antigo (como era feito antes desta mudança), que nota você daria para a eficiência e praticidade daquele formato?',
    tipo: 'escala_0_10', kpiTipo: 'delta_melhoria_antes', obrigatorio: true, ordem: 1,
  },
  {
    texto: 'Pensando no processo atual (com a nova mudança implementada), que nota você dá para a eficiência e praticidade de como está agora?',
    tipo: 'escala_0_10', kpiTipo: 'delta_melhoria_depois', obrigatorio: true, ordem: 2,
  },
  {
    texto: 'Qual foi o seu nível de dificuldade para entender e se adaptar a essa nova mudança/ferramenta?',
    tipo: 'dificuldade_1_5', kpiTipo: 'indice_friccao', obrigatorio: true, ordem: 3,
    opcoes: [
      '1 — Muito Difícil (Ainda não consegui me adaptar)',
      '2 — Difícil (Tive muita dificuldade, mas estou conseguindo)',
      '3 — Moderado (Exigiu um pouco de esforço, mas foi tranquilo)',
      '4 — Fácil (Adaptação rápida)',
      '5 — Muito Fácil (Intuitivo desde o primeiro dia)',
    ],
  },
  {
    texto: 'No geral, qual é o seu nível de satisfação com essa mudança específica?',
    tipo: 'satisfacao', kpiTipo: 'taxa_satisfacao', obrigatorio: true, ordem: 4,
    opcoes: ['Muito Insatisfeito', 'Insatisfeito', 'Neutro', 'Satisfeito', 'Muito Satisfeito'],
  },
  {
    texto: 'Encontrou algum erro? Tem alguma ideia para melhorar essa mudança ou algo que dificultou seu trabalho? Conta pra gente.',
    tipo: 'campo_livre', kpiTipo: 'mural_qualitativo', obrigatorio: false, ordem: 5,
  },
];

const BUILTIN_TEMPLATES: { id: string; nome: string; descricao: string; tipo: SurveyType; perguntas: Omit<SurveyQuestion, 'id'>[] }[] = [
  {
    id: 'tpl_transicao', nome: 'Pesquisa de Transição', tipo: 'transicao',
    descricao: 'Comparativo início do ano vs. agora — entender como a reestruturação impacta o time.',
    perguntas: TEMPLATE_TRANSICAO,
  },
  {
    id: 'tpl_pulso', nome: 'Pesquisa de Pulso Mensal', tipo: 'pulso',
    descricao: 'Acompanhamento contínuo de clima, eNPS e bem-estar. Rápida e direta.',
    perguntas: TEMPLATE_PULSO,
  },
  {
    id: 'tpl_inovacao', nome: 'Avaliação de Inovação / Processo', tipo: 'inovacao',
    descricao: 'Bloco padrão para avaliar cada mudança ou novo processo implementado.',
    perguntas: TEMPLATE_INOVACAO,
  },
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

function blankQuestion(): SurveyQuestion {
  return { id: uid(), texto: '', tipo: 'escala_0_10', kpiTipo: 'media_numerica', obrigatorio: true, ordem: 0, opcoes: [] };
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */
const SurveyManagement: React.FC = () => {
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'modelos' | 'pesquisas'>('modelos');
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});

  // ── Survey creation (from template) ──
  const [showSurveyForm, setShowSurveyForm] = useState(false);
  const [surveyTemplate, setSurveyTemplate] = useState<SurveyTemplate | null>(null);
  const [surveyMode, setSurveyMode] = useState<'continua' | 'nova'>('nova');
  const [surveyTitulo, setSurveyTitulo] = useState('');
  const [surveyDescricao, setSurveyDescricao] = useState('');
  const [savingSurvey, setSavingSurvey] = useState(false);

  // ── Access Keys modal (Sprint 52) ──
  const [showKeysModal, setShowKeysModal] = useState(false);
  const [keysModalSurvey, setKeysModalSurvey] = useState<Survey | null>(null);
  const [keyCount, setKeyCount] = useState(10);
  const [generatedKeys, setGeneratedKeys] = useState<SurveyAccessKey[]>([]);
  const [generatingKeys, setGeneratingKeys] = useState(false);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // ── Template editing ──
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SurveyTemplate | null>(null);
  const [tplNome, setTplNome] = useState('');
  const [tplDescricao, setTplDescricao] = useState('');
  const [tplTipo, setTplTipo] = useState<SurveyType>('pulso');
  const [tplPerguntas, setTplPerguntas] = useState<SurveyQuestion[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);

  /* ── Seed built-in templates on first load ── */
  const seedTemplates = async () => {
    if (!currentUser) return;
    for (const tpl of BUILTIN_TEMPLATES) {
      const docRef = doc(db, CollectionName.SURVEY_TEMPLATES, tpl.id);
      const snap = await getDocs(query(collection(db, CollectionName.SURVEY_TEMPLATES), where('__name__', '==', tpl.id)));
      if (snap.empty) {
        await setDoc(docRef, {
          nome: tpl.nome,
          descricao: tpl.descricao,
          tipo: tpl.tipo,
          perguntas: tpl.perguntas.map(q => ({ ...q, id: uid() })),
          criadoPor: currentUser.uid,
          criadoEm: Timestamp.now(),
          builtIn: true,
        });
      }
    }
  };

  /* ── Load templates ── */
  useEffect(() => {
    seedTemplates();
    const q = query(collection(db, CollectionName.SURVEY_TEMPLATES), orderBy('criadoEm', 'asc'));
    return onSnapshot(q, snap => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SurveyTemplate));
    });
  }, [currentUser]);

  /* ── Load surveys ── */
  useEffect(() => {
    const q = query(collection(db, CollectionName.SURVEYS), orderBy('criadoEm', 'desc'));
    return onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Survey);
      setSurveys(docs);
      setLoading(false);
      docs.forEach(async sv => {
        const rq = query(collection(db, CollectionName.SURVEY_RESPONSES), where('surveyId', '==', sv.id));
        const rs = await getDocs(rq);
        setResponseCounts(prev => ({ ...prev, [sv.id]: rs.size }));
      });
    }, () => setLoading(false));
  }, []);

  /* ═══════════════════════════════════════════════════════════════════════════
     TEMPLATE ACTIONS — perguntas são editáveis SOMENTE nos modelos
  ═══════════════════════════════════════════════════════════════════════════ */

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTplNome(''); setTplDescricao(''); setTplTipo('pulso'); setTplPerguntas([]);
    setShowTemplateForm(true);
  };

  const openEditTemplate = (tpl: SurveyTemplate) => {
    setEditingTemplate(tpl);
    setTplNome(tpl.nome); setTplDescricao(tpl.descricao); setTplTipo(tpl.tipo);
    setTplPerguntas(tpl.perguntas.map(q => ({ ...q, opcoes: q.opcoes ? [...q.opcoes] : [] })));
    setShowTemplateForm(true);
  };

  const addTplQuestion = () => setTplPerguntas(p => [...p, { ...blankQuestion(), ordem: p.length + 1 }]);
  const removeTplQuestion = (id: string) => setTplPerguntas(p => p.filter(q => q.id !== id));
  const moveTplQuestion = (idx: number, dir: 'up' | 'down') => {
    setTplPerguntas(prev => {
      const arr = [...prev];
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  };
  const updateTplQuestion = (id: string, patch: Partial<SurveyQuestion>) =>
    setTplPerguntas(p => p.map(q => q.id === id ? { ...q, ...patch } : q));

  const handleTplTypeChange = (id: string, newTipo: SurveyQuestionType) => {
    const kpiTipo = KPI_AUTO[newTipo];
    const defaultOpcoes: Record<string, string[]> = {
      satisfacao:      ['Muito Insatisfeito','Insatisfeito','Neutro','Satisfeito','Muito Satisfeito'],
      dificuldade_1_5: ['1 — Muito Difícil','2 — Difícil','3 — Moderado','4 — Fácil','5 — Muito Fácil'],
    };
    updateTplQuestion(id, { tipo: newTipo, kpiTipo, opcoes: defaultOpcoes[newTipo] ?? [] });
  };

  const handleSaveTemplate = async () => {
    if (!tplNome.trim() || !currentUser) return;
    setSavingTemplate(true);
    try {
      const payload = {
        nome: tplNome.trim(),
        descricao: tplDescricao.trim(),
        tipo: tplTipo,
        perguntas: tplPerguntas.map((q, i) => ({ ...q, ordem: i + 1 })),
        criadoPor: currentUser.uid,
        criadoEm: editingTemplate?.criadoEm ?? Timestamp.now(),
        builtIn: editingTemplate?.builtIn ?? false,
      };
      if (editingTemplate) {
        await updateDoc(doc(db, CollectionName.SURVEY_TEMPLATES, editingTemplate.id), payload);
      } else {
        await addDoc(collection(db, CollectionName.SURVEY_TEMPLATES), payload);
      }
      setShowTemplateForm(false);
    } catch (err) {
      console.error('Erro ao salvar modelo:', err);
      alert('Erro ao salvar modelo.');
    } finally { setSavingTemplate(false); }
  };

  const handleDeleteTemplate = async (tpl: SurveyTemplate) => {
    if (tpl.builtIn) { alert('Modelos padrão não podem ser excluídos.'); return; }
    if (!confirm(`Excluir o modelo "${tpl.nome}"?`)) return;
    await deleteDoc(doc(db, CollectionName.SURVEY_TEMPLATES, tpl.id));
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     SURVEY ACTIONS — pesquisas HERDAM perguntas do modelo (read-only)
  ═══════════════════════════════════════════════════════════════════════════ */

  const openSurveyFromTemplate = (tpl: SurveyTemplate, mode: 'continua' | 'nova') => {
    setSurveyTemplate(tpl);
    setSurveyMode(mode);
    setSurveyDescricao(tpl.descricao);

    if (mode === 'continua') {
      const prevSurveys = surveys.filter(s => s.templateId === tpl.id);
      const nextEdicao = prevSurveys.length > 0
        ? Math.max(...prevSurveys.map(s => s.edicao ?? 1)) + 1
        : 1;
      setSurveyTitulo(`${tpl.nome} — Edição ${nextEdicao}`);
    } else {
      setSurveyTitulo('');
    }
    setShowSurveyForm(true);
  };

  const handleSaveSurvey = async () => {
    if (!surveyTitulo.trim() || !currentUser || !surveyTemplate) return;
    setSavingSurvey(true);
    try {
      const prevSurveys = surveys.filter(s => s.templateId === surveyTemplate.id);
      const edicao = surveyMode === 'continua'
        ? (prevSurveys.length > 0 ? Math.max(...prevSurveys.map(s => s.edicao ?? 1)) + 1 : 1)
        : undefined;

      // Herdar perguntas do modelo (read-only) — com novos IDs para isolamento de respostas
      const perguntas = surveyTemplate.perguntas.map(q => ({ ...q, id: uid() }));

      await addDoc(collection(db, CollectionName.SURVEYS), {
        titulo: surveyTitulo.trim(),
        descricao: surveyDescricao.trim(),
        tipo: surveyTemplate.tipo,
        status: 'rascunho' as SurveyStatus,
        perguntas,
        criadoPor: currentUser.uid,
        criadoEm: Timestamp.now(),
        templateId: surveyTemplate.id,
        ...(edicao ? { edicao } : {}),
      });
      setShowSurveyForm(false);
    } catch (err) {
      console.error('Erro ao criar pesquisa:', err);
      alert('Erro ao criar pesquisa.');
    } finally { setSavingSurvey(false); }
  };

  /* ── Access Keys (Sprint 52) ── */
  const openKeysModal = async (sv: Survey) => {
    setKeysModalSurvey(sv);
    setShowKeysModal(true);
    setGeneratedKeys([]);
    setLoadingKeys(true);
    try {
      const q = query(
        collection(db, CollectionName.SURVEY_ACCESS_KEYS),
        where('surveyId', '==', sv.id),
        orderBy('criadoEm', 'asc'),
      );
      const snap = await getDocs(q);
      setGeneratedKeys(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SurveyAccessKey));
    } finally {
      setLoadingKeys(false);
    }
  };

  const generateRandomKey = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1 para evitar confusão
    let result = '';
    for (let i = 0; i < 8; i++) {
      if (i === 4) result += '-';
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  };

  const handleGenerateKeys = async () => {
    if (!keysModalSurvey || !currentUser) return;
    setGeneratingKeys(true);
    try {
      const batch = writeBatch(db);
      const newKeys: SurveyAccessKey[] = [];
      for (let i = 0; i < keyCount; i++) {
        const ref = doc(collection(db, CollectionName.SURVEY_ACCESS_KEYS));
        const chave = generateRandomKey();
        const key: Omit<SurveyAccessKey, 'id'> = {
          surveyId: keysModalSurvey.id,
          chave,
          usado: false,
          criadoEm: Timestamp.now(),
        };
        batch.set(ref, key);
        newKeys.push({ id: ref.id, ...key });
      }
      // Atualiza survey com linkPublico=true e totalParticipantes
      batch.update(doc(db, CollectionName.SURVEYS, keysModalSurvey.id), {
        linkPublico: true,
        totalParticipantes: (keysModalSurvey.totalParticipantes ?? 0) + keyCount,
      });
      await batch.commit();
      setGeneratedKeys(prev => [...prev, ...newKeys]);
      setKeysModalSurvey(prev => prev ? {
        ...prev,
        linkPublico: true,
        totalParticipantes: (prev.totalParticipantes ?? 0) + keyCount,
      } : prev);
    } finally {
      setGeneratingKeys(false);
    }
  };

  const getSurveyPublicUrl = (sv: Survey) => {
    const base = window.location.origin + window.location.pathname;
    // HashRouter → URL com #
    return `${base}#/pesquisa/${sv.id}`;
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Popup bloqueado. Permita popups para imprimir.'); return; }
    win.document.write(`
      <!DOCTYPE html><html><head>
        <title>Chaves de Acesso — ${keysModalSurvey?.titulo}</title>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; background: white; }
          .page { display: flex; flex-wrap: wrap; gap: 0; }
          .slip {
            width: 50%; border: 1px dashed #ccc; padding: 18px 16px;
            page-break-inside: avoid; display: flex; flex-direction: column;
            align-items: center; gap: 8px;
          }
          .slip-title { font-size: 11px; font-weight: 700; text-transform: uppercase;
            color: #1e40af; letter-spacing: 0.05em; text-align: center; }
          .slip-survey { font-size: 13px; font-weight: 700; color: #111827;
            text-align: center; line-height: 1.3; max-width: 220px; }
          .slip-qr { width: 140px; height: 140px; border: 2px solid #e5e7eb; border-radius: 8px; }
          .slip-key-label { font-size: 10px; color: #6b7280; font-weight: 600; }
          .slip-key { font-size: 22px; font-weight: 800; font-family: monospace;
            letter-spacing: 0.15em; color: #111827; border: 2px solid #dbeafe;
            background: #eff6ff; padding: 6px 14px; border-radius: 8px; }
          .slip-anon { font-size: 10px; color: #15803d; font-weight: 600;
            text-align: center; max-width: 220px; line-height: 1.4; }
          .slip-instructions { font-size: 10px; color: #374151; text-align: center;
            max-width: 220px; line-height: 1.5; }
          .slip-status { font-size: 10px; font-weight: 700;
            padding: 2px 8px; border-radius: 9999px; }
          .slip-status.used { background: #fee2e2; color: #dc2626; }
          .slip-status.available { background: #dcfce7; color: #16a34a; }
          .mgr-logo { font-size: 10px; font-weight: 800; color: #1e40af;
            letter-spacing: 0.1em; }
          @media print {
            @page { size: A4; margin: 10mm; }
            .slip { width: 50%; }
          }
        </style>
      </head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  };

  /* ── Publish / Close ── */
  const setStatus = async (id: string, status: SurveyStatus) => {
    const patch: Record<string, unknown> = { status };
    if (status === 'encerrado') patch.encerradoEm = Timestamp.now();
    await updateDoc(doc(db, CollectionName.SURVEYS, id), patch);
  };

  const handleDeleteSurvey = async (sv: Survey) => {
    if (!confirm(`Excluir a pesquisa "${sv.titulo}"?`)) return;
    await deleteDoc(doc(db, CollectionName.SURVEYS, sv.id));
  };

  /* ── Derived ── */
  const getSurveysByTemplate = (tplId: string) =>
    surveys.filter(s => s.templateId === tplId).sort((a, b) => (b.edicao ?? 0) - (a.edicao ?? 0));

  const getTemplateIcon = (tipo: SurveyType) => {
    switch (tipo) {
      case 'transicao': return '🔄';
      case 'pulso': return '📊';
      case 'inovacao': return '🚀';
    }
  };

  /* ─────────────────────────────────────────────────── */
  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px] text-gray-400">
      <Loader2 size={24} className="animate-spin mr-2" /> Carregando...
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="text-violet-500" size={28} /> Pesquisas Internas
          </h1>
          <p className="text-gray-500 text-sm mt-1">People Analytics — Modelos, Clima, eNPS e Avaliações</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-0 overflow-x-auto">
        {([
          { key: 'modelos' as const, label: 'Modelos de Pesquisa', icon: LayoutTemplate },
          { key: 'pesquisas' as const, label: 'Pesquisas Criadas', icon: FileText },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-violet-500 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: MODELOS ═══ */}
      {activeTab === 'modelos' && (
        <div className="space-y-4">
          {/* Instruction + New template button */}
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-violet-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-violet-800 leading-relaxed">
                <strong>As perguntas são editadas aqui nos modelos.</strong> Cada pesquisa criada herda automaticamente as perguntas do modelo vinculado. 
                Novas perguntas adicionadas ao modelo serão incluídas nas próximas pesquisas. Para pesquisas com KPIs diferentes, crie um novo modelo.
              </p>
            </div>
            <button onClick={openNewTemplate}
              className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2.5 rounded-xl hover:bg-violet-700 transition-colors font-bold text-sm shadow-sm whitespace-nowrap flex-shrink-0">
              <PlusCircle size={16} /> Novo Modelo
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center text-gray-400">
              <LayoutTemplate size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum modelo cadastrado.</p>
            </div>
          ) : templates.map(tpl => {
            const related = getSurveysByTemplate(tpl.id);
            const isExpanded = expanded === `tpl_${tpl.id}`;
            return (
              <div key={tpl.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                {/* Template header */}
                <div className="flex items-center gap-3 px-4 py-4">
                  <button onClick={() => setExpanded(isExpanded ? null : `tpl_${tpl.id}`)}
                    className="flex-1 flex items-center gap-3 text-left">
                    {isExpanded ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-lg flex-shrink-0">
                      {getTemplateIcon(tpl.tipo)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900">{tpl.nome}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{tpl.descricao}</p>
                      <p className="text-[10px] text-violet-500 font-bold mt-1">
                        {tpl.perguntas.length} perguntas · {related.length} pesquisa(s) criada(s)
                        {tpl.builtIn && <span className="ml-2 bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full">Padrão</span>}
                      </p>
                    </div>
                  </button>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button onClick={() => openSurveyFromTemplate(tpl, 'continua')}
                      title="Criar pesquisa contínua (histórico comparativo)"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors">
                      <RefreshCw size={12} /> Contínua
                    </button>
                    <button onClick={() => openSurveyFromTemplate(tpl, 'nova')}
                      title="Criar nova pesquisa avulsa (KPIs separados)"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-xs font-bold transition-colors">
                      <Rocket size={12} /> Nova Avulsa
                    </button>
                  </div>

                  {/* Edit + Delete template */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => openEditTemplate(tpl)} title="Editar perguntas do modelo"
                      className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                      <Edit size={16} />
                    </button>
                    {!tpl.builtIn && (
                      <button onClick={() => handleDeleteTemplate(tpl)} title="Excluir modelo"
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded: questions + history */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-4">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Perguntas do Modelo</p>
                      <div className="space-y-1.5">
                        {tpl.perguntas.map((q, i) => (
                          <div key={q.id} className="flex items-start gap-2 bg-white border border-gray-100 rounded-lg px-3 py-2">
                            <span className="text-xs font-bold text-violet-500 bg-violet-50 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                            <div className="min-w-0">
                              <p className="text-sm text-gray-800 leading-snug">{q.texto}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {QUESTION_TYPE_LABELS[q.tipo]} · KPI: <span className="font-mono">{q.kpiTipo}</span>
                                {q.permitirOutro && <span className="ml-1 text-orange-500">· +Outro</span>}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {related.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                          Histórico de Pesquisas ({related.length})
                        </p>
                        <div className="space-y-1.5">
                          {related.map(sv => (
                            <div key={sv.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{sv.titulo}</p>
                                <p className="text-[10px] text-gray-400">
                                  {sv.edicao ? `Edição ${sv.edicao} · ` : ''}{responseCounts[sv.id] ?? 0} respostas · {sv.criadoEm?.toDate?.()?.toLocaleDateString('pt-BR') || '—'}
                                </p>
                              </div>
                              {statusBadge(sv.status)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ TAB: PESQUISAS ═══ */}
      {activeTab === 'pesquisas' && (
        <div className="space-y-3">
          {surveys.length === 0 && (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center text-gray-400">
              <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma pesquisa criada.</p>
              <p className="text-sm mt-1">Acesse a aba "Modelos" e crie uma pesquisa a partir de um modelo.</p>
            </div>
          )}
          {surveys.map(sv => {
            const tpl = templates.find(t => t.id === sv.templateId);
            return (
              <div key={sv.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <button onClick={() => setExpanded(expanded === sv.id ? null : sv.id)} className="flex-1 flex items-center gap-3 text-left">
                    {expanded === sv.id ? <ChevronDown size={18} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{sv.titulo}</p>
                      <p className="text-xs text-gray-500">
                        {TIPO_LABELS[sv.tipo]} · {responseCounts[sv.id] ?? 0} respostas
                        {tpl && <span className="ml-1 text-violet-500">· Modelo: {tpl.nome}</span>}
                        {sv.edicao && <span className="ml-1 text-blue-500">· Edição {sv.edicao}</span>}
                        {sv.linkPublico && (
                          <span className="ml-1 text-green-600 font-semibold">
                            · 🔗 Link público · {sv.totalParticipantes ?? 0} chaves
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                  {statusBadge(sv.status)}
                  <div className="flex items-center gap-1.5 ml-2">
                    {sv.status === 'rascunho' && (
                      <button onClick={() => setStatus(sv.id, 'ativo')} title="Publicar"
                        className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1">
                        <Play size={14} /> Publicar
                      </button>
                    )}
                    {sv.status === 'ativo' && (
                      <>
                        <button onClick={() => openKeysModal(sv)} title="Chaves de Acesso"
                          className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1">
                          <Key size={14} /> Chaves
                        </button>
                        <button onClick={() => setStatus(sv.id, 'encerrado')} title="Encerrar"
                          className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1">
                          <Square size={14} /> Encerrar
                        </button>
                      </>
                    )}
                    <button onClick={() => handleDeleteSurvey(sv)} title="Excluir"
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {expanded === sv.id && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Perguntas herdadas do modelo (somente leitura)</p>
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
            );
          })}
        </div>
      )}

      {/* ═══ MODAL: CRIAR PESQUISA (a partir de modelo — perguntas read-only) ═══ */}
      {showSurveyForm && surveyTemplate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Criar Pesquisa</h2>
                <p className="text-xs text-violet-600 mt-0.5">
                  {surveyMode === 'continua'
                    ? `📊 Contínua — alimenta o histórico de "${surveyTemplate.nome}"`
                    : `🚀 Avulsa — mesmo modelo, KPIs avaliados separadamente`}
                </p>
              </div>
              <button onClick={() => setShowSurveyForm(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Privacy notice */}
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle size={16} className="text-violet-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-violet-800 leading-relaxed">
                  <strong>100% anônima.</strong> As respostas serão vinculadas ao modelo "{surveyTemplate.nome}" para análise contínua de KPIs.
                </p>
              </div>

              {/* Título */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Título da Pesquisa *</label>
                <input value={surveyTitulo} onChange={e => setSurveyTitulo(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400"
                  placeholder={surveyTemplate.tipo === 'inovacao' ? 'Ex: Avaliação — Novo Módulo de O.S.' : 'Ex: Pulso de Clima — Março 2026'} />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Descrição (opcional)</label>
                <textarea value={surveyDescricao} onChange={e => setSurveyDescricao(e.target.value)} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400 resize-none"
                  placeholder="Contexto adicional..." />
              </div>

              {/* Perguntas herdadas (READ-ONLY) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-700">Perguntas do Modelo ({surveyTemplate.perguntas.length})</label>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">🔒 Somente leitura</span>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {surveyTemplate.perguntas.map((q, i) => (
                    <div key={q.id} className="flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                      <span className="text-xs font-bold text-violet-500 bg-violet-50 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-700 leading-snug">{q.texto}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{QUESTION_TYPE_LABELS[q.tipo]} · KPI: <span className="font-mono">{q.kpiTipo}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-violet-600 mt-2 flex items-center gap-1">
                  <Edit size={10} /> Para alterar perguntas, edite o modelo na aba "Modelos de Pesquisa".
                </p>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowSurveyForm(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium">
                Cancelar
              </button>
              <button onClick={handleSaveSurvey} disabled={savingSurvey || !surveyTitulo.trim()}
                className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-40 transition-colors text-sm font-bold flex items-center justify-center gap-2">
                {savingSurvey ? <><Loader2 size={16} className="animate-spin" /> Criando...</> : <><CheckCircle2 size={16} /> Criar como Rascunho</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: EDITAR MODELO (perguntas editáveis aqui) ═══ */}
      {showTemplateForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingTemplate ? `Editar Modelo: ${editingTemplate.nome}` : 'Novo Modelo de Pesquisa'}
              </h2>
              <button onClick={() => setShowTemplateForm(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
                <LayoutTemplate size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-800 leading-relaxed">
                  As perguntas definidas aqui serão herdadas por todas as pesquisas criadas a partir deste modelo.
                  Cada modelo gera seus próprios KPIs e gráficos independentes.
                </p>
              </div>

              {/* Nome */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Modelo *</label>
                <input value={tplNome} onChange={e => setTplNome(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400"
                  placeholder="Ex: Pesquisa de Rotatividade" />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Descrição</label>
                <textarea value={tplDescricao} onChange={e => setTplDescricao(e.target.value)} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400 resize-none"
                  placeholder="Objetivo e foco deste modelo de pesquisa..." />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Tipo *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(Object.keys(TIPO_LABELS) as SurveyType[]).map(t => (
                    <button key={t} onClick={() => setTplTipo(t)}
                      className={`text-sm px-3 py-2 rounded-xl border-2 text-left transition-all font-medium ${tplTipo === t ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:border-violet-300'}`}>
                      {TIPO_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Perguntas (EDITÁVEIS) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-700">Perguntas ({tplPerguntas.length})</label>
                  <button onClick={addTplQuestion}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-bold bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1.5 transition-colors">
                    <Plus size={13} /> Adicionar Pergunta
                  </button>
                </div>
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {tplPerguntas.map((q, idx) => (
                    <QuestionEditor key={q.id} q={q} idx={idx} total={tplPerguntas.length}
                      onChange={patch => updateTplQuestion(q.id, patch)}
                      onChangeType={t => handleTplTypeChange(q.id, t)}
                      onDelete={() => removeTplQuestion(q.id)}
                      onMoveUp={() => moveTplQuestion(idx, 'up')}
                      onMoveDown={() => moveTplQuestion(idx, 'down')} />
                  ))}
                  {tplPerguntas.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
                      Clique em "+ Adicionar Pergunta" para começar.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowTemplateForm(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium">
                Cancelar
              </button>
              <button onClick={handleSaveTemplate} disabled={savingTemplate || !tplNome.trim()}
                className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-40 transition-colors text-sm font-bold flex items-center justify-center gap-2">
                {savingTemplate ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : <><Save size={16} /> Salvar Modelo</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: CHAVES DE ACESSO (Sprint 52) ═══ */}
      {showKeysModal && keysModalSurvey && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">

            {/* header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Key size={20} className="text-blue-600" /> Chaves de Acesso
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">{keysModalSurvey.titulo}</p>
              </div>
              <button onClick={() => setShowKeysModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* link público */}
              {keysModalSurvey.linkPublico && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                  <Link size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-blue-800 mb-1">Link Público da Pesquisa</p>
                    <p className="text-xs font-mono text-blue-700 break-all">{getSurveyPublicUrl(keysModalSurvey)}</p>
                    <button
                      onClick={() => navigator.clipboard.writeText(getSurveyPublicUrl(keysModalSurvey))}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                    >
                      <Copy size={12} /> Copiar link
                    </button>
                  </div>
                </div>
              )}

              {/* gerar chaves */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-bold text-gray-700 mb-3">Gerar novas chaves de acesso</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Quantidade de participantes</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={keyCount}
                      onChange={e => setKeyCount(Math.max(1, Math.min(200, Number(e.target.value))))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleGenerateKeys}
                    disabled={generatingKeys}
                    className="mt-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold px-5 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
                  >
                    {generatingKeys
                      ? <><Loader2 size={14} className="animate-spin" /> Gerando...</>
                      : <><QrCode size={14} /> Gerar Chaves</>}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Cada chave permite exatamente uma resposta. Recomendamos gerar a mesma quantidade de funcionários participantes.
                </p>
              </div>

              {/* lista de chaves + imprimir */}
              {loadingKeys ? (
                <div className="flex items-center justify-center py-6 text-gray-400">
                  <Loader2 size={20} className="animate-spin mr-2" /> Carregando chaves...
                </div>
              ) : generatedKeys.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-gray-700">
                      {generatedKeys.length} chave{generatedKeys.length !== 1 ? 's' : ''} gerada{generatedKeys.length !== 1 ? 's' : ''}
                      {' '}· {generatedKeys.filter(k => k.usado).length} usada{generatedKeys.filter(k => k.usado).length !== 1 ? 's' : ''}
                      {' '}· {generatedKeys.filter(k => !k.usado).length} disponível{generatedKeys.filter(k => !k.usado).length !== 1 ? 'eis' : ''}
                    </p>
                    <button
                      onClick={handlePrint}
                      className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors"
                    >
                      <Printer size={14} /> Imprimir Chaves
                    </button>
                  </div>

                  {/* preview da lista */}
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-500 font-semibold">Chave</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-semibold">Status</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-semibold">Usada em</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {generatedKeys.map(k => (
                          <tr key={k.id} className={k.usado ? 'bg-red-50' : 'bg-white'}>
                            <td className="px-3 py-2 font-mono font-bold tracking-widest text-gray-800">{k.chave}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded-full font-bold ${k.usado ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                                {k.usado ? 'Usada' : 'Disponível'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-400">
                              {k.usadoEm ? new Date((k.usadoEm as any).seconds * 1000).toLocaleString('pt-BR') : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ CONTEÚDO DE IMPRESSÃO (oculto no ecrã, injetado na janela de impressão) ═══ */}
      <div ref={printRef} style={{ display: 'none' }}>
        {keysModalSurvey && (
          <div className="page">
            {generatedKeys.filter(k => !k.usado).map(k => {
              const url = encodeURIComponent(
                `${window.location.origin}${window.location.pathname}#/pesquisa/${keysModalSurvey.id}?key=${k.chave}`
              );
              const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&format=png&ecc=M&data=${url}`;
              return (
                <div key={k.id} className="slip">
                  <div className="mgr-logo">MGR CONECT</div>
                  <div className="slip-title">Pesquisa Interna Anônima</div>
                  <div className="slip-survey">{keysModalSurvey.titulo}</div>
                  <img src={qrSrc} alt="QR Code" className="slip-qr" />
                  <div className="slip-key-label">Sua Chave de Acesso</div>
                  <div className="slip-key">{k.chave}</div>
                  <div className="slip-anon">🔒 Resposta 100% anônima. Nenhum dado pessoal é coletado.</div>
                  <div className="slip-instructions">
                    Aponte a câmera do celular para o QR Code<br />
                    ou acesse o link e digite sua chave.<br />
                    Cada chave é de uso único.
                  </div>
                  <div className={`slip-status ${k.usado ? 'used' : 'available'}`}>
                    {k.usado ? 'USADA' : 'DISPONÍVEL'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   QUESTION EDITOR (sub-component — usado dentro do modal de MODELO)
───────────────────────────────────────────────────────────────────────────── */
interface QuestionEditorProps {
  q: SurveyQuestion;
  idx: number;
  total?: number;
  onChange: (patch: Partial<SurveyQuestion>) => void;
  onChangeType: (tipo: SurveyQuestionType) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}
const QuestionEditor: React.FC<QuestionEditorProps> = ({ q, idx, total = 0, onChange, onChangeType, onDelete, onMoveUp, onMoveDown }) => {
  const needsOpcoes = ['multipla_ordenada','multipla_categorica','satisfacao','dificuldade_1_5'].includes(q.tipo);
  const [opcoesText, setOpcoesText] = useState((q.opcoes ?? []).join('\n'));

  const handleOpcoesBlur = () => {
    const arr = opcoesText.split('\n').map(s => s.trim()).filter(Boolean);
    onChange({ opcoes: arr });
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {/* Reorder buttons */}
          <div className="flex flex-col gap-0.5">
            <button onClick={onMoveUp} disabled={idx === 0} title="Mover para cima"
              className="p-0.5 text-gray-400 hover:text-violet-600 disabled:opacity-20 disabled:cursor-not-allowed rounded transition-colors">
              <ArrowUp size={12} />
            </button>
            <button onClick={onMoveDown} disabled={idx >= total - 1} title="Mover para baixo"
              className="p-0.5 text-gray-400 hover:text-violet-600 disabled:opacity-20 disabled:cursor-not-allowed rounded transition-colors">
              <ArrowDown size={12} />
            </button>
          </div>
          <span className="text-xs font-bold text-violet-500 bg-violet-50 rounded-full px-2 py-0.5">Pergunta {idx + 1}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-gray-400">KPI: {q.kpiTipo}</span>
          <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"><Trash2 size={14} /></button>
        </div>
      </div>
      <textarea value={q.texto} onChange={e => onChange({ texto: e.target.value })} rows={2}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400 resize-none bg-white"
        placeholder="Digite o enunciado da pergunta..." />
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
      {needsOpcoes && (
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase">Opções (uma por linha)</label>
          <textarea value={opcoesText} onChange={e => setOpcoesText(e.target.value)} onBlur={handleOpcoesBlur} rows={3}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-violet-400 resize-none mt-0.5"
            placeholder={'Opção 1\nOpção 2\nOpção 3'} />
        </div>
      )}
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
