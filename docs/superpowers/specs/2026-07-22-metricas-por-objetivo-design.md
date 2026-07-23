# Design — Métricas por Objetivo de Conjunto de Anúncios (Meta Payments)

**Data:** 2026-07-22
**Status:** Aprovado, pronto para plano de implementação

## Contexto

O Dashboard visual (`/dashboard` e `/dashboard/[metaAccountId]`, ver
`docs/superpowers/plans/2026-07-21-dashboard-visual.md` e
`2026-07-22-colunas-personalizaveis.md`, já implementados e em `main`) hoje
busca métricas só no nível de **conta** (`/act_XXX/insights` sem quebra por
conjunto de anúncios). Isso causa dois problemas:

1. **Colunas fixas.** `Gasto`, `Resultado`, `Custo por resultado` e `ROAS`
   são pinadas na visão geral — não podem ser removidas nem reordenadas,
   ao contrário de qualquer outra métrica do catálogo.
2. **Números errados quando a conta mistura objetivos.** Quando uma conta
   tem mais de um conjunto de anúncios ativo com objetivos diferentes (ex:
   um conjunto otimizando pra Lead, outro pra Compra), somar tudo no nível
   de conta produz um "Resultado" e um "Custo por resultado" sem sentido —
   e o mesmo vale pra qualquer métrica "custo por X" do catálogo (custo por
   lead, por mensagem, por compra etc.), que hoje divide o gasto da conta
   inteira pela contagem daquele evento específico, mesmo que esse gasto
   inclua campanhas que não miram nele.

O Gerenciador de Anúncios do Meta resolve isso mostrando "—" na coluna
Resultados quando os conjuntos de anúncios somados não compartilham o mesmo
objetivo — este documento replica esse comportamento.

## Objetivos desta rodada

1. Detectar o objetivo de cada conjunto de anúncios (via `optimization_goal`
   + `promoted_object.custom_event_type`) e mapear pra uma chave do catálogo
   de métricas (`metrics-catalog.ts`).
2. Toda métrica "custo por X" do catálogo (não só lead/mensagem — compras,
   carrinho, cadastros, instalação de app etc.) passa a somar gasto e
   contagem **só dos conjuntos de anúncios cujo objetivo bate com X**, em
   vez do rollup da conta inteira.
3. `Resultado` / `Custo por resultado` (na visão geral e nos cards da
   página de detalhe) mostram "—" quando os conjuntos de anúncios com gasto
   no período têm mais de um objetivo distinto entre si. O seletor manual
   de métrica de resultado por conta continua existindo — a checagem de
   objetivo misto só decide se o valor é exibido ou vira traço.
4. `ROAS` nunca vira traço por objetivo misto — sempre soma gasto/valor só
   dos conjuntos que otimizam pra Compra (mesmo princípio do item 2,
   aplicado à métrica fixa de ROAS).
5. `Gasto`, `Resultado`, `Custo por resultado` e `ROAS` deixam de ser
   pinados — viram itens normais e removíveis do catálogo/painel
   "Personalizar colunas", como qualquer outra métrica.
6. A ordenação por clique no cabeçalho da tabela (hoje restrita às 5
   colunas fixas) generaliza para **qualquer** coluna selecionada.
7. A página de detalhe (`/dashboard/[metaAccountId]`) ganha um seletor de
   conta ao lado do nome, pra trocar de conta sem voltar à visão geral.

### Fora de escopo desta rodada

- Granularidade de anúncio individual (conjunto de anúncios já é o nível
  correto — ver decisão abaixo).
- Suporte a eventos de conversão personalizados dinâmicos por pixel (já
  documentado como fora de escopo no spec anterior).
- Cache de qualquer tipo — todas as chamadas continuam ao vivo por
  carregamento de página (constraint já vigente, mantida).

## Nível de dado: conjunto de anúncios

`optimization_goal` é o campo que realmente determina o que aquele conjunto
de anúncios está otimizando — mais granular que o objetivo da campanha
(uma campanha "Vendas" pode ter um conjunto otimizando Compra e outro
Carrinho) e suficiente sem precisar descer ao anúncio individual (anúncios
não têm meta de otimização própria).

## Mapeamento objetivo → chave do catálogo

Novo arquivo `src/lib/ad-set-objectives.ts`:

```typescript
export interface AdSetObjective {
  adSetId: string;
  /** Chave de TRACKED_ACTIONS (report-variables.ts) que esse conjunto persegue, ou null se não mapeável (ex: Reconhecimento, Alcance). */
  actionKey: string | null;
}

/** optimization_goal -> chave de TRACKED_ACTIONS, quando 1:1. */
const OPTIMIZATION_GOAL_TO_ACTION_KEY: Record<string, string> = {
  LEAD_GENERATION: "leads",
  QUALITY_LEAD: "leads",
  LINK_CLICKS: "cliques_link",
  LANDING_PAGE_VIEWS: "visualizacoes_pagina",
  APP_INSTALLS: "instalacoes_app",
  CONVERSATIONS: "conversas_iniciadas",
  REPLIES: "conversas_iniciadas",
};

/** Para optimization_goal=OFFSITE_CONVERSIONS (genérico), desambigua pelo evento configurado no conjunto. */
const CUSTOM_EVENT_TYPE_TO_ACTION_KEY: Record<string, string> = {
  PURCHASE: "compras",
  ADD_TO_CART: "carrinho",
  INITIATED_CHECKOUT: "checkout_iniciado",
  COMPLETE_REGISTRATION: "cadastros",
  LEAD: "leads",
  ADD_PAYMENT_INFO: "info_pagamento",
};

export function mapOptimizationGoalToActionKey(
  optimizationGoal: string,
  customEventType?: string | null,
): string | null {
  if (optimizationGoal === "OFFSITE_CONVERSIONS" && customEventType) {
    return CUSTOM_EVENT_TYPE_TO_ACTION_KEY[customEventType] ?? null;
  }
  return OPTIMIZATION_GOAL_TO_ACTION_KEY[optimizationGoal] ?? null;
}
```

Conjuntos cujo objetivo não mapeia pra nenhuma `TRACKED_ACTIONS` (ex:
Reconhecimento de marca, Alcance) entram como `actionKey: null` — contam
pro cálculo de "objetivo misto" (ver abaixo) mas não pra nenhum "custo por
X" específico.

## Busca de dados

`getAccountAdSetObjectives(adAccountId)`: chama `/act_XXX/adsets` com
`fields=id,optimization_goal,promoted_object{custom_event_type}`, **sem**
filtro de status — devolve `AdSetObjective[]` sem métricas (chamada
independente de período, já que objetivo de otimização não muda por
período). Importante: não filtrar por `effective_status=ACTIVE` aqui, senão
um conjunto pausado hoje mas que gastou no período selecionado ficaria sem
objetivo mapeado e seu gasto seria perdido do rollup. Quem decide "só conta
quem gastou no período" é o cruzamento com `getAdSetInsights` abaixo, não
o status atual do conjunto.

`getAdSetInsights(adAccountId, selection)`: chama `/act_XXX/insights` com
`level=adset`, `fields=adset_id,spend,actions,action_values` — devolve uma
linha por conjunto de anúncios **que teve entrega no período** (conjuntos
sem gasto simplesmente não aparecem, o que já resolve “só conta quem gastou
no período” sem filtro extra).

## Agregação por objetivo

Novo `computeObjectiveRollups(adSets, insightRows, actionTypesByKey)`:
cruza os dois (por `adset_id`), e pra cada `actionKey` distinto presente
entre os conjuntos com gasto, soma `spend` e `sumActionValue(actions,
actionTypesByKey[actionKey])` só dos conjuntos daquele `actionKey`. Retorna:

```typescript
export interface ObjectiveRollup {
  /** Distintos actionKey (não-null) entre conjuntos com gasto no período. */
  distinctActionKeys: string[];
  /** Gasto + contagem + valor por actionKey, só dos conjuntos daquele objetivo. */
  byActionKey: Record<string, { spend: number; count: number; value: number }>;
}
```

`distinctActionKeys.length > 1` ⇒ "objetivo misto" (Resultado/Custo por
resultado viram "—"). `byActionKey["compras"]` ⇒ usado pelo ROAS.
`byActionKey[qualquerChave]` ⇒ usado por toda métrica "custo por X" do
catálogo (substitui o cálculo antigo `spend-da-conta / contagem-da-conta`).

## Impacto no catálogo e no motor de extração

- `Gasto` vira uma entrada normal do catálogo (`kind: "scalar", field:
  "spend"`, já suportado hoje sem mudança no motor).
- `Resultado` e `Custo por resultado` são "pseudo-métricas": aparecem no
  catálogo/painel de seleção pra efeito de escolher/remover/reordenar, mas
  seu valor não passa pelo motor genérico — continuam calculados por conta,
  usando `account.resultMetricKey` (seletor manual já existente) +
  `ObjectiveRollup` pra decidir entre número real ou "—".
- `ROAS` também é pseudo-métrica: usa sempre `byActionKey["compras"]`.
- Toda métrica `cost_per` do catálogo (as já existentes, ex: custo por
  lead, por compra, por cadastro etc.) passa a ler de
  `byActionKey[correspondente]` em vez de `spend`/`actions` da conta.

## Un-pin + ordenação genérica

`DashboardOverviewTable`/`dashboard-sort.ts` deixam de ter um `SortableRow`
de forma fixa — toda linha vira `{ id, metaAccountId, name, values:
Record<string, number | null>, valueLabels?: Record<string, string>, error
}`. `sortOverviewRows(rows, sortKey, direction)` ordena por `name`
(alfabético) ou por qualquer chave em `values` (numérico, nulls sempre no
fim). Clicar em qualquer cabeçalho de coluna — fixa ou do catálogo — ordena
por ela. `Conta` continua a única coluna sempre presente e não removível.

**Migração de continuidade:** como as 4 métricas eram pinadas (sempre
visíveis), a migração desta rodada garante que contas já em produção não
percam essas colunas do dia pra noite — o valor atual de
`dashboard_column_preferences.metric_keys` ganha `gasto`, `resultado`,
`custo_por_resultado` e `roas` no início da lista (sem duplicar, se já
estiverem lá).

## Página de detalhe: seletor de conta

Um `<select>` (ou combobox simples) ao lado do nome da conta em
`/dashboard/[metaAccountId]`, listando as contas de `listDashboardAccounts()`
— ao trocar, navega para `/dashboard/{novoMetaAccountId}` preservando o
período selecionado na query string. Os KPIs dessa página também passam a
usar `ObjectiveRollup` pra decidir "—" no Resultado/Custo por resultado,
mesma lógica da visão geral.

## Testes

- `mapOptimizationGoalToActionKey`: cada goal mapeado, `OFFSITE_CONVERSIONS`
  com cada `custom_event_type`, goal desconhecido → null.
- `computeObjectiveRollups`: objetivo único (não misto), múltiplos
  objetivos (misto), conjunto com `actionKey: null` não conta pra nenhum
  rollup mas conta pro `distinctActionKeys` como "outro" (decisão: goals
  não mapeáveis são ignorados na contagem de mistura — só objetivos
  *mapeáveis e diferentes entre si* configuram "misto"; um conjunto de
  Reconhecimento rodando junto de um de Compra não torna o Resultado
  automaticamente traço, já que Reconhecimento não tem "resultado"
  comparável).
- `sortOverviewRows` generalizado: ordena por chave arbitrária de `values`,
  nulls no fim, não muta o array (mesmos casos de teste de antes, mais
  cobertura pra uma chave dinâmica do catálogo).
