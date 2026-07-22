# Dashboard Visual de Métricas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal dashboard (`/dashboard`) where gestores see real-time Meta Ads metrics — an overview table across accounts and a per-account detail screen with KPI cards, a daily spend/result chart, a conversion funnel, and a creative ranking — with a customizable date period. Nothing here is sent to clients or automated.

**Architecture:** New Supabase table `dashboard_accounts` (independent of the existing `ad_accounts` balance-automation table) controls which accounts appear and each account's "primary result metric". `src/lib/meta-insights.ts` gains custom date-range and daily-series support. Two new routes under `src/app/(app)/dashboard/` render an overview table and a per-account detail page, both fetching live from the Graph API on every request (no cache). Charts use Recharts.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Supabase (Postgres), Meta Graph API, Recharts, Vitest.

## Global Constraints

- No caching anywhere in the dashboard — every page load / filter change fetches live from the Graph API (per approved spec).
- `dashboard_accounts` is independent from `ad_accounts` — adding/removing a dashboard account must never create/delete a balance automation, and vice versa.
- New nav item `📈 Dashboard`, positioned between `🔔 Alertas` and `📊 Relatórios`, visible to all managers (not admin-only).
- Route the detail page by `meta_account_id` (e.g. `act_123456789`), not by an internal uuid — simpler links, no extra lookups.
- Reuse `TRACKED_ACTIONS` from `src/lib/report-variables.ts` as the single source of truth for the 10 selectable "result metric" types — do not redefine them.
- Out of scope: AI analysis, sending to clients, Facebook Page metrics (same limitations as the existing Relatórios feature).
- Follow existing code style: Tailwind classes matching `src/app/EditAccountModal.tsx` / `src/app/AccountsTable.tsx`, dark slate theme, `"use client"` only on interactive components, Server Actions in `actions.ts` files guarded by a `requireAuth`/`requireAdmin` helper matching `src/app/actions.ts`.

---

### Task 1: Migration — `dashboard_accounts` table

**Files:**
- Create: `supabase/migrations/0010_dashboard_accounts.sql`

**Interfaces:**
- Produces: table `dashboard_accounts(id uuid, meta_account_id text unique, account_name text, result_metric_key text, created_at timestamptz)`, seeded from existing `ad_accounts` rows.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0010_dashboard_accounts.sql
-- Contas visíveis no dashboard visual de métricas — independente do cadastro
-- de automação de saldo em ad_accounts (uma conta pode estar em uma tabela,
-- na outra, nas duas, ou em nenhuma).

create table dashboard_accounts (
  id uuid primary key default gen_random_uuid(),
  meta_account_id text not null unique,
  account_name text not null,
  result_metric_key text not null default 'compras',
  created_at timestamptz not null default now()
);

create index idx_dashboard_accounts_meta_account on dashboard_accounts(meta_account_id);

-- Seed: começa com as mesmas contas já cadastradas em ad_accounts hoje.
insert into dashboard_accounts (meta_account_id, account_name, result_metric_key)
select meta_account_id, name, 'compras'
from ad_accounts
on conflict (meta_account_id) do nothing;
```

- [ ] **Step 2: Apply the migration**

Run: `npm run db:migrate`
Expected output includes: `Aplicando 0010_dashboard_accounts.sql...` then `Migrations aplicadas com sucesso.`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0010_dashboard_accounts.sql
git commit -m "feat: adiciona tabela dashboard_accounts"
```

---

### Task 2: `meta-insights.ts` — custom period selection

**Files:**
- Modify: `src/lib/meta-insights.ts`
- Test: `src/lib/meta-insights.test.ts`

**Interfaces:**
- Consumes: existing `ReportPeriod`, `DATE_PRESET`, `fetchInsights`, `getAccountInsights`, `getTopCreatives` in `src/lib/meta-insights.ts`.
- Produces: `export type PeriodSelection = { type: "preset"; period: ReportPeriod } | { type: "custom"; since: string; until: string }`, `export function buildPeriodParams(selection: PeriodSelection): Record<string, string>`, `getAccountInsights(adAccountId: string, selection: PeriodSelection | ReportPeriod)`, `getTopCreatives(adAccountId: string, selection: PeriodSelection | ReportPeriod, limit: number)` — both now accept either a plain `ReportPeriod` (unchanged callers in `check-reports.ts` keep working) or a `PeriodSelection` object (used by the dashboard).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/meta-insights.test.ts
import { describe, it, expect } from "vitest";
import { buildPeriodParams, type PeriodSelection } from "./meta-insights";

describe("buildPeriodParams", () => {
  it("monta date_preset para seleção do tipo preset", () => {
    const selection: PeriodSelection = { type: "preset", period: "last_7_days" };
    expect(buildPeriodParams(selection)).toEqual({ date_preset: "last_7d" });
  });

  it("monta time_range para seleção do tipo custom", () => {
    const selection: PeriodSelection = { type: "custom", since: "2026-07-01", until: "2026-07-15" };
    expect(buildPeriodParams(selection)).toEqual({
      time_range: JSON.stringify({ since: "2026-07-01", until: "2026-07-15" }),
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/meta-insights.test.ts`
Expected: FAIL — `buildPeriodParams is not exported` (module has no such member yet).

- [ ] **Step 3: Implement `PeriodSelection` and refactor `fetchInsights`/`getAccountInsights`/`getTopCreatives`**

In `src/lib/meta-insights.ts`, replace the block that currently reads:

```typescript
export type ReportPeriod = "today" | "last_7_days" | "last_30_days" | "current_month";

const DATE_PRESET: Record<ReportPeriod, string> = {
  today: "today",
  last_7_days: "last_7d",
  last_30_days: "last_30d",
  current_month: "this_month",
};
```

with:

```typescript
export type ReportPeriod = "today" | "last_7_days" | "last_30_days" | "current_month";

const DATE_PRESET: Record<ReportPeriod, string> = {
  today: "today",
  last_7_days: "last_7d",
  last_30_days: "last_30d",
  current_month: "this_month",
};

/** Seleção de período: preset fixo (usado pelos Relatórios) ou intervalo customizado (usado pelo Dashboard). */
export type PeriodSelection =
  | { type: "preset"; period: ReportPeriod }
  | { type: "custom"; since: string; until: string };

/** Monta os parâmetros de data da Graph API a partir de uma seleção de período. Função pura, sem chamada de rede. */
export function buildPeriodParams(selection: PeriodSelection): Record<string, string> {
  if (selection.type === "preset") {
    return { date_preset: DATE_PRESET[selection.period] };
  }
  return { time_range: JSON.stringify({ since: selection.since, until: selection.until }) };
}

/** Normaliza um ReportPeriod (usado pelos Relatórios) para PeriodSelection (usado internamente). */
function normalizeSelection(selection: PeriodSelection | ReportPeriod): PeriodSelection {
  if (typeof selection === "string") return { type: "preset", period: selection };
  return selection;
}
```

Then replace `fetchInsights`:

```typescript
async function fetchInsights(adAccountId: string, period: ReportPeriod, level: "account" | "ad") {
  const { token, version } = getConfig();
  const fields =
    level === "account"
      ? "spend,clicks,ctr,cpc,cpm,reach,impressions,frequency,unique_clicks,unique_ctr,actions,action_values,date_start,date_stop"
      : "spend,clicks,ctr,actions,ad_id,ad_name";

  const params: Record<string, string> = {
    fields,
    date_preset: DATE_PRESET[period],
    access_token: token,
  };
  if (level === "ad") params.level = "ad";

  return graphGetAll<RawInsightRow>(`/${adAccountId}/insights`, params);
}
```

with:

```typescript
async function fetchInsights(adAccountId: string, selection: PeriodSelection, level: "account" | "ad") {
  const fields =
    level === "account"
      ? "spend,clicks,ctr,cpc,cpm,reach,impressions,frequency,unique_clicks,unique_ctr,actions,action_values,date_start,date_stop"
      : "spend,clicks,ctr,actions,ad_id,ad_name";

  const params: Record<string, string> = {
    fields,
    ...buildPeriodParams(selection),
  };
  if (level === "ad") params.level = "ad";

  return graphGetAll<RawInsightRow>(`/${adAccountId}/insights`, params);
}
```

Then update the two call sites (function signatures gain `| ReportPeriod` and normalize before calling `fetchInsights`):

```typescript
export async function getAccountInsights(
  adAccountId: string,
  selection: PeriodSelection | ReportPeriod,
): Promise<AccountInsights> {
  const rows = await fetchInsights(adAccountId, normalizeSelection(selection), "account");
  // ...rest of the function body is unchanged...
```

```typescript
export async function getTopCreatives(
  adAccountId: string,
  selection: PeriodSelection | ReportPeriod,
  limit: number,
): Promise<CreativeInsight[]> {
  const rows = await fetchInsights(adAccountId, normalizeSelection(selection), "ad");
  // ...rest of the function body is unchanged...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/meta-insights.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Run full test suite to confirm no regressions**

Run: `npm test`
Expected: All existing tests still PASS, including `src/lib/check-reports.test.ts` (callers of `getAccountInsights`/`getTopCreatives` still pass plain `ReportPeriod` strings, unaffected by the signature widening).

- [ ] **Step 6: Commit**

```bash
git add src/lib/meta-insights.ts src/lib/meta-insights.test.ts
git commit -m "feat: suporta período customizado em meta-insights"
```

---

### Task 3: `meta-insights.ts` — daily series for the chart

**Files:**
- Modify: `src/lib/meta-insights.ts`
- Test: `src/lib/meta-insights.test.ts`

**Interfaces:**
- Consumes: `PeriodSelection`, `buildPeriodParams`, `normalizeSelection`, `RawInsightRow`, `sumActionValue` (from Task 2 / existing imports).
- Produces: `export interface DailyPoint { date: string; spend: number; result: number }`, `export function parseDailyRows(rows: RawInsightRow[], resultActionTypes: string[]): DailyPoint[]`, `export async function getAccountInsightsDaily(adAccountId: string, selection: PeriodSelection | ReportPeriod, resultActionTypes: string[]): Promise<DailyPoint[]>`.

- [ ] **Step 1: Write the failing test**

```typescript
// append to src/lib/meta-insights.test.ts
import { parseDailyRows } from "./meta-insights";

describe("parseDailyRows", () => {
  it("converte linhas cruas em pontos {date, spend, result}, ordenados por data", () => {
    const rows = [
      {
        date_start: "2026-07-02",
        spend: "50",
        actions: [{ action_type: "purchase", value: "3" }],
      },
      {
        date_start: "2026-07-01",
        spend: "30",
        actions: [{ action_type: "purchase", value: "1" }],
      },
    ];
    const result = parseDailyRows(rows, ["purchase", "omni_purchase"]);
    expect(result).toEqual([
      { date: "2026-07-01", spend: 30, result: 1 },
      { date: "2026-07-02", spend: 50, result: 3 },
    ]);
  });

  it("retorna resultado 0 quando não há ações do tipo procurado", () => {
    const rows = [{ date_start: "2026-07-01", spend: "10", actions: [] }];
    expect(parseDailyRows(rows, ["purchase"])).toEqual([{ date: "2026-07-01", spend: 10, result: 0 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/meta-insights.test.ts`
Expected: FAIL — `parseDailyRows is not exported`.

- [ ] **Step 3: Implement `DailyPoint`, `parseDailyRows`, `getAccountInsightsDaily`**

Add to the end of `src/lib/meta-insights.ts`:

```typescript
export interface DailyPoint {
  date: string;
  spend: number;
  result: number;
}

/** Converte linhas cruas da Graph API (uma por dia, via time_increment=1) em pontos {date, spend, result}. Função pura, testável sem rede. */
export function parseDailyRows(rows: RawInsightRow[], resultActionTypes: string[]): DailyPoint[] {
  return rows
    .map((row) => ({
      date: row.date_start ?? "",
      spend: Number(row.spend ?? 0),
      result: sumActionValue(row.actions, resultActionTypes),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Busca gasto e resultado (métrica de conversão escolhida) por dia, para o gráfico de evolução do dashboard. */
export async function getAccountInsightsDaily(
  adAccountId: string,
  selection: PeriodSelection | ReportPeriod,
  resultActionTypes: string[],
): Promise<DailyPoint[]> {
  const params: Record<string, string> = {
    fields: "spend,actions,date_start",
    ...buildPeriodParams(normalizeSelection(selection)),
    time_increment: "1",
  };
  const rows = await graphGetAll<RawInsightRow>(`/${adAccountId}/insights`, params);
  return parseDailyRows(rows, resultActionTypes);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/meta-insights.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/meta-insights.ts src/lib/meta-insights.test.ts
git commit -m "feat: adiciona série diária de métricas (getAccountInsightsDaily)"
```

---

### Task 4: `funnel.ts` — conversion funnel math

**Files:**
- Create: `src/lib/funnel.ts`
- Test: `src/lib/funnel.test.ts`

**Interfaces:**
- Produces: `export interface FunnelStep { label: string; value: number; percentOfFirst: number; dropFromPrevious: number | null }`, `export function computeFunnelSteps(steps: { label: string; value: number }[]): FunnelStep[]`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/funnel.test.ts
import { describe, it, expect } from "vitest";
import { computeFunnelSteps } from "./funnel";

describe("computeFunnelSteps", () => {
  it("calcula percentual do primeiro estágio e queda entre estágios consecutivos", () => {
    const result = computeFunnelSteps([
      { label: "Alcance", value: 1000 },
      { label: "Cliques", value: 400 },
      { label: "Checkout", value: 100 },
      { label: "Compra", value: 50 },
    ]);
    expect(result[0]).toEqual({ label: "Alcance", value: 1000, percentOfFirst: 100, dropFromPrevious: null });
    expect(result[1]).toEqual({ label: "Cliques", value: 400, percentOfFirst: 40, dropFromPrevious: 60 });
    expect(result[3]).toEqual({ label: "Compra", value: 50, percentOfFirst: 5, dropFromPrevious: 50 });
  });

  it("não quebra com primeiro estágio zerado (percentOfFirst vira 0, sem dividir por zero)", () => {
    const result = computeFunnelSteps([
      { label: "Alcance", value: 0 },
      { label: "Cliques", value: 0 },
    ]);
    expect(result[0].percentOfFirst).toBe(0);
    expect(result[1].percentOfFirst).toBe(0);
    expect(result[1].dropFromPrevious).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/funnel.test.ts`
Expected: FAIL — `Cannot find module './funnel'`.

- [ ] **Step 3: Implement `computeFunnelSteps`**

```typescript
// src/lib/funnel.ts
export interface FunnelStep {
  label: string;
  value: number;
  /** Percentual em relação ao primeiro estágio (100 no primeiro). */
  percentOfFirst: number;
  /** Percentual de queda em relação ao estágio anterior (null no primeiro estágio ou se o anterior for 0). */
  dropFromPrevious: number | null;
}

/** Calcula percentuais de um funil a partir de estágios em ordem decrescente esperada. Função pura. */
export function computeFunnelSteps(steps: { label: string; value: number }[]): FunnelStep[] {
  const first = steps[0]?.value ?? 0;
  return steps.map((step, i) => {
    const previous = steps[i - 1]?.value;
    const percentOfFirst = first > 0 ? (step.value / first) * 100 : 0;
    const dropFromPrevious =
      i === 0 || previous == null || previous <= 0 ? null : ((previous - step.value) / previous) * 100;
    return { label: step.label, value: step.value, percentOfFirst, dropFromPrevious };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/funnel.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/funnel.ts src/lib/funnel.test.ts
git commit -m "feat: adiciona cálculo puro de funil de conversão"
```

---

### Task 5: `period-params.ts` — URL ⇄ PeriodSelection

**Files:**
- Create: `src/lib/period-params.ts`
- Test: `src/lib/period-params.test.ts`

**Interfaces:**
- Consumes: `PeriodSelection`, `ReportPeriod` from `src/lib/meta-insights.ts` (Task 2).
- Produces: `export function parsePeriodFromSearchParams(params: URLSearchParams): PeriodSelection`, `export function periodToSearchParams(selection: PeriodSelection): URLSearchParams`, `export function searchParamsToURLSearchParams(sp: Record<string, string | string[] | undefined>): URLSearchParams`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/period-params.test.ts
import { describe, it, expect } from "vitest";
import {
  parsePeriodFromSearchParams,
  periodToSearchParams,
  searchParamsToURLSearchParams,
} from "./period-params";

describe("parsePeriodFromSearchParams", () => {
  it("lê preset válido da query string", () => {
    expect(parsePeriodFromSearchParams(new URLSearchParams("period=last_30_days"))).toEqual({
      type: "preset",
      period: "last_30_days",
    });
  });

  it("lê intervalo customizado quando since e until estão presentes", () => {
    expect(parsePeriodFromSearchParams(new URLSearchParams("since=2026-07-01&until=2026-07-15"))).toEqual({
      type: "custom",
      since: "2026-07-01",
      until: "2026-07-15",
    });
  });

  it("cai para last_7_days sem parâmetros", () => {
    expect(parsePeriodFromSearchParams(new URLSearchParams(""))).toEqual({
      type: "preset",
      period: "last_7_days",
    });
  });

  it("cai para last_7_days com preset inválido", () => {
    expect(parsePeriodFromSearchParams(new URLSearchParams("period=bogus"))).toEqual({
      type: "preset",
      period: "last_7_days",
    });
  });
});

describe("periodToSearchParams", () => {
  it("serializa preset", () => {
    expect(periodToSearchParams({ type: "preset", period: "today" }).toString()).toBe("period=today");
  });

  it("serializa intervalo customizado", () => {
    const params = periodToSearchParams({ type: "custom", since: "2026-07-01", until: "2026-07-15" });
    expect(params.get("since")).toBe("2026-07-01");
    expect(params.get("until")).toBe("2026-07-15");
  });
});

describe("searchParamsToURLSearchParams", () => {
  it("converte objeto do Next (com arrays e undefined) para URLSearchParams", () => {
    const result = searchParamsToURLSearchParams({ period: "today", tag: ["a", "b"], empty: undefined });
    expect(result.get("period")).toBe("today");
    expect(result.getAll("tag")).toEqual(["a", "b"]);
    expect(result.has("empty")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/period-params.test.ts`
Expected: FAIL — `Cannot find module './period-params'`.

- [ ] **Step 3: Implement the module**

```typescript
// src/lib/period-params.ts
import type { PeriodSelection, ReportPeriod } from "./meta-insights";

const VALID_PRESETS: ReportPeriod[] = ["today", "last_7_days", "last_30_days", "current_month"];

/** Lê a seleção de período da query string (?period=X ou ?since=YYYY-MM-DD&until=YYYY-MM-DD). Sem parâmetros válidos, cai para last_7_days. */
export function parsePeriodFromSearchParams(params: URLSearchParams): PeriodSelection {
  const since = params.get("since");
  const until = params.get("until");
  if (since && until) return { type: "custom", since, until };

  const period = params.get("period");
  if (period && (VALID_PRESETS as string[]).includes(period)) {
    return { type: "preset", period: period as ReportPeriod };
  }
  return { type: "preset", period: "last_7_days" };
}

/** Serializa uma seleção de período de volta pra query string. */
export function periodToSearchParams(selection: PeriodSelection): URLSearchParams {
  const params = new URLSearchParams();
  if (selection.type === "preset") {
    params.set("period", selection.period);
  } else {
    params.set("since", selection.since);
    params.set("until", selection.until);
  }
  return params;
}

/** Converte o objeto searchParams do Next (Record<string, string|string[]|undefined>) pra URLSearchParams. */
export function searchParamsToURLSearchParams(
  sp: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.set(key, value);
    }
  }
  return params;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/period-params.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/period-params.ts src/lib/period-params.test.ts
git commit -m "feat: adiciona conversão entre query string e PeriodSelection"
```

---

### Task 6: `dashboard-accounts.ts` and `dashboard-sort.ts` libs

**Files:**
- Create: `src/lib/dashboard-accounts.ts`
- Create: `src/lib/dashboard-sort.ts`
- Test: `src/lib/dashboard-accounts.test.ts`
- Test: `src/lib/dashboard-sort.test.ts`

**Interfaces:**
- Consumes: `getSupabaseAdmin` from `src/lib/supabase.ts`, `TRACKED_ACTIONS` from `src/lib/report-variables.ts`.
- Produces: `export interface DashboardAccount { id: string; metaAccountId: string; accountName: string; resultMetricKey: string }`, `listDashboardAccounts()`, `getDashboardAccount(metaAccountId: string)`, `addDashboardAccount(metaAccountId: string, accountName: string)`, `removeDashboardAccount(metaAccountId: string)`, `updateResultMetric(metaAccountId: string, resultMetricKey: string)`, `export interface MetaAccountOption { metaAccountId: string; name: string }`, `export interface MetaAccountWithMembership extends MetaAccountOption { inDashboard: boolean }`, `export function mergeAccountsWithMembership(metaAccounts: MetaAccountOption[], dashboardAccounts: DashboardAccount[]): MetaAccountWithMembership[]`. Also `export type OverviewSortKey = "name" | "spend" | "resultValue" | "costPerResult" | "roas"`, `export function sortOverviewRows<T extends SortableRow>(rows: T[], key: OverviewSortKey, direction: "asc" | "desc"): T[]`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/dashboard-accounts.test.ts
import { describe, it, expect } from "vitest";
import { mergeAccountsWithMembership, type DashboardAccount } from "./dashboard-accounts";

describe("mergeAccountsWithMembership", () => {
  it("marca inDashboard=true para contas já presentes, ordenando por nome", () => {
    const metaAccounts = [
      { metaAccountId: "act_2", name: "Conta B" },
      { metaAccountId: "act_1", name: "Conta A" },
    ];
    const dashboardAccounts: DashboardAccount[] = [
      { id: "uuid-1", metaAccountId: "act_1", accountName: "Conta A", resultMetricKey: "compras" },
    ];
    const result = mergeAccountsWithMembership(metaAccounts, dashboardAccounts);
    expect(result).toEqual([
      { metaAccountId: "act_1", name: "Conta A", inDashboard: true },
      { metaAccountId: "act_2", name: "Conta B", inDashboard: false },
    ]);
  });

  it("retorna todas com inDashboard=false quando nenhuma está cadastrada", () => {
    const result = mergeAccountsWithMembership([{ metaAccountId: "act_1", name: "Conta A" }], []);
    expect(result).toEqual([{ metaAccountId: "act_1", name: "Conta A", inDashboard: false }]);
  });
});
```

```typescript
// src/lib/dashboard-sort.test.ts
import { describe, it, expect } from "vitest";
import { sortOverviewRows } from "./dashboard-sort";

const rows = [
  { name: "Conta C", spend: 300, resultValue: 10, costPerResult: 30, roas: 1.5 },
  { name: "Conta A", spend: 100, resultValue: 5, costPerResult: 20, roas: null },
  { name: "Conta B", spend: 200, resultValue: 8, costPerResult: null, roas: 3 },
];

describe("sortOverviewRows", () => {
  it("ordena numericamente por gasto, decrescente", () => {
    const result = sortOverviewRows(rows, "spend", "desc");
    expect(result.map((r) => r.name)).toEqual(["Conta C", "Conta B", "Conta A"]);
  });

  it("ordena alfabeticamente por nome, crescente", () => {
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/dashboard-accounts.test.ts src/lib/dashboard-sort.test.ts`
Expected: FAIL — both modules don't exist yet.

- [ ] **Step 3: Implement `dashboard-accounts.ts`**

```typescript
// src/lib/dashboard-accounts.ts
import { getSupabaseAdmin } from "./supabase";
import { TRACKED_ACTIONS } from "./report-variables";

export interface DashboardAccount {
  id: string;
  metaAccountId: string;
  accountName: string;
  resultMetricKey: string;
}

const DEFAULT_RESULT_METRIC_KEY = "compras";

interface DashboardAccountRow {
  id: string;
  meta_account_id: string;
  account_name: string;
  result_metric_key: string;
}

function mapRow(r: DashboardAccountRow): DashboardAccount {
  return {
    id: r.id,
    metaAccountId: r.meta_account_id,
    accountName: r.account_name,
    resultMetricKey: r.result_metric_key,
  };
}

/** Lista as contas visíveis no dashboard, ordenadas por nome. */
export async function listDashboardAccounts(): Promise<DashboardAccount[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("dashboard_accounts")
    .select("id, meta_account_id, account_name, result_metric_key")
    .order("account_name");
  if (error) throw new Error(`Erro ao buscar contas do dashboard: ${error.message}`);
  return ((data ?? []) as DashboardAccountRow[]).map(mapRow);
}

/** Busca uma conta do dashboard pelo meta_account_id (usado pela rota de detalhe). */
export async function getDashboardAccount(metaAccountId: string): Promise<DashboardAccount | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("dashboard_accounts")
    .select("id, meta_account_id, account_name, result_metric_key")
    .eq("meta_account_id", metaAccountId)
    .single();
  if (error || !data) return null;
  return mapRow(data as DashboardAccountRow);
}

/** Adiciona uma conta ao dashboard (idempotente por meta_account_id). Independente de ad_accounts. */
export async function addDashboardAccount(metaAccountId: string, accountName: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("dashboard_accounts").upsert(
    { meta_account_id: metaAccountId, account_name: accountName, result_metric_key: DEFAULT_RESULT_METRIC_KEY },
    { onConflict: "meta_account_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`Erro ao adicionar conta ao dashboard: ${error.message}`);
}

/** Remove uma conta do dashboard. Não afeta a automação de saldo em ad_accounts. */
export async function removeDashboardAccount(metaAccountId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("dashboard_accounts").delete().eq("meta_account_id", metaAccountId);
  if (error) throw new Error(`Erro ao remover conta do dashboard: ${error.message}`);
}

/** Atualiza a métrica de resultado principal de uma conta do dashboard. */
export async function updateResultMetric(metaAccountId: string, resultMetricKey: string): Promise<void> {
  if (!TRACKED_ACTIONS.some((a) => a.key === resultMetricKey)) {
    throw new Error(`Métrica de resultado inválida: ${resultMetricKey}`);
  }
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("dashboard_accounts")
    .update({ result_metric_key: resultMetricKey })
    .eq("meta_account_id", metaAccountId);
  if (error) throw new Error(`Erro ao atualizar métrica de resultado: ${error.message}`);
}

export interface MetaAccountOption {
  metaAccountId: string;
  name: string;
}

export interface MetaAccountWithMembership extends MetaAccountOption {
  inDashboard: boolean;
}

/** Cruza a lista de contas do Meta com as já presentes no dashboard, pra marcar checkboxes no modal de gerenciamento. Função pura, testável sem rede/DB. */
export function mergeAccountsWithMembership(
  metaAccounts: MetaAccountOption[],
  dashboardAccounts: DashboardAccount[],
): MetaAccountWithMembership[] {
  const memberIds = new Set(dashboardAccounts.map((a) => a.metaAccountId));
  return metaAccounts
    .map((a) => ({ ...a, inDashboard: memberIds.has(a.metaAccountId) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

- [ ] **Step 4: Implement `dashboard-sort.ts`**

```typescript
// src/lib/dashboard-sort.ts
export type OverviewSortKey = "name" | "spend" | "resultValue" | "costPerResult" | "roas";

export interface SortableRow {
  name: string;
  spend: number;
  resultValue: number;
  costPerResult: number | null;
  roas: number | null;
}

/** Ordena linhas da visão geral por coluna. Nulls vão sempre pro fim, independente da direção. Função pura, não muta o array. */
export function sortOverviewRows<T extends SortableRow>(
  rows: T[],
  key: OverviewSortKey,
  direction: "asc" | "desc",
): T[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "string" || typeof bv === "string") {
      return factor * String(av).localeCompare(String(bv));
    }
    return factor * ((av as number) - (bv as number));
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/dashboard-accounts.test.ts src/lib/dashboard-sort.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboard-accounts.ts src/lib/dashboard-sort.ts src/lib/dashboard-accounts.test.ts src/lib/dashboard-sort.test.ts
git commit -m "feat: lib de contas do dashboard e ordenação da visão geral"
```

---

### Task 7: `dashboard/actions.ts` — Server Actions

**Files:**
- Create: `src/app/(app)/dashboard/actions.ts`

**Interfaces:**
- Consumes: `addDashboardAccount`, `removeDashboardAccount`, `updateResultMetric` from `src/lib/dashboard-accounts.ts` (Task 6); `createClient` from `@/lib/supabase/server`; `getSupabaseAdmin` from `@/lib/supabase`.
- Produces: `export async function addDashboardAccountAction(metaAccountId: string, accountName: string): Promise<void>`, `export async function removeDashboardAccountAction(metaAccountId: string): Promise<void>`, `export async function updateResultMetricAction(metaAccountId: string, resultMetricKey: string): Promise<void>`.

- [ ] **Step 1: Implement the actions**

```typescript
// src/app/(app)/dashboard/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { addDashboardAccount, removeDashboardAccount, updateResultMetric } from "@/lib/dashboard-accounts";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const admin = getSupabaseAdmin();
  const { data: manager } = await admin.from("managers").select("id").eq("auth_user_id", user.id).single();
  if (!manager) throw new Error("Seu login não está vinculado a nenhum gestor.");
}

export async function addDashboardAccountAction(metaAccountId: string, accountName: string): Promise<void> {
  await requireAuth();
  await addDashboardAccount(metaAccountId, accountName);
  revalidatePath("/dashboard");
}

export async function removeDashboardAccountAction(metaAccountId: string): Promise<void> {
  await requireAuth();
  await removeDashboardAccount(metaAccountId);
  revalidatePath("/dashboard");
}

export async function updateResultMetricAction(metaAccountId: string, resultMetricKey: string): Promise<void> {
  await requireAuth();
  await updateResultMetric(metaAccountId, resultMetricKey);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/${metaAccountId}`);
}
```

- [ ] **Step 2: Confirm the project still builds**

Run: `npm run lint`
Expected: No errors (this is a plain Server Action module, no new type errors).

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/dashboard/actions.ts
git commit -m "feat: server actions de gerenciamento de contas do dashboard"
```

---

### Task 8: Visão Geral — nav item, page, overview table

**Files:**
- Modify: `src/app/AppShell.tsx:17-23`
- Create: `src/app/(app)/dashboard/page.tsx`
- Create: `src/app/(app)/dashboard/DashboardOverviewTable.tsx`

**Interfaces:**
- Consumes: `listDashboardAccounts` (Task 6), `getAccountInsights` (Task 2), `TRACKED_ACTIONS`, `parsePeriodFromSearchParams`/`searchParamsToURLSearchParams` (Task 5), `sortOverviewRows`/`OverviewSortKey` (Task 6).
- Produces: `export interface OverviewRow { id: string; metaAccountId: string; name: string; spend: number; resultLabel: string; resultValue: number; costPerResult: number | null; roas: number | null; error: string | null }` from `DashboardOverviewTable.tsx`, consumed by Task 9/10.

- [ ] **Step 1: Add the nav item**

In `src/app/AppShell.tsx`, replace:

```typescript
const NAV: NavItem[] = [
  { href: "/", label: "Alertas", icon: "🔔" },
  { href: "/relatorios", label: "Relatórios", icon: "📊" },
  { href: "/templates", label: "Templates", icon: "💬" },
  { href: "/settings", label: "Configurações", icon: "⚙️", adminOnly: true },
  { href: "/usuarios", label: "Usuários", icon: "👥", adminOnly: true },
];
```

with:

```typescript
const NAV: NavItem[] = [
  { href: "/", label: "Alertas", icon: "🔔" },
  { href: "/dashboard", label: "Dashboard", icon: "📈" },
  { href: "/relatorios", label: "Relatórios", icon: "📊" },
  { href: "/templates", label: "Templates", icon: "💬" },
  { href: "/settings", label: "Configurações", icon: "⚙️", adminOnly: true },
  { href: "/usuarios", label: "Usuários", icon: "👥", adminOnly: true },
];
```

- [ ] **Step 2: Implement `DashboardOverviewTable.tsx`**

```tsx
// src/app/(app)/dashboard/DashboardOverviewTable.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { sortOverviewRows, type OverviewSortKey } from "@/lib/dashboard-sort";

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

const currencyFmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const COLUMNS: { key: OverviewSortKey; label: string }[] = [
  { key: "name", label: "Conta" },
  { key: "spend", label: "Gasto" },
  { key: "resultValue", label: "Resultado" },
  { key: "costPerResult", label: "Custo por resultado" },
  { key: "roas", label: "ROAS" },
];

export default function DashboardOverviewTable({ rows }: { rows: OverviewRow[] }) {
  const [sortKey, setSortKey] = useState<OverviewSortKey>("spend");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => sortOverviewRows(rows, sortKey, direction), [rows, sortKey, direction]);

  function toggleSort(key: OverviewSortKey) {
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
      <tbody>
        {sorted.map((row) => (
          <tr key={row.id} className="border-t border-slate-800 hover:bg-slate-900/60">
            <td className="px-4 py-2">
              <Link href={`/dashboard/${row.metaAccountId}`} className="text-sky-400 hover:underline">
                {row.name}
              </Link>
            </td>
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
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: Implement `dashboard/page.tsx`**

```tsx
// src/app/(app)/dashboard/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listDashboardAccounts } from "@/lib/dashboard-accounts";
import { getAccountInsights, type PeriodSelection } from "@/lib/meta-insights";
import { TRACKED_ACTIONS } from "@/lib/report-variables";
import { parsePeriodFromSearchParams, searchParamsToURLSearchParams } from "@/lib/period-params";
import DashboardOverviewTable, { type OverviewRow } from "./DashboardOverviewTable";

const BATCH_SIZE = 10;

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

  return (
    <main className="mx-auto max-w-[1600px] p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-400">Métricas em tempo real das contas Meta Ads.</p>
        </div>
      </header>
      <DashboardOverviewTable rows={rows} />
    </main>
  );
}
```

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, log in, open `/dashboard`.
Expected: page loads without errors; if `dashboard_accounts` was seeded in Task 1, a table with the 35 accounts appears sorted by spend (last 7 days, the default). No period selector or manage-accounts button yet — those come in Tasks 9–10.

- [ ] **Step 5: Commit**

```bash
git add src/app/AppShell.tsx src/app/\(app\)/dashboard/page.tsx src/app/\(app\)/dashboard/DashboardOverviewTable.tsx
git commit -m "feat: tela de visão geral do dashboard"
```

---

### Task 9: Period selector, wired into the overview page

**Files:**
- Create: `src/app/(app)/dashboard/PeriodSelector.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `PeriodSelection`, `ReportPeriod` (Task 2), `periodToSearchParams` (Task 5).
- Produces: `<PeriodSelector selection={selection} />` client component, reusable by the detail page (Task 11).

- [ ] **Step 1: Implement `PeriodSelector.tsx`**

```tsx
// src/app/(app)/dashboard/PeriodSelector.tsx
"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PeriodSelection, ReportPeriod } from "@/lib/meta-insights";
import { periodToSearchParams } from "@/lib/period-params";

const PRESETS: { key: ReportPeriod; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "last_7_days", label: "7 dias" },
  { key: "last_30_days", label: "30 dias" },
  { key: "current_month", label: "Mês atual" },
];

export default function PeriodSelector({ selection }: { selection: PeriodSelection }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [customSince, setCustomSince] = useState(selection.type === "custom" ? selection.since : "");
  const [customUntil, setCustomUntil] = useState(selection.type === "custom" ? selection.until : "");

  function apply(next: PeriodSelection) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("period");
    params.delete("since");
    params.delete("until");
    for (const [key, value] of periodToSearchParams(next).entries()) {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => apply({ type: "preset", period: p.key })}
          className={`rounded px-2.5 py-1 text-xs ${
            selection.type === "preset" && selection.period === p.key
              ? "bg-sky-600 text-white"
              : "border border-slate-700 text-slate-300 hover:bg-slate-800"
          }`}
        >
          {p.label}
        </button>
      ))}
      <input
        type="date"
        value={customSince}
        onChange={(e) => setCustomSince(e.target.value)}
        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
      />
      <span className="text-xs text-slate-500">até</span>
      <input
        type="date"
        value={customUntil}
        onChange={(e) => setCustomUntil(e.target.value)}
        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
      />
      <button
        type="button"
        disabled={!customSince || !customUntil}
        onClick={() => apply({ type: "custom", since: customSince, until: customUntil })}
        className="rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
      >
        Aplicar
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `dashboard/page.tsx`**

In `src/app/(app)/dashboard/page.tsx`, add the import:

```typescript
import PeriodSelector from "./PeriodSelector";
```

and replace the `<header>` block:

```tsx
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-400">Métricas em tempo real das contas Meta Ads.</p>
        </div>
      </header>
```

with:

```tsx
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-400">Métricas em tempo real das contas Meta Ads.</p>
        </div>
        <PeriodSelector selection={selection} />
      </header>
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, open `/dashboard`, click "30 dias".
Expected: URL updates to `?period=last_30_days`, table re-fetches and updates numbers. Pick two dates and click "Aplicar": URL updates to `?since=...&until=...`, table updates accordingly.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/dashboard/PeriodSelector.tsx src/app/\(app\)/dashboard/page.tsx
git commit -m "feat: seletor de período no dashboard"
```

---

### Task 10: Manage dashboard accounts (add/remove)

**Files:**
- Create: `src/app/(app)/dashboard/ManageAccountsButton.tsx`
- Create: `src/app/(app)/dashboard/ManageAccountsSection.tsx`
- Create: `src/app/(app)/dashboard/ManageAccountsForm.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `listBusinessAdAccountsCached` from `@/lib/meta`, `listDashboardAccounts`/`mergeAccountsWithMembership`/`MetaAccountWithMembership` from `@/lib/dashboard-accounts` (Task 6), `addDashboardAccountAction`/`removeDashboardAccountAction` from `./actions` (Task 7), `Modal` from `@/app/Modal`.

- [ ] **Step 1: Implement `ManageAccountsButton.tsx`**

```tsx
// src/app/(app)/dashboard/ManageAccountsButton.tsx
"use client";

import { useState } from "react";
import Modal from "@/app/Modal";

export default function ManageAccountsButton({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
      >
        ⚙️ Gerenciar contas
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Gerenciar contas do dashboard">
        {children}
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: Implement `ManageAccountsForm.tsx`**

```tsx
// src/app/(app)/dashboard/ManageAccountsForm.tsx
"use client";

import { useTransition } from "react";
import { addDashboardAccountAction, removeDashboardAccountAction } from "./actions";
import type { MetaAccountWithMembership } from "@/lib/dashboard-accounts";

export default function ManageAccountsForm({ accounts }: { accounts: MetaAccountWithMembership[] }) {
  const [isPending, startTransition] = useTransition();

  function toggle(account: MetaAccountWithMembership) {
    startTransition(async () => {
      if (account.inDashboard) {
        await removeDashboardAccountAction(account.metaAccountId);
      } else {
        await addDashboardAccountAction(account.metaAccountId, account.name);
      }
    });
  }

  return (
    <div className="max-h-96 space-y-1 overflow-y-auto">
      {accounts.map((a) => (
        <label
          key={a.metaAccountId}
          className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
        >
          <input
            type="checkbox"
            checked={a.inDashboard}
            disabled={isPending}
            onChange={() => toggle(a)}
            className="h-4 w-4 accent-emerald-500"
          />
          {a.name}
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Implement `ManageAccountsSection.tsx`**

```tsx
// src/app/(app)/dashboard/ManageAccountsSection.tsx
import { listBusinessAdAccountsCached } from "@/lib/meta";
import { listDashboardAccounts, mergeAccountsWithMembership } from "@/lib/dashboard-accounts";
import ManageAccountsForm from "./ManageAccountsForm";

export default async function ManageAccountsSection() {
  const dashboardAccounts = await listDashboardAccounts();

  try {
    const metaAccounts = await listBusinessAdAccountsCached();
    const merged = mergeAccountsWithMembership(
      metaAccounts.map((a) => ({ metaAccountId: a.id, name: a.name })),
      dashboardAccounts,
    );
    return <ManageAccountsForm accounts={merged} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar contas do Meta.";
    return <p className="rounded bg-red-950 px-3 py-2 text-sm text-red-300">{message}</p>;
  }
}
```

- [ ] **Step 4: Wire into `dashboard/page.tsx`**

In `src/app/(app)/dashboard/page.tsx`, add the imports:

```typescript
import { Suspense } from "react";
import ManageAccountsButton from "./ManageAccountsButton";
import ManageAccountsSection from "./ManageAccountsSection";
```

and replace the header again:

```tsx
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-400">Métricas em tempo real das contas Meta Ads.</p>
        </div>
        <PeriodSelector selection={selection} />
      </header>
```

with:

```tsx
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-400">Métricas em tempo real das contas Meta Ads.</p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector selection={selection} />
          <ManageAccountsButton>
            <Suspense fallback={<p className="text-sm text-slate-500">Carregando contas…</p>}>
              <ManageAccountsSection />
            </Suspense>
          </ManageAccountsButton>
        </div>
      </header>
```

- [ ] **Step 5: Verify manually**

Run: `npm run dev`, open `/dashboard`, click "⚙️ Gerenciar contas".
Expected: modal opens showing all Meta accounts (may take ~15s on cold cache) with the 35 seeded ones checked. Uncheck one → it disappears from the overview table after closing the modal (page revalidates). Check a previously-unchecked one → it appears in the overview table. Confirm `ad_accounts` (Configurações → balance automations) is unaffected by either action.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/dashboard/ManageAccountsButton.tsx src/app/\(app\)/dashboard/ManageAccountsSection.tsx src/app/\(app\)/dashboard/ManageAccountsForm.tsx src/app/\(app\)/dashboard/page.tsx
git commit -m "feat: gerenciar contas visíveis no dashboard"
```

---

### Task 11: Account detail page — KPI cards and result metric selector

**Files:**
- Create: `src/app/(app)/dashboard/[metaAccountId]/page.tsx`
- Create: `src/app/(app)/dashboard/[metaAccountId]/KpiCards.tsx`
- Create: `src/app/(app)/dashboard/[metaAccountId]/ResultMetricSelector.tsx`

**Interfaces:**
- Consumes: `getDashboardAccount` (Task 6), `getAccountInsights` (Task 2), `TRACKED_ACTIONS`, `parsePeriodFromSearchParams`/`searchParamsToURLSearchParams` (Task 5), `PeriodSelector` (Task 9), `updateResultMetricAction` (Task 7).

- [ ] **Step 1: Implement `KpiCards.tsx`**

```tsx
// src/app/(app)/dashboard/[metaAccountId]/KpiCards.tsx
const currencyFmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-400">{c.label}</p>
          <p className="mt-1 text-lg font-semibold text-slate-100">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Implement `ResultMetricSelector.tsx`**

```tsx
// src/app/(app)/dashboard/[metaAccountId]/ResultMetricSelector.tsx
"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { updateResultMetricAction } from "../actions";
import { TRACKED_ACTIONS } from "@/lib/report-variables";

export default function ResultMetricSelector({
  metaAccountId,
  selectedKey,
}: {
  metaAccountId: string;
  selectedKey: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function changeMetric(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("metric", key);
    router.push(`${pathname}?${params.toString()}`);
  }

  function saveAsDefault() {
    startTransition(() => updateResultMetricAction(metaAccountId, selectedKey));
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-400">Resultado:</label>
      <select
        value={selectedKey}
        onChange={(e) => changeMetric(e.target.value)}
        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
      >
        {TRACKED_ACTIONS.map((a) => (
          <option key={a.key} value={a.key}>
            {a.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={saveAsDefault}
        disabled={isPending}
        title="Salvar esta métrica como padrão desta conta"
        className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
      >
        {isPending ? "Salvando…" : "Definir como padrão"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Implement `[metaAccountId]/page.tsx`**

```tsx
// src/app/(app)/dashboard/[metaAccountId]/page.tsx
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardAccount } from "@/lib/dashboard-accounts";
import { getAccountInsights, type PeriodSelection } from "@/lib/meta-insights";
import { TRACKED_ACTIONS } from "@/lib/report-variables";
import { parsePeriodFromSearchParams, searchParamsToURLSearchParams } from "@/lib/period-params";
import PeriodSelector from "../PeriodSelector";
import ResultMetricSelector from "./ResultMetricSelector";
import KpiCards from "./KpiCards";

export default async function DashboardAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ metaAccountId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { metaAccountId } = await params;
  const account = await getDashboardAccount(metaAccountId);
  if (!account) notFound();

  const sp = await searchParams;
  const urlParams = searchParamsToURLSearchParams(sp);
  const selection: PeriodSelection = parsePeriodFromSearchParams(urlParams);
  const resultMetricKeyParam = urlParams.get("metric");
  const resultMetric =
    TRACKED_ACTIONS.find((a) => a.key === resultMetricKeyParam) ??
    TRACKED_ACTIONS.find((a) => a.key === account.resultMetricKey) ??
    TRACKED_ACTIONS[0];

  const insights = await getAccountInsights(metaAccountId, selection);
  const resultValue = insights.detailedActions[resultMetric.key] ?? 0;
  const costPerResult = resultValue > 0 ? insights.spend / resultValue : null;

  return (
    <main className="mx-auto max-w-[1600px] p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{account.accountName}</h1>
          <p className="text-sm text-slate-400">Dashboard de métricas em tempo real.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ResultMetricSelector metaAccountId={metaAccountId} selectedKey={resultMetric.key} />
          <PeriodSelector selection={selection} />
        </div>
      </header>

      <KpiCards
        spend={insights.spend}
        resultLabel={resultMetric.label}
        resultValue={resultValue}
        costPerResult={costPerResult}
        roas={insights.roas}
      />
    </main>
  );
}
```

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, open `/dashboard`, click into any account.
Expected: detail page loads with 4 KPI cards, the result-metric dropdown and period selector both work (URL updates, numbers refresh). Clicking "Definir como padrão" persists the choice — reload the overview table and confirm that account's "Resultado" column now uses the newly chosen metric.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/dashboard/\[metaAccountId\]/page.tsx src/app/\(app\)/dashboard/\[metaAccountId\]/KpiCards.tsx src/app/\(app\)/dashboard/\[metaAccountId\]/ResultMetricSelector.tsx
git commit -m "feat: pagina de detalhe do dashboard com KPIs e seletor de metrica"
```

---

### Task 12: Daily spend/result chart

**Files:**
- Modify: `package.json` (add `recharts` dependency)
- Create: `src/app/(app)/dashboard/[metaAccountId]/SpendResultChart.tsx`
- Modify: `src/app/(app)/dashboard/[metaAccountId]/page.tsx`

**Interfaces:**
- Consumes: `getAccountInsightsDaily`, `DailyPoint` (Task 3).

- [ ] **Step 1: Install Recharts**

Run: `npm install recharts`
Expected: `package.json` gains a `"recharts": "^2.x.x"` dependency; `package-lock.json` updated.

- [ ] **Step 2: Implement `SpendResultChart.tsx`**

```tsx
// src/app/(app)/dashboard/[metaAccountId]/SpendResultChart.tsx
"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyPoint } from "@/lib/meta-insights";

export default function SpendResultChart({ daily, resultLabel }: { daily: DailyPoint[]; resultLabel: string }) {
  if (daily.length === 0) {
    return (
      <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
        Sem dados no período.
      </div>
    );
  }

  const data = daily.map((d) => ({ date: d.date.slice(5), spend: d.spend, result: d.result }));

  return (
    <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-200">Gasto e {resultLabel} por dia</h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
          <YAxis yAxisId="spend" stroke="#38bdf8" fontSize={12} />
          <YAxis yAxisId="result" orientation="right" stroke="#34d399" fontSize={12} />
          <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
          <Legend />
          <Line
            yAxisId="spend"
            type="monotone"
            dataKey="spend"
            name="Gasto (R$)"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="result"
            type="monotone"
            dataKey="result"
            name={resultLabel}
            stroke="#34d399"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Wire into `[metaAccountId]/page.tsx`**

Add the import:

```typescript
import { getAccountInsights, getAccountInsightsDaily, type PeriodSelection } from "@/lib/meta-insights";
import SpendResultChart from "./SpendResultChart";
```

(replacing the existing single-name import of `getAccountInsights`/`PeriodSelection`).

Replace:

```typescript
  const insights = await getAccountInsights(metaAccountId, selection);
  const resultValue = insights.detailedActions[resultMetric.key] ?? 0;
  const costPerResult = resultValue > 0 ? insights.spend / resultValue : null;
```

with:

```typescript
  const [insights, daily] = await Promise.all([
    getAccountInsights(metaAccountId, selection),
    getAccountInsightsDaily(metaAccountId, selection, resultMetric.actionTypes),
  ]);
  const resultValue = insights.detailedActions[resultMetric.key] ?? 0;
  const costPerResult = resultValue > 0 ? insights.spend / resultValue : null;
```

and add the chart right after `<KpiCards ... />`:

```tsx
      <KpiCards
        spend={insights.spend}
        resultLabel={resultMetric.label}
        resultValue={resultValue}
        costPerResult={costPerResult}
        roas={insights.roas}
      />

      <SpendResultChart daily={daily} resultLabel={resultMetric.label} />
```

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, open a dashboard account detail page.
Expected: a line chart renders below the KPI cards with two lines (gasto/resultado) across the selected period; switching period or result metric updates the chart.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/app/\(app\)/dashboard/\[metaAccountId\]/SpendResultChart.tsx src/app/\(app\)/dashboard/\[metaAccountId\]/page.tsx
git commit -m "feat: grafico de gasto e resultado por dia"
```

---

### Task 13: Conversion funnel

**Files:**
- Create: `src/app/(app)/dashboard/[metaAccountId]/ConversionFunnel.tsx`
- Modify: `src/app/(app)/dashboard/[metaAccountId]/page.tsx`

**Interfaces:**
- Consumes: `computeFunnelSteps` (Task 4).

- [ ] **Step 1: Implement `ConversionFunnel.tsx`**

```tsx
// src/app/(app)/dashboard/[metaAccountId]/ConversionFunnel.tsx
import { computeFunnelSteps } from "@/lib/funnel";

export default function ConversionFunnel({
  reach,
  linkClicks,
  checkouts,
  resultLabel,
  resultValue,
}: {
  reach: number;
  linkClicks: number;
  checkouts: number;
  resultLabel: string;
  resultValue: number;
}) {
  const steps = computeFunnelSteps([
    { label: "Alcance", value: reach },
    { label: "Cliques no link", value: linkClicks },
    { label: "Checkout iniciado", value: checkouts },
    { label: resultLabel, value: resultValue },
  ]);

  return (
    <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-200">Funil de conversão</h2>
      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.label}>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{step.label}</span>
              <span>
                {step.value.toLocaleString("pt-BR")}
                {step.dropFromPrevious != null && (
                  <span className="ml-2 text-red-400">-{step.dropFromPrevious.toFixed(1)}%</span>
                )}
              </span>
            </div>
            <div className="mt-1 h-3 w-full rounded bg-slate-800">
              <div className="h-3 rounded bg-sky-600" style={{ width: `${Math.max(step.percentOfFirst, 2)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `[metaAccountId]/page.tsx`**

Add the import:

```typescript
import ConversionFunnel from "./ConversionFunnel";
```

Right after the `TRACKED_ACTIONS` import block, add two more lookups (both keys are known to exist in `TRACKED_ACTIONS`, see `src/lib/report-variables.ts:66-71` and `:35-40`):

```typescript
const CHECKOUT_METRIC = TRACKED_ACTIONS.find((a) => a.key === "checkout_iniciado")!;
const LINK_CLICKS_METRIC = TRACKED_ACTIONS.find((a) => a.key === "cliques_link")!;
```

(placed at module scope, right below the imports, before the `export default async function` line).

Then add the funnel right after `<SpendResultChart ... />`:

```tsx
      <SpendResultChart daily={daily} resultLabel={resultMetric.label} />

      <ConversionFunnel
        reach={insights.reach}
        linkClicks={insights.detailedActions[LINK_CLICKS_METRIC.key] ?? 0}
        checkouts={insights.detailedActions[CHECKOUT_METRIC.key] ?? 0}
        resultLabel={resultMetric.label}
        resultValue={resultValue}
      />
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, open a dashboard account detail page.
Expected: a 4-stage funnel (Alcance → Cliques no link → Checkout iniciado → [métrica escolhida]) renders below the chart, with bar widths proportional to `percentOfFirst` and a red "-X%" drop label on stages after the first.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/dashboard/\[metaAccountId\]/ConversionFunnel.tsx src/app/\(app\)/dashboard/\[metaAccountId\]/page.tsx
git commit -m "feat: funil de conversao no dashboard"
```

---

### Task 14: Creative ranking and final verification

**Files:**
- Create: `src/app/(app)/dashboard/[metaAccountId]/CreativeRankingSection.tsx`
- Modify: `src/app/(app)/dashboard/[metaAccountId]/page.tsx`

**Interfaces:**
- Consumes: `getTopCreatives` (Task 2, already existing function, now accepts `PeriodSelection`).

- [ ] **Step 1: Implement `CreativeRankingSection.tsx`**

```tsx
// src/app/(app)/dashboard/[metaAccountId]/CreativeRankingSection.tsx
import { getTopCreatives, type PeriodSelection } from "@/lib/meta-insights";

export default async function CreativeRankingSection({
  metaAccountId,
  selection,
  resultLabel,
}: {
  metaAccountId: string;
  selection: PeriodSelection;
  resultLabel: string;
}) {
  try {
    const creatives = await getTopCreatives(metaAccountId, selection, 5);

    if (creatives.length === 0) {
      return <p className="text-sm text-slate-400">Sem criativos com resultado no período.</p>;
    }

    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Ranking de criativos</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {creatives.map((c, i) => (
            <div key={c.adId} className="rounded border border-slate-800 p-3 text-sm">
              <p className="text-xs text-slate-500">#{i + 1}</p>
              <p className="truncate font-medium text-slate-100">{c.adName}</p>
              <p className="mt-1 text-xs text-slate-400">
                {resultLabel}: {c.conversions} · CPA:{" "}
                {c.cpa != null ? c.cpa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
              </p>
              {c.permalink && (
                <a
                  href={c.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-xs text-sky-400 hover:underline"
                >
                  Ver post ↗
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar ranking de criativos.";
    return <p className="text-xs text-red-400">Ranking de criativos indisponível: {message}</p>;
  }
}
```

- [ ] **Step 2: Wire into `[metaAccountId]/page.tsx`**

Add the imports:

```typescript
import { Suspense } from "react";
import CreativeRankingSection from "./CreativeRankingSection";
```

Add right after `<ConversionFunnel ... />`, closing the `</main>`:

```tsx
      <ConversionFunnel
        reach={insights.reach}
        linkClicks={insights.detailedActions[LINK_CLICKS_METRIC.key] ?? 0}
        checkouts={insights.detailedActions[CHECKOUT_METRIC.key] ?? 0}
        resultLabel={resultMetric.label}
        resultValue={resultValue}
      />

      <Suspense fallback={<p className="text-sm text-slate-500">Carregando ranking de criativos…</p>}>
        <CreativeRankingSection metaAccountId={metaAccountId} selection={selection} resultLabel={resultMetric.label} />
      </Suspense>
```

- [ ] **Step 3: Verify manually end-to-end**

Run: `npm run dev`, walk through the full flow:
1. `/dashboard` shows the overview table, sortable by every column.
2. "⚙️ Gerenciar contas" adds/removes an account without touching `ad_accounts`.
3. Clicking an account opens `/dashboard/act_XXXXXXXXX` with KPI cards, chart, funnel, and creative ranking (with post links) all reflecting the selected period and result metric.
4. Changing the period on either screen re-fetches live (no stale cached numbers — confirm via the Network tab that a fresh request fires each time).
5. Confirm nothing in this feature sends anything to WhatsApp or touches `metric_reports`/`report_log`.

Expected: all of the above works with no console errors.

- [ ] **Step 4: Run the full automated test suite and linter**

Run: `npm test && npm run lint`
Expected: All tests PASS (existing + all tests added in Tasks 2–6), lint reports no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/dashboard/\[metaAccountId\]/CreativeRankingSection.tsx src/app/\(app\)/dashboard/\[metaAccountId\]/page.tsx
git commit -m "feat: ranking de criativos no dashboard"
```
