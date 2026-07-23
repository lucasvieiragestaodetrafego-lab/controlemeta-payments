# Métricas por Objetivo de Conjunto de Anúncios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Dashboard's Resultado/Custo por resultado/ROAS/custo-por-X metrics correct when an account mixes multiple ad-set optimization goals (showing "—" instead of a misleading blended number, matching the Meta Ads Manager's own behavior), and un-pin every non-"Conta" column so it's selectable/removable/reorderable exactly like any other catalog metric.

**Architecture:** A new pure module (`src/lib/ad-set-objectives.ts`) maps each ad set's `optimization_goal` (+ `promoted_object.custom_event_type` for the generic `OFFSITE_CONVERSIONS` goal) to the matching `TRACKED_ACTIONS` key, then rolls up spend/count/value **only from ad sets that actually delivered in the selected period**, grouped by that key. This `ObjectiveRollup` feeds: (a) the existing metric-extraction engine (`dashboard-metrics.ts`) so every "custo por X" catalog metric and ROAS use the correct, objective-filtered spend/count instead of the account-wide rollup; (b) a mixed-objective flag consumed by the overview table and the account detail page's KPI cards to show "—" for Resultado/Custo por resultado when ad sets disagree on objective. `Gasto`, `Resultado`, `Custo por resultado`, and `ROAS` become regular entries in `metrics-catalog.ts` (two of them — Resultado and Custo por resultado — are "pseudo" entries whose value is computed per-account outside the generic engine, since they depend on each account's own manually-chosen result metric). The overview table's column/sort model generalizes from 5 hardcoded fields to an arbitrary list of selected catalog keys.

**Tech Stack:** Next.js App Router (Server Components), Meta Graph API (`/adsets`, `/insights?level=adset`), Supabase (Postgres), Vitest.

## Global Constraints

- Only `Conta` stays a permanently fixed column — everything else (Gasto, Resultado, Custo por resultado, ROAS, and every catalog metric) is selectable/removable/reorderable through the same "Personalizar colunas" panel from the previous round.
- Objective detection uses **ad set** `optimization_goal` (not campaign `objective`, not ad-level data) — this is the level that actually determines what an ad set optimizes for.
- "Objetivo misto" is computed **only from ad sets that had spend in the selected period** (an ad set fetched with no matching row in the period's `level=adset` insights is treated as not-delivering and excluded), not from all ad sets with `status=ACTIVE` today.
- Ad sets whose objective doesn't map to any `TRACKED_ACTIONS` key (e.g. Reconhecimento, Alcance) are excluded from both the mixed-objective count and every `byActionKey` rollup — they never force a "—", since they have no comparable "resultado".
- The objective-filtered rollup fix for "custo por X" applies to exactly the metrics that already correspond 1:1 to a `TRACKED_ACTIONS` key: the 10 `custoKey` entries generated from `TRACKED_ACTIONS` in the `Conversões` category, plus `cpc_link` (Distribuição, since "cliques no link" is itself one of the 10 `TRACKED_ACTIONS`). Metrics with no clean single-objective correspondence (`cpm`, `cpc_todos`, `custo_engajamento_pagina`, `video_custo_thruplay`, `custo_engajamento_post`, `custo_conversa_iniciada_msg`, `custo_novo_contato_msg`) are **out of scope this round** — they keep computing from the account-wide rollup, unchanged.
- `ROAS` (catalog key `roas_compras`) always uses the objective-filtered rollup for the `compras` key — it never shows "—" for mixed objectives, since it's inherently purchase-specific regardless of what else the account is running. `ticket_medio_compras` is unaffected this round (out of scope, not requested).
- The manual "métrica de resultado" selector per account (`dashboard_accounts.result_metric_key`, `ResultMetricSelector.tsx`) keeps working exactly as today — the mixed-objective check only decides whether the chosen metric's value is displayed or replaced with "—", it does not remove or replace the selector.
- No caching anywhere — every new Graph API call (ad sets, ad-set-level insights) is live per page load, same as the rest of the Dashboard.
- Follow existing code style: pure logic in `src/lib/*.ts` with Vitest tests colocated (`*.test.ts`); network-calling wrapper functions have no unit test (verified by type-check + manual browser walkthrough), consistent with `getAccountInsights`/`getAccountMetricValues`.

---

### Task 1: `ad-set-objectives.ts` — optimization goal → TRACKED_ACTIONS key mapping

**Files:**
- Create: `src/lib/ad-set-objectives.ts`
- Test: `src/lib/ad-set-objectives.test.ts`

**Interfaces:**
- Produces: `export function mapOptimizationGoalToActionKey(optimizationGoal: string, customEventType?: string | null): string | null`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/ad-set-objectives.test.ts
import { describe, it, expect } from "vitest";
import { mapOptimizationGoalToActionKey } from "./ad-set-objectives";

describe("mapOptimizationGoalToActionKey", () => {
  it("mapeia goals 1:1 conhecidos", () => {
    expect(mapOptimizationGoalToActionKey("LEAD_GENERATION")).toBe("leads");
    expect(mapOptimizationGoalToActionKey("QUALITY_LEAD")).toBe("leads");
    expect(mapOptimizationGoalToActionKey("LINK_CLICKS")).toBe("cliques_link");
    expect(mapOptimizationGoalToActionKey("LANDING_PAGE_VIEWS")).toBe("visualizacoes_pagina");
    expect(mapOptimizationGoalToActionKey("APP_INSTALLS")).toBe("instalacoes_app");
    expect(mapOptimizationGoalToActionKey("CONVERSATIONS")).toBe("conversas_iniciadas");
    expect(mapOptimizationGoalToActionKey("REPLIES")).toBe("conversas_iniciadas");
  });

  it("desambigua OFFSITE_CONVERSIONS pelo custom_event_type", () => {
    expect(mapOptimizationGoalToActionKey("OFFSITE_CONVERSIONS", "PURCHASE")).toBe("compras");
    expect(mapOptimizationGoalToActionKey("OFFSITE_CONVERSIONS", "ADD_TO_CART")).toBe("carrinho");
    expect(mapOptimizationGoalToActionKey("OFFSITE_CONVERSIONS", "INITIATED_CHECKOUT")).toBe("checkout_iniciado");
    expect(mapOptimizationGoalToActionKey("OFFSITE_CONVERSIONS", "COMPLETE_REGISTRATION")).toBe("cadastros");
    expect(mapOptimizationGoalToActionKey("OFFSITE_CONVERSIONS", "LEAD")).toBe("leads");
    expect(mapOptimizationGoalToActionKey("OFFSITE_CONVERSIONS", "ADD_PAYMENT_INFO")).toBe("info_pagamento");
  });

  it("retorna null pra OFFSITE_CONVERSIONS sem custom_event_type reconhecido", () => {
    expect(mapOptimizationGoalToActionKey("OFFSITE_CONVERSIONS")).toBeNull();
    expect(mapOptimizationGoalToActionKey("OFFSITE_CONVERSIONS", "SUBSCRIBE")).toBeNull();
  });

  it("retorna null pra goal desconhecido ou sem resultado comparável (ex: Reconhecimento)", () => {
    expect(mapOptimizationGoalToActionKey("BRAND_AWARENESS")).toBeNull();
    expect(mapOptimizationGoalToActionKey("REACH")).toBeNull();
    expect(mapOptimizationGoalToActionKey("IMPRESSIONS")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ad-set-objectives.test.ts`
Expected: FAIL — `Cannot find module './ad-set-objectives'`.

- [ ] **Step 3: Implement the mapping**

```typescript
// src/lib/ad-set-objectives.ts
// Mapeia o objetivo de otimização de um conjunto de anúncios (nível correto
// pra saber o que ele persegue — mais granular que o objetivo da campanha,
// já que uma campanha pode ter conjuntos com metas diferentes entre si; ver
// docs/superpowers/specs/2026-07-22-metricas-por-objetivo-design.md) pra
// uma chave de TRACKED_ACTIONS (report-variables.ts). Módulo puro — sem
// fetch/env — seguro pra importar em componente client.

/** optimization_goal -> chave de TRACKED_ACTIONS, quando o mapeamento é 1:1. */
const OPTIMIZATION_GOAL_TO_ACTION_KEY: Record<string, string> = {
  LEAD_GENERATION: "leads",
  QUALITY_LEAD: "leads",
  LINK_CLICKS: "cliques_link",
  LANDING_PAGE_VIEWS: "visualizacoes_pagina",
  APP_INSTALLS: "instalacoes_app",
  CONVERSATIONS: "conversas_iniciadas",
  REPLIES: "conversas_iniciadas",
};

/** Para optimization_goal=OFFSITE_CONVERSIONS (genérico), desambigua pelo evento configurado no conjunto de anúncios. */
const CUSTOM_EVENT_TYPE_TO_ACTION_KEY: Record<string, string> = {
  PURCHASE: "compras",
  ADD_TO_CART: "carrinho",
  INITIATED_CHECKOUT: "checkout_iniciado",
  COMPLETE_REGISTRATION: "cadastros",
  LEAD: "leads",
  ADD_PAYMENT_INFO: "info_pagamento",
};

/**
 * Mapeia o objetivo de otimização de um conjunto de anúncios pra uma chave
 * de TRACKED_ACTIONS. Retorna null quando o objetivo não tem um "resultado"
 * comparável (ex: Reconhecimento, Alcance) ou quando OFFSITE_CONVERSIONS
 * vem sem um custom_event_type reconhecido.
 */
export function mapOptimizationGoalToActionKey(
  optimizationGoal: string,
  customEventType?: string | null,
): string | null {
  if (optimizationGoal === "OFFSITE_CONVERSIONS") {
    return customEventType ? (CUSTOM_EVENT_TYPE_TO_ACTION_KEY[customEventType] ?? null) : null;
  }
  return OPTIMIZATION_GOAL_TO_ACTION_KEY[optimizationGoal] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ad-set-objectives.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ad-set-objectives.ts src/lib/ad-set-objectives.test.ts
git commit -m "feat: mapeia optimization_goal do conjunto de anuncios para chave de tracked action"
```

---

### Task 2: `ad-set-objectives.ts` — objective rollup computation

**Files:**
- Modify: `src/lib/ad-set-objectives.ts`
- Test: `src/lib/ad-set-objectives.test.ts`

**Interfaces:**
- Consumes: `mapOptimizationGoalToActionKey` (Task 1); `sumActionValue`, `type InsightAction` from `src/lib/report-metrics.ts`.
- Produces: `export interface AdSetObjective { adSetId: string; actionKey: string | null }`, `export interface AdSetInsightRow { adSetId: string; spend: number; actions: InsightAction[]; actionValues: InsightAction[] }`, `export interface ObjectiveRollup { distinctActionKeys: string[]; byActionKey: Record<string, { spend: number; count: number; value: number }> }`, `export function computeObjectiveRollups(adSets: AdSetObjective[], insightRows: AdSetInsightRow[], actionTypesByKey: Record<string, string[]>): ObjectiveRollup`.

- [ ] **Step 1: Write the failing tests**

```typescript
// append to src/lib/ad-set-objectives.test.ts
import { computeObjectiveRollups, type AdSetObjective, type AdSetInsightRow } from "./ad-set-objectives";

const ACTION_TYPES_BY_KEY: Record<string, string[]> = {
  leads: ["lead"],
  compras: ["purchase"],
};

describe("computeObjectiveRollups", () => {
  it("um único objetivo entre os conjuntos com gasto: não é misto", () => {
    const adSets: AdSetObjective[] = [
      { adSetId: "1", actionKey: "leads" },
      { adSetId: "2", actionKey: "leads" },
    ];
    const rows: AdSetInsightRow[] = [
      { adSetId: "1", spend: 100, actions: [{ action_type: "lead", value: "5" }], actionValues: [] },
      { adSetId: "2", spend: 50, actions: [{ action_type: "lead", value: "2" }], actionValues: [] },
    ];
    const rollup = computeObjectiveRollups(adSets, rows, ACTION_TYPES_BY_KEY);
    expect(rollup.distinctActionKeys).toEqual(["leads"]);
    expect(rollup.byActionKey.leads).toEqual({ spend: 150, count: 7, value: 0 });
  });

  it("múltiplos objetivos distintos entre os conjuntos com gasto: é misto", () => {
    const adSets: AdSetObjective[] = [
      { adSetId: "1", actionKey: "leads" },
      { adSetId: "2", actionKey: "compras" },
    ];
    const rows: AdSetInsightRow[] = [
      { adSetId: "1", spend: 100, actions: [{ action_type: "lead", value: "5" }], actionValues: [] },
      {
        adSetId: "2",
        spend: 200,
        actions: [{ action_type: "purchase", value: "3" }],
        actionValues: [{ action_type: "purchase", value: "450" }],
      },
    ];
    const rollup = computeObjectiveRollups(adSets, rows, ACTION_TYPES_BY_KEY);
    expect(rollup.distinctActionKeys.sort()).toEqual(["compras", "leads"]);
    expect(rollup.byActionKey.leads).toEqual({ spend: 100, count: 5, value: 0 });
    expect(rollup.byActionKey.compras).toEqual({ spend: 200, count: 3, value: 450 });
  });

  it("conjunto com actionKey null não conta pro misto nem pro rollup", () => {
    const adSets: AdSetObjective[] = [
      { adSetId: "1", actionKey: "leads" },
      { adSetId: "2", actionKey: null },
    ];
    const rows: AdSetInsightRow[] = [
      { adSetId: "1", spend: 100, actions: [{ action_type: "lead", value: "5" }], actionValues: [] },
      { adSetId: "2", spend: 300, actions: [], actionValues: [] },
    ];
    const rollup = computeObjectiveRollups(adSets, rows, ACTION_TYPES_BY_KEY);
    expect(rollup.distinctActionKeys).toEqual(["leads"]);
    expect(Object.keys(rollup.byActionKey)).toEqual(["leads"]);
  });

  it("conjunto sem gasto no período (sem linha de insight) é ignorado", () => {
    const adSets: AdSetObjective[] = [
      { adSetId: "1", actionKey: "leads" },
      { adSetId: "2", actionKey: "compras" },
    ];
    const rows: AdSetInsightRow[] = [
      { adSetId: "1", spend: 100, actions: [{ action_type: "lead", value: "5" }], actionValues: [] },
    ];
    const rollup = computeObjectiveRollups(adSets, rows, ACTION_TYPES_BY_KEY);
    expect(rollup.distinctActionKeys).toEqual(["leads"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/ad-set-objectives.test.ts`
Expected: FAIL — `computeObjectiveRollups is not exported`.

- [ ] **Step 3: Implement the rollup**

Add to `src/lib/ad-set-objectives.ts`:

```typescript
import { sumActionValue, type InsightAction } from "./report-metrics";

export interface AdSetObjective {
  adSetId: string;
  /** Chave de TRACKED_ACTIONS que esse conjunto persegue, ou null se não mapeável (ex: Reconhecimento). */
  actionKey: string | null;
}

export interface AdSetInsightRow {
  adSetId: string;
  spend: number;
  actions: InsightAction[];
  actionValues: InsightAction[];
}

export interface ObjectiveRollup {
  /** Chaves distintas entre os conjuntos com gasto no período — mais de uma = objetivo misto. */
  distinctActionKeys: string[];
  /** Gasto + contagem + valor por chave, somando só os conjuntos daquele objetivo. */
  byActionKey: Record<string, { spend: number; count: number; value: number }>;
}

/**
 * Cruza os conjuntos de anúncios (com seu objetivo já mapeado) com as linhas
 * de insights por conjunto do período selecionado, e agrega gasto/contagem/
 * valor por chave de TRACKED_ACTIONS — só considerando conjuntos que
 * tiveram gasto no período (aparecem em `insightRows`) e cujo objetivo é
 * mapeável (`actionKey` não-nulo). Função pura, testável sem rede.
 */
export function computeObjectiveRollups(
  adSets: AdSetObjective[],
  insightRows: AdSetInsightRow[],
  actionTypesByKey: Record<string, string[]>,
): ObjectiveRollup {
  const actionKeyByAdSetId = new Map(adSets.map((a) => [a.adSetId, a.actionKey]));
  const byActionKey: Record<string, { spend: number; count: number; value: number }> = {};

  for (const row of insightRows) {
    const actionKey = actionKeyByAdSetId.get(row.adSetId);
    if (!actionKey) continue;
    const actionTypes = actionTypesByKey[actionKey] ?? [];
    const current = byActionKey[actionKey] ?? { spend: 0, count: 0, value: 0 };
    byActionKey[actionKey] = {
      spend: current.spend + row.spend,
      count: current.count + sumActionValue(row.actions, actionTypes),
      value: current.value + sumActionValue(row.actionValues, actionTypes),
    };
  }

  return { distinctActionKeys: Object.keys(byActionKey), byActionKey };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/ad-set-objectives.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ad-set-objectives.ts src/lib/ad-set-objectives.test.ts
git commit -m "feat: agrega gasto e resultado por objetivo de conjunto de anuncios"
```

---

### Task 3: `meta.ts` — fetch ad set objectives

**Files:**
- Modify: `src/lib/meta.ts`

**Interfaces:**
- Consumes: `mapOptimizationGoalToActionKey`, `type AdSetObjective` from `src/lib/ad-set-objectives.ts` (Task 1/2); existing `graphGetAll`, `getConfig` (unused directly, kept for pattern parity), `MetaApiError` in this file.
- Produces: `export async function getAccountAdSetObjectives(adAccountId: string): Promise<AdSetObjective[]>`.

- [ ] **Step 1: Add the import**

In `src/lib/meta.ts`, add to the top imports:

```typescript
import { mapOptimizationGoalToActionKey, type AdSetObjective } from "./ad-set-objectives";
```

- [ ] **Step 2: Implement the fetch**

Add to the end of `src/lib/meta.ts`:

```typescript
interface RawAdSet {
  id: string;
  optimization_goal?: string;
  promoted_object?: { custom_event_type?: string };
}

/**
 * Busca todos os conjuntos de anúncios da conta com seu objetivo de
 * otimização já mapeado pra uma chave de TRACKED_ACTIONS. Não filtra por
 * status — um conjunto pausado hoje mas que gastou no período selecionado
 * ainda precisa aparecer aqui pra não perder o gasto dele no rollup por
 * objetivo (quem decide "só conta quem gastou no período" é o cruzamento
 * com os insights por conjunto, não o status atual).
 */
export async function getAccountAdSetObjectives(adAccountId: string): Promise<AdSetObjective[]> {
  const rows = await graphGetAll<RawAdSet>(`/${adAccountId}/adsets`, {
    fields: "id,optimization_goal,promoted_object{custom_event_type}",
  });
  return rows.map((row) => ({
    adSetId: row.id,
    actionKey: row.optimization_goal
      ? mapOptimizationGoalToActionKey(row.optimization_goal, row.promoted_object?.custom_event_type)
      : null,
  }));
}
```

- [ ] **Step 3: Confirm the project still type-checks**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/meta.ts
git commit -m "feat: busca objetivo de otimizacao dos conjuntos de anuncios da conta"
```

---

### Task 4: `meta-insights.ts` — ad-set-level insights and combined rollup fetch

**Files:**
- Modify: `src/lib/meta-insights.ts`

**Interfaces:**
- Consumes: `getAccountAdSetObjectives` from `src/lib/meta.ts` (Task 3); `computeObjectiveRollups`, `type ObjectiveRollup`, `type AdSetInsightRow` from `src/lib/ad-set-objectives.ts` (Task 2); `TRACKED_ACTIONS` (already imported in this file).
- Produces: `export async function getAccountObjectiveRollup(adAccountId: string, selection: PeriodSelection | ReportPeriod): Promise<ObjectiveRollup>`.

- [ ] **Step 1: Add the imports**

In `src/lib/meta-insights.ts`, add to the top imports:

```typescript
import { getAccountAdSetObjectives } from "./meta";
import { computeObjectiveRollups, type AdSetInsightRow, type ObjectiveRollup } from "./ad-set-objectives";
```

- [ ] **Step 2: Implement the combined fetch**

Add to the end of `src/lib/meta-insights.ts`:

```typescript
/** Mapa chave de TRACKED_ACTIONS -> tipos de ação da Graph API, usado pra agregar o rollup por objetivo. */
const ACTION_TYPES_BY_TRACKED_KEY: Record<string, string[]> = Object.fromEntries(
  TRACKED_ACTIONS.map((a) => [a.key, a.actionTypes]),
);

/**
 * Busca gasto/ações por conjunto de anúncios no período selecionado —
 * conjuntos sem gasto no período simplesmente não aparecem no resultado.
 */
async function fetchAdSetInsightRows(
  adAccountId: string,
  selection: PeriodSelection,
): Promise<AdSetInsightRow[]> {
  const params: Record<string, string> = {
    fields: "adset_id,spend,actions,action_values",
    level: "adset",
    ...buildPeriodParams(selection),
  };
  const rows = await graphGetAll<{ adset_id?: string; spend?: string; actions?: InsightAction[]; action_values?: InsightAction[] }>(
    `/${adAccountId}/insights`,
    params,
  );
  return rows.map((row) => ({
    adSetId: row.adset_id ?? "",
    spend: Number(row.spend ?? 0),
    actions: row.actions ?? [],
    actionValues: row.action_values ?? [],
  }));
}

/**
 * Busca o rollup de gasto/resultado por objetivo de conjunto de anúncios
 * pra uma conta no período informado — usado pra filtrar as métricas
 * "custo por X"/ROAS por objetivo e pra detectar objetivo misto no
 * Resultado/Custo por resultado.
 */
export async function getAccountObjectiveRollup(
  adAccountId: string,
  selection: PeriodSelection | ReportPeriod,
): Promise<ObjectiveRollup> {
  const normalized = normalizeSelection(selection);
  const [adSets, insightRows] = await Promise.all([
    getAccountAdSetObjectives(adAccountId),
    fetchAdSetInsightRows(adAccountId, normalized),
  ]);
  return computeObjectiveRollups(adSets, insightRows, ACTION_TYPES_BY_TRACKED_KEY);
}
```

- [ ] **Step 3: Confirm the project still type-checks**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/meta-insights.ts
git commit -m "feat: busca rollup de metricas por objetivo de conjunto de anuncios"
```

---

### Task 5: `dashboard-metrics.ts` — objective-filtered cost_per, filtered ROAS, pseudo kind

**Files:**
- Modify: `src/lib/dashboard-metrics.ts`
- Test: `src/lib/dashboard-metrics.test.ts`

**Interfaces:**
- Consumes: `type ObjectiveRollup` from `src/lib/ad-set-objectives.ts` (Task 2).
- Produces: `MetricSource`'s `cost_per` variant (defined in `metrics-catalog.ts`, Task 6) gains an optional `objectiveKey?: string`, read here; a new `MetricSource` kind `{ kind: "pseudo" }` (also defined in `metrics-catalog.ts`, Task 6); `extractMetricValue(row: GraphInsightRow, metric: MetricDefinition, rollup?: ObjectiveRollup): number | null` and `extractMetricValues(row: GraphInsightRow, metricKeys: string[], rollup?: ObjectiveRollup): Record<string, number | null>` gain the optional `rollup` parameter (backward compatible — existing callers that omit it keep the old account-level behavior for every metric that isn't objective-filtered).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/dashboard-metrics.test.ts` (this task depends on `metrics-catalog.ts` already having the `objectiveKey` field and `"pseudo"` kind on the `MetricSource` type — implement Task 6 first if executing tasks out of order is not possible; if your TDD tool requires the type to exist before writing this test, add the `objectiveKey?: string` field to `cost_per` and the `"pseudo"` variant to `MetricSource` in `metrics-catalog.ts` as a small preparatory edit here, then let Task 6 build on top of it):

```typescript
import type { ObjectiveRollup } from "./ad-set-objectives";

describe("extractMetricValue com rollup por objetivo", () => {
  const rollup: ObjectiveRollup = {
    distinctActionKeys: ["leads", "compras"],
    byActionKey: {
      leads: { spend: 100, count: 5, value: 0 },
      compras: { spend: 300, count: 3, value: 900 },
    },
  };

  it("cost_per com objectiveKey usa o rollup em vez da linha da conta", () => {
    const metric: MetricDefinition = {
      key: "custo_por_lead",
      label: "Custo por lead",
      category: "Conversões",
      valueKind: "currency",
      source: { kind: "cost_per", countField: "actions", countActionTypes: ["lead"], objectiveKey: "leads" },
    };
    // Linha da conta traria um gasto/contagem bem diferentes do rollup — confirma que o rollup vence.
    const row: GraphInsightRow = { spend: "99999", actions: [{ action_type: "lead", value: "1" }] };
    expect(extractMetricValue(row, metric, rollup)).toBe(20); // 100 / 5
  });

  it("cost_per com objectiveKey mas chave ausente do rollup retorna null", () => {
    const metric: MetricDefinition = {
      key: "custo_por_cadastro",
      label: "Custo por cadastro",
      category: "Conversões",
      valueKind: "currency",
      source: { kind: "cost_per", countField: "actions", countActionTypes: ["complete_registration"], objectiveKey: "cadastros" },
    };
    const row: GraphInsightRow = { spend: "50", actions: [] };
    expect(extractMetricValue(row, metric, rollup)).toBeNull();
  });

  it("cost_per sem objectiveKey ignora o rollup e usa a linha da conta (comportamento antigo)", () => {
    const metric: MetricDefinition = {
      key: "cpm",
      label: "CPM",
      category: "Distribuição",
      valueKind: "currency",
      source: { kind: "cost_per", countField: "impressions" },
    };
    const row: GraphInsightRow = { spend: "40", impressions: "2000" };
    expect(extractMetricValue(row, metric, rollup)).toBe(0.02);
  });

  it("roas sempre usa o rollup da chave compras quando disponível", () => {
    const metric: MetricDefinition = {
      key: "roas_compras",
      label: "ROAS das compras",
      category: "ROAS e ticket médio",
      valueKind: "decimal",
      source: { kind: "roas", actionTypes: ["purchase"] },
    };
    const row: GraphInsightRow = { spend: "99999", action_values: [{ action_type: "purchase", value: "1" }] };
    expect(extractMetricValue(row, metric, rollup)).toBe(3); // 900 / 300
  });

  it("roas sem rollup cai pro cálculo antigo a partir da linha da conta", () => {
    const metric: MetricDefinition = {
      key: "roas_compras",
      label: "ROAS das compras",
      category: "ROAS e ticket médio",
      valueKind: "decimal",
      source: { kind: "roas", actionTypes: ["purchase"] },
    };
    const row: GraphInsightRow = { spend: "100", action_values: [{ action_type: "purchase", value: "250" }] };
    expect(extractMetricValue(row, metric)).toBe(2.5);
  });

  it("kind pseudo sempre retorna null e não exige nenhum campo da Graph API", () => {
    const metric: MetricDefinition = {
      key: "resultado",
      label: "Resultado",
      category: "Resultados e investimento",
      valueKind: "count",
      source: { kind: "pseudo" },
    };
    expect(extractMetricValue({}, metric)).toBeNull();
    expect(buildMetricFields(["resultado"], [metric])).toEqual(["spend"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/dashboard-metrics.test.ts`
Expected: FAIL — `objectiveKey`/`"pseudo"` don't exist on `MetricSource` yet (type error), and `extractMetricValue` doesn't accept a third argument.

- [ ] **Step 3: Add `objectiveKey` and the `"pseudo"` kind to `MetricSource`**

In `src/lib/metrics-catalog.ts`, replace:

```typescript
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
```

with:

```typescript
export type MetricSource =
  | { kind: "scalar"; field: string }
  | { kind: "action_sum"; field: string; actionTypes?: string[] }
  | {
      kind: "cost_per";
      countField: string;
      countActionTypes?: string[];
      /** Quando presente, essa métrica usa o rollup por objetivo de conjunto de anúncios (gasto+contagem só dos conjuntos com esse objetivo) em vez do rollup da conta inteira. Chave de ObjectiveRollup.byActionKey (ad-set-objectives.ts). */
      objectiveKey?: string;
    }
  | {
      kind: "rate";
      numeratorField: string;
      numeratorActionTypes?: string[];
      denominatorField: string;
      denominatorActionTypes?: string[];
      multiplier: number;
    }
  | { kind: "roas"; actionTypes: string[] }
  | { kind: "ticket_medio"; actionTypes: string[] }
  | { kind: "pseudo" };
```

(This edit belongs to `metrics-catalog.ts`, but is listed here because this task's tests depend on it — Task 6 will use these same fields when it adds `objectiveKey` to the real catalog entries.)

- [ ] **Step 4: Update `dashboard-metrics.ts`'s extraction functions**

Replace in `src/lib/dashboard-metrics.ts`:

```typescript
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
      return ["actions", "action_values"];
    case "ticket_medio":
      return ["actions", "action_values"];
  }
}
```

with:

```typescript
function fieldsForSource(source: MetricSource): string[] {
  switch (source.kind) {
    case "scalar":
      return [source.field];
    case "action_sum":
      return [source.field];
    case "cost_per":
      return source.objectiveKey ? [] : ["spend", source.countField];
    case "rate":
      return [source.numeratorField, source.denominatorField];
    case "roas":
      return ["actions", "action_values"];
    case "ticket_medio":
      return ["actions", "action_values"];
    case "pseudo":
      return [];
  }
}
```

Replace:

```typescript
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

with:

```typescript
/**
 * Extrai o valor de uma métrica específica de uma linha crua. Retorna null
 * quando o denominador/contagem é 0 (evita divisão por zero). Quando
 * `rollup` é informado e a métrica é `cost_per` com `objectiveKey` (ou
 * `roas`), usa o rollup por objetivo de conjunto de anúncios em vez da
 * linha da conta inteira — ver ad-set-objectives.ts.
 */
export function extractMetricValue(
  row: GraphInsightRow,
  metric: MetricDefinition,
  rollup?: ObjectiveRollup,
): number | null {
  const { source } = metric;
  switch (source.kind) {
    case "scalar":
      return resolveFieldValue(row, source.field);
    case "action_sum":
      return resolveFieldValue(row, source.field, source.actionTypes);
    case "cost_per": {
      if (source.objectiveKey) {
        const entry = rollup?.byActionKey[source.objectiveKey];
        if (!entry || entry.count <= 0) return null;
        return entry.spend / entry.count;
      }
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
      const comprasRollup = rollup?.byActionKey["compras"];
      if (comprasRollup) return computeRoas(comprasRollup.spend, comprasRollup.value);
      const spend = resolveFieldValue(row, "spend");
      const value = resolveFieldValue(row, "action_values", source.actionTypes);
      return computeRoas(spend, value);
    }
    case "ticket_medio": {
      const count = resolveFieldValue(row, "actions", source.actionTypes);
      const value = resolveFieldValue(row, "action_values", source.actionTypes);
      return computeTicketMedio(value, count);
    }
    case "pseudo":
      return null;
  }
}

/** Extrai todas as métricas pedidas de uma linha crua. Chaves desconhecidas no catálogo são ignoradas silenciosamente. */
export function extractMetricValues(
  row: GraphInsightRow,
  metricKeys: string[],
  rollup?: ObjectiveRollup,
): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  for (const key of metricKeys) {
    const metric = findMetric(key);
    if (!metric) continue;
    result[key] = extractMetricValue(row, metric, rollup);
  }
  return result;
}
```

Add the import at the top of `src/lib/dashboard-metrics.ts`:

```typescript
import type { ObjectiveRollup } from "./ad-set-objectives";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/dashboard-metrics.test.ts`
Expected: PASS (all previous tests + 6 new ones)

- [ ] **Step 6: Run full test suite to confirm no regressions**

Run: `npm test`
Expected: All tests PASS — every existing caller of `extractMetricValue`/`extractMetricValues` omits the new optional `rollup` parameter and keeps the old account-level behavior.

- [ ] **Step 7: Commit**

```bash
git add src/lib/dashboard-metrics.ts src/lib/dashboard-metrics.test.ts src/lib/metrics-catalog.ts
git commit -m "feat: custo por X e ROAS usam rollup por objetivo quando disponivel"
```

---

### Task 6: `metrics-catalog.ts` — Gasto, Resultado/Custo por resultado pseudo-entries, objectiveKey wiring

**Files:**
- Modify: `src/lib/metrics-catalog.ts`
- Test: `src/lib/metrics-catalog.test.ts`

**Interfaces:**
- Consumes: `MetricSource`'s `objectiveKey`/`"pseudo"` (Task 5, already added to the type).
- Produces: new catalog entries `gasto`, `resultado`, `custo_por_resultado`; the 10 `TRACKED_ACTIONS`-derived `costKey` entries and `cpc_link` gain `objectiveKey`.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/metrics-catalog.test.ts`:

```typescript
describe("Resultados e investimento", () => {
  it("inclui gasto, resultado e custo_por_resultado", () => {
    const keys = METRIC_CATALOG.map((m) => m.key);
    expect(keys).toEqual(expect.arrayContaining(["gasto", "resultado", "custo_por_resultado"]));
  });

  it("resultado e custo_por_resultado são pseudo-métricas (sem fonte de dado real)", () => {
    expect(findMetric("resultado")?.source).toEqual({ kind: "pseudo" });
    expect(findMetric("custo_por_resultado")?.source).toEqual({ kind: "pseudo" });
  });

  it("gasto é uma métrica real (campo escalar spend)", () => {
    expect(findMetric("gasto")?.source).toEqual({ kind: "scalar", field: "spend" });
  });
});

describe("objectiveKey nas métricas de custo por resultado rastreado", () => {
  it("toda métrica custo_por_X gerada de TRACKED_ACTIONS tem objectiveKey igual à chave rastreada", () => {
    for (const tracked of TRACKED_ACTIONS) {
      const metric = findMetric(tracked.costKey);
      expect(metric?.source).toEqual({
        kind: "cost_per",
        countField: "actions",
        countActionTypes: tracked.actionTypes,
        objectiveKey: tracked.key,
      });
    }
  });

  it("cpc_link tem objectiveKey cliques_link", () => {
    expect(findMetric("cpc_link")?.source).toEqual({
      kind: "cost_per",
      countField: "inline_link_clicks",
      objectiveKey: "cliques_link",
    });
  });
});
```

Add the `TRACKED_ACTIONS` import to the test file if not already present:

```typescript
import { TRACKED_ACTIONS } from "./report-variables";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/metrics-catalog.test.ts`
Expected: FAIL — `gasto`/`resultado`/`custo_por_resultado` don't exist yet; `objectiveKey` missing from the existing `cost_per` entries.

- [ ] **Step 3: Add the new category and wire `objectiveKey`**

In `src/lib/metrics-catalog.ts`, add above `const DISTRIBUICAO`:

```typescript
const RESULTADOS_INVESTIMENTO: MetricDefinition[] = [
  { key: "gasto", label: "Gasto", category: "Resultados e investimento", valueKind: "currency", source: { kind: "scalar", field: "spend" } },
  {
    key: "resultado",
    label: "Resultado",
    category: "Resultados e investimento",
    valueKind: "count",
    source: { kind: "pseudo" },
  },
  {
    key: "custo_por_resultado",
    label: "Custo por resultado",
    category: "Resultados e investimento",
    valueKind: "currency",
    source: { kind: "pseudo" },
  },
];
```

`resultado` and `custo_por_resultado` are "pseudo" catalog entries: they exist so the "Personalizar colunas" panel can list, select, remove, and reorder them like any other metric, but their actual value is never computed by `extractMetricValue` — it's computed per-account from the account's own `result_metric_key` (see `dashboard/page.tsx`, Task 10), because unlike every other catalog metric, "Resultado" means a different underlying conversion type for each account.

Replace the `cpc_link` entry in `DISTRIBUICAO`:

```typescript
  {
    key: "cpc_link",
    label: "CPC (custo por clique no link)",
    category: "Distribuição",
    valueKind: "currency",
    source: { kind: "cost_per", countField: "inline_link_clicks" },
  },
```

with:

```typescript
  {
    key: "cpc_link",
    label: "CPC (custo por clique no link)",
    category: "Distribuição",
    valueKind: "currency",
    source: { kind: "cost_per", countField: "inline_link_clicks", objectiveKey: "cliques_link" },
  },
```

Replace the `CONVERSOES` generator:

```typescript
const CONVERSOES: MetricDefinition[] = TRACKED_ACTIONS.flatMap((a) => [
  { key: a.key, label: a.label, category: "Conversões", valueKind: "count" as const, source: { kind: "action_sum" as const, field: "actions", actionTypes: a.actionTypes } },
  { key: a.costKey, label: `Custo por ${a.label.toLowerCase()}`, category: "Conversões", valueKind: "currency" as const, source: { kind: "cost_per" as const, countField: "actions", countActionTypes: a.actionTypes } },
  { key: a.valueKey, label: `Valor de ${a.label.toLowerCase()}`, category: "Conversões", valueKind: "currency" as const, source: { kind: "action_sum" as const, field: "action_values", actionTypes: a.actionTypes } },
]);
```

with:

```typescript
const CONVERSOES: MetricDefinition[] = TRACKED_ACTIONS.flatMap((a) => [
  { key: a.key, label: a.label, category: "Conversões", valueKind: "count" as const, source: { kind: "action_sum" as const, field: "actions", actionTypes: a.actionTypes } },
  {
    key: a.costKey,
    label: `Custo por ${a.label.toLowerCase()}`,
    category: "Conversões",
    valueKind: "currency" as const,
    source: { kind: "cost_per" as const, countField: "actions", countActionTypes: a.actionTypes, objectiveKey: a.key },
  },
  { key: a.valueKey, label: `Valor de ${a.label.toLowerCase()}`, category: "Conversões", valueKind: "currency" as const, source: { kind: "action_sum" as const, field: "action_values", actionTypes: a.actionTypes } },
]);
```

Finally, add `RESULTADOS_INVESTIMENTO` to `METRIC_CATALOG` (first, so it's the first category shown in the picker):

```typescript
export const METRIC_CATALOG: MetricDefinition[] = [
  ...RESULTADOS_INVESTIMENTO,
  ...DISTRIBUICAO,
  ...VIDEO,
  ...ENGAJAMENTO,
  ...MENSAGENS,
  ...CONVERSOES,
  ...ROAS_TICKET,
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/metrics-catalog.test.ts`
Expected: PASS (all previous tests + 5 new ones)

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/metrics-catalog.ts src/lib/metrics-catalog.test.ts
git commit -m "feat: desafixa gasto/resultado/custo/roas como metricas normais do catalogo"
```

---

### Task 7: Migration — preserve the un-pinned columns for existing installs

**Files:**
- Create: `supabase/migrations/0012_dashboard_default_columns.sql`

**Interfaces:**
- Produces: prepends `gasto`, `resultado`, `custo_por_resultado`, `roas_compras` to the existing `dashboard_column_preferences.metric_keys` (id=1), so the columns that used to be pinned don't disappear the moment this feature ships.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0012_dashboard_default_columns.sql
-- As colunas Gasto/Resultado/Custo por resultado/ROAS deixam de ser
-- pinadas nesta rodada (viram métricas normais do catálogo, selecionáveis
-- e removíveis). Pra quem já usa o dashboard não perder essas colunas do
-- dia pra noite, prepend na preferência global já existente — a leitura
-- (getSelectedMetricKeys) já deduplica preservando a primeira ocorrência,
-- então não há problema se alguma delas já estiver selecionada.

update dashboard_column_preferences
set metric_keys = array['gasto', 'resultado', 'custo_por_resultado', 'roas_compras'] || metric_keys
where id = 1;
```

- [ ] **Step 2: Apply the migration**

Run: `npm run db:migrate`
Expected output includes: `Aplicando 0012_dashboard_default_columns.sql...` then `Migrations aplicadas com sucesso.`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0012_dashboard_default_columns.sql
git commit -m "feat: preserva colunas antes pinadas na preferencia global existente"
```

---

### Task 8: `dashboard-sort.ts` — generalize sorting to any selected column

**Files:**
- Modify: `src/lib/dashboard-sort.ts`
- Test: `src/lib/dashboard-sort.test.ts`

**Interfaces:**
- Produces: `export interface SortableRow { name: string; values: Record<string, number | null> }`, `export function sortOverviewRows<T extends SortableRow>(rows: T[], sortKey: string, direction: "asc" | "desc"): T[]` (`sortKey` is `"name"` for the account name, or any key present in `values`).

- [ ] **Step 1: Replace the test file**

Replace the full contents of `src/lib/dashboard-sort.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { sortOverviewRows, type SortableRow } from "./dashboard-sort";

const rows: SortableRow[] = [
  { name: "Conta C", values: { spend: 300, resultValue: 10, roas: 1.5 } },
  { name: "Conta A", values: { spend: 100, resultValue: 5, roas: null } },
  { name: "Conta B", values: { spend: 200, resultValue: 8, roas: 3 } },
];

describe("sortOverviewRows", () => {
  it("ordena numericamente por uma chave de values, decrescente", () => {
    const result = sortOverviewRows(rows, "spend", "desc");
    expect(result.map((r) => r.name)).toEqual(["Conta C", "Conta B", "Conta A"]);
  });

  it("ordena alfabeticamente por name, crescente", () => {
    const result = sortOverviewRows(rows, "name", "asc");
    expect(result.map((r) => r.name)).toEqual(["Conta A", "Conta B", "Conta C"]);
  });

  it("manda valores null pro fim independente da direção", () => {
    const asc = sortOverviewRows(rows, "roas", "asc");
    expect(asc[asc.length - 1].name).toBe("Conta A");
    const desc = sortOverviewRows(rows, "roas", "desc");
    expect(desc[desc.length - 1].name).toBe("Conta A");
  });

  it("não muta o array original", () => {
    const copy = [...rows];
    sortOverviewRows(rows, "spend", "asc");
    expect(rows).toEqual(copy);
  });

  it("ordena por qualquer chave dinâmica presente em values (ex: uma coluna do catálogo)", () => {
    const dynamicRows: SortableRow[] = [
      { name: "X", values: { video_p25: 40 } },
      { name: "Y", values: { video_p25: 10 } },
      { name: "Z", values: { video_p25: 25 } },
    ];
    const result = sortOverviewRows(dynamicRows, "video_p25", "asc");
    expect(result.map((r) => r.name)).toEqual(["Y", "Z", "X"]);
  });

  it("chave ausente em values é tratada como null (vai pro fim)", () => {
    const partialRows: SortableRow[] = [
      { name: "X", values: { video_p25: 40 } },
      { name: "Y", values: {} },
    ];
    const result = sortOverviewRows(partialRows, "video_p25", "desc");
    expect(result.map((r) => r.name)).toEqual(["X", "Y"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/dashboard-sort.test.ts`
Expected: FAIL — current `SortableRow`/`sortOverviewRows` have the old fixed shape (`spend`, `resultValue`, `costPerResult`, `roas` as direct fields, no `values` map).

- [ ] **Step 3: Rewrite `dashboard-sort.ts`**

Replace the full contents of `src/lib/dashboard-sort.ts`:

```typescript
// src/lib/dashboard-sort.ts

export interface SortableRow {
  name: string;
  /** Valor de cada coluna selecionada, por chave do catálogo (ou pseudo-chave como "resultado"). */
  values: Record<string, number | null>;
}

/**
 * Ordena linhas da visão geral por "name" (alfabético) ou por qualquer
 * chave presente em `values` (numérico). Nulls (e chaves ausentes) vão
 * sempre pro fim, independente da direção. Função pura, não muta o array.
 */
export function sortOverviewRows<T extends SortableRow>(
  rows: T[],
  sortKey: string,
  direction: "asc" | "desc",
): T[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortKey === "name") return factor * a.name.localeCompare(b.name);
    const av = a.values[sortKey] ?? null;
    const bv = b.values[sortKey] ?? null;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return factor * (av - bv);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/dashboard-sort.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard-sort.ts src/lib/dashboard-sort.test.ts
git commit -m "feat: generaliza ordenacao da visao geral para qualquer coluna selecionada"
```

---

### Task 9: `DashboardOverviewTable.tsx` — one generic column list

**Files:**
- Modify: `src/app/(app)/dashboard/DashboardOverviewTable.tsx`

**Interfaces:**
- Consumes: `sortOverviewRows`, `type SortableRow` from `src/lib/dashboard-sort.ts` (Task 8); `formatMetricValue` from `@/lib/metric-format`; `type MetricDefinition` from `@/lib/metrics-catalog`.
- Produces: `export interface OverviewRow { id: string; metaAccountId: string; name: string; values: Record<string, number | null>; valueLabels?: Record<string, string>; error: string | null }` (replaces the old fixed-field shape); `DashboardOverviewTable` now takes `columns: MetricDefinition[]` (every selected column, "Conta" is separate/always first) instead of the old split between hardcoded `COLUMNS` and `extraColumns`.

- [ ] **Step 1: Replace the file**

Replace the full contents of `src/app/(app)/dashboard/DashboardOverviewTable.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { sortOverviewRows } from "@/lib/dashboard-sort";
import { formatMetricValue } from "@/lib/metric-format";
import type { MetricDefinition } from "@/lib/metrics-catalog";

export interface OverviewRow {
  id: string;
  metaAccountId: string;
  name: string;
  /** Valor de cada coluna selecionada, por chave do catálogo. */
  values: Record<string, number | null>;
  /** Rótulo dinâmico por coluna quando difere do label padrão (ex: "Resultado" mostra o nome da métrica escolhida pela conta, tipo "Compras"). */
  valueLabels?: Record<string, string>;
  error: string | null;
}

export default function DashboardOverviewTable({
  rows,
  columns,
}: {
  rows: OverviewRow[];
  columns: MetricDefinition[];
}) {
  const [sortKey, setSortKey] = useState<string>("gasto");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => sortOverviewRows(rows, sortKey, direction), [rows, sortKey, direction]);

  function toggleSort(key: string) {
    if (key === sortKey) {
      setDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDirection("desc");
    }
  }

  if (rows.length === 0) {
    return (
      <p className="rounded border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
        Nenhuma conta no dashboard ainda. Use &quot;Gerenciar contas&quot; para adicionar.
      </p>
    );
  }

  return (
    <table className="w-full text-left text-sm">
      <thead className="text-slate-400">
        <tr>
          <th className="cursor-pointer select-none px-4 py-2" onClick={() => toggleSort("name")}>
            Conta {sortKey === "name" ? (direction === "asc" ? "▲" : "▼") : ""}
          </th>
          {columns.map((col) => (
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
      <tbody>
        {sorted.map((row) => (
          <tr key={row.id} className="border-t border-slate-800 hover:bg-slate-900/60">
            <td className="px-4 py-2">
              <Link href={`/dashboard/${row.metaAccountId}`} className="text-sky-400 hover:underline">
                {row.name}
              </Link>
            </td>
            {row.error ? (
              <td colSpan={columns.length} className="px-4 py-2 text-xs text-red-400">
                {row.error}
              </td>
            ) : (
              columns.map((col) => (
                <td key={col.key} className="px-4 py-2">
                  {formatMetricValue(row.values[col.key] ?? null, col.valueKind)}
                  {row.valueLabels?.[col.key] && (
                    <span className="ml-1 text-xs text-slate-500">{row.valueLabels[col.key]}</span>
                  )}
                </td>
              ))
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Confirm the project still type-checks**

Run: `npx tsc --noEmit`
Expected: Errors only in `src/app/(app)/dashboard/page.tsx` (Task 10 fixes it — it still constructs the old `OverviewRow` shape and passes `extraColumns` instead of `columns`). No errors inside `DashboardOverviewTable.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/dashboard/DashboardOverviewTable.tsx
git commit -m "feat: DashboardOverviewTable usa uma lista unica de colunas selecionadas"
```

---

### Task 10: `dashboard/page.tsx` — wire the objective rollup, pseudo columns, drop the old pinned fetch

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getAccountObjectiveRollup`, `getAccountMetricValues` from `@/lib/meta-insights` (Tasks 4/5); `findMetric` from `@/lib/metrics-catalog` (Task 6); `getSelectedMetricKeys` from `@/lib/dashboard-columns`; `TRACKED_ACTIONS` from `@/lib/report-variables`; `OverviewRow` (Task 9).

- [ ] **Step 1: Replace the file**

Replace the full contents of `src/app/(app)/dashboard/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { listDashboardAccounts } from "@/lib/dashboard-accounts";
import { getAccountObjectiveRollup, getAccountMetricValues, type PeriodSelection } from "@/lib/meta-insights";
import { TRACKED_ACTIONS } from "@/lib/report-variables";
import { getSelectedMetricKeys } from "@/lib/dashboard-columns";
import { findMetric } from "@/lib/metrics-catalog";
import { parsePeriodFromSearchParams, searchParamsToURLSearchParams } from "@/lib/period-params";
import DashboardOverviewTable, { type OverviewRow } from "./DashboardOverviewTable";
import PeriodSelector from "./PeriodSelector";
import ManageAccountsButton from "./ManageAccountsButton";
import ManageAccountsSection from "./ManageAccountsSection";
import ColumnPickerButton from "./ColumnPickerButton";

const BATCH_SIZE = 10;
const PSEUDO_RESULT_KEYS = new Set(["resultado", "custo_por_resultado"]);

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const selection: PeriodSelection = parsePeriodFromSearchParams(searchParamsToURLSearchParams(sp));

  const accounts = await listDashboardAccounts();
  const selectedMetricKeys = await getSelectedMetricKeys();
  const columns = selectedMetricKeys.map(findMetric).filter((m) => m != null);
  const catalogKeysForFetch = selectedMetricKeys.filter((k) => !PSEUDO_RESULT_KEYS.has(k));
  const wantsResultado = selectedMetricKeys.some((k) => PSEUDO_RESULT_KEYS.has(k));

  const rows: OverviewRow[] = [];
  for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
    const batch = accounts.slice(i, i + BATCH_SIZE);
    const batchRows = await Promise.all(
      batch.map(async (account): Promise<OverviewRow> => {
        const resultMetric = TRACKED_ACTIONS.find((a) => a.key === account.resultMetricKey);
        try {
          const rollup = await getAccountObjectiveRollup(account.metaAccountId, selection);
          const extraMetrics = await getAccountMetricValues(
            account.metaAccountId,
            selection,
            catalogKeysForFetch,
            rollup,
          ).catch(() => ({}) as Record<string, number | null>);

          const values: Record<string, number | null> = { ...extraMetrics };
          const valueLabels: Record<string, string> = {};

          if (wantsResultado) {
            const isMixed = rollup.distinctActionKeys.length > 1;
            const entry = resultMetric ? rollup.byActionKey[resultMetric.key] : undefined;
            const resultValue = !isMixed && entry ? entry.count : null;
            const costPerResult = !isMixed && entry && entry.count > 0 ? entry.spend / entry.count : null;
            values.resultado = resultValue;
            values.custo_por_resultado = costPerResult;
            if (resultMetric) valueLabels.resultado = resultMetric.label;
          }

          return {
            id: account.id,
            metaAccountId: account.metaAccountId,
            name: account.accountName,
            values,
            valueLabels,
            error: null,
          };
        } catch (err) {
          return {
            id: account.id,
            metaAccountId: account.metaAccountId,
            name: account.accountName,
            values: {},
            error: err instanceof Error ? err.message : "Erro ao buscar métricas.",
          };
        }
      }),
    );
    rows.push(...batchRows);
  }

  return (
    <main className="mx-auto max-w-[1600px] p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-400">Métricas em tempo real das contas Meta Ads.</p>
        </div>
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
      <DashboardOverviewTable rows={rows} columns={columns} />
    </main>
  );
}
```

Note: `getAccountMetricValues` gains a 4th parameter (`rollup`) in this task's companion change to `meta-insights.ts` below — add it there before wiring this file.

- [ ] **Step 2: Thread the rollup into `getAccountMetricValues`**

In `src/lib/meta-insights.ts`, replace:

```typescript
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

with:

```typescript
export async function getAccountMetricValues(
  adAccountId: string,
  selection: PeriodSelection | ReportPeriod,
  metricKeys: string[],
  rollup?: ObjectiveRollup,
): Promise<Record<string, number | null>> {
  if (metricKeys.length === 0) return {};
  const fields = buildMetricFields(metricKeys).join(",");
  const params: Record<string, string> = { fields, ...buildPeriodParams(normalizeSelection(selection)) };
  const rows = await graphGetAll<GraphInsightRow>(`/${adAccountId}/insights`, params);
  return extractMetricValues(rows[0] ?? {}, metricKeys, rollup);
}
```

- [ ] **Step 3: Run the full test suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: All tests PASS, no type errors anywhere (this resolves the transient errors Task 9 left in this file).

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, open `/dashboard`.
Expected: with the migration from Task 7 applied, Gasto/Resultado/Custo por resultado/ROAS still appear by default (now as regular, removable columns — confirm via "📊 Colunas" that they're checked and can be unchecked). For an account whose ad sets share one objective, Resultado/Custo por resultado show real numbers; if you have (or can simulate by picking an account with) multiple ad-set objectives active in the period, Resultado/Custo por resultado show "—". Clicking any column header — including Gasto/Resultado/ROAS or a catalog column — sorts the table.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx src/lib/meta-insights.ts
git commit -m "feat: visao geral usa rollup por objetivo e colunas totalmente personalizaveis"
```

---

### Task 11: `KpiCards.tsx` — nullable Resultado/Custo por resultado

**Files:**
- Modify: `src/app/(app)/dashboard/[metaAccountId]/KpiCards.tsx`

**Interfaces:**
- Produces: `resultValue` prop becomes `number | null` (was `number`), rendering "—" when null (mixed objective), matching the existing `costPerResult`/`roas` pattern already in this file.

- [ ] **Step 1: Update the component**

Replace in `src/app/(app)/dashboard/[metaAccountId]/KpiCards.tsx`:

```typescript
export default function KpiCards({
  spend,
  resultLabel,
  resultValue,
  costPerResult,
  roas,
}: {
  spend: number;
  resultLabel: string;
  resultValue: number;
  costPerResult: number | null;
  roas: number | null;
}) {
  const cards = [
    { label: "Gasto", value: currencyFmt(spend) },
    { label: resultLabel, value: String(resultValue) },
    { label: "Custo por resultado", value: costPerResult != null ? currencyFmt(costPerResult) : "—" },
    { label: "ROAS", value: roas != null ? roas.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—" },
  ];
```

with:

```typescript
export default function KpiCards({
  spend,
  resultLabel,
  resultValue,
  costPerResult,
  roas,
}: {
  spend: number;
  resultLabel: string;
  resultValue: number | null;
  costPerResult: number | null;
  roas: number | null;
}) {
  const cards = [
    { label: "Gasto", value: currencyFmt(spend) },
    { label: resultLabel, value: resultValue != null ? String(resultValue) : "—" },
    { label: "Custo por resultado", value: costPerResult != null ? currencyFmt(costPerResult) : "—" },
    { label: "ROAS", value: roas != null ? roas.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—" },
  ];
```

- [ ] **Step 2: Confirm the project still type-checks**

Run: `npx tsc --noEmit`
Expected: A transient error in `[metaAccountId]/page.tsx` (still passes a plain `number` — fixed in Task 12) is expected; no errors inside `KpiCards.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/dashboard/\[metaAccountId\]/KpiCards.tsx
git commit -m "feat: KpiCards aceita resultado nulo (objetivo misto)"
```

---

### Task 12: Account detail page — objective-aware KPIs and ROAS

**Files:**
- Modify: `src/app/(app)/dashboard/[metaAccountId]/page.tsx`

**Interfaces:**
- Consumes: `getAccountObjectiveRollup` from `@/lib/meta-insights` (Task 4); `KpiCards` (Task 11).

- [ ] **Step 1: Update the imports**

Replace:

```typescript
import { getAccountInsights, getAccountInsightsDaily, type PeriodSelection } from "@/lib/meta-insights";
```

with:

```typescript
import {
  getAccountInsights,
  getAccountInsightsDaily,
  getAccountObjectiveRollup,
  type PeriodSelection,
} from "@/lib/meta-insights";
```

- [ ] **Step 2: Fetch the rollup alongside the existing insights and compute the objective-aware KPI values**

Replace:

```typescript
  const [insights, daily] = await Promise.all([
    getAccountInsights(metaAccountId, selection),
    getAccountInsightsDaily(metaAccountId, selection, resultMetric.actionTypes),
  ]);
  const resultValue = insights.detailedActions[resultMetric.key] ?? 0;
  const costPerResult = resultValue > 0 ? insights.spend / resultValue : null;
```

with:

```typescript
  const [insights, daily, rollup] = await Promise.all([
    getAccountInsights(metaAccountId, selection),
    getAccountInsightsDaily(metaAccountId, selection, resultMetric.actionTypes),
    getAccountObjectiveRollup(metaAccountId, selection),
  ]);
  const isMixedObjective = rollup.distinctActionKeys.length > 1;
  const resultEntry = rollup.byActionKey[resultMetric.key];
  const resultValue = !isMixedObjective && resultEntry ? resultEntry.count : null;
  const costPerResult = !isMixedObjective && resultEntry && resultEntry.count > 0 ? resultEntry.spend / resultEntry.count : null;
  const comprasEntry = rollup.byActionKey["compras"];
  const roas = comprasEntry ? computeRoas(comprasEntry.spend, comprasEntry.value) : null;
```

Add the `computeRoas` import:

```typescript
import { computeRoas } from "@/lib/report-metrics";
```

- [ ] **Step 3: Pass the new `roas` in place of `insights.roas`**

Replace:

```tsx
      <KpiCards
        spend={insights.spend}
        resultLabel={resultMetric.label}
        resultValue={resultValue}
        costPerResult={costPerResult}
        roas={insights.roas}
      />
```

with:

```tsx
      <KpiCards
        spend={insights.spend}
        resultLabel={resultMetric.label}
        resultValue={resultValue}
        costPerResult={costPerResult}
        roas={roas}
      />
```

Note: `insights.reach`, `insights.detailedActions[LINK_CLICKS_METRIC.key]`, `insights.detailedActions[CHECKOUT_METRIC.key]` (used by `ConversionFunnel`, below the KPI cards) are unaffected by this task — the conversion funnel is out of scope for the objective-mixing fix, per this plan's Global Constraints.

- [ ] **Step 4: Run the full test suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: All tests PASS, no type errors.

- [ ] **Step 5: Verify manually**

Run: `npm run dev`, open `/dashboard/{uma conta}`.
Expected: Resultado/Custo por resultado show "—" if that account's ad sets have mixed objectives in the period; ROAS reflects only ad sets optimizing for Compra.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/dashboard/\[metaAccountId\]/page.tsx
git commit -m "feat: KPIs da pagina de detalhe respeitam objetivo misto e ROAS filtrado"
```

---

### Task 13: Account switcher on the detail page

**Files:**
- Create: `src/app/(app)/dashboard/[metaAccountId]/AccountSwitcher.tsx`
- Modify: `src/app/(app)/dashboard/[metaAccountId]/page.tsx`

**Interfaces:**
- Consumes: `listDashboardAccounts` from `@/lib/dashboard-accounts` (already used by this page's sibling `dashboard/page.tsx`).
- Produces: `<AccountSwitcher accounts={{ metaAccountId: string; accountName: string }[]} currentMetaAccountId={string} />` client component, navigating to `/dashboard/{novoId}` preserving the current query string (period selection).

- [ ] **Step 1: Implement `AccountSwitcher.tsx`**

```tsx
// src/app/(app)/dashboard/[metaAccountId]/AccountSwitcher.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function AccountSwitcher({
  accounts,
  currentMetaAccountId,
}: {
  accounts: { metaAccountId: string; accountName: string }[];
  currentMetaAccountId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const query = searchParams.toString();
    router.push(`/dashboard/${next}${query ? `?${query}` : ""}`);
  }

  return (
    <select
      value={currentMetaAccountId}
      onChange={handleChange}
      className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
    >
      {accounts.map((a) => (
        <option key={a.metaAccountId} value={a.metaAccountId}>
          {a.accountName}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Wire it into the detail page**

In `src/app/(app)/dashboard/[metaAccountId]/page.tsx`, add the imports:

```typescript
import { listDashboardAccounts } from "@/lib/dashboard-accounts";
import AccountSwitcher from "./AccountSwitcher";
```

Fetch the account list alongside the current account (replace):

```typescript
  const { metaAccountId } = await params;
  const account = await getDashboardAccount(metaAccountId);
  if (!account) notFound();
```

with:

```typescript
  const { metaAccountId } = await params;
  const [account, allAccounts] = await Promise.all([
    getDashboardAccount(metaAccountId),
    listDashboardAccounts(),
  ]);
  if (!account) notFound();
```

Add the switcher next to the account name in the header — replace:

```tsx
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{account.accountName}</h1>
          <p className="text-sm text-slate-400">Dashboard de métricas em tempo real.</p>
        </div>
```

with:

```tsx
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{account.accountName}</h1>
            <AccountSwitcher
              accounts={allAccounts.map((a) => ({ metaAccountId: a.metaAccountId, accountName: a.accountName }))}
              currentMetaAccountId={metaAccountId}
            />
          </div>
          <p className="text-sm text-slate-400">Dashboard de métricas em tempo real.</p>
        </div>
```

- [ ] **Step 3: Run the full test suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: All tests PASS, no type errors.

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, open `/dashboard/{uma conta}`, change the account in the new dropdown next to the account name.
Expected: navigates to the chosen account's detail page, keeping the same period selection in the URL.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/dashboard/\[metaAccountId\]/AccountSwitcher.tsx src/app/\(app\)/dashboard/\[metaAccountId\]/page.tsx
git commit -m "feat: seletor de conta na pagina de detalhe do dashboard"
```

---

### Task 14: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test`
Expected: All tests PASS (existing suite + every test added in Tasks 1, 2, 5, 6, 8).

- [ ] **Step 2: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Verify manually end-to-end**

Run: `npm run dev`, walk through:
1. `/dashboard` — "📊 Colunas" shows Gasto/Resultado/Custo por resultado/ROAS as normal, uncheckable entries under "Resultados e investimento", alongside every other catalog metric.
2. Uncheck ROAS, save — the ROAS column disappears from the table; re-check it, save — it reappears with the objective-filtered value.
3. Click the "Resultado" header (or any other column header) — table sorts by it, ascending/descending on repeated clicks.
4. Open an account whose ad sets share a single objective in the selected period — Resultado/Custo por resultado show real numbers matching that objective's conversions.
5. Open an account with ad sets spanning more than one objective in the period (or temporarily change the period to one where this happens) — Resultado/Custo por resultado show "—", ROAS still shows a real number (purchase-only).
6. On the account detail page, use the new account switcher dropdown to jump to a different account without going back to the overview.
7. Confirm the Relatórios feature (`/relatorios`) still works unchanged — it doesn't use any of the ad-set-objective code from this plan.

Expected: all of the above works with no console errors.

- [ ] **Step 4: Commit (only if Steps 1–3 required fixes)**

```bash
git add -A
git commit -m "fix: ajustes finais das metricas por objetivo de conjunto de anuncios"
```
