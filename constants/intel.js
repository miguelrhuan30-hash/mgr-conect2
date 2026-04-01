/**
 * constants/intel.js
 * Prompt estratégico e constantes do Módulo de Inteligência MGR.
 * Sprint 25 — Extração multi-ferramenta com acoes_hub[].
 */

// Contexto da empresa — injetado em todas as análises
export const MGR_CONTEXT = `
EMPRESA: MGR Soluções em Refrigeração Industrial
Fundada há 10 anos | Câmaras frigoríficas Walk-in | Refrigeração Industrial
SÓCIOS: Miguel (Gestão estratégica) | Giovanni (Comercial)
SETORES: Comercial · Técnico de Campo · Administrativo · Compras
PROCESSOS MAPEADOS:
  • atendimento-comercial   — prospecção → orçamento → aprovação
  • execucao-projetos       — kickoff → instalação → comissionamento
  • compra-materiais        — requisição → cotação → aprovação → compra
  • manutencao-preventiva   — agenda → execução → relatório
  • handoff-comercial       — confirmação Comercial → Adm após aprovação
FERRAMENTAS DO HUB: Eisenhower · Ishikawa · Business Model Canvas · BPMN · Roadmap
`;

// ─── PROMPT PRINCIPAL ─────────────────────────────────────────────────────────
// Sprint 25: além do destino primário, o Gemini extrai um array "acoes_hub"
// com TODOS os itens identificados na nota — permitindo roteamento multi-ferramenta.
export const MGR_INTEL_PROMPT = `${MGR_CONTEXT}

Você é o Orquestrador da MGR. Leia a anotação operacional abaixo e retorne
APENAS um objeto JSON válido (sem markdown, sem texto extra).

O JSON deve conter TODOS os campos abaixo:

{
  "tipo": "acao" | "fraqueza" | "oportunidade" | "processo" | "meta" | "alerta",
  "destino": "eisenhower" | "ishikawa" | "canvas" | "bpmn" | "roadmap",
  "area": "comercial" | "financeiro" | "operacional" | "rh" | "processos" | "geral",
  "sentimento": "alerta" | "oportunidade" | "neutra",
  "urgencia": "critica" | "alta" | "media" | "baixa",
  "resumo": "Uma frase até 80 chars explicando o impacto",
  "acao_sugerida": "Ação concreta até 90 chars",
  "tags": ["max 3 palavras-chave"],

  "eisenhower": {
    "quadrante": "do" | "plan" | "dele" | "elim",
    "titulo": "Título do card (max 60 chars)",
    "responsavel": "Nome ou setor",
    "prazo": "Prazo estimado"
  },
  "ishikawa": {
    "categoria": "Pessoas" | "Processos" | "Comunicação" | "Ferramentas" | "Gestão" | "Cultura",
    "causa": "Descrição da causa-raiz (max 70 chars)"
  },
  "canvas": {
    "celula": "parceiros" | "atividades" | "recursos" | "proposta" | "relacionamento" | "canais" | "clientes" | "custos" | "receitas",
    "conteudo": "Conteúdo para a célula (max 80 chars)"
  },
  "bpmn": {
    "processo": "atendimento-comercial" | "execucao-projetos" | "compra-materiais" | "manutencao-preventiva" | "handoff-comercial" | "novo",
    "task": "Nome da task BPMN (max 50 chars)",
    "novo_processo": ""
  },
  "roadmap": {
    "fase": 1 | 2 | 3,
    "titulo": "Título da etapa (max 60 chars)",
    "responsavel": "Responsável",
    "prazo": "Prazo estimado"
  },

  "acoes_hub": [
    {
      "ferramenta": "canvas" | "ishikawa" | "eisenhower" | "bpmn" | "roadmap",
      "campo_especifico": "proposta_valor" | "causa_raiz" | "tarefa" | "processo" | "etapa" | "fraqueza" | "oportunidade",
      "conteudo": "Texto extraído literalmente da nota (max 120 chars)",
      "urgencia": "critica" | "alta" | "media" | "baixa",
      "contexto": "Por que este trecho pertence a esta ferramenta (max 80 chars)"
    }
  ]
}

REGRAS DO CAMPO "destino" (escolhe A ferramenta principal):
• fraqueza / problema / risco / reclamação / erro operacional → "ishikawa"
• oportunidade / negócio / diferencial / valor para cliente   → "canvas"
• tarefa / ação imediata / correção urgente / compra          → "eisenhower"
• fluxo / etapa / subprocesso / mapeamento de processo        → "bpmn"
• objetivo / meta / prazo longo / iniciativa estratégica      → "roadmap"

REGRAS DO ARRAY "acoes_hub" (extração multi-ferramenta — OBRIGATÓRIO):
• Identifique CADA trecho da nota que pertence a UMA ferramenta específica.
• Uma nota pode gerar 1 a 5 itens em "acoes_hub".
• Nunca misture contextos: um diferencial de valor NÃO vai para Ishikawa.
• Prioridade semântica:
  - Afirmações sobre benefício/diferencial → canvas (campo: proposta_valor)
  - Falhas/erros/reclamações              → ishikawa (campo: causa_raiz)
  - Tarefas claras com verbo de ação      → eisenhower (campo: tarefa)
  - Processos/etapas de fluxo             → bpmn (campo: processo)
  - Metas de médio/longo prazo            → roadmap (campo: etapa)

Preencha TODOS os campos. Retorne apenas o JSON, nada mais.`;

// ─── PROMPT DE RESUMO ESTRATÉGICO ─────────────────────────────────────────────
export const MGR_SUMMARY_PROMPT = `${MGR_CONTEXT}

Como Analista Estratégico da MGR, leia as notas de inteligência abaixo e gere um
RESUMO EXECUTIVO em português, com no máximo 4 parágrafos curtos:
1. Principais riscos identificados
2. Oportunidades de crescimento
3. Processos que precisam de atenção imediata
4. Recomendação prioritária para a liderança

Retorne APENAS um JSON:
{
  "titulo": "Título do resumo executivo",
  "corpo": "Texto completo em markdown (use **negrito** para destaques)",
  "score_saude": 0–100,
  "prioridade_maxima": "eisenhower" | "ishikawa" | "canvas" | "bpmn" | "roadmap"
}`;
