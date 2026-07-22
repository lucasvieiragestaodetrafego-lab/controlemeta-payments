# Colunas Personalizáveis do Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let gestores customize which Meta Ads metric columns appear in the Dashboard overview table (`/dashboard`), picking from a full catalog covering every metric category the Meta Ads Manager itself exposes (reach, video — all sub-metrics, clicks, engagement, messaging, all tracked conversions), with a "Personalizar colunas" experience (search, categorized checklist, drag-to-reorder selected list) modeled directly on the Meta Ads Manager UI.

**Architecture:** A new static, pure catalog (`src/lib/metrics-catalog.ts`) declares every selectable metric as a small declarative `MetricSource` (which Graph API field(s) it reads and how to combine them) — no per-metric fetch code to write by hand. A generic extraction engine (`src/lib/dashboard-metrics.ts`) turns a list of selected metric keys into the Graph API `fields` param and back into a `{ key: value }` map from one raw Insights row. The 5 existing pinned overview columns (Conta/Gasto/Resultado/Custo por resultado/ROAS, driven by each account's `result_metric_key`) are untouched; the new catalog only powers *additional* columns appended after them. The selected column set is a single global preference (like Meta's own per-table "view"), stored in a new one-row Supabase table, edited through a client-side modal that mirrors Meta's own "Personalizar colunas..." panel.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Supabase (Postgres), Meta Graph API, Vitest. No new npm dependency — column reordering uses native HTML5 drag-and-drop.

## Global Constraints

- Reuse `TRACKED_ACTIONS` from `src/lib/report-variables.ts` as the source of the "Conversões" category (count/cost/value per tracked action) — do not hand-duplicate that list (per the existing dashboard-visual plan's constraint, still in force).
- The 5 pinned overview columns (Conta, Gasto, Resultado, Custo por resultado, ROAS) keep their current behavior (driven by `dashboard_accounts.result_metric_key`) — this plan only adds optional extra columns after them. Do not remove or restructure the pinned columns.
- The selected extra-column set is **global** (one shared list for the whole overview table, exactly like a Meta Ads Manager "view"), not per-account and not per-user, in this v1.
- No caching — column values are fetched live from the Graph API on every page load, same as the rest of the Dashboard (per the original dashboard-visual spec's global constraint, still in force).
- Ad-level diagnostics (relevância do anúncio, classificações de qualidade) and per-campaign budget percentage are out of scope — the Dashboard operates at account level, and those metrics don't roll up sensibly to an account (see `docs/superpowers/specs/2026-07-22-colunas-personalizaveis-design.md`, "Fora de escopo").
- Custom/dynamic pixel conversion events (per-client custom conversions) are out of scope for this v1 — only the standard catalog in `metrics-catalog.ts` is selectable.
- Sorting the table by one of the new extra columns is out of scope for this v1 — only the 5 pinned columns remain sortable (`dashboard-sort.ts` is not touched). Extra columns render in the user-chosen order, unsorted.
- Follow existing code style: Tailwind classes matching `src/app/(app)/dashboard/DashboardOverviewTable.tsx` / `ManageAccountsButton.tsx`, dark slate theme, `"use client"` only on interactive components, Server Actions guarded by the `requireAuth` helper already in `src/app/(app)/dashboard/actions.ts`.

---

### Task 1: `report-metrics.ts` — let `sumActionValue` sum everything when no types are given

**Files:**
- Modify: `src/lib/report-metrics.ts`
- Test: `src/lib/report-metrics.test.ts`

**Interfaces:**
- Produces: `sumActionValue(actions: InsightAction[] | undefined, types?: string[]): number` — `types` becomes optional; omitting it (or passing `[]`) sums every entry instead of filtering. All existing callers pass a non-empty `types` array today, so this is purely additive.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/report-metrics.test.ts`, inside the existing `describe("sumActionValue", ...)` block:

```typescript
  it("soma todos os valores quando nenhum tipo é informado", () => {
    const actions = [
      { action_type: "video_view", value: "10" },
      { action_type: "video_view", value: "7" },
    ];
    expect(sumActionValue(actions)).toBe(17);
    expect(sumActionValue(actions, [])).toBe(17);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/report-metrics.test.ts`
Expected: FAIL — `sumActionValue(actions)` is a type error today (`types` is required) and at runtime `types.includes` would throw on `undefined`.

- [ ] **Step 3: Update the implementation**

Replace in `src/lib/report-metrics.ts`:

```typescript
/** Soma os valores de `actions`/`action_values` cujo tipo está em `types`. */
export function sumActionValue(actions: InsightAction[] | undefined, types: string[]): number {
  if (!actions) return 0;
  return actions
    .filter((a) => types.includes(a.action_type))
    .reduce((sum, a) => sum + Number(a.value), 0);
}
```

with:

```typescript
/**
 * Soma os valores de `actions`/`action_values`. Com `types` informado (e não
 * vazio), soma só as entradas desses tipos; sem `types`, soma tudo — usado
 * pelos campos de vídeo/engajamento da Graph API que já vêm com um único
 * tipo relevante por campo (ex: `video_play_actions`).
 */
export function sumActionValue(actions: InsightAction[] | undefined, types?: string[]): number {
  if (!actions) return 0;
  const relevant = types && types.length > 0 ? actions.filter((a) => types.includes(a.action_type)) : actions;
  return relevant.reduce((sum, a) => sum + Number(a.value), 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/report-metrics.test.ts`
Expected: PASS (all `sumActionValue` cases, including the new one)

- [ ] **Step 5: Run full test suite to confirm no regressions**

Run: `npm test`
Expected: All tests PASS — every existing caller (`meta-insights.ts`, `check-reports.ts`, etc.) still passes an explicit non-empty `types` array, unaffected by the widened signature.

- [ ] **Step 6: Commit**

```bash
git add src/lib/report-metrics.ts src/lib/report-metrics.test.ts
git commit -m "feat: sumActionValue soma tudo quando nenhum tipo e informado"
```

---

### Task 2: `metrics-catalog.ts` — types and catalog data

**Files:**
- Create: `src/lib/metrics-catalog.ts`
- Test: `src/lib/metrics-catalog.test.ts`

**Interfaces:**
- Consumes: `TRACKED_ACTIONS` from `src/lib/report-variables.ts`.
- Produces: `export type MetricValueKind = "count" | "currency" | "decimal" | "percent"`; `export type MetricSource = { kind: "scalar"; field: string } | { kind: "action_sum"; field: string; actionTypes?: string[] } | { kind: "cost_per"; countField: string; countActionTypes?: string[] } | { kind: "rate"; numeratorField: string; numeratorActionTypes?: string[]; denominatorField: string; denominatorActionTypes?: string[]; multiplier: number } | { kind: "roas"; actionTypes: string[] } | { kind: "ticket_medio"; actionTypes: string[] }`; `export interface MetricDefinition { key: string; label: string; category: string; valueKind: MetricValueKind; source: MetricSource }`; `export const METRIC_CATALOG: MetricDefinition[]`; `export function findMetric(key: string): MetricDefinition | undefined`; `export function metricsByCategory(): { category: string; metrics: MetricDefinition[] }[]`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/metrics-catalog.test.ts
import { describe, it, expect } from "vitest";
import { METRIC_CATALOG, findMetric, metricsByCategory } from "./metrics-catalog";

describe("METRIC_CATALOG", () => {
  it("não tem chaves duplicadas", () => {
    const keys = METRIC_CATALOG.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("inclui métricas de vídeo cobrindo todos os quartis", () => {
    const keys = METRIC_CATALOG.map((m) => m.key);
    expect(keys).toEqual(
      expect.arrayContaining(["video_p25", "video_p50", "video_p75", "video_p95", "video_p100"]),
    );
  });

  it("gera 3 métricas (contagem, custo, valor) para cada TRACKED_ACTION", () => {
    const compras = METRIC_CATALOG.filter((m) => m.key === "compras" || m.key === "custo_por_compra" || m.key === "valor_compras");
    expect(compras).toHaveLength(3);
  });
});

describe("findMetric", () => {
  it("encontra uma métrica pela chave", () => {
    expect(findMetric("alcance")?.label).toBe("Alcance");
  });

  it("retorna undefined para chave desconhecida", () => {
    expect(findMetric("nao_existe")).toBeUndefined();
  });
});

describe("metricsByCategory", () => {
  it("agrupa todas as métricas do catálogo, sem perder nenhuma", () => {
    const grouped = metricsByCategory();
    const total = grouped.reduce((sum, g) => sum + g.metrics.length, 0);
    expect(total).toBe(METRIC_CATALOG.length);
  });

  it("cada grupo tem pelo menos uma métrica", () => {
    const grouped = metricsByCategory();
    for (const g of grouped) {
      expect(g.metrics.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/metrics-catalog.test.ts`
Expected: FAIL — `Cannot find module './metrics-catalog'`.

- [ ] **Step 3: Implement the catalog**

```typescript
// src/lib/metrics-catalog.ts
// Catálogo de todas as métricas selecionáveis como coluna extra na visão
// geral do Dashboard. Espelha as categorias que o próprio Gerenciador de
// Anúncios do Meta usa no modal "Personalizar colunas..." (ver
// docs/superpowers/specs/2026-07-22-colunas-personalizaveis-design.md para
// o mapeamento original). Módulo puro — sem fetch/env — seguro para
// importar em componente client.
import { TRACKED_ACTIONS } from "./report-variables";

export type MetricValueKind = "count" | "currency" | "decimal" | "percent";

/** Como extrair o valor de uma métrica a partir de uma linha crua de /insights. */
export type MetricSource =
  | { kind: "scalar"; field: string }
  | { kind: "action_sum"; field: string; actionTypes?: string[] }
  | { kind: "cost_per"; countField: string; countActionTypes?: string[] }
  | {
      kind: "rate";
      numeratorField: string;
      numeratorActionTypes?: string[];
      denominatorField: string;
      denominatorActionTypes?: string[];
      multiplier: number;
    }
  | { kind: "roas"; actionTypes: string[] }
  | { kind: "ticket_medio"; actionTypes: string[] };

export interface MetricDefinition {
  key: string;
  label: string;
  category: string;
  valueKind: MetricValueKind;
  source: MetricSource;
}

const DISTRIBUICAO: MetricDefinition[] = [
  { key: "alcance", label: "Alcance", category: "Distribuição", valueKind: "count", source: { kind: "scalar", field: "reach" } },
  { key: "impressoes", label: "Impressões", category: "Distribuição", valueKind: "count", source: { kind: "scalar", field: "impressions" } },
  { key: "frequencia", label: "Frequência", category: "Distribuição", valueKind: "decimal", source: { kind: "scalar", field: "frequency" } },
  { key: "cpm", label: "CPM (custo por 1.000 impressões)", category: "Distribuição", valueKind: "currency", source: { kind: "scalar", field: "cpm" } },
  { key: "cliques_todos", label: "Cliques (todos)", category: "Distribuição", valueKind: "count", source: { kind: "scalar", field: "clicks" } },
  { key: "cliques_unicos", label: "Cliques únicos (todos)", category: "Distribuição", valueKind: "count", source: { kind: "scalar", field: "unique_clicks" } },
  { key: "ctr_todos", label: "CTR (todos)", category: "Distribuição", valueKind: "percent", source: { kind: "scalar", field: "ctr" } },
  { key: "ctr_unico", label: "CTR único (todos)", category: "Distribuição", valueKind: "percent", source: { kind: "scalar", field: "unique_ctr" } },
  { key: "cpc_todos", label: "CPC (todos)", category: "Distribuição", valueKind: "currency", source: { kind: "scalar", field: "cpc" } },
  { key: "cliques_link", label: "Cliques no link", category: "Distribuição", valueKind: "count", source: { kind: "scalar", field: "inline_link_clicks" } },
  {
    key: "ctr_link",
    label: "CTR (taxa de cliques no link)",
    category: "Distribuição",
    valueKind: "percent",
    source: { kind: "rate", numeratorField: "inline_link_clicks", denominatorField: "impressions", multiplier: 100 },
  },
  {
    key: "cpc_link",
    label: "CPC (custo por clique no link)",
    category: "Distribuição",
    valueKind: "currency",
    source: { kind: "cost_per", countField: "inline_link_clicks" },
  },
];

const VIDEO: MetricDefinition[] = [
  { key: "video_reproducoes", label: "Reproduções de vídeo", category: "Vídeo", valueKind: "count", source: { kind: "action_sum", field: "video_play_actions" } },
  { key: "video_thruplays", label: "ThruPlays", category: "Vídeo", valueKind: "count", source: { kind: "action_sum", field: "video_thruplay_watched_actions" } },
  { key: "video_custo_thruplay", label: "Custo por ThruPlay", category: "Vídeo", valueKind: "currency", source: { kind: "cost_per", countField: "video_thruplay_watched_actions" } },
  { key: "video_30s", label: "Reproduções por no mínimo 30 segundos", category: "Vídeo", valueKind: "count", source: { kind: "action_sum", field: "video_30_sec_watched_actions" } },
  { key: "video_tempo_medio", label: "Tempo médio assistido do vídeo", category: "Vídeo", valueKind: "decimal", source: { kind: "action_sum", field: "video_avg_time_watched_actions" } },
  { key: "video_continuas_2s", label: "Reproduções contínuas por no mínimo 2 segundos", category: "Vídeo", valueKind: "count", source: { kind: "action_sum", field: "video_continuous_2_sec_watched_actions" } },
  { key: "video_p25", label: "Reproduções de vídeo: 25%", category: "Vídeo", valueKind: "count", source: { kind: "action_sum", field: "video_p25_watched_actions" } },
  { key: "video_p50", label: "Reproduções de vídeo: 50%", category: "Vídeo", valueKind: "count", source: { kind: "action_sum", field: "video_p50_watched_actions" } },
  { key: "video_p75", label: "Reproduções de vídeo: 75%", category: "Vídeo", valueKind: "count", source: { kind: "action_sum", field: "video_p75_watched_actions" } },
  { key: "video_p95", label: "Reproduções de vídeo: 95%", category: "Vídeo", valueKind: "count", source: { kind: "action_sum", field: "video_p95_watched_actions" } },
  { key: "video_p100", label: "Reproduções de vídeo: 100%", category: "Vídeo", valueKind: "count", source: { kind: "action_sum", field: "video_p100_watched_actions" } },
];

const ENGAJAMENTO: MetricDefinition[] = [
  { key: "engajamento_pagina", label: "Engajamento com a Página", category: "Engajamento", valueKind: "count", source: { kind: "action_sum", field: "actions", actionTypes: ["page_engagement"] } },
  { key: "custo_engajamento_pagina", label: "Custo por engajamento com a Página", category: "Engajamento", valueKind: "currency", source: { kind: "cost_per", countField: "actions", countActionTypes: ["page_engagement"] } },
  { key: "engajamentos_post", label: "Engajamentos com o post", category: "Engajamento", valueKind: "count", source: { kind: "action_sum", field: "actions", actionTypes: ["post_engagement"] } },
  { key: "custo_engajamento_post", label: "Custo por engajamento com o post", category: "Engajamento", valueKind: "currency", source: { kind: "cost_per", countField: "actions", countActionTypes: ["post_engagement"] } },
  { key: "reacoes_post", label: "Reações ao post", category: "Engajamento", valueKind: "count", source: { kind: "action_sum", field: "actions", actionTypes: ["post_reaction"] } },
  { key: "comentarios_post", label: "Comentários no post", category: "Engajamento", valueKind: "count", source: { kind: "action_sum", field: "actions", actionTypes: ["comment"] } },
  { key: "compartilhamentos_post", label: "Compartilhamentos do post", category: "Engajamento", valueKind: "count", source: { kind: "action_sum", field: "actions", actionTypes: ["post"] } },
  { key: "salvamentos_post", label: "Salvamentos do post", category: "Engajamento", valueKind: "count", source: { kind: "action_sum", field: "actions", actionTypes: ["onsite_conversion.post_save"] } },
];

const MENSAGENS: MetricDefinition[] = [
  { key: "conversas_iniciadas_msg", label: "Conversas por mensagem iniciadas", category: "Mensagens", valueKind: "count", source: { kind: "action_sum", field: "actions", actionTypes: ["onsite_conversion.messaging_conversation_started_7d"] } },
  { key: "custo_conversa_iniciada_msg", label: "Custo por conversa por mensagem iniciada", category: "Mensagens", valueKind: "currency", source: { kind: "cost_per", countField: "actions", countActionTypes: ["onsite_conversion.messaging_conversation_started_7d"] } },
  { key: "conversas_respondidas_msg", label: "Conversas por mensagem respondidas", category: "Mensagens", valueKind: "count", source: { kind: "action_sum", field: "actions", actionTypes: ["onsite_conversion.messaging_first_reply"] } },
  { key: "novos_contatos_msg", label: "Novos contatos de mensagem", category: "Mensagens", valueKind: "count", source: { kind: "action_sum", field: "actions", actionTypes: ["onsite_conversion.total_messaging_connection"] } },
  { key: "custo_novo_contato_msg", label: "Custo por novo contato por mensagem", category: "Mensagens", valueKind: "currency", source: { kind: "cost_per", countField: "actions", countActionTypes: ["onsite_conversion.total_messaging_connection"] } },
];

/** Uma métrica de contagem + custo + valor para cada tipo de conversão já rastreado pelos Relatórios (fonte única: report-variables.ts). */
const CONVERSOES: MetricDefinition[] = TRACKED_ACTIONS.flatMap((a) => [
  { key: a.key, label: a.label, category: "Conversões", valueKind: "count" as const, source: { kind: "action_sum" as const, field: "actions", actionTypes: a.actionTypes } },
  { key: a.costKey, label: `Custo por ${a.label.toLowerCase()}`, category: "Conversões", valueKind: "currency" as const, source: { kind: "cost_per" as const, countField: "actions", countActionTypes: a.actionTypes } },
  { key: a.valueKey, label: `Valor de ${a.label.toLowerCase()}`, category: "Conversões", valueKind: "currency" as const, source: { kind: "action_sum" as const, field: "action_values", actionTypes: a.actionTypes } },
]);

const COMPRAS_ACTION_TYPES = TRACKED_ACTIONS.find((a) => a.key === "compras")!.actionTypes;

const ROAS_TICKET: MetricDefinition[] = [
  { key: "roas_compras", label: "ROAS das compras", category: "ROAS e ticket médio", valueKind: "decimal", source: { kind: "roas", actionTypes: COMPRAS_ACTION_TYPES } },
  { key: "ticket_medio_compras", label: "Ticket médio (compras)", category: "ROAS e ticket médio", valueKind: "currency", source: { kind: "ticket_medio", actionTypes: COMPRAS_ACTION_TYPES } },
];

export const METRIC_CATALOG: MetricDefinition[] = [
  ...DISTRIBUICAO,
  ...VIDEO,
  ...ENGAJAMENTO,
  ...MENSAGENS,
  ...CONVERSOES,
  ...ROAS_TICKET,
];

/** Busca uma métrica do catálogo pela chave. */
export function findMetric(key: string): MetricDefinition | undefined {
  return METRIC_CATALOG.find((m) => m.key === key);
}

/** Agrupa o catálogo por categoria, na ordem em que as categorias aparecem no catálogo. */
export function metricsByCategory(): { category: string; metrics: MetricDefinition[] }[] {
  const order: string[] = [];
  const groups = new Map<string, MetricDefinition[]>();
  for (const metric of METRIC_CATALOG) {
    if (!groups.has(metric.category)) {
      groups.set(metric.category, []);
      order.push(metric.category);
    }
    groups.get(metric.category)!.push(metric);
  }
  return order.map((category) => ({ category, metrics: groups.get(category)! }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/metrics-catalog.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics-catalog.ts src/lib/metrics-catalog.test.ts
git commit -m "feat: catalogo completo de metricas selecionaveis do dashboard"
```

---

### Task 3: `dashboard-metrics.ts` — generic extraction engine

**Files:**
- Create: `src/lib/dashboard-metrics.ts`
- Test: `src/lib/dashboard-metrics.test.ts`

**Interfaces:**
- Consumes: `MetricDefinition`, `MetricSource`, `findMetric` from `src/lib/metrics-catalog.ts`; `sumActionValue`, `computeRoas`, `computeTicketMedio`, `type InsightAction` from `src/lib/report-metrics.ts` (Task 1).
- Produces: `export type GraphInsightRow = Record<string, string | InsightAction[] | undefined>`; `export function resolveFieldValue(row: GraphInsightRow, field: string, actionTypes?: string[]): number`; `export function buildMetricFields(metricKeys: string[], catalog?: MetricDefinition[]): string[]` (the optional `catalog` param exists only so tests can inject a small fixture instead of the full real catalog — real callers always omit it and get `findMetric` from `metrics-catalog.ts`); `export function extractMetricValue(row: GraphInsightRow, metric: MetricDefinition): number | null`; `export function extractMetricValues(row: GraphInsightRow, metricKeys: string[]): Record<string, number | null>`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/dashboard-metrics.test.ts
import { describe, it, expect } from "vitest";
import {
  resolveFieldValue,
  buildMetricFields,
  extractMetricValue,
  extractMetricValues,
  type GraphInsightRow,
} from "./dashboard-metrics";
import type { MetricDefinition } from "./metrics-catalog";

describe("resolveFieldValue", () => {
  it("lê um campo escalar", () => {
    expect(resolveFieldValue({ reach: "1234" }, "reach")).toBe(1234);
  });

  it("retorna 0 quando o campo escalar não existe", () => {
    expect(resolveFieldValue({}, "reach")).toBe(0);
  });

  it("soma um campo de lista de ações, filtrando por tipo", () => {
    const row: GraphInsightRow = {
      actions: [
        { action_type: "purchase", value: "3" },
        { action_type: "lead", value: "100" },
      ],
    };
    expect(resolveFieldValue(row, "actions", ["purchase"])).toBe(3);
  });

  it("soma tudo de um campo de lista de ações quando não filtra por tipo", () => {
    const row: GraphInsightRow = { video_play_actions: [{ action_type: "video_view", value: "50" }] };
    expect(resolveFieldValue(row, "video_play_actions")).toBe(50);
  });
});

describe("buildMetricFields", () => {
  it("inclui sempre spend, e os campos de cada métrica, sem duplicar", () => {
    const scalarMetric: MetricDefinition = {
      key: "alcance",
      label: "Alcance",
      category: "Distribuição",
      valueKind: "count",
      source: { kind: "scalar", field: "reach" },
    };
    const costMetric: MetricDefinition = {
      key: "custo_link",
      label: "Custo por clique no link",
      category: "Distribuição",
      valueKind: "currency",
      source: { kind: "cost_per", countField: "inline_link_clicks" },
    };
    const fields = buildMetricFields(["alcance", "custo_link"], [scalarMetric, costMetric]);
    expect(fields).toEqual(expect.arrayContaining(["spend", "reach", "inline_link_clicks"]));
    expect(new Set(fields).size).toBe(fields.length);
  });

  it("inclui numerador e denominador de métricas do tipo rate", () => {
    const rateMetric: MetricDefinition = {
      key: "ctr_link",
      label: "CTR link",
      category: "Distribuição",
      valueKind: "percent",
      source: { kind: "rate", numeratorField: "inline_link_clicks", denominatorField: "impressions", multiplier: 100 },
    };
    const fields = buildMetricFields(["ctr_link"], [rateMetric]);
    expect(fields).toEqual(expect.arrayContaining(["inline_link_clicks", "impressions"]));
  });

  it("inclui actions e action_values para métricas roas/ticket_medio", () => {
    const roasMetric: MetricDefinition = {
      key: "roas_compras",
      label: "ROAS",
      category: "ROAS e ticket médio",
      valueKind: "decimal",
      source: { kind: "roas", actionTypes: ["purchase"] },
    };
    const fields = buildMetricFields(["roas_compras"], [roasMetric]);
    expect(fields).toEqual(expect.arrayContaining(["actions", "action_values"]));
  });
});

describe("extractMetricValue", () => {
  it("resolve uma métrica scalar", () => {
    const metric: MetricDefinition = { key: "alcance", label: "Alcance", category: "Distribuição", valueKind: "count", source: { kind: "scalar", field: "reach" } };
    expect(extractMetricValue({ reach: "500" }, metric)).toBe(500);
  });

  it("resolve uma métrica cost_per, null quando a contagem é 0", () => {
    const metric: MetricDefinition = { key: "cpc_link", label: "CPC link", category: "Distribuição", valueKind: "currency", source: { kind: "cost_per", countField: "inline_link_clicks" } };
    expect(extractMetricValue({ spend: "100", inline_link_clicks: "20" }, metric)).toBe(5);
    expect(extractMetricValue({ spend: "100", inline_link_clicks: "0" }, metric)).toBeNull();
  });

  it("resolve uma métrica rate, null quando o denominador é 0", () => {
    const metric: MetricDefinition = { key: "ctr_link", label: "CTR link", category: "Distribuição", valueKind: "percent", source: { kind: "rate", numeratorField: "inline_link_clicks", denominatorField: "impressions", multiplier: 100 } };
    expect(extractMetricValue({ inline_link_clicks: "10", impressions: "1000" }, metric)).toBe(1);
    expect(extractMetricValue({ inline_link_clicks: "10", impressions: "0" }, metric)).toBeNull();
  });

  it("resolve roas e ticket_medio a partir de actions/action_values", () => {
    const row: GraphInsightRow = {
      spend: "100",
      actions: [{ action_type: "purchase", value: "4" }],
      action_values: [{ action_type: "purchase", value: "500" }],
    };
    const roas: MetricDefinition = { key: "roas_compras", label: "ROAS", category: "ROAS e ticket médio", valueKind: "decimal", source: { kind: "roas", actionTypes: ["purchase"] } };
    const ticket: MetricDefinition = { key: "ticket_medio_compras", label: "Ticket médio", category: "ROAS e ticket médio", valueKind: "currency", source: { kind: "ticket_medio", actionTypes: ["purchase"] } };
    expect(extractMetricValue(row, roas)).toBe(5);
    expect(extractMetricValue(row, ticket)).toBe(125);
  });
});

describe("extractMetricValues", () => {
  it("monta um mapa chave -> valor para as métricas pedidas, ignorando chaves desconhecidas", () => {
    const row: GraphInsightRow = { reach: "10", impressions: "100" };
    const result = extractMetricValues(row, ["alcance", "chave_inexistente"]);
    expect(result).toEqual({ alcance: 10 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/dashboard-metrics.test.ts`
Expected: FAIL — `Cannot find module './dashboard-metrics'`.

- [ ] **Step 3: Implement the engine**

```typescript
// src/lib/dashboard-metrics.ts
// Motor genérico que liga o catálogo declarativo de metrics-catalog.ts à
// Graph API: monta os `fields` a pedir e extrai o valor de cada métrica de
// uma linha crua de /insights. Módulo puro — sem fetch — testável sem rede.
import { sumActionValue, computeRoas, computeTicketMedio, type InsightAction } from "./report-metrics";
import { findMetric, type MetricDefinition, type MetricSource } from "./metrics-catalog";

export type GraphInsightRow = Record<string, string | InsightAction[] | undefined>;

/** Lê um campo da linha: se for uma lista de ações, soma (filtrando por tipo, se informado); se for escalar, converte pra número. */
export function resolveFieldValue(row: GraphInsightRow, field: string, actionTypes?: string[]): number {
  const raw = row[field];
  if (Array.isArray(raw)) return sumActionValue(raw, actionTypes);
  return Number(raw ?? 0);
}

function fieldsForSource(source: MetricSource): string[] {
  switch (source.kind) {
    case "scalar":
      return [source.field];
    case "action_sum":
      return [source.field];
    case "cost_per":
      return ["spend", source.countField];
    case "rate":
      return [source.numeratorField, source.denominatorField];
    case "roas":
      return ["spend", "action_values"];
    case "ticket_medio":
      return ["actions", "action_values"];
  }
}

/**
 * Monta a lista de campos da Graph API necessários para buscar as métricas
 * pedidas, sempre incluindo "spend", sem duplicatas. `catalog` é injetável
 * (usado pelos testes); em produção, os chamadores usam o catálogo real.
 */
export function buildMetricFields(metricKeys: string[], catalog?: MetricDefinition[]): string[] {
  const fields = new Set<string>(["spend"]);
  for (const key of metricKeys) {
    const metric = catalog ? catalog.find((m) => m.key === key) : findMetric(key);
    if (!metric) continue;
    for (const field of fieldsForSource(metric.source)) fields.add(field);
  }
  return [...fields];
}

/** Extrai o valor de uma métrica específica de uma linha crua. Retorna null quando o denominador/contagem é 0 (evita divisão por zero). */
export function extractMetricValue(row: GraphInsightRow, metric: MetricDefinition): number | null {
  const { source } = metric;
  switch (source.kind) {
    case "scalar":
      return resolveFieldValue(row, source.field);
    case "action_sum":
      return resolveFieldValue(row, source.field, source.actionTypes);
    case "cost_per": {
      const spend = resolveFieldValue(row, "spend");
      const count = resolveFieldValue(row, source.countField, source.countActionTypes);
      return count > 0 ? spend / count : null;
    }
    case "rate": {
      const numerator = resolveFieldValue(row, source.numeratorField, source.numeratorActionTypes);
      const denominator = resolveFieldValue(row, source.denominatorField, source.denominatorActionTypes);
      return denominator > 0 ? (numerator / denominator) * source.multiplier : null;
    }
    case "roas": {
      const spend = resolveFieldValue(row, "spend");
      const value = resolveFieldValue(row, "action_values", source.actionTypes);
      return computeRoas(spend, value);
    }
    case "ticket_medio": {
      const count = resolveFieldValue(row, "actions", source.actionTypes);
      const value = resolveFieldValue(row, "action_values", source.actionTypes);
      return computeTicketMedio(value, count);
    }
  }
}

/** Extrai todas as métricas pedidas de uma linha crua. Chaves desconhecidas no catálogo são ignoradas silenciosamente. */
export function extractMetricValues(row: GraphInsightRow, metricKeys: string[]): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  for (const key of metricKeys) {
    const metric = findMetric(key);
    if (!metric) continue;
    result[key] = extractMetricValue(row, metric);
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/dashboard-metrics.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard-metrics.ts src/lib/dashboard-metrics.test.ts
git commit -m "feat: motor generico de extracao de metricas do catalogo"
```

---

### Task 4: `metric-format.ts` — display formatting per value kind

**Files:**
- Create: `src/lib/metric-format.ts`
- Test: `src/lib/metric-format.test.ts`

**Interfaces:**
- Consumes: `MetricValueKind` from `src/lib/metrics-catalog.ts`.
- Produces: `export function formatMetricValue(value: number | null, valueKind: MetricValueKind): string`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/metric-format.test.ts
import { describe, it, expect } from "vitest";
import { formatMetricValue } from "./metric-format";

describe("formatMetricValue", () => {
  it("formata currency em pt-BR", () => {
    expect(formatMetricValue(1234.5, "currency")).toBe(
      (1234.5).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    );
  });

  it("formata count como inteiro", () => {
    expect(formatMetricValue(1234.7, "count")).toBe("1.235");
  });

  it("formata decimal com 2 casas", () => {
    expect(formatMetricValue(3.14159, "decimal")).toBe("3,14");
  });

  it("formata percent com símbolo %", () => {
    expect(formatMetricValue(2.5, "percent")).toBe("2,50%");
  });

  it("retorna travessão para valores null", () => {
    expect(formatMetricValue(null, "currency")).toBe("—");
    expect(formatMetricValue(null, "count")).toBe("—");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/metric-format.test.ts`
Expected: FAIL — `Cannot find module './metric-format'`.

- [ ] **Step 3: Implement formatting**

```typescript
// src/lib/metric-format.ts
import type { MetricValueKind } from "./metrics-catalog";

/** Formata o valor de uma métrica do catálogo pro formato de exibição pt-BR correspondente ao seu tipo. */
export function formatMetricValue(value: number | null, valueKind: MetricValueKind): string {
  if (value == null) return "—";
  switch (valueKind) {
    case "currency":
      return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    case "count":
      return Math.round(value).toLocaleString("pt-BR");
    case "decimal":
      return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "percent":
      return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/metric-format.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/metric-format.ts src/lib/metric-format.test.ts
git commit -m "feat: formatacao de valores por tipo de metrica"
```

---

### Task 5: `meta-insights.ts` — fetch custom metric columns for an account

**Files:**
- Modify: `src/lib/meta-insights.ts`

**Interfaces:**
- Consumes: `buildMetricFields`, `extractMetricValues`, `type GraphInsightRow` from `src/lib/dashboard-metrics.ts` (Task 3); existing `buildPeriodParams`, `normalizeSelection` (private in this file), `graphGetAll` from `./meta`.
- Produces: `export async function getAccountMetricValues(adAccountId: string, selection: PeriodSelection | ReportPeriod, metricKeys: string[]): Promise<Record<string, number | null>>`.

- [ ] **Step 1: Add the import**

In `src/lib/meta-insights.ts`, add to the top imports:

```typescript
import { buildMetricFields, extractMetricValues, type GraphInsightRow } from "./dashboard-metrics";
```

- [ ] **Step 2: Implement `getAccountMetricValues`**

Add to the end of `src/lib/meta-insights.ts`:

```typescript
/**
 * Busca o valor de um conjunto arbitrário de métricas do catálogo
 * (`metrics-catalog.ts`) para uma conta, no período informado. Usado pelas
 * colunas extras (personalizáveis) da visão geral do Dashboard — os campos
 * pedidos à Graph API variam conforme `metricKeys`, ao contrário de
 * `getAccountInsights`, que sempre busca o mesmo conjunto fixo de campos.
 */
export async function getAccountMetricValues(
  adAccountId: string,
  selection: PeriodSelection | ReportPeriod,
  metricKeys: string[],
): Promise<Record<string, number | null>> {
  if (metricKeys.length === 0) return {};
  const fields = buildMetricFields(metricKeys).join(",");
  const params: Record<string, string> = { fields, ...buildPeriodParams(normalizeSelection(selection)) };
  const rows = await graphGetAll<GraphInsightRow>(`/${adAccountId}/insights`, params);
  return extractMetricValues(rows[0] ?? {}, metricKeys);
}
```

- [ ] **Step 3: Confirm the project still type-checks**

Run: `npx tsc --noEmit`
Expected: No errors. (`normalizeSelection` and `buildPeriodParams` are already defined earlier in this same file and used by `getAccountInsights`/`getTopCreatives` — this task just adds one more caller.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/meta-insights.ts
git commit -m "feat: busca valores de metricas customizadas por conta"
```

---

### Task 6: Migration — `dashboard_column_preferences` table

**Files:**
- Create: `supabase/migrations/0011_dashboard_column_preferences.sql`

**Interfaces:**
- Produces: singleton table `dashboard_column_preferences(id smallint primary key check (id = 1), metric_keys text[], updated_at timestamptz)`, seeded with one row (`id = 1`, `metric_keys = '{}'`).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0011_dashboard_column_preferences.sql
-- Preferência global de colunas extras da visão geral do Dashboard — uma
-- única linha (id = 1), análoga a uma "visualização" salva no Gerenciador
-- de Anúncios do Meta. Não é por conta nem por usuário nesta v1.

create table dashboard_column_preferences (
  id smallint primary key default 1 check (id = 1),
  metric_keys text[] not null default '{}',
  updated_at timestamptz not null default now()
);

insert into dashboard_column_preferences (id, metric_keys) values (1, '{}');
```

- [ ] **Step 2: Apply the migration**

Run: `npm run db:migrate`
Expected output includes: `Aplicando 0011_dashboard_column_preferences.sql...` then `Migrations aplicadas com sucesso.`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0011_dashboard_column_preferences.sql
git commit -m "feat: adiciona tabela dashboard_column_preferences"
```

---

### Task 7: `dashboard-columns.ts` — validate and persist the selected columns

**Files:**
- Create: `src/lib/dashboard-columns.ts`
- Test: `src/lib/dashboard-columns.test.ts`

**Interfaces:**
- Consumes: `findMetric` from `src/lib/metrics-catalog.ts` (Task 2); `getSupabaseAdmin` from `src/lib/supabase.ts`.
- Produces: `export function validateMetricKeys(keys: string[]): string[]`; `export async function getSelectedMetricKeys(): Promise<string[]>`; `export async function updateSelectedMetricKeys(keys: string[]): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/dashboard-columns.test.ts
import { describe, it, expect } from "vitest";
import { validateMetricKeys } from "./dashboard-columns";

describe("validateMetricKeys", () => {
  it("mantém só chaves que existem no catálogo, na ordem informada", () => {
    expect(validateMetricKeys(["alcance", "chave_inexistente", "impressoes"])).toEqual(["alcance", "impressoes"]);
  });

  it("remove duplicatas mantendo a primeira ocorrência", () => {
    expect(validateMetricKeys(["alcance", "alcance", "impressoes"])).toEqual(["alcance", "impressoes"]);
  });

  it("retorna array vazio para entrada vazia", () => {
    expect(validateMetricKeys([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dashboard-columns.test.ts`
Expected: FAIL — `Cannot find module './dashboard-columns'`.

- [ ] **Step 3: Implement the module**

```typescript
// src/lib/dashboard-columns.ts
import { getSupabaseAdmin } from "./supabase";
import { findMetric } from "./metrics-catalog";

/** Filtra pra só chaves conhecidas do catálogo, removendo duplicatas e preservando a ordem. Função pura. */
export function validateMetricKeys(keys: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const key of keys) {
    if (seen.has(key)) continue;
    if (!findMetric(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

/** Lê as colunas extras selecionadas atualmente (preferência global, linha única). */
export async function getSelectedMetricKeys(): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("dashboard_column_preferences")
    .select("metric_keys")
    .eq("id", 1)
    .single();
  if (error || !data) return [];
  return validateMetricKeys((data.metric_keys as string[]) ?? []);
}

/** Atualiza as colunas extras selecionadas (preferência global, linha única). Chaves desconhecidas são descartadas silenciosamente. */
export async function updateSelectedMetricKeys(keys: string[]): Promise<void> {
  const admin = getSupabaseAdmin();
  const validated = validateMetricKeys(keys);
  const { error } = await admin
    .from("dashboard_column_preferences")
    .update({ metric_keys: validated, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(`Erro ao salvar colunas do dashboard: ${error.message}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dashboard-columns.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard-columns.ts src/lib/dashboard-columns.test.ts
git commit -m "feat: valida e persiste colunas extras do dashboard"
```

---

### Task 8: Server Action to save selected columns

**Files:**
- Modify: `src/app/(app)/dashboard/actions.ts`

**Interfaces:**
- Consumes: `updateSelectedMetricKeys` from `src/lib/dashboard-columns.ts` (Task 7); existing `requireAuth` helper already defined in this file.
- Produces: `export async function updateSelectedColumnsAction(keys: string[]): Promise<void>`.

- [ ] **Step 1: Add the import and action**

In `src/app/(app)/dashboard/actions.ts`, add to the imports:

```typescript
import { updateSelectedMetricKeys } from "@/lib/dashboard-columns";
```

and add at the end of the file:

```typescript
export async function updateSelectedColumnsAction(keys: string[]): Promise<void> {
  await requireAuth();
  await updateSelectedMetricKeys(keys);
  revalidatePath("/dashboard");
}
```

- [ ] **Step 2: Confirm the project still builds**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/dashboard/actions.ts
git commit -m "feat: server action para salvar colunas extras do dashboard"
```

---

### Task 9: `Modal.tsx` — optional width override

**Files:**
- Modify: `src/app/Modal.tsx`

**Interfaces:**
- Produces: `Modal` gains an optional `widthClassName` prop (default `"max-w-2xl"`, unchanged for every existing caller) so the column picker (Task 10) can request a wider two-pane layout without touching any other modal in the app.

- [ ] **Step 1: Add the prop**

Replace in `src/app/Modal.tsx`:

```typescript
export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
```

with:

```typescript
export default function Modal({
  open,
  onClose,
  title,
  children,
  widthClassName = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  widthClassName?: string;
}) {
```

and replace:

```typescript
        className="mt-10 w-full max-w-2xl rounded-lg border border-slate-800 bg-slate-900 p-5 shadow-xl"
```

with:

```typescript
        className={`mt-10 w-full ${widthClassName} rounded-lg border border-slate-800 bg-slate-900 p-5 shadow-xl`}
```

- [ ] **Step 2: Confirm the project still builds**

Run: `npx tsc --noEmit`
Expected: No errors — every existing `<Modal ...>` usage (Alertas, Relatórios, Gerenciar contas) omits `widthClassName` and keeps rendering at `max-w-2xl`.

- [ ] **Step 3: Commit**

```bash
git add src/app/Modal.tsx
git commit -m "feat: Modal aceita largura customizada"
```

---

### Task 10: `ColumnPickerButton.tsx` — the "Personalizar colunas" UI

**Files:**
- Create: `src/app/(app)/dashboard/ColumnPickerButton.tsx`

**Interfaces:**
- Consumes: `metricsByCategory`, `type MetricDefinition` from `@/lib/metrics-catalog`; `updateSelectedColumnsAction` from `./actions` (Task 8); `Modal` from `@/app/Modal` (Task 9, using `widthClassName="max-w-4xl"`).
- Produces: `<ColumnPickerButton selectedKeys={string[]} />` client component, rendered by `dashboard/page.tsx` (Task 11).

- [ ] **Step 1: Implement the component**

```tsx
// src/app/(app)/dashboard/ColumnPickerButton.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import Modal from "@/app/Modal";
import { metricsByCategory, type MetricDefinition } from "@/lib/metrics-catalog";
import { updateSelectedColumnsAction } from "./actions";

const CATEGORIES = metricsByCategory();
const ALL_METRICS = CATEGORIES.flatMap((c) => c.metrics);

function metricByKey(key: string): MetricDefinition | undefined {
  return ALL_METRICS.find((m) => m.key === key);
}

export default function ColumnPickerButton({ selectedKeys }: { selectedKeys: string[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string[]>(selectedKeys);
  const [search, setSearch] = useState("");
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return CATEGORIES;
    return CATEGORIES.map((c) => ({
      ...c,
      metrics: c.metrics.filter((m) => m.label.toLowerCase().includes(term)),
    })).filter((c) => c.metrics.length > 0);
  }, [search]);

  function openModal() {
    setPending(selectedKeys);
    setSearch("");
    setOpen(true);
  }

  function toggle(key: string) {
    setPending((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function remove(key: string) {
    setPending((prev) => prev.filter((k) => k !== key));
  }

  function reorder(overKey: string) {
    if (!dragKey || dragKey === overKey) return;
    setPending((prev) => {
      const next = prev.filter((k) => k !== dragKey);
      const overIndex = next.indexOf(overKey);
      next.splice(overIndex, 0, dragKey);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      await updateSelectedColumnsAction(pending);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
      >
        📊 Colunas
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Personalizar colunas" widthClassName="max-w-4xl">
        <input
          type="text"
          placeholder="Pesquisar métricas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
        <div className="flex gap-4">
          <div className="max-h-96 flex-1 space-y-4 overflow-y-auto pr-2">
            {filteredCategories.map((c) => (
              <div key={c.category}>
                <p className="mb-1 text-xs font-semibold uppercase text-slate-500">{c.category}</p>
                {c.metrics.map((m) => (
                  <label
                    key={m.key}
                    className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={pending.includes(m.key)}
                      onChange={() => toggle(m.key)}
                      className="h-4 w-4 accent-emerald-500"
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            ))}
            {filteredCategories.length === 0 && (
              <p className="text-sm text-slate-500">Nenhuma métrica encontrada.</p>
            )}
          </div>
          <div className="w-64 shrink-0 border-l border-slate-800 pl-4">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
              {pending.length} coluna(s) selecionada(s)
            </p>
            <ul className="max-h-96 space-y-1 overflow-y-auto">
              {pending.map((key) => {
                const metric = metricByKey(key);
                if (!metric) return null;
                return (
                  <li
                    key={key}
                    draggable
                    onDragStart={() => setDragKey(key)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => reorder(key)}
                    className="flex cursor-move items-center justify-between rounded bg-slate-800 px-2 py-1 text-xs text-slate-200"
                  >
                    <span>⠿ {metric.label}</span>
                    <button type="button" onClick={() => remove(key)} className="text-slate-500 hover:text-red-400">
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={save}
            className="rounded bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: Confirm the project still builds**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/dashboard/ColumnPickerButton.tsx
git commit -m "feat: modal de personalizar colunas do dashboard"
```

---

### Task 11: `DashboardOverviewTable.tsx` — render the extra columns

**Files:**
- Modify: `src/app/(app)/dashboard/DashboardOverviewTable.tsx`

**Interfaces:**
- Consumes: `formatMetricValue` from `@/lib/metric-format` (Task 4); `type MetricDefinition` from `@/lib/metrics-catalog`.
- Produces: `OverviewRow` gains `extraMetrics: Record<string, number | null>`; `DashboardOverviewTable` gains a required `extraColumns: MetricDefinition[]` prop, rendered as unsorted columns after the existing 5 pinned ones.

- [ ] **Step 1: Add the import**

In `src/app/(app)/dashboard/DashboardOverviewTable.tsx`, add to the imports:

```typescript
import { formatMetricValue } from "@/lib/metric-format";
import type { MetricDefinition } from "@/lib/metrics-catalog";
```

- [ ] **Step 2: Extend `OverviewRow` and the component signature**

Replace:

```typescript
export interface OverviewRow {
  id: string;
  metaAccountId: string;
  name: string;
  spend: number;
  resultLabel: string;
  resultValue: number;
  costPerResult: number | null;
  roas: number | null;
  error: string | null;
}
```

with:

```typescript
export interface OverviewRow {
  id: string;
  metaAccountId: string;
  name: string;
  spend: number;
  resultLabel: string;
  resultValue: number;
  costPerResult: number | null;
  roas: number | null;
  /** Valores das colunas extras selecionadas pelo usuário (Task 10), por chave do catálogo. Vazio quando nenhuma coluna extra está selecionada. */
  extraMetrics: Record<string, number | null>;
  error: string | null;
}
```

Replace:

```typescript
export default function DashboardOverviewTable({ rows }: { rows: OverviewRow[] }) {
```

with:

```typescript
export default function DashboardOverviewTable({
  rows,
  extraColumns,
}: {
  rows: OverviewRow[];
  extraColumns: MetricDefinition[];
}) {
```

- [ ] **Step 3: Render the extra header cells and body cells**

Replace the `<thead>` block:

```tsx
      <thead className="text-slate-400">
        <tr>
          {COLUMNS.map((col) => (
            <th
              key={col.key}
              className="cursor-pointer select-none px-4 py-2"
              onClick={() => toggleSort(col.key)}
            >
              {col.label} {sortKey === col.key ? (direction === "asc" ? "▲" : "▼") : ""}
            </th>
          ))}
        </tr>
      </thead>
```

with:

```tsx
      <thead className="text-slate-400">
        <tr>
          {COLUMNS.map((col) => (
            <th
              key={col.key}
              className="cursor-pointer select-none px-4 py-2"
              onClick={() => toggleSort(col.key)}
            >
              {col.label} {sortKey === col.key ? (direction === "asc" ? "▲" : "▼") : ""}
            </th>
          ))}
          {extraColumns.map((col) => (
            <th key={col.key} className="px-4 py-2">
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
```

Replace the row-rendering block:

```tsx
            {row.error ? (
              <td colSpan={4} className="px-4 py-2 text-xs text-red-400">
                {row.error}
              </td>
            ) : (
              <>
                <td className="px-4 py-2">{currencyFmt(row.spend)}</td>
                <td className="px-4 py-2">
                  {row.resultValue} <span className="text-xs text-slate-500">{row.resultLabel}</span>
                </td>
                <td className="px-4 py-2">
                  {row.costPerResult != null ? currencyFmt(row.costPerResult) : "—"}
                </td>
                <td className="px-4 py-2">
                  {row.roas != null ? row.roas.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}
                </td>
              </>
            )}
```

with:

```tsx
            {row.error ? (
              <td colSpan={4 + extraColumns.length} className="px-4 py-2 text-xs text-red-400">
                {row.error}
              </td>
            ) : (
              <>
                <td className="px-4 py-2">{currencyFmt(row.spend)}</td>
                <td className="px-4 py-2">
                  {row.resultValue} <span className="text-xs text-slate-500">{row.resultLabel}</span>
                </td>
                <td className="px-4 py-2">
                  {row.costPerResult != null ? currencyFmt(row.costPerResult) : "—"}
                </td>
                <td className="px-4 py-2">
                  {row.roas != null ? row.roas.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}
                </td>
                {extraColumns.map((col) => (
                  <td key={col.key} className="px-4 py-2">
                    {formatMetricValue(row.extraMetrics[col.key] ?? null, col.valueKind)}
                  </td>
                ))}
              </>
            )}
```

- [ ] **Step 4: Confirm the project still builds**

Run: `npx tsc --noEmit`
Expected: No errors. `dashboard/page.tsx` (Task 12) is the only other place that constructs `OverviewRow` and calls `<DashboardOverviewTable>` — it's updated in the next task, so a transient type error here is expected until Task 12 lands; if executing tasks one commit at a time, verify with `npx tsc --noEmit` after Task 12 instead.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/dashboard/DashboardOverviewTable.tsx
git commit -m "feat: DashboardOverviewTable renderiza colunas extras"
```

---

### Task 12: Wire it all into `dashboard/page.tsx`

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getSelectedMetricKeys` from `@/lib/dashboard-columns` (Task 7); `getAccountMetricValues` from `@/lib/meta-insights` (Task 5); `findMetric` from `@/lib/metrics-catalog` (Task 2); `ColumnPickerButton` (Task 10).

- [ ] **Step 1: Update the imports**

Replace:

```typescript
import { getAccountInsights, type PeriodSelection } from "@/lib/meta-insights";
import { TRACKED_ACTIONS } from "@/lib/report-variables";
import { parsePeriodFromSearchParams, searchParamsToURLSearchParams } from "@/lib/period-params";
import DashboardOverviewTable, { type OverviewRow } from "./DashboardOverviewTable";
import PeriodSelector from "./PeriodSelector";
import ManageAccountsButton from "./ManageAccountsButton";
import ManageAccountsSection from "./ManageAccountsSection";
```

with:

```typescript
import { getAccountInsights, getAccountMetricValues, type PeriodSelection } from "@/lib/meta-insights";
import { TRACKED_ACTIONS } from "@/lib/report-variables";
import { getSelectedMetricKeys } from "@/lib/dashboard-columns";
import { findMetric } from "@/lib/metrics-catalog";
import { parsePeriodFromSearchParams, searchParamsToURLSearchParams } from "@/lib/period-params";
import DashboardOverviewTable, { type OverviewRow } from "./DashboardOverviewTable";
import PeriodSelector from "./PeriodSelector";
import ManageAccountsButton from "./ManageAccountsButton";
import ManageAccountsSection from "./ManageAccountsSection";
import ColumnPickerButton from "./ColumnPickerButton";
```

- [ ] **Step 2: Fetch the selected columns and pass extra metrics per account**

Replace:

```typescript
  const accounts = await listDashboardAccounts();

  const rows: OverviewRow[] = [];
  for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
    const batch = accounts.slice(i, i + BATCH_SIZE);
    const batchRows = await Promise.all(
      batch.map(async (account): Promise<OverviewRow> => {
        const resultMetric = TRACKED_ACTIONS.find((a) => a.key === account.resultMetricKey);
        try {
          const insights = await getAccountInsights(account.metaAccountId, selection);
          const resultValue = resultMetric
            ? insights.detailedActions[resultMetric.key] ?? 0
            : insights.conversions;
          return {
            id: account.id,
            metaAccountId: account.metaAccountId,
            name: account.accountName,
            spend: insights.spend,
            resultLabel: resultMetric?.label ?? insights.resultLabel,
            resultValue,
            costPerResult: resultValue > 0 ? insights.spend / resultValue : null,
            roas: insights.roas,
            error: null,
          };
        } catch (err) {
          return {
            id: account.id,
            metaAccountId: account.metaAccountId,
            name: account.accountName,
            spend: 0,
            resultLabel: resultMetric?.label ?? "Resultado",
            resultValue: 0,
            costPerResult: null,
            roas: null,
            error: err instanceof Error ? err.message : "Erro ao buscar métricas.",
          };
        }
      }),
    );
    rows.push(...batchRows);
  }
```

with:

```typescript
  const accounts = await listDashboardAccounts();
  const selectedMetricKeys = await getSelectedMetricKeys();
  const extraColumns = selectedMetricKeys.map(findMetric).filter((m) => m != null);

  const rows: OverviewRow[] = [];
  for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
    const batch = accounts.slice(i, i + BATCH_SIZE);
    const batchRows = await Promise.all(
      batch.map(async (account): Promise<OverviewRow> => {
        const resultMetric = TRACKED_ACTIONS.find((a) => a.key === account.resultMetricKey);
        try {
          const [insights, extraMetrics] = await Promise.all([
            getAccountInsights(account.metaAccountId, selection),
            getAccountMetricValues(account.metaAccountId, selection, selectedMetricKeys),
          ]);
          const resultValue = resultMetric
            ? insights.detailedActions[resultMetric.key] ?? 0
            : insights.conversions;
          return {
            id: account.id,
            metaAccountId: account.metaAccountId,
            name: account.accountName,
            spend: insights.spend,
            resultLabel: resultMetric?.label ?? insights.resultLabel,
            resultValue,
            costPerResult: resultValue > 0 ? insights.spend / resultValue : null,
            roas: insights.roas,
            extraMetrics,
            error: null,
          };
        } catch (err) {
          return {
            id: account.id,
            metaAccountId: account.metaAccountId,
            name: account.accountName,
            spend: 0,
            resultLabel: resultMetric?.label ?? "Resultado",
            resultValue: 0,
            costPerResult: null,
            roas: null,
            extraMetrics: {},
            error: err instanceof Error ? err.message : "Erro ao buscar métricas.",
          };
        }
      }),
    );
    rows.push(...batchRows);
  }
```

- [ ] **Step 3: Add the button and pass `extraColumns` to the table**

Replace:

```tsx
        <div className="flex items-center gap-3">
          <PeriodSelector selection={selection} />
          <ManageAccountsButton>
            <Suspense fallback={<p className="text-sm text-slate-500">Carregando contas…</p>}>
              <ManageAccountsSection />
            </Suspense>
          </ManageAccountsButton>
        </div>
      </header>
      <DashboardOverviewTable rows={rows} />
```

with:

```tsx
        <div className="flex items-center gap-3">
          <PeriodSelector selection={selection} />
          <ColumnPickerButton selectedKeys={selectedMetricKeys} />
          <ManageAccountsButton>
            <Suspense fallback={<p className="text-sm text-slate-500">Carregando contas…</p>}>
              <ManageAccountsSection />
            </Suspense>
          </ManageAccountsButton>
        </div>
      </header>
      <DashboardOverviewTable rows={rows} extraColumns={extraColumns} />
```

- [ ] **Step 4: Run the full test suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: All tests PASS, no type errors.

- [ ] **Step 5: Verify manually end-to-end**

Run: `npm run dev`, open `/dashboard`:
1. Click "📊 Colunas" — the modal opens mirroring the Meta Ads Manager layout: search box, categorized checklist on the left (Distribuição, Vídeo, Engajamento, Mensagens, Conversões, ROAS e ticket médio), selected-columns panel on the right.
2. Type "vídeo" in the search box — only video metrics remain visible.
3. Check a few video metrics (e.g. "Reproduções de vídeo: 25%", "ThruPlays") plus "Alcance". Confirm they appear in the right-hand selected list.
4. Drag one item in the right-hand list to reorder it; confirm the order changes.
5. Click "Salvar" — modal closes, the overview table now shows the new columns after ROAS, with live values (no stale cache — refresh the page and confirm the same columns and values reappear, since selection is a persisted global preference).
6. Click "📊 Colunas" again, uncheck everything, save — table goes back to just the 5 pinned columns.
7. Confirm the account detail page (`/dashboard/act_...`) and the rest of the app (Alertas, Relatórios) still work unchanged.

Expected: all of the above works with no console errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx
git commit -m "feat: colunas personalizaveis na visao geral do dashboard"
```

---

### Task 13: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test`
Expected: All tests PASS (existing suite + every test added in Tasks 1–7).

- [ ] **Step 2: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Re-run the manual end-to-end walkthrough from Task 12, Step 5**

Expected: still passes after the full sequence of commits.

- [ ] **Step 4: Commit (only if Steps 1–3 required fixes)**

```bash
git add -A
git commit -m "fix: ajustes finais das colunas personalizaveis do dashboard"
```
