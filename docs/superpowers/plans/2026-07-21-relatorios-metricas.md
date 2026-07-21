# Relatórios de Métricas de Campanha — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ao Meta Payments uma nova funcionalidade de "Relatórios" — envio agendado de métricas de campanha (investimento, cliques, conversões, ROAS, ticket médio e ranking de criativos) por WhatsApp, para contas Meta já cadastradas, separada da funcionalidade existente de alerta de saldo (renomeada para "Alertas").

**Architecture:** Segue exatamente os padrões já existentes no repo: Server Actions com `FormData` (`src/app/actions.ts`), busca de dados em Server Components + formulário em Client Component, lib puro-função + wrapper de API (`src/lib/meta.ts`), cron diário estendido (`src/app/api/cron/check-balances/route.ts`), envio via `sendWhatsAppMessage` (`src/lib/zapi.ts`). Só funções puras testáveis ganham teste unitário (vitest), igual ao padrão já usado em `zapi.test.ts`/`account-status.test.ts` — orquestradores que tocam Supabase/API externa (`checkAllBalances`, `sendScheduledReports`) não têm teste unitário no repo hoje, e este plano segue a mesma convenção.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres + `@supabase/supabase-js`), Meta Graph API (`fetch` nativo), Z-API (WhatsApp), Vitest, Tailwind.

## Global Constraints

- Toda a interface e mensagens de commit em português, no mesmo tom já usado no resto do app.
- Server actions exigem `requireAuth()` (login de qualquer papel) para criar/editar/enviar relatórios — mesmo padrão de `forceSendAlertAction`/`createAccount` em `src/app/actions.ts`. Nenhuma ação nova exige `requireAdmin()` neste escopo.
- Sem dependências novas no `package.json` — tudo com `fetch` nativo e as libs já instaladas.
- Migrations numeradas sequencialmente em `supabase/migrations/`; a última hoje é `0007_whatsapp_group_name.sql` → a nova é `0008_metric_reports.sql`.
- Fora de escopo (não implementar): canal Google Ads, Análise por IA, múltiplos blocos por relatório, miniatura de imagem do criativo (ver spec).

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/0008_metric_reports.sql` | Tabelas `metric_reports` e `report_log` |
| `src/lib/report-metrics.ts` (novo) | Funções puras: extrair valor de ação, ROAS, ticket médio, ranking de criativos, formatação do bloco de texto do ranking |
| `src/lib/report-metrics.test.ts` (novo) | Testes das funções acima |
| `src/lib/meta.ts` (modificar) | Exportar `graphGetAll` e `getConfig` para reuso em `meta-insights.ts` |
| `src/lib/meta-insights.ts` (novo) | `getAccountInsights()` e `getTopCreatives()` — chamadas reais à Graph API `/insights` |
| `src/lib/report-schedule.ts` (novo) | `computeNextSendAt()` — pura, calcula o próximo envio conforme frequência |
| `src/lib/report-schedule.test.ts` (novo) | Testes de `computeNextSendAt` |
| `src/lib/check-reports.ts` (novo) | `renderReportMessage()` (pura, testada), `sendScheduledReports()`, `forceSendReport()` — espelha `check-balances.ts` |
| `src/lib/check-reports.test.ts` (novo) | Teste de `renderReportMessage` |
| `src/app/api/cron/check-balances/route.ts` (modificar) | Chama também `sendScheduledReports()` |
| `src/app/actions.ts` (modificar) | Novas server actions: `createMetricReport`, `updateMetricReport`, `deleteMetricReport`, `setMetricReportActive`, `forceSendReportAction` |
| `src/app/AppShell.tsx` (modificar) | Renomeia item de nav `/` para "Alertas"; adiciona item `/relatorios` → "Relatórios" |
| `src/app/(app)/relatorios/page.tsx` (novo) | Lista de relatórios cadastrados (Server Component) |
| `src/app/MetricReportsTable.tsx` (novo) | Tabela client-side com ações (liga/desliga, editar, excluir, enviar agora) |
| `src/app/(app)/relatorios/NewMetricReportSection.tsx` (novo) | Server Component: busca contas Meta cadastradas + grupos WhatsApp |
| `src/app/(app)/relatorios/NewMetricReportForm.tsx` (novo) | Client Component: formulário de criação |
| `src/app/(app)/relatorios/EditMetricReportModal.tsx` (novo) | Client Component: formulário de edição (mesmos campos, dados pré-preenchidos) |

---

### Task 1: Migração do banco — tabelas `metric_reports` e `report_log`

**Files:**
- Create: `supabase/migrations/0008_metric_reports.sql`

**Interfaces:**
- Produces: tabelas `metric_reports` (colunas: `id`, `ad_account_id`, `name`, `whatsapp_group_id`, `whatsapp_group_name`, `frequency`, `send_hour`, `period`, `message_template`, `creative_ranking_size`, `is_active`, `next_send_at`, `created_at`, `updated_at`) e `report_log` (`id`, `metric_report_id`, `message`, `whatsapp_message_id`, `sent_at`).

- [ ] **Step 1: Escrever a migração**

```sql
-- supabase/migrations/0008_metric_reports.sql
-- Relatórios de métricas de campanha (separado do alerta de saldo em ad_accounts).

create table metric_reports (
  id uuid primary key default gen_random_uuid(),
  ad_account_id uuid not null references ad_accounts(id) on delete cascade,
  name text not null,
  whatsapp_group_id text not null,
  whatsapp_group_name text,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  send_hour smallint not null default 9,
  period text not null default 'last_7_days'
    check (period in ('today', 'last_7_days', 'last_30_days', 'current_month')),
  message_template text not null,
  creative_ranking_size smallint,
  is_active boolean not null default true,
  next_send_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_metric_reports_account on metric_reports(ad_account_id);
create index idx_metric_reports_next_send on metric_reports(next_send_at) where is_active;

create trigger trg_metric_reports_updated_at
  before update on metric_reports
  for each row execute function set_updated_at();

create table report_log (
  id uuid primary key default gen_random_uuid(),
  metric_report_id uuid not null references metric_reports(id) on delete cascade,
  message text not null,
  whatsapp_message_id text,
  sent_at timestamptz not null default now()
);

create index idx_report_log_report_time on report_log(metric_report_id, sent_at desc);
```

- [ ] **Step 2: Rodar a migração**

Run: `npm run db:migrate`
Expected: saída sem erro, log mencionando `0008_metric_reports.sql` aplicada.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_metric_reports.sql
git commit -m "feat: cria tabelas metric_reports e report_log"
```

---

### Task 2: `src/lib/report-metrics.ts` — funções puras de métrica e ranking

**Files:**
- Create: `src/lib/report-metrics.ts`
- Test: `src/lib/report-metrics.test.ts`

**Interfaces:**
- Produces:
  - `interface InsightAction { action_type: string; value: string }`
  - `sumActionValue(actions: InsightAction[] | undefined, types: string[]): number`
  - `computeRoas(spend: number, actionValue: number): number | null`
  - `computeTicketMedio(actionValue: number, conversions: number): number | null`
  - `interface CreativeInsight { adId: string; adName: string; permalink: string | null; conversions: number; clicks: number; ctr: number; cpa: number | null }`
  - `rankCreatives(rows: CreativeInsight[], limit: number): CreativeInsight[]`
  - `formatCreativeRankingText(ranked: CreativeInsight[], resultLabel: string): string`

- [ ] **Step 1: Escrever os testes (falhando)**

```typescript
// src/lib/report-metrics.test.ts
import { describe, it, expect } from "vitest";
import {
  sumActionValue,
  computeRoas,
  computeTicketMedio,
  rankCreatives,
  formatCreativeRankingText,
  type CreativeInsight,
} from "./report-metrics";

describe("sumActionValue", () => {
  it("soma os valores dos tipos de ação informados", () => {
    const actions = [
      { action_type: "purchase", value: "10" },
      { action_type: "purchase", value: "5" },
      { action_type: "lead", value: "100" },
    ];
    expect(sumActionValue(actions, ["purchase"])).toBe(15);
  });

  it("retorna 0 quando não há ações ou não bate nenhum tipo", () => {
    expect(sumActionValue(undefined, ["purchase"])).toBe(0);
    expect(sumActionValue([{ action_type: "lead", value: "10" }], ["purchase"])).toBe(0);
  });
});

describe("computeRoas", () => {
  it("calcula valor da conversão dividido pelo investimento", () => {
    expect(computeRoas(100, 2185)).toBeCloseTo(21.85);
  });

  it("retorna null quando o investimento é 0", () => {
    expect(computeRoas(0, 100)).toBeNull();
  });
});

describe("computeTicketMedio", () => {
  it("calcula valor da conversão dividido pela quantidade de conversões", () => {
    expect(computeTicketMedio(9176, 100)).toBeCloseTo(91.76);
  });

  it("retorna null quando não há conversões", () => {
    expect(computeTicketMedio(100, 0)).toBeNull();
  });
});

describe("rankCreatives", () => {
  const base: CreativeInsight = {
    adId: "1",
    adName: "A",
    permalink: null,
    conversions: 0,
    clicks: 0,
    ctr: 0,
    cpa: null,
  };

  it("ordena por conversões decrescente e corta no limite", () => {
    const rows: CreativeInsight[] = [
      { ...base, adId: "1", adName: "AD01", conversions: 10 },
      { ...base, adId: "2", adName: "AD02", conversions: 78 },
      { ...base, adId: "3", adName: "AD03", conversions: 17 },
    ];
    const ranked = rankCreatives(rows, 2);
    expect(ranked.map((r) => r.adId)).toEqual(["2", "3"]);
  });

  it("usa cliques como critério de desempate/fallback quando conversões são todas 0", () => {
    const rows: CreativeInsight[] = [
      { ...base, adId: "1", adName: "AD01", conversions: 0, clicks: 5 },
      { ...base, adId: "2", adName: "AD02", conversions: 0, clicks: 20 },
    ];
    const ranked = rankCreatives(rows, 2);
    expect(ranked.map((r) => r.adId)).toEqual(["2", "1"]);
  });
});

describe("formatCreativeRankingText", () => {
  it("monta o bloco de texto com medalhas, métricas e link", () => {
    const ranked: CreativeInsight[] = [
      {
        adId: "1",
        adName: "[AD03]",
        permalink: "https://www.instagram.com/p/DaqCFjmg-4t/",
        conversions: 78,
        clicks: 200,
        ctr: 0.5,
        cpa: 2.65,
      },
    ];
    const text = formatCreativeRankingText(ranked, "Resultados");
    expect(text).toContain("🏆 1. [AD03]");
    expect(text).toContain("Resultados: 78");
    expect(text).toContain("CPA: R$ 2,65");
    expect(text).toContain("CTR: 0,50 %");
    expect(text).toContain("https://www.instagram.com/p/DaqCFjmg-4t/");
  });

  it("omite a linha de link quando não há permalink", () => {
    const ranked: CreativeInsight[] = [
      { adId: "1", adName: "AD01", permalink: null, conversions: 5, clicks: 10, ctr: 1, cpa: 1 },
    ];
    const text = formatCreativeRankingText(ranked, "Resultados");
    expect(text).not.toContain("🔗");
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/lib/report-metrics.test.ts`
Expected: FAIL — `Cannot find module './report-metrics'`

- [ ] **Step 3: Implementar `src/lib/report-metrics.ts`**

```typescript
// src/lib/report-metrics.ts

export interface InsightAction {
  action_type: string;
  value: string;
}

/** Soma os valores de `actions`/`action_values` cujo tipo está em `types`. */
export function sumActionValue(actions: InsightAction[] | undefined, types: string[]): number {
  if (!actions) return 0;
  return actions
    .filter((a) => types.includes(a.action_type))
    .reduce((sum, a) => sum + Number(a.value), 0);
}

/** ROAS: valor gerado pelas conversões dividido pelo investimento. */
export function computeRoas(spend: number, actionValue: number): number | null {
  if (spend <= 0) return null;
  return actionValue / spend;
}

/** Ticket médio: valor gerado pelas conversões dividido pela quantidade delas. */
export function computeTicketMedio(actionValue: number, conversions: number): number | null {
  if (conversions <= 0) return null;
  return actionValue / conversions;
}

export interface CreativeInsight {
  adId: string;
  adName: string;
  permalink: string | null;
  conversions: number;
  clicks: number;
  ctr: number;
  cpa: number | null;
}

/**
 * Ordena os criativos pelo número de conversões (desempate/fallback por
 * cliques, para campanhas sem otimização de conversão) e retorna os top N.
 */
export function rankCreatives(rows: CreativeInsight[], limit: number): CreativeInsight[] {
  return [...rows]
    .sort((a, b) => {
      if (b.conversions !== a.conversions) return b.conversions - a.conversions;
      return b.clicks - a.clicks;
    })
    .slice(0, limit);
}

const MEDALS = ["🏆", "🥈", "🥉"];

function medalFor(position: number): string {
  return MEDALS[position] ?? `${position + 1}º`;
}

const currencyFmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const percentFmt = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

/** Monta o bloco de texto do ranking de criativos, pronto para entrar na mensagem do WhatsApp. */
export function formatCreativeRankingText(ranked: CreativeInsight[], resultLabel: string): string {
  return ranked
    .map((r, i) => {
      const lines = [
        `${medalFor(i)} ${i + 1}. ${r.adName}`,
        `${resultLabel}: ${r.conversions} | CPA: ${r.cpa != null ? currencyFmt(r.cpa) : "—"} | CTR: ${percentFmt(r.ctr)}`,
      ];
      if (r.permalink) lines.push(`🔗 ${r.permalink}`);
      return lines.join("\n");
    })
    .join("\n\n");
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/lib/report-metrics.test.ts`
Expected: PASS (todos os testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/report-metrics.ts src/lib/report-metrics.test.ts
git commit -m "feat: funcoes puras de metricas e ranking de criativos"
```

---

### Task 3: Expor `graphGetAll` e `getConfig` em `src/lib/meta.ts`

**Files:**
- Modify: `src/lib/meta.ts:60,88`

**Interfaces:**
- Consumes: nada novo (arquivo já existente).
- Produces: `export function getConfig()` e `export async function graphGetAll<T>(path, params): Promise<T[]>` — hoje privados, viram públicos para reuso em `meta-insights.ts`.

- [ ] **Step 1: Exportar as duas funções**

Em `src/lib/meta.ts`, troque as declarações:

```typescript
// Linha ~49: era "function getConfig() {"
export function getConfig() {
```

```typescript
// Linha ~88: era "async function graphGetAll<T>("
export async function graphGetAll<T>(
```

- [ ] **Step 2: Checar que o projeto ainda compila**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `meta.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/meta.ts
git commit -m "refactor: expoe getConfig e graphGetAll de meta.ts para reuso em relatorios"
```

---

### Task 4: `src/lib/meta-insights.ts` — busca de métricas e criativos na Graph API

**Files:**
- Create: `src/lib/meta-insights.ts`

**Interfaces:**
- Consumes: `getConfig`, `graphGetAll`, `MetaApiError` de `./meta`; `sumActionValue`, `computeRoas`, `computeTicketMedio`, `rankCreatives`, `type CreativeInsight` de `./report-metrics`.
- Produces:
  - `type ReportPeriod = "today" | "last_7_days" | "last_30_days" | "current_month"`
  - `interface AccountInsights { spend: number; clicks: number; ctr: number; cpc: number; reach: number; conversions: number; costPerConversion: number | null; roas: number | null; ticketMedio: number | null; resultLabel: string; dateStart: string; dateStop: string }`
  - `getAccountInsights(adAccountId: string, period: ReportPeriod): Promise<AccountInsights>`
  - `getTopCreatives(adAccountId: string, period: ReportPeriod, limit: number): Promise<CreativeInsight[]>`

- [ ] **Step 1: Implementar**

```typescript
// src/lib/meta-insights.ts
import { getConfig, graphGetAll } from "./meta";
import {
  sumActionValue,
  computeRoas,
  computeTicketMedio,
  rankCreatives,
  type CreativeInsight,
  type InsightAction,
} from "./report-metrics";

export type ReportPeriod = "today" | "last_7_days" | "last_30_days" | "current_month";

const DATE_PRESET: Record<ReportPeriod, string> = {
  today: "today",
  last_7_days: "last_7d",
  last_30_days: "last_30d",
  current_month: "this_month",
};

/**
 * Tipos de ação considerados "conversão" nesta ordem de prioridade — usa o
 * primeiro que tiver valor > 0. Cobre os objetivos mais comuns de campanha
 * (compra, lead, conversa iniciada no WhatsApp/Messenger).
 */
const CONVERSION_ACTION_TYPES: { types: string[]; label: string }[] = [
  { types: ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"], label: "Resultados" },
  { types: ["lead", "onsite_conversion.lead_grouped"], label: "Resultados" },
  {
    types: [
      "onsite_conversion.messaging_conversation_started_7d",
      "onsite_conversion.messaging_first_reply",
    ],
    label: "Mensagens",
  },
];

interface RawInsightRow {
  spend?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  reach?: string;
  actions?: InsightAction[];
  action_values?: InsightAction[];
  date_start?: string;
  date_stop?: string;
  ad_id?: string;
  ad_name?: string;
  effective_object_story_id?: string;
}

/** Escolhe o primeiro tipo de conversão com valor > 0; senão cai para o primeiro da lista (0). */
function pickConversions(actions: InsightAction[] | undefined): { conversions: number; actionValue: number; label: string } {
  for (const { types, label } of CONVERSION_ACTION_TYPES) {
    const conversions = sumActionValue(actions, types);
    if (conversions > 0) return { conversions, actionValue: 0, label };
  }
  return { conversions: 0, actionValue: 0, label: CONVERSION_ACTION_TYPES[0].label };
}

async function fetchInsights(adAccountId: string, period: ReportPeriod, level: "account" | "ad") {
  const { token, version } = getConfig();
  const fields =
    level === "account"
      ? "spend,clicks,ctr,cpc,reach,actions,action_values,date_start,date_stop"
      : "spend,clicks,ctr,actions,ad_id,ad_name,effective_object_story_id";

  const params: Record<string, string> = {
    fields,
    date_preset: DATE_PRESET[period],
    access_token: token,
  };
  if (level === "ad") params.level = "ad";

  return graphGetAll<RawInsightRow>(`/${adAccountId}/insights`, params);
}

/** Busca métricas agregadas da conta para o período informado. */
export async function getAccountInsights(
  adAccountId: string,
  period: ReportPeriod,
): Promise<AccountInsights> {
  const rows = await fetchInsights(adAccountId, period, "account");
  const row = rows[0];

  if (!row) {
    return {
      spend: 0,
      clicks: 0,
      ctr: 0,
      cpc: 0,
      reach: 0,
      conversions: 0,
      costPerConversion: null,
      roas: null,
      ticketMedio: null,
      resultLabel: CONVERSION_ACTION_TYPES[0].label,
      dateStart: "",
      dateStop: "",
    };
  }

  const spend = Number(row.spend ?? 0);
  const { conversions, label } = pickConversions(row.actions);
  const actionValue = sumActionValue(row.action_values, CONVERSION_ACTION_TYPES.flatMap((c) => c.types));
  const costPerConversion = conversions > 0 ? spend / conversions : null;

  return {
    spend,
    clicks: Number(row.clicks ?? 0),
    ctr: Number(row.ctr ?? 0),
    cpc: Number(row.cpc ?? 0),
    reach: Number(row.reach ?? 0),
    conversions,
    costPerConversion,
    roas: computeRoas(spend, actionValue),
    ticketMedio: computeTicketMedio(actionValue, conversions),
    resultLabel: label,
    dateStart: row.date_start ?? "",
    dateStop: row.date_stop ?? "",
  };
}

export interface AccountInsights {
  spend: number;
  clicks: number;
  ctr: number;
  cpc: number;
  reach: number;
  conversions: number;
  costPerConversion: number | null;
  roas: number | null;
  ticketMedio: number | null;
  resultLabel: string;
  dateStart: string;
  dateStop: string;
}

/** Busca o ranking dos criativos com melhor desempenho no período. */
export async function getTopCreatives(
  adAccountId: string,
  period: ReportPeriod,
  limit: number,
): Promise<CreativeInsight[]> {
  const rows = await fetchInsights(adAccountId, period, "ad");

  const creatives: CreativeInsight[] = rows.map((row) => {
    const clicks = Number(row.clicks ?? 0);
    const spend = Number(row.spend ?? 0);
    const { conversions } = pickConversions(row.actions);
    return {
      adId: row.ad_id ?? "",
      adName: row.ad_name ?? "—",
      permalink: row.effective_object_story_id
        ? `https://www.facebook.com/${row.effective_object_story_id}`
        : null,
      conversions,
      clicks,
      ctr: Number(row.ctr ?? 0),
      cpa: conversions > 0 ? spend / conversions : null,
    };
  });

  return rankCreatives(creatives, limit);
}
```

- [ ] **Step 2: Checar compilação**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/meta-insights.ts
git commit -m "feat: busca metricas e ranking de criativos na Graph API"
```

---

### Task 5: `src/lib/report-schedule.ts` — cálculo do próximo envio

**Files:**
- Create: `src/lib/report-schedule.ts`
- Test: `src/lib/report-schedule.test.ts`

**Interfaces:**
- Produces: `type ReportFrequency = "daily" | "weekly" | "monthly"`, `computeNextSendAt(frequency: ReportFrequency, sendHour: number, from: Date): Date`

- [ ] **Step 1: Escrever os testes (falhando)**

```typescript
// src/lib/report-schedule.test.ts
import { describe, it, expect } from "vitest";
import { computeNextSendAt } from "./report-schedule";

describe("computeNextSendAt", () => {
  it("avança 1 dia para frequência diária, no horário configurado", () => {
    const from = new Date("2026-07-21T09:15:00Z");
    const next = computeNextSendAt("daily", 9, from);
    expect(next.toISOString()).toBe("2026-07-22T09:00:00.000Z");
  });

  it("avança 7 dias para frequência semanal", () => {
    const from = new Date("2026-07-21T09:15:00Z");
    const next = computeNextSendAt("weekly", 9, from);
    expect(next.toISOString()).toBe("2026-07-28T09:00:00.000Z");
  });

  it("avança 1 mês para frequência mensal", () => {
    const from = new Date("2026-07-21T09:15:00Z");
    const next = computeNextSendAt("monthly", 9, from);
    expect(next.toISOString()).toBe("2026-08-21T09:00:00.000Z");
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/lib/report-schedule.test.ts`
Expected: FAIL — `Cannot find module './report-schedule'`

- [ ] **Step 3: Implementar**

```typescript
// src/lib/report-schedule.ts

export type ReportFrequency = "daily" | "weekly" | "monthly";

const DAYS_TO_ADD: Record<ReportFrequency, number> = {
  daily: 1,
  weekly: 7,
  monthly: 0, // tratado à parte, avançando o mês
};

/** Calcula o próximo horário de envio a partir de `from`, no horário `sendHour` (UTC). */
export function computeNextSendAt(frequency: ReportFrequency, sendHour: number, from: Date): Date {
  const next = new Date(from);
  next.setUTCHours(sendHour, 0, 0, 0);

  if (frequency === "monthly") {
    next.setUTCMonth(next.getUTCMonth() + 1);
  } else {
    next.setUTCDate(next.getUTCDate() + DAYS_TO_ADD[frequency]);
  }

  return next;
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run src/lib/report-schedule.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/report-schedule.ts src/lib/report-schedule.test.ts
git commit -m "feat: calculo do proximo envio de relatorio por frequencia"
```

---

### Task 6: `src/lib/check-reports.ts` — renderização, envio agendado e envio manual

**Files:**
- Create: `src/lib/check-reports.ts`
- Test: `src/lib/check-reports.test.ts`

**Interfaces:**
- Consumes: `getSupabaseAdmin` de `./supabase`; `getAccountInsights`, `getTopCreatives`, `type ReportPeriod` de `./meta-insights`; `formatCreativeRankingText` de `./report-metrics`; `computeNextSendAt`, `type ReportFrequency` de `./report-schedule`; `sendWhatsAppMessage` de `./zapi`.
- Produces:
  - `renderReportMessage(template: string, vars: Record<string, string>): string`
  - `sendScheduledReports(): Promise<void>`
  - `forceSendReport(reportId: string): Promise<{ reportName: string; message: string }>`

- [ ] **Step 1: Escrever o teste de `renderReportMessage` (falhando)**

```typescript
// src/lib/check-reports.test.ts
import { describe, it, expect } from "vitest";
import { renderReportMessage } from "./check-reports";

describe("renderReportMessage", () => {
  it("substitui todas as variáveis presentes no template", () => {
    const template = "Conta: {conta}\nInvestido: {investimento}\nCliques: {cliques}";
    const result = renderReportMessage(template, {
      conta: "Mineirinha",
      investimento: "R$ 453,60",
      cliques: "395",
    });
    expect(result).toBe("Conta: Mineirinha\nInvestido: R$ 453,60\nCliques: 395");
  });

  it("mantém o texto de variáveis não fornecidas (não quebra o envio)", () => {
    const template = "Conta: {conta} | ROAS: {roas}";
    const result = renderReportMessage(template, { conta: "X" });
    expect(result).toBe("Conta: X | ROAS: {roas}");
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/lib/check-reports.test.ts`
Expected: FAIL — `Cannot find module './check-reports'`

- [ ] **Step 3: Implementar**

```typescript
// src/lib/check-reports.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getAccountInsights, getTopCreatives, type ReportPeriod } from "@/lib/meta-insights";
import { formatCreativeRankingText } from "@/lib/report-metrics";
import { computeNextSendAt, type ReportFrequency } from "@/lib/report-schedule";
import { sendWhatsAppMessage } from "@/lib/zapi";

interface MetricReportRow {
  id: string;
  name: string;
  ad_account_id: string;
  whatsapp_group_id: string;
  frequency: ReportFrequency;
  send_hour: number;
  period: ReportPeriod;
  message_template: string;
  creative_ranking_size: number | null;
  account: { meta_account_id: string; name: string; currency: string } | null;
}

/** Substitui `{chave}` pelo valor correspondente; chaves sem valor ficam como estão. */
export function renderReportMessage(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? vars[key] : match,
  );
}

const currencyFmt = (v: number, currency: string) =>
  v.toLocaleString("pt-BR", { style: "currency", currency });
const percentFmt = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

async function buildMessage(report: MetricReportRow): Promise<string> {
  if (!report.account) throw new Error("Conta de anúncio não encontrada.");

  const insights = await getAccountInsights(report.account.meta_account_id, report.period);
  const currency = report.account.currency;

  let topCreativesText = "";
  if (report.creative_ranking_size) {
    const creatives = await getTopCreatives(
      report.account.meta_account_id,
      report.period,
      report.creative_ranking_size,
    );
    topCreativesText = formatCreativeRankingText(creatives, insights.resultLabel);
  }

  const vars: Record<string, string> = {
    conta: report.account.name,
    periodo: report.period,
    data_inicio: insights.dateStart,
    data_fim: insights.dateStop,
    investimento: currencyFmt(insights.spend, currency),
    cliques: String(insights.clicks),
    alcance: String(insights.reach),
    conversoes: String(insights.conversions),
    custo_por_conversao:
      insights.costPerConversion != null ? currencyFmt(insights.costPerConversion, currency) : "—",
    roas: insights.roas != null ? insights.roas.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—",
    ticket_medio: insights.ticketMedio != null ? currencyFmt(insights.ticketMedio, currency) : "—",
    top_criativos: topCreativesText,
  };

  return renderReportMessage(report.message_template, vars);
}

const SELECT_REPORT =
  "id, name, ad_account_id, whatsapp_group_id, frequency, send_hour, period, message_template, creative_ranking_size, account:ad_accounts(meta_account_id, name, currency)";

/** Envia todos os relatórios agendados cujo `next_send_at` já venceu. */
export async function sendScheduledReports(): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("metric_reports")
    .select(SELECT_REPORT)
    .eq("is_active", true)
    .lte("next_send_at", new Date().toISOString());

  if (error) throw new Error(`Erro ao buscar relatórios agendados: ${error.message}`);

  const reports = (data ?? []) as unknown as MetricReportRow[];

  for (const report of reports) {
    await sendOne(supabase, report);
  }
}

async function sendOne(supabase: SupabaseClient, report: MetricReportRow): Promise<void> {
  const message = await buildMessage(report);
  const sendResult = await sendWhatsAppMessage(report.whatsapp_group_id, message);

  await supabase.from("report_log").insert({
    metric_report_id: report.id,
    message,
    whatsapp_message_id: sendResult.messageId,
  });

  const nextSendAt = computeNextSendAt(report.frequency, report.send_hour, new Date());
  await supabase
    .from("metric_reports")
    .update({ next_send_at: nextSendAt.toISOString() })
    .eq("id", report.id);
}

/** Dispara um relatório específico agora, sem alterar `next_send_at` (botão "Enviar agora"). */
export async function forceSendReport(reportId: string): Promise<{ reportName: string; message: string }> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("metric_reports")
    .select(SELECT_REPORT)
    .eq("id", reportId)
    .single();

  if (error || !data) throw new Error("Relatório não encontrado.");
  const report = data as unknown as MetricReportRow;

  const message = await buildMessage(report);
  const sendResult = await sendWhatsAppMessage(report.whatsapp_group_id, message);

  await supabase.from("report_log").insert({
    metric_report_id: report.id,
    message,
    whatsapp_message_id: sendResult.messageId,
  });

  return { reportName: report.name, message };
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run src/lib/check-reports.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/check-reports.ts src/lib/check-reports.test.ts
git commit -m "feat: envio agendado e manual de relatorios de metricas"
```

---

### Task 7: Ligar o envio agendado ao cron existente

**Files:**
- Modify: `src/app/api/cron/check-balances/route.ts`

**Interfaces:**
- Consumes: `sendScheduledReports` de `@/lib/check-reports`.

- [ ] **Step 1: Editar o endpoint**

```typescript
// src/app/api/cron/check-balances/route.ts
import { NextResponse } from "next/server";
import { checkAllBalances } from "@/lib/check-balances";
import { sendScheduledReports } from "@/lib/check-reports";

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const results = await checkAllBalances();
    await sendScheduledReports();
    return NextResponse.json({ ok: true, checked: results.length, results });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Checar compilação**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/check-balances/route.ts
git commit -m "feat: cron diario tambem dispara relatorios agendados"
```

---

### Task 8: Server actions de CRUD e envio manual de relatórios

**Files:**
- Modify: `src/app/actions.ts`

**Interfaces:**
- Consumes: `requireAuth`, `getSupabaseAdmin` (já existentes no arquivo); `forceSendReport` de `@/lib/check-reports`; `computeNextSendAt` de `@/lib/report-schedule`.
- Produces: `createMetricReport(formData: FormData)`, `updateMetricReport(formData: FormData)`, `deleteMetricReport(reportId: string)`, `setMetricReportActive(reportId: string, enabled: boolean)`, `forceSendReportAction(reportId: string)`.

- [ ] **Step 1: Adicionar as actions ao final de `src/app/actions.ts`**

```typescript
// adicionar aos imports do topo do arquivo:
import { forceSendReport } from "@/lib/check-reports";
import { computeNextSendAt } from "@/lib/report-schedule";

// ---- Relatórios de métricas ----

/** Cadastra um novo relatório de métricas para uma conta já registrada. */
export async function createMetricReport(formData: FormData) {
  await requireAuth();

  const name = (formData.get("name") as string).trim();
  const adAccountId = formData.get("ad_account_id") as string;
  const whatsappGroupId = (formData.get("whatsapp_group_id") as string || "").trim();
  const whatsappGroupName = (formData.get("whatsapp_group_name") as string || "").trim() || null;
  const frequency = formData.get("frequency") as "daily" | "weekly" | "monthly";
  const sendHour = Number(formData.get("send_hour") || "9");
  const period = formData.get("period") as string;
  const messageTemplate = (formData.get("message_template") as string || "").trim();
  const creativeRankingSizeRaw = formData.get("creative_ranking_size") as string;
  const creativeRankingSize = creativeRankingSizeRaw ? Number(creativeRankingSizeRaw) : null;

  if (!name || !adAccountId || !whatsappGroupId || !messageTemplate) {
    throw new Error("Preencha nome, conta, destinatário e mensagem.");
  }

  const admin = getSupabaseAdmin();
  const nextSendAt = computeNextSendAt(frequency, sendHour, new Date());

  const { error } = await admin.from("metric_reports").insert({
    name,
    ad_account_id: adAccountId,
    whatsapp_group_id: whatsappGroupId,
    whatsapp_group_name: whatsappGroupName,
    frequency,
    send_hour: sendHour,
    period,
    message_template: messageTemplate,
    creative_ranking_size: creativeRankingSize,
    next_send_at: nextSendAt.toISOString(),
  });

  if (error) throw new Error(`Erro ao criar relatório: ${error.message}`);

  revalidatePath("/relatorios");
}

/** Salva as edições de um relatório de métricas existente. */
export async function updateMetricReport(formData: FormData) {
  await requireAuth();

  const id = formData.get("id") as string;
  const name = (formData.get("name") as string).trim();
  const whatsappGroupId = (formData.get("whatsapp_group_id") as string || "").trim();
  const whatsappGroupName = (formData.get("whatsapp_group_name") as string || "").trim() || null;
  const frequency = formData.get("frequency") as "daily" | "weekly" | "monthly";
  const sendHour = Number(formData.get("send_hour") || "9");
  const period = formData.get("period") as string;
  const messageTemplate = (formData.get("message_template") as string || "").trim();
  const creativeRankingSizeRaw = formData.get("creative_ranking_size") as string;
  const creativeRankingSize = creativeRankingSizeRaw ? Number(creativeRankingSizeRaw) : null;

  if (!name || !whatsappGroupId || !messageTemplate) {
    throw new Error("Preencha nome, destinatário e mensagem.");
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("metric_reports")
    .update({
      name,
      whatsapp_group_id: whatsappGroupId,
      whatsapp_group_name: whatsappGroupName,
      frequency,
      send_hour: sendHour,
      period,
      message_template: messageTemplate,
      creative_ranking_size: creativeRankingSize,
    })
    .eq("id", id);

  if (error) throw new Error(`Erro ao salvar relatório: ${error.message}`);

  revalidatePath("/relatorios");
}

/** Liga/desliga o envio automático de um relatório de métricas. */
export async function setMetricReportActive(reportId: string, enabled: boolean) {
  await requireAuth();

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("metric_reports")
    .update({ is_active: enabled })
    .eq("id", reportId);

  if (error) throw new Error(`Erro ao alterar relatório: ${error.message}`);

  revalidatePath("/relatorios");
}

/** Exclui um relatório de métricas (e seu histórico de envio em cascata). */
export async function deleteMetricReport(reportId: string) {
  await requireAuth();

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("metric_reports").delete().eq("id", reportId);

  if (error) throw new Error(`Erro ao excluir relatório: ${error.message}`);

  revalidatePath("/relatorios");
}

/** Dispara um relatório de métricas agora, fora do agendamento. */
export async function forceSendReportAction(reportId: string) {
  await requireAuth();
  const result = await forceSendReport(reportId);
  revalidatePath("/relatorios");
  return result;
}
```

- [ ] **Step 2: Checar compilação**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions.ts
git commit -m "feat: server actions de CRUD e envio manual de relatorios de metricas"
```

---

### Task 9: Navegação — renomear "Alertas" e adicionar "Relatórios"

**Files:**
- Modify: `src/app/AppShell.tsx:17-22`

- [ ] **Step 1: Atualizar o array `NAV`**

```typescript
const NAV: NavItem[] = [
  { href: "/", label: "Alertas", icon: "🔔" },
  { href: "/relatorios", label: "Relatórios", icon: "📊" },
  { href: "/templates", label: "Templates", icon: "💬" },
  { href: "/settings", label: "Configurações", icon: "⚙️", adminOnly: true },
  { href: "/usuarios", label: "Usuários", icon: "👥", adminOnly: true },
];
```

- [ ] **Step 2: Verificar visualmente**

Run: `npm run dev` (se ainda não estiver rodando) e abrir `http://localhost:3000`
Expected: menu lateral mostra "Alertas" e "Relatórios" como itens separados; "Relatórios" ainda não tem página (404 esperado até a Task 10).

- [ ] **Step 3: Commit**

```bash
git add src/app/AppShell.tsx
git commit -m "feat: renomeia nav para Alertas e adiciona item Relatorios"
```

---

### Task 10: Página `/relatorios` — listagem

**Files:**
- Create: `src/app/(app)/relatorios/page.tsx`
- Create: `src/app/MetricReportsTable.tsx`

**Interfaces:**
- Consumes: `setMetricReportActive`, `deleteMetricReport`, `forceSendReportAction` de `@/app/actions`.
- Produces: componente `MetricReportsTable` exportado com `export interface MetricReportRow { id: string; name: string; accountName: string; whatsappGroupName: string | null; frequency: string; nextSendAt: string | null; isActive: boolean }`.

- [ ] **Step 1: Criar a tabela client-side**

```tsx
// src/app/MetricReportsTable.tsx
"use client";

import { useState, useTransition } from "react";
import {
  setMetricReportActive,
  deleteMetricReport,
  forceSendReportAction,
} from "@/app/actions";

export interface MetricReportRow {
  id: string;
  name: string;
  accountName: string;
  whatsappGroupName: string | null;
  frequency: string;
  nextSendAt: string | null;
  isActive: boolean;
}

const FREQUENCY_LABEL: Record<string, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

export default function MetricReportsTable({ rows }: { rows: MetricReportRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [sendingId, setSendingId] = useState<string | null>(null);

  function toggle(id: string, enabled: boolean) {
    startTransition(() => setMetricReportActive(id, enabled));
  }

  function remove(id: string) {
    if (!confirm("Excluir este relatório?")) return;
    startTransition(() => deleteMetricReport(id));
  }

  async function sendNow(id: string) {
    setSendingId(id);
    try {
      await forceSendReportAction(id);
    } finally {
      setSendingId(null);
    }
  }

  return (
    <table className="w-full text-left text-sm">
      <thead className="text-slate-400">
        <tr>
          <th className="px-4 py-2">Status</th>
          <th className="px-4 py-2">Nome</th>
          <th className="px-4 py-2">Conta</th>
          <th className="px-4 py-2">Destinatário</th>
          <th className="px-4 py-2">Frequência</th>
          <th className="px-4 py-2">Próximo envio</th>
          <th className="px-4 py-2">Ações</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t border-slate-800">
            <td className="px-4 py-3">
              <input
                type="checkbox"
                checked={row.isActive}
                disabled={isPending}
                onChange={(e) => toggle(row.id, e.target.checked)}
              />
            </td>
            <td className="px-4 py-3">{row.name}</td>
            <td className="px-4 py-3">{row.accountName}</td>
            <td className="px-4 py-3">{row.whatsappGroupName ?? "—"}</td>
            <td className="px-4 py-3">{FREQUENCY_LABEL[row.frequency] ?? row.frequency}</td>
            <td className="px-4 py-3">
              {row.nextSendAt ? new Date(row.nextSendAt).toLocaleString("pt-BR") : "—"}
            </td>
            <td className="px-4 py-3">
              <button
                type="button"
                onClick={() => sendNow(row.id)}
                disabled={sendingId === row.id}
                className="mr-2 rounded bg-sky-600 px-2 py-1 text-xs text-white hover:bg-sky-500 disabled:opacity-50"
              >
                📨 Enviar agora
              </button>
              <button
                type="button"
                onClick={() => remove(row.id)}
                className="rounded bg-red-950 px-2 py-1 text-xs text-red-300 hover:bg-red-900"
              >
                🗑
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Criar a página**

```tsx
// src/app/(app)/relatorios/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import MetricReportsTable, { type MetricReportRow } from "@/app/MetricReportsTable";

interface RawReport {
  id: string;
  name: string;
  whatsapp_group_name: string | null;
  frequency: string;
  next_send_at: string | null;
  is_active: boolean;
  ad_accounts: { name: string } | null;
}

export default async function RelatoriosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("metric_reports")
    .select(
      "id, name, whatsapp_group_name, frequency, next_send_at, is_active, ad_accounts(name)",
    )
    .order("name");

  if (error) console.error("Erro ao buscar relatórios:", error.message);

  const rows: MetricReportRow[] = ((data ?? []) as unknown as RawReport[]).map((r) => ({
    id: r.id,
    name: r.name,
    accountName: r.ad_accounts?.name ?? "—",
    whatsappGroupName: r.whatsapp_group_name,
    frequency: r.frequency,
    nextSendAt: r.next_send_at,
    isActive: r.is_active,
  }));

  return (
    <main className="mx-auto max-w-[1600px] p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Relatórios</h1>
        <p className="text-sm text-slate-400">Métricas de campanha enviadas por WhatsApp.</p>
      </header>
      <MetricReportsTable rows={rows} />
    </main>
  );
}
```

- [ ] **Step 3: Verificar visualmente**

Run: `npm run dev` (se ainda não estiver rodando) e abrir `http://localhost:3000/relatorios`
Expected: página carrega sem erro, mostrando tabela vazia (nenhum relatório cadastrado ainda).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/relatorios/page.tsx" src/app/MetricReportsTable.tsx
git commit -m "feat: pagina de listagem de relatorios de metricas"
```

---

### Task 11: Formulário de criação de relatório

**Files:**
- Create: `src/app/(app)/relatorios/NewMetricReportSection.tsx`
- Create: `src/app/(app)/relatorios/NewMetricReportForm.tsx`
- Modify: `src/app/(app)/relatorios/page.tsx`

**Interfaces:**
- Consumes: `listWhatsAppGroupsAction` de `@/app/actions` (já existe); `createMetricReport` de `@/app/actions`; `NewReportModal` de `@/app/NewReportModal` (reaproveitado, já genérico).

- [ ] **Step 1: Server Component que busca as contas Meta cadastradas**

```tsx
// src/app/(app)/relatorios/NewMetricReportSection.tsx
import { getSupabaseAdmin } from "@/lib/supabase";
import NewMetricReportForm from "./NewMetricReportForm";

export default async function NewMetricReportSection() {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("ad_accounts")
    .select("id, name")
    .eq("is_active", true)
    .eq("platform", "meta")
    .order("name");

  const accounts = (data ?? []) as { id: string; name: string }[];

  return <NewMetricReportForm accounts={accounts} />;
}
```

- [ ] **Step 2: Client Component com o formulário**

```tsx
// src/app/(app)/relatorios/NewMetricReportForm.tsx
"use client";

import { useState } from "react";
import { createMetricReport } from "@/app/actions";

const DEFAULT_TEMPLATE =
  "📊 *Relatório de Campanha*\n\n" +
  "Conta: *{conta}*\n" +
  "Período: {periodo} ({data_inicio} até {data_fim})\n\n" +
  "💰 Valor investido: {investimento}\n" +
  "👆 Cliques: {cliques}\n" +
  "🎯 Alcance: {alcance}\n" +
  "🚀 Conversões: {conversoes}\n" +
  "📱 Custo por conversão: {custo_por_conversao}\n" +
  "📈 ROAS: {roas}\n" +
  "🎟️ Ticket médio: {ticket_medio}\n\n" +
  "{top_criativos}";

export default function NewMetricReportForm({
  accounts,
}: {
  accounts: { id: string; name: string }[];
}) {
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);

  return (
    <form action={createMetricReport} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-slate-300">Nome do relatório</label>
        <input
          name="name"
          required
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-slate-300">Conta de anúncio</label>
        <select
          name="ad_account_id"
          required
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        >
          <option value="">Selecione…</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm text-slate-300">Frequência</label>
          <select
            name="frequency"
            defaultValue="weekly"
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="daily">Diário</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">Horário (UTC)</label>
          <input
            type="number"
            name="send_hour"
            min={0}
            max={23}
            defaultValue={9}
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm text-slate-300">Período</label>
          <select
            name="period"
            defaultValue="last_7_days"
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="today">Hoje</option>
            <option value="last_7_days">Últimos 7 dias</option>
            <option value="last_30_days">Últimos 30 dias</option>
            <option value="current_month">Mês atual</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">Ranking de criativos</label>
          <select
            name="creative_ranking_size"
            defaultValue=""
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="">Sem ranking</option>
            <option value="1">Top 1</option>
            <option value="3">Top 3</option>
            <option value="5">Top 5</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-slate-300">
          ID do grupo/número de WhatsApp
        </label>
        <input
          name="whatsapp_group_id"
          required
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <input type="hidden" name="whatsapp_group_name" value="" />
      </div>

      <div>
        <label className="mb-1 block text-sm text-slate-300">Mensagem</label>
        <textarea
          name="message_template"
          rows={10}
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
        />
        <p className="mt-1 text-xs text-slate-500">
          Variáveis: {"{conta} {periodo} {data_inicio} {data_fim} {investimento} {cliques} {alcance} {conversoes} {custo_por_conversao} {roas} {ticket_medio} {top_criativos}"}
        </p>
      </div>

      <button
        type="submit"
        className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
      >
        Criar relatório
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Ligar o formulário na página, dentro do modal já existente**

```tsx
// src/app/(app)/relatorios/page.tsx — adicionar aos imports:
import { Suspense } from "react";
import NewReportModal from "@/app/NewReportModal";
import NewMetricReportSection from "./NewMetricReportSection";

// dentro do <header>, ao lado do <h1>, adicionar:
        <NewReportModal>
          <Suspense fallback={<p className="text-sm text-slate-500">Carregando contas…</p>}>
            <NewMetricReportSection />
          </Suspense>
        </NewReportModal>
```

Ajustar o `<header>` para `flex items-center justify-between`, igual ao padrão já usado em `src/app/(app)/page.tsx`.

- [ ] **Step 4: Verificar manualmente**

Run: `npm run dev` e no navegador:
1. Abrir `http://localhost:3000/relatorios`.
2. Clicar em "+ Novo relatório", preencher nome, escolher uma conta Meta já cadastrada, deixar os defaults, informar um ID de grupo WhatsApp de teste, e criar.
3. Confirmar que a linha aparece na tabela com o "Próximo envio" calculado.

Expected: relatório criado aparece na listagem sem erros no console.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/relatorios/"
git commit -m "feat: formulario de criacao de relatorio de metricas"
```

---

### Task 12: Formulário de edição de relatório

**Files:**
- Create: `src/app/(app)/relatorios/EditMetricReportModal.tsx`
- Modify: `src/app/MetricReportsTable.tsx`
- Modify: `src/app/(app)/relatorios/page.tsx`

**Interfaces:**
- Consumes: `updateMetricReport` de `@/app/actions`; `Modal` de `@/app/Modal`.
- Produces: componente `EditMetricReportModal`, recebendo o relatório completo (incluindo `messageTemplate`, `period`, `sendHour`, `creativeRankingSize`) e renderizando o mesmo conjunto de campos do formulário de criação, pré-preenchidos.

- [ ] **Step 1: Estender `MetricReportRow` com os campos necessários para edição**

Em `src/app/MetricReportsTable.tsx`, ajustar a interface:

```typescript
export interface MetricReportRow {
  id: string;
  name: string;
  accountName: string;
  whatsappGroupId: string;
  whatsappGroupName: string | null;
  frequency: string;
  sendHour: number;
  period: string;
  messageTemplate: string;
  creativeRankingSize: number | null;
  nextSendAt: string | null;
  isActive: boolean;
}
```

- [ ] **Step 2: Criar o modal de edição**

```tsx
// src/app/(app)/relatorios/EditMetricReportModal.tsx
"use client";

import { useState } from "react";
import Modal from "@/app/Modal";
import { updateMetricReport } from "@/app/actions";
import type { MetricReportRow } from "@/app/MetricReportsTable";

export default function EditMetricReportModal({ report }: { report: MetricReportRow }) {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState(report.messageTemplate);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
      >
        ✏️ Editar
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Editar — ${report.name}`}>
        <form
          action={async (formData) => {
            await updateMetricReport(formData);
            setOpen(false);
          }}
          className="space-y-4"
        >
          <input type="hidden" name="id" value={report.id} />

          <div>
            <label className="mb-1 block text-sm text-slate-300">Nome do relatório</label>
            <input
              name="name"
              defaultValue={report.name}
              required
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Frequência</label>
              <select
                name="frequency"
                defaultValue={report.frequency}
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Horário (UTC)</label>
              <input
                type="number"
                name="send_hour"
                min={0}
                max={23}
                defaultValue={report.sendHour}
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Período</label>
              <select
                name="period"
                defaultValue={report.period}
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="today">Hoje</option>
                <option value="last_7_days">Últimos 7 dias</option>
                <option value="last_30_days">Últimos 30 dias</option>
                <option value="current_month">Mês atual</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Ranking de criativos</label>
              <select
                name="creative_ranking_size"
                defaultValue={report.creativeRankingSize ? String(report.creativeRankingSize) : ""}
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="">Sem ranking</option>
                <option value="1">Top 1</option>
                <option value="3">Top 3</option>
                <option value="5">Top 5</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">
              ID do grupo/número de WhatsApp
            </label>
            <input
              name="whatsapp_group_id"
              defaultValue={report.whatsappGroupId}
              required
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <input type="hidden" name="whatsapp_group_name" value={report.whatsappGroupName ?? ""} />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">Mensagem</label>
            <textarea
              name="message_template"
              rows={10}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
            />
          </div>

          <button
            type="submit"
            className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            Salvar alterações
          </button>
        </form>
      </Modal>
    </>
  );
}
```

- [ ] **Step 3: Adicionar o botão de editar na tabela**

Em `src/app/MetricReportsTable.tsx`, importar e renderizar `EditMetricReportModal` na célula de ações, antes do botão "Enviar agora":

```tsx
import EditMetricReportModal from "@/app/(app)/relatorios/EditMetricReportModal";

// dentro do <td className="px-4 py-3"> de Ações, antes do botão "Enviar agora":
              <EditMetricReportModal report={row} />
```

- [ ] **Step 4: Atualizar a página para preencher os novos campos de `MetricReportRow`**

Em `src/app/(app)/relatorios/page.tsx`, ajustar `RawReport` e o `map`:

```typescript
interface RawReport {
  id: string;
  name: string;
  whatsapp_group_id: string;
  whatsapp_group_name: string | null;
  frequency: string;
  send_hour: number;
  period: string;
  message_template: string;
  creative_ranking_size: number | null;
  next_send_at: string | null;
  is_active: boolean;
  ad_accounts: { name: string } | null;
}
```

E no `select`, incluir as colunas novas: `"id, name, whatsapp_group_id, whatsapp_group_name, frequency, send_hour, period, message_template, creative_ranking_size, next_send_at, is_active, ad_accounts(name)"`.

No `map`, adicionar os campos correspondentes (`whatsappGroupId: r.whatsapp_group_id`, `sendHour: r.send_hour`, `period: r.period`, `messageTemplate: r.message_template`, `creativeRankingSize: r.creative_ranking_size`).

- [ ] **Step 5: Verificar manualmente**

Run: `npm run dev`, abrir `/relatorios`, clicar em "✏️ Editar" num relatório existente, alterar o nome e salvar.
Expected: modal fecha e a tabela mostra o nome atualizado sem erro no console.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/relatorios/" src/app/MetricReportsTable.tsx
git commit -m "feat: formulario de edicao de relatorio de metricas"
```

---

### Task 13: Rodar a suíte completa e checar tipos antes de finalizar

- [ ] **Step 1: Rodar todos os testes**

Run: `npm test`
Expected: todos os testes passam, incluindo os novos (`report-metrics`, `report-schedule`, `check-reports`) e os já existentes.

- [ ] **Step 2: Checar tipos do projeto inteiro**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sem erros novos.

- [ ] **Step 4: Commit final (se houver ajustes)**

```bash
git add -A
git commit -m "chore: ajustes finais de tipos/lint da funcionalidade de relatorios"
```
