---
tipo: doc-tecnica
area: erp-mgrconnect
data: 2026-04-16
status: rascunho
tags: [mgrconnect, crm, leads, funil, flow-atendimento, typescript, react, firebase]
relacionados: ["[[2026-04-14_estrategia_mgrconnect-erp]]"]
resumo: "Refatoração completa do CRM de leads: funil visual 2 etapas, FunilConversao fases 1-4, analytics no BI Dashboard, remoção do NegotiationSubStatus e correção do modal de lead."
---

# Refatoração CRM de Leads — Funil Visual + BI Dashboard

**Data:** 2026-04-16  
**Projeto:** MGRConnect (mgr-conect2)  
**Stack:** React + TypeScript + Tailwind CSS + Firebase/Firestore  
**Build final:** ✅ `tsc --noEmit` exit code 0, sem erros

---

## Contexto

O sistema possuía o CRM de leads concentrado em `LeadsDashboard.tsx` com 3 abas (Kanban 5 colunas, Lista, Config). O fluxo de avanço era confuso para o usuário — o Kanban misturava fases de lead com fases de projeto, o modal tinha um pipeline "Novo → Contatado → Convertido" clicável que saltava direto para Cotação, e o `NegotiationSubStatus` duplicava informações já presentes no Flow de Atendimento.

---

## Decisões de Arquitetura

| Decisão | Raciocínio |
|---|---|
| Fase 0 vira funil de 2 retângulos | Somente `novo` e `contatado` são gerenciados aqui |
| FunilConversao fases 1-4 separado | Cards descem automaticamente via Firebase onSnapshot |
| Analytics de leads → BIDashboard | Separação de responsabilidades, KPIs de tempo centralizado |
| Remover NegotiationSubStatus | Era duplicidade do estado do Flow de Atendimento |
| Modal por estado de status | UX guiada: cada status mostra ação específica, não um menu genérico |

---

## Arquivos Criados

### `components/FunilConversao.tsx` ✨ Novo
Funil visual com 5 estágios decrescentes por largura (100% → 82% → 65% → 50% → 36%):

| Estágio | Fases do Projeto | Largura |
|---|---|---|
| Prancheta | `lead_capturado`, `em_levantamento` | 100% |
| Cotação | `em_cotacao`, `cotacao_recebida` | 82% |
| Proposta | `proposta_enviada` | 65% |
| Contrato | `contrato_enviado`, `contrato_assinado` | 50% |
| Convertido | `em_planejamento` até `concluido` | 36% |

- Cards clicáveis → navegam direto para a fase no FlowAtendimento
- Descida automática via reatividade do `onSnapshot` do Firebase
- Cards com borda vermelha se >3 dias na mesma fase
- Widget colapsável com contador "N em conversão · N convertido(s)"

```typescript
interface FunilConversaoProps {
  projects: ProjectV2[];
  onNavigateToFase: (faseId: FlowFaseId, projectId?: string) => void;
  faseSelecionada: FlowFaseId;
}
```

---

### `components/LeadsAnalyticsWidget.tsx` ✨ Novo
Widget de analytics extraído da antiga aba "Lista" do LeadsDashboard, integrado ao BIDashboard:

- KPI cards: Total, Novos, Taxa de Conversão, Tempo Médio até Contato
- KPI extra: Tempo médio lead → contrato (dias), usando `faseTimestamps`
- Filtros: status, origem, período (7/30/90d/todos), busca por nome/empresa/telefone
- Export CSV com todos os campos
- Usa próprio `useProjectLeads()` internamente (não duplica listener — Firebase SDK faz cache)

---

## Arquivos Modificados

### `components/LeadsDashboard.tsx` 🔄 Refatorado

**Removido:**
- `KanbanCard`, `KanbanView`, `KANBAN_COLS`
- Aba "Kanban" e aba "Lista"
- Badge de `NegotiationSubStatus` no modal
- Pipeline "Novo → Contatado → Convertido" clicável
- Botão "Converter em Projeto" genérico

**Adicionado:**
- `FunilVisualLeads` — 2 retângulos empilhados (Leads Recebidos / Contato Inicial)
- `LeadModal` refatorado por estado de status:
  - **Status `novo`** → botão destaque "📞 Iniciar Contato Primário"
  - **Status `contatado`** → campo âmbar "Anotações do Contato — Necessidades do Cliente" + botão "Enviar para Prancheta →"
  - **Status `convertido`** → card verde de confirmação + link "Ver Projeto na Prancheta"
- Header do modal muda de cor por status (roxo/azul/verde/vermelho)
- `try/catch/finally` em todas as ações do modal → botões nunca travam em loading
- Exibição de erro inline ao falhar envio para Prancheta

**Nova interface de props:**
```typescript
export interface LeadsDashboardProps {
  initialTab?: 'funil' | 'config' | 'kanban' | 'lista'; // backward compat
  onNavigateToFlow?: (faseId: FlowFaseId) => void;
}
```

---

### `components/FlowAtendimento.tsx` 🔄 Atualizado

- Import e render de `FunilConversao` nas fases 0–4 (abaixo do conteúdo da fase)
- `handleNavigateToFase(faseId, projectId?)` — callback que seta fase e abre projeto:
  - Prancheta: abre modo inline com `setSelectedProjectId`
  - Demais: navega para `/app/projetos-v2/:id?tab=X&from=flow`
- `LeadsDashboard` recebe `onNavigateToFlow={handleFaseChange}`
- Removido: toggle Lista/Kanban, estado `viewMode`, bloco inteiro do modo Kanban
- Ícones `LayoutList` e `Kanban` removidos dos imports
- Botão "Novo Projeto" renomeado para "Novo Lead" e não seta mais `viewMode`

---

### `components/BIDashboard.tsx` 🔄 Atualizado

```tsx
// Adicionado no topo do grid de widgets
<div className="lg:col-span-2">
  <LeadsAnalyticsWidget />
</div>
```

---

### `hooks/useProjectLeads.ts` 🔄 Atualizado

- `marcarContatado()` agora grava `faseTimestamps.contatado: serverTimestamp()`
- `atualizarStatus()` agora grava `` `faseTimestamps.${novoStatus}`: serverTimestamp() ``
- Removida função `atualizarSubStatus` e seu bloco de criação de `ProjectV2`
- Removido import de `NegotiationSubStatus`, `ProjectPhase`, `Timestamp`

---

### `types.ts` 🔄 Atualizado

**Adicionado** em `ProjectLead`:
```typescript
faseTimestamps?: {
  novo?: Timestamp;
  contatado?: Timestamp;
  em_negociacao?: Timestamp;
  convertido?: Timestamp;
};
```

**Removido:**
- `type NegotiationSubStatus`
- `const NEGOTIATION_SUB_LABELS`
- `const NEGOTIATION_SUB_COLORS`
- `const NEGOTIATION_SUB_TRANSITIONS`
- Campo `negotiationSubStatus?: NegotiationSubStatus` da interface `ProjectLead`

**Corrigido** em `PROJECT_TRANSITIONS`:
```typescript
// Antes:
lead_capturado: ['em_levantamento', 'nao_aprovado'],

// Depois (permite pular direto para cotação ao concluir prancheta):
lead_capturado: ['em_levantamento', 'em_cotacao', 'nao_aprovado'],
```

---

### `hooks/useProject.ts` 🔄 Atualizado

- Removido bloco que gravava `negotiationSubStatus: 'aguardando_proposta'` ao concluir prancheta

---

### `components/ProjectCotacao.tsx` 🔄 Atualizado

- Removido bloco que gravava `negotiationSubStatus: 'material_cotado'`
- Removidos imports desnecessários: `doc`, `updateDoc`, `CollectionName`, `db`

---

### `components/ProjectPrancheta.tsx` 🔄 Atualizado

- Removido bloco que gravava `negotiationSubStatus: 'cotar_material'`
- Removidos imports desnecessários: `doc`, `updateDoc`, `db`, `CollectionName`

---

## Fluxo CRM — Estado Final

```
FASE 0 — Funil de Leads (LeadsDashboard)
┌─────────────────────────────────────────────┐  ← 100%
│  LEADS RECEBIDOS  (status: novo)            │
│  Botão: "Iniciar Contato Primário"          │
└─────────────────────────────────────────────┘
              ↓
      ┌───────────────────────────────────┐     ← 80%
      │  CONTATO INICIAL (status: contatado) │
      │  Campo: Anotações do Contato       │
      │  Botão: "Enviar para Prancheta →"  │
      └───────────────────────────────────┘
              ↓
   → Cria ProjectV2 + marca lead como 'convertido'

FASES 1–4 — FunilConversao (visível abaixo do conteúdo)
┌──────────────────────── Prancheta ──────────────────────────┐ 100%
│  [card A]  [card B]  [card C]  ...                         │
└─────────────────────────────────────────────────────────────┘
       ┌────────────────────── Cotação ──────────────────────┐  82%
       └─────────────────────────────────────────────────────┘
              ┌────────────── Proposta ──────────────────┐     65%
              └──────────────────────────────────────────┘
                     ┌──────── Contrato ──────────┐          50%
                     └────────────────────────────┘
                            ┌── Convertido ──┐              36%
                            └────────────────┘

BI DASHBOARD — LeadsAnalyticsWidget
  KPIs: Total · Novos · Taxa Conversão · Tempo Médio Contato
  KPI: Tempo médio lead → contrato (dias)
  Filtros: status / origem / período / busca
  Export: CSV
```

---

## KPIs de Tempo Implementados

| KPI | Campo fonte | Cálculo |
|---|---|---|
| Tempo até primeiro contato | `criadoEm` → `faseTimestamps.contatado` | diferença em horas |
| Tempo lead → convertido | `criadoEm` → `faseTimestamps.convertido` | diferença em dias |
| Tempo por fase de projeto | `faseHistorico[n].alteradoEm` → `faseHistorico[n+1].alteradoEm` | horas por fase |

---

## Bugs Corrigidos

| Bug | Causa | Correção |
|---|---|---|
| "Transição de Lead Capturado para Em Cotação não permitida" | `PROJECT_TRANSITIONS` não tinha `em_cotacao` como destino de `lead_capturado` | Adicionado `em_cotacao` nas transições permitidas |
| Botão "Enviar para Prancheta" travava em loading | Falta de `try/catch/finally` no handler do modal | Adicionado tratamento completo com exibição de erro inline |
| Modal mostrava "Converter em Projeto" que saltava fases | Lógica genérica sem contexto do status atual | Modal refeito com ações específicas por status |

---

## Próximas Ações Sugeridas

- [ ] Testar fluxo completo: Lead Novo → Contato → Prancheta → Cotação → Proposta → Contrato
- [ ] Validar descida automática dos cards no FunilConversao em tempo real
- [ ] Verificar KPI "Tempo médio lead → contrato" no BI Dashboard após acumular dados com `faseTimestamps`
- [ ] Avaliar adicionar animação de transição (opacity fade) quando card desce de estágio no funil
