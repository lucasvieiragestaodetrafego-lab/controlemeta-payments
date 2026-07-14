# Reorganização da página de Relatórios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Concentrar criação/edição de relatórios em modais na página inicial, adicionar coluna Plataforma + gráficos (contas em risco no topo, sparklines por conta) e repropor Configurações como Integrações + padrões.

**Architecture:** Next.js 15 App Router (RSC) + Supabase. A página `(app)/page.tsx` (Server Component) busca contas e histórico de `balance_snapshots`, calcula série de risco e dados de sparkline com helpers puros, e passa tudo para `AccountsTable` (Client Component) que renderiza tabela/cards, gráficos SVG e modais. Gráficos são SVG inline, sem nova lib. Server actions já existentes (`updateAccount`, `createAccount`) são reaproveitadas pelos modais.

**Tech Stack:** Next.js 15.5, React 19, TypeScript, Tailwind 3.4, Supabase JS, Vitest (novo, só para os helpers puros).

## Global Constraints

- Sem novas dependências de runtime; gráficos em **SVG inline** (sem chart lib).
- Vitest entra apenas como **devDependency** para os helpers puros de `src/lib/`.
- Seguir o padrão visual existente (tema escuro slate: `bg-slate-900`, `border-slate-800`, texto `text-slate-100/400`).
- Não implementar integração real do Google Ads: apenas coluna `platform` (default `'meta'`) e um slot "em breve" na UI.
- Toda ação de escrita passa por server action com `requireAdmin()` (padrão já existente em `src/app/actions.ts`).
- Moeda por conta: **nunca somar saldos de moedas diferentes**. O gráfico do topo conta contas em risco (número), não soma dinheiro.

---

## Estrutura de arquivos

**Criar:**
- `supabase/migrations/0006_platform.sql` — coluna `platform` (0002–0005 já existem).
- `src/lib/sparkline.ts` — função pura que converte valores em pontos de polyline SVG.
- `src/lib/sparkline.test.ts` — testes.
- `src/lib/risk-series.ts` — função pura que monta série diária de "contas em risco".
- `src/lib/risk-series.test.ts` — testes.
- `src/app/Sparkline.tsx` — componente SVG de minilinha.
- `src/app/RiskChart.tsx` — componente SVG do gráfico do topo.
- `src/app/Modal.tsx` — casca de modal reutilizável (client).
- `src/app/EditAccountModal.tsx` — modal de edição de uma conta.
- `src/app/NewReportModal.tsx` — modal de criação (reusa o form de nova automação).
- `vitest.config.ts` — config mínima do Vitest.

**Modificar:**
- `src/lib/account-status.ts` — exportar helper `isAtRisk`.
- `src/app/(app)/page.tsx` — buscar histórico, calcular série/sparklines, passar props novas.
- `src/app/AccountsTable.tsx` — coluna Plataforma, sparkline, toggle Tabela/Cards, modo Cards, botão Editar, botão Novo relatório, montar o gráfico do topo.
- `src/app/actions.ts` — `createAccount` grava `platform`; nenhum outro comportamento muda.
- `src/app/(app)/settings/page.tsx` — remover forms por conta; virar Integrações + padrões.
- `package.json` — script `test` + devDependency `vitest`.

---

## Task 1: Migration da coluna `platform`

**Files:**
- Create: `supabase/migrations/0006_platform.sql` (0002–0005 já existem no diretório)
- Modify: `src/app/actions.ts:286-297` (insert de `createAccount`)

**Interfaces:**
- Produces: coluna `ad_accounts.platform text not null default 'meta'`.

> Nota de contexto: o repositório tem *schema drift* — `0001_init.sql` é a única migration mas o código usa colunas adicionadas depois (`is_prepay`, `custom_message`, `automation_enabled`, `role`, `message_templates`, view `latest_balance_snapshots`). Portanto esta migration precisa ser aplicada no banco pelo mesmo caminho que as outras (Supabase SQL editor ou `npm run db:migrate`), e a task só termina quando a coluna existir de fato no banco.

- [ ] **Step 1: Criar o arquivo de migration**

Create `supabase/migrations/0006_platform.sql`:

```sql
-- Adiciona a plataforma de origem da conta de anúncio.
-- 'meta' hoje; 'google' reservado para integração futura do Google Ads.
alter table ad_accounts
  add column if not exists platform text not null default 'meta';

-- Índice leve para filtrar/agrupar por plataforma na listagem.
create index if not exists idx_ad_accounts_platform on ad_accounts(platform);
```

- [ ] **Step 2: Aplicar a migration no banco**

Run: `npm run db:migrate`
Expected: script conclui sem erro. Se `db:migrate` não estiver configurado para este banco, aplicar o conteúdo do arquivo no SQL editor do Supabase.

- [ ] **Step 3: Verificar a coluna no banco**

Run (no SQL editor do Supabase, ou psql):
```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'ad_accounts' and column_name = 'platform';
```
Expected: uma linha com `platform | text | 'meta'::text`.

- [ ] **Step 4: Gravar `platform` na criação de conta**

In `src/app/actions.ts`, dentro de `createAccount`, no objeto do `insert` (hoje termina em `automation_enabled: automationEnabled,`), adicionar a linha `platform`:

```ts
  const { error: accountError } = await admin.from("ad_accounts").insert({
    name,
    meta_account_id: metaAccountId,
    client_id: clientId,
    manager_id: managerId,
    whatsapp_group_id: whatsappGroupId,
    alert_threshold: alertThreshold,
    currency,
    is_prepay: isPrepay,
    custom_message: customMessage,
    automation_enabled: automationEnabled,
    platform: "meta",
  });
```

- [ ] **Step 5: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0006_platform.sql src/app/actions.ts
git commit -m "feat: coluna platform em ad_accounts (default meta)"
```

---

## Task 2: Setup do Vitest + helper `isAtRisk`

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `src/lib/account-status.ts`
- Create: `src/lib/account-status.test.ts`

**Interfaces:**
- Produces: `isAtRisk(situacao: Situacao): boolean` exportada de `src/lib/account-status.ts`.

- [ ] **Step 1: Adicionar Vitest e script de teste**

In `package.json`, adicionar em `scripts`:
```json
    "test": "vitest run",
```
E em `devDependencies` (rodar depois o install):
```json
    "vitest": "^2.1.8",
```

Run: `npm install`
Expected: instala `vitest` sem erro.

- [ ] **Step 2: Config mínima do Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 3: Escrever o teste que falha para `isAtRisk`**

Create `src/lib/account-status.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getSituacao, isAtRisk } from "./account-status";

describe("isAtRisk", () => {
  it("conta ativa não está em risco", () => {
    expect(isAtRisk(getSituacao("ACTIVE", false, null))).toBe(false);
  });

  it("conta travada por pagamento está em risco", () => {
    expect(isAtRisk(getSituacao("UNSETTLED", false, null))).toBe(true);
  });

  it("pré-paga com saldo abaixo do limite está em risco", () => {
    expect(isAtRisk(getSituacao("ACTIVE", true, 50, 100))).toBe(true);
  });

  it("pré-paga sem saldo está em risco", () => {
    expect(isAtRisk(getSituacao("ACTIVE", true, 0, 100))).toBe(true);
  });

  it("sem checagem não conta como risco", () => {
    expect(isAtRisk(getSituacao(null, false, null))).toBe(false);
  });
});
```

- [ ] **Step 4: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/account-status.test.ts`
Expected: FAIL — `isAtRisk is not a function` / import não resolvido.

- [ ] **Step 5: Implementar `isAtRisk`**

In `src/lib/account-status.ts`, adicionar ao final do arquivo:
```ts
/**
 * "Em risco" = conta parada (travada) OU com saldo baixo (amber).
 * Usado no card de resumo e no gráfico de contas em risco ao longo do tempo.
 */
export function isAtRisk(situacao: Situacao): boolean {
  return situacao.travada || situacao.tone === "amber";
}
```

- [ ] **Step 6: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/account-status.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/account-status.ts src/lib/account-status.test.ts
git commit -m "test: setup vitest e helper isAtRisk"
```

---

## Task 3: Helper puro `sparklinePoints`

**Files:**
- Create: `src/lib/sparkline.ts`
- Create: `src/lib/sparkline.test.ts`

**Interfaces:**
- Produces: `sparklinePoints(values: number[], width: number, height: number): string` — string de pontos `"x,y x,y …"` para `<polyline points>`. Y invertido (valor maior = topo). Lista vazia → `""`. Valores todos iguais (ou 1 valor) → linha reta na metade da altura.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/lib/sparkline.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { sparklinePoints } from "./sparkline";

describe("sparklinePoints", () => {
  it("lista vazia retorna string vazia", () => {
    expect(sparklinePoints([], 100, 20)).toBe("");
  });

  it("um único valor vira linha reta no meio", () => {
    expect(sparklinePoints([5], 100, 20)).toBe("0,10 100,10");
  });

  it("valores iguais viram linha reta no meio", () => {
    expect(sparklinePoints([3, 3, 3], 100, 20)).toBe("0,10 50,10 100,10");
  });

  it("crescente: primeiro no fundo, último no topo", () => {
    // 3 pontos, largura 100 -> x = 0, 50, 100; altura 20 -> y de 20 (min) a 0 (max)
    expect(sparklinePoints([0, 5, 10], 100, 20)).toBe("0,20 50,10 100,0");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/sparkline.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Create `src/lib/sparkline.ts`:
```ts
/**
 * Converte uma série de valores em pontos para <polyline points="…"> de um SVG
 * de largura×altura dadas. Y é invertido (valor maior fica no topo, y menor).
 * Casos degenerados (vazio, 1 ponto, todos iguais) caem numa linha reta no meio.
 */
export function sparklinePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const stepX = values.length === 1 ? 0 : width / (values.length - 1);

  return values
    .map((v, i) => {
      const x = Math.round(i * stepX);
      const y = span === 0 ? height / 2 : height - ((v - min) / span) * height;
      return `${x},${Math.round(y)}`;
    })
    .join(" ");
}
```

Nota sobre o caso de 1 valor: `stepX = 0` produziria `"0,10"` só. O teste espera dois pontos (`"0,10 100,10"`) para desenhar uma linha visível. Ajustar o caso de 1 valor explicitamente antes do `map`:

```ts
  if (values.length === 1) {
    return `0,${Math.round(height / 2)} ${width},${Math.round(height / 2)}`;
  }
```
(inserir logo após o `if (values.length === 0) return "";`).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/sparkline.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sparkline.ts src/lib/sparkline.test.ts
git commit -m "feat: helper puro sparklinePoints"
```

---

## Task 4: Helper puro `buildRiskSeries`

**Files:**
- Create: `src/lib/risk-series.ts`
- Create: `src/lib/risk-series.test.ts`

**Interfaces:**
- Consumes: `getSituacao`, `isAtRisk` de `./account-status`.
- Produces:
  ```ts
  interface SnapshotRow { adAccountId: string; balance: number | null; accountStatus: string | null; checkedAt: string }
  interface RiskAccount { id: string; isPrepay: boolean | null; alertThreshold: number }
  function buildRiskSeries(snapshots: SnapshotRow[], accounts: RiskAccount[], days: number, now?: Date): { date: string; count: number }[]
  ```
  Para cada um dos últimos `days` dias (inclusive hoje), conta quantas contas estavam "em risco" considerando o snapshot mais recente de cada conta até o fim daquele dia. Retorna array cronológico (mais antigo primeiro), `date` no formato `YYYY-MM-DD`.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/lib/risk-series.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildRiskSeries } from "./risk-series";

const accounts = [
  { id: "a", isPrepay: true, alertThreshold: 100 },
  { id: "b", isPrepay: false, alertThreshold: 100 },
];

describe("buildRiskSeries", () => {
  it("retorna um ponto por dia na ordem cronológica", () => {
    const now = new Date("2026-01-03T12:00:00Z");
    const series = buildRiskSeries([], accounts, 3, now);
    expect(series.map((p) => p.date)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
    expect(series.every((p) => p.count === 0)).toBe(true);
  });

  it("conta a conta pré-paga como em risco quando o saldo fica abaixo do limite", () => {
    const now = new Date("2026-01-02T12:00:00Z");
    const snapshots = [
      // dia 1: conta 'a' com saldo cheio (não em risco)
      { adAccountId: "a", balance: 500, accountStatus: "ACTIVE", checkedAt: "2026-01-01T10:00:00Z" },
      // dia 2: conta 'a' cai para 50 (< 100 -> em risco)
      { adAccountId: "a", balance: 50, accountStatus: "ACTIVE", checkedAt: "2026-01-02T10:00:00Z" },
    ];
    const series = buildRiskSeries(snapshots, accounts, 2, now);
    expect(series).toEqual([
      { date: "2026-01-01", count: 0 },
      { date: "2026-01-02", count: 1 },
    ]);
  });

  it("usa o snapshot mais recente até o fim do dia, não posteriores", () => {
    const now = new Date("2026-01-01T23:59:00Z");
    const snapshots = [
      { adAccountId: "b", balance: null, accountStatus: "UNSETTLED", checkedAt: "2026-01-01T08:00:00Z" },
    ];
    const series = buildRiskSeries(snapshots, accounts, 1, now);
    expect(series).toEqual([{ date: "2026-01-01", count: 1 }]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/risk-series.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Create `src/lib/risk-series.ts`:
```ts
import { getSituacao, isAtRisk } from "./account-status";

export interface SnapshotRow {
  adAccountId: string;
  balance: number | null;
  accountStatus: string | null;
  checkedAt: string;
}

export interface RiskAccount {
  id: string;
  isPrepay: boolean | null;
  alertThreshold: number;
}

/** Formata uma data (UTC) como YYYY-MM-DD. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Série diária de "contas em risco". Para cada dia da janela, considera o
 * snapshot mais recente de cada conta até o fim daquele dia (23:59:59Z) e conta
 * quantas contas estavam em risco (via getSituacao + isAtRisk).
 */
export function buildRiskSeries(
  snapshots: SnapshotRow[],
  accounts: RiskAccount[],
  days: number,
  now: Date = new Date(),
): { date: string; count: number }[] {
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  // snapshots ordenados por tempo crescente por conta
  const byAccount = new Map<string, SnapshotRow[]>();
  for (const s of snapshots) {
    const arr = byAccount.get(s.adAccountId) ?? [];
    arr.push(s);
    byAccount.set(s.adAccountId, arr);
  }
  for (const arr of byAccount.values()) {
    arr.sort((x, y) => x.checkedAt.localeCompare(y.checkedAt));
  }

  const result: { date: string; count: number }[] = [];
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(todayUtc);
    day.setUTCDate(day.getUTCDate() - i);
    const endOfDay = new Date(day);
    endOfDay.setUTCHours(23, 59, 59, 999);

    let count = 0;
    for (const account of accounts) {
      const history = byAccount.get(account.id) ?? [];
      // último snapshot com checkedAt <= fim do dia
      let latest: SnapshotRow | undefined;
      for (const s of history) {
        if (new Date(s.checkedAt) <= endOfDay) latest = s;
        else break;
      }
      if (!latest) continue;
      const meta = accountById.get(account.id)!;
      const situacao = getSituacao(latest.accountStatus, meta.isPrepay, latest.balance, meta.alertThreshold);
      if (isAtRisk(situacao)) count++;
    }
    result.push({ date: dayKey(day), count });
  }

  return result;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/risk-series.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Rodar toda a suíte**

Run: `npm test`
Expected: todos os arquivos `.test.ts` passam.

- [ ] **Step 6: Commit**

```bash
git add src/lib/risk-series.ts src/lib/risk-series.test.ts
git commit -m "feat: helper puro buildRiskSeries"
```

---

## Task 5: Componentes SVG `Sparkline` e `RiskChart`

**Files:**
- Create: `src/app/Sparkline.tsx`
- Create: `src/app/RiskChart.tsx`

**Interfaces:**
- Consumes: `sparklinePoints` de `@/lib/sparkline`.
- Produces:
  - `<Sparkline values={number[]} tone="up"|"down"|"flat" />`
  - `<RiskChart series={{ date: string; count: number }[]} />`

- [ ] **Step 1: Criar `Sparkline`**

Create `src/app/Sparkline.tsx`:
```tsx
import { sparklinePoints } from "@/lib/sparkline";

const STROKE: Record<string, string> = {
  up: "#34d399", // subindo = bom (verde)
  down: "#f87171", // caindo = ruim (vermelho)
  flat: "#94a3b8", // estável / sem sinal (cinza)
};

export default function Sparkline({
  values,
  tone = "flat",
  width = 56,
  height = 16,
}: {
  values: number[];
  tone?: "up" | "down" | "flat";
  width?: number;
  height?: number;
}) {
  const points = sparklinePoints(values, width, height);
  if (!points) {
    return <span className="text-xs text-slate-600">—</span>;
  }
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <polyline fill="none" stroke={STROKE[tone]} strokeWidth={1.5} points={points} />
    </svg>
  );
}
```

- [ ] **Step 2: Criar `RiskChart`**

Create `src/app/RiskChart.tsx`:
```tsx
import { sparklinePoints } from "@/lib/sparkline";

/**
 * Gráfico de "contas em risco ao longo do tempo". Área vermelha translúcida.
 * Mostra estado vazio amigável quando não há histórico suficiente (0 ou 1 ponto,
 * ou todos os pontos zerados).
 */
export default function RiskChart({
  series,
}: {
  series: { date: string; count: number }[];
}) {
  const values = series.map((p) => p.count);
  const hasSignal = values.length >= 2 && values.some((v) => v > 0);

  const W = 640;
  const H = 80;
  const points = sparklinePoints(values, W, H);
  const max = Math.max(1, ...values);
  const last = values[values.length - 1] ?? 0;

  return (
    <section className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Contas em risco ao longo do tempo</h2>
        <span className="text-xs text-slate-400">
          {series.length > 0 ? `hoje: ${last}` : ""}
        </span>
      </div>
      {hasSignal ? (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-24 w-full">
          <polyline fill="none" stroke="#f87171" strokeWidth={2} points={points} />
          <polyline
            fill="#f8717122"
            stroke="none"
            points={`${points} ${W},${H} 0,${H}`}
          />
        </svg>
      ) : (
        <p className="py-6 text-center text-xs text-slate-500">
          Ainda coletando histórico. O gráfico aparece após alguns dias de checagens.
        </p>
      )}
      <p className="mt-1 text-xs text-slate-500">Pico no período: {max === 1 && !hasSignal ? 0 : max}</p>
    </section>
  );
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/Sparkline.tsx src/app/RiskChart.tsx
git commit -m "feat: componentes SVG Sparkline e RiskChart"
```

---

## Task 6: Buscar histórico e passar dados novos em `page.tsx`

**Files:**
- Modify: `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `buildRiskSeries` de `@/lib/risk-series`.
- Produces: props novas em `AccountRow` — `platform: string`, `sparkValues: number[]`; e props novas de `AccountsTable` — `riskSeries: { date: string; count: number }[]`.

- [ ] **Step 1: Buscar `platform` e histórico**

In `src/app/(app)/page.tsx`, na interface `DashboardAccount` adicionar `platform: string;`. No `select` de `accountsQuery` (linha ~57), incluir `platform` e `is_prepay` (já presente) — a lista de colunas fica:
```ts
    .select(
      "id, name, currency, is_prepay, alert_threshold, automation_enabled, manager_id, whatsapp_group_id, platform",
    )
```

Depois do bloco que carrega `snapshots` (após a linha que cria o `Map` `snapshots`), adicionar a busca de histórico dos últimos 14 dias:
```ts
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const { data: historyData } = accountIds.length
    ? await admin
        .from("balance_snapshots")
        .select("ad_account_id, balance, account_status, checked_at")
        .in("ad_account_id", accountIds)
        .gte("checked_at", since.toISOString())
        .order("checked_at", { ascending: true })
    : { data: [] };

  const history = (historyData ?? []) as {
    ad_account_id: string;
    balance: number | null;
    account_status: string | null;
    checked_at: string;
  }[];

  const sparkByAccount = new Map<string, number[]>();
  for (const h of history) {
    if (h.balance == null) continue;
    const arr = sparkByAccount.get(h.ad_account_id) ?? [];
    arr.push(Number(h.balance));
    sparkByAccount.set(h.ad_account_id, arr);
  }
```

- [ ] **Step 2: Montar a série de risco**

Ainda em `page.tsx`, após montar `rows` (depois do `.map` que gera `rows`), adicionar:
```ts
  const riskSeries = buildRiskSeries(
    history.map((h) => ({
      adAccountId: h.ad_account_id,
      balance: h.balance,
      accountStatus: h.account_status,
      checkedAt: h.checked_at,
    })),
    accounts.map((a) => ({
      id: a.id,
      isPrepay: a.is_prepay,
      alertThreshold: a.alert_threshold,
    })),
    14,
  );
```
E o import no topo:
```ts
import { buildRiskSeries } from "@/lib/risk-series";
```

- [ ] **Step 3: Preencher `platform` e `sparkValues` em cada row**

No objeto retornado dentro do `.map` que cria `rows` (o que hoje termina em `travada: situacao.travada,`), adicionar:
```ts
      platform: account.platform,
      sparkValues: sparkByAccount.get(account.id) ?? [],
```

- [ ] **Step 4: Passar `riskSeries` para a tabela**

Trocar a renderização `<AccountsTable rows={rows} isAdmin={isAdmin} managers={managersList} />` por:
```tsx
      <AccountsTable rows={rows} isAdmin={isAdmin} managers={managersList} riskSeries={riskSeries} />
```

- [ ] **Step 5: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: erros esperados em `AccountsTable` (props ainda não existem) — serão resolvidos na Task 7. Se aparecer erro **dentro** de `page.tsx`, corrigir agora.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/page.tsx"
git commit -m "feat: page.tsx busca histórico e calcula série de risco/sparklines"
```

---

## Task 7: Coluna Plataforma + Sparkline + gráfico do topo na tabela

**Files:**
- Modify: `src/app/AccountsTable.tsx`

**Interfaces:**
- Consumes: `Sparkline`, `RiskChart`, `AccountRow` com `platform` e `sparkValues`, prop `riskSeries`.
- Produces: `AccountsTable` renderiza `RiskChart` no topo, coluna Plataforma e Tendência na tabela.

- [ ] **Step 1: Estender o tipo e as props**

In `src/app/AccountsTable.tsx`, na interface `AccountRow`, adicionar:
```ts
  platform: string;
  sparkValues: number[];
```
Na assinatura do componente, adicionar `riskSeries`:
```ts
export default function AccountsTable({
  rows,
  isAdmin,
  managers,
  riskSeries,
}: {
  rows: AccountRow[];
  isAdmin: boolean;
  managers: ManagerOption[];
  riskSeries: { date: string; count: number }[];
}) {
```
Imports no topo:
```ts
import Sparkline from "@/app/Sparkline";
import RiskChart from "@/app/RiskChart";
```

- [ ] **Step 2: Helper de badge de plataforma**

Adicionar antes do `return` do componente:
```tsx
  function PlatformBadge({ platform }: { platform: string }) {
    const meta = platform === "meta";
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: meta ? "#1877f2" : "#fbbc05" }}
        />
        {meta ? "Meta" : "Google"}
      </span>
    );
  }

  function sparkTone(values: number[]): "up" | "down" | "flat" {
    if (values.length < 2) return "flat";
    const diff = values[values.length - 1] - values[0];
    if (diff > 0) return "up";
    if (diff < 0) return "down";
    return "flat";
  }
```

- [ ] **Step 3: Renderizar `RiskChart` acima dos filtros**

Logo depois do `return (` e da `<div>` externa de abertura, antes da `<div className="mb-3 flex flex-wrap gap-2">` (a barra de filtros), inserir:
```tsx
      <RiskChart series={riskSeries} />
```

- [ ] **Step 4: Adicionar a coluna Plataforma e Tendência no cabeçalho**

No `<thead>`, entre a coluna "Conta" e "Tipo", adicionar `<th className="px-4 py-2 font-medium">Plataforma</th>`. Entre "Saldo" e "Situação", adicionar `<th className="px-4 py-2 font-medium">Tendência</th>`. Cabeçalho final:
```tsx
              <th className="px-4 py-2 font-medium">Conta</th>
              <th className="px-4 py-2 font-medium">Plataforma</th>
              {isAdmin && <th className="px-4 py-2 font-medium">Tipo</th>}
              <th className="px-4 py-2 font-medium">Saldo</th>
              <th className="px-4 py-2 font-medium">Tendência</th>
              <th className="px-4 py-2 font-medium">Situação</th>
```

- [ ] **Step 5: Ajustar o `colSpan` do estado vazio**

A linha vazia usa `colSpan={isAdmin ? 8 : 3}`. Com 2 colunas novas vira `colSpan={isAdmin ? 10 : 5}`.

- [ ] **Step 6: Renderizar as células novas em cada linha**

Na `<tr>` de cada `row`, adicionar a célula Plataforma logo após `<td className="px-4 py-3">{row.name}</td>`:
```tsx
                  <td className="px-4 py-3"><PlatformBadge platform={row.platform} /></td>
```
E a célula Tendência logo após a célula de Saldo (`<td className="px-4 py-3">{balanceLabel}</td>`):
```tsx
                  <td className="px-4 py-3"><Sparkline values={row.sparkValues} tone={sparkTone(row.sparkValues)} /></td>
```

- [ ] **Step 7: Verificar compilação e build**

Run: `npx tsc --noEmit && npm run build`
Expected: build conclui sem erro.

- [ ] **Step 8: Commit**

```bash
git add src/app/AccountsTable.tsx
git commit -m "feat: coluna Plataforma, sparkline e gráfico de risco na tabela"
```

---

## Task 8: Casca de Modal reutilizável

**Files:**
- Create: `src/app/Modal.tsx`

**Interfaces:**
- Produces: `<Modal open={boolean} onClose={() => void} title={string}>{children}</Modal>` — overlay escuro, fecha no `Esc`, no clique fora e no botão ✕.

- [ ] **Step 1: Implementar o Modal**

Create `src/app/Modal.tsx`:
```tsx
"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="mt-10 w-full max-w-2xl rounded-lg border border-slate-800 bg-slate-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/Modal.tsx
git commit -m "feat: casca de Modal reutilizável"
```

---

## Task 9: Modal de edição de conta (botão Editar na tabela)

**Files:**
- Create: `src/app/EditAccountModal.tsx`
- Modify: `src/app/AccountsTable.tsx`
- Modify: `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `Modal`, server action `updateAccount` (de `@/app/actions`).
- Produces: em cada linha/card, um botão "Editar" que abre o modal com nome, WhatsApp, limite, mensagem e automação. Salvar chama `updateAccount` e fecha.

> `updateAccount` já existe e revalida `/`. Precisamos dos valores atuais de cada conta na tabela: estender `AccountRow` com `alertThreshold`, `whatsappGroupId`, `customMessage`.

- [ ] **Step 1: Passar os campos editáveis para a tabela**

In `src/app/(app)/page.tsx`: incluir `custom_message` no `select` de `accountsQuery`:
```ts
    .select(
      "id, name, currency, is_prepay, alert_threshold, automation_enabled, manager_id, whatsapp_group_id, platform, custom_message",
    )
```
Na interface `DashboardAccount` adicionar `custom_message: string | null;`. No objeto de cada `row`, adicionar:
```ts
      alertThreshold: account.alert_threshold,
      whatsappGroupId: account.whatsapp_group_id,
      customMessage: account.custom_message,
```

- [ ] **Step 2: Estender `AccountRow`**

In `src/app/AccountsTable.tsx`, na interface `AccountRow`:
```ts
  alertThreshold: number;
  whatsappGroupId: string | null;
  customMessage: string | null;
```

- [ ] **Step 3: Implementar `EditAccountModal`**

Create `src/app/EditAccountModal.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import Modal from "@/app/Modal";
import { updateAccount } from "@/app/actions";
import type { AccountRow } from "@/app/AccountsTable";

export default function EditAccountModal({
  row,
  open,
  onClose,
}: {
  row: AccountRow;
  open: boolean;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateAccount(formData);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao salvar.");
      }
    });
  }

  const inputClass =
    "w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100";

  return (
    <Modal open={open} onClose={onClose} title={`Editar: ${row.name}`}>
      <form action={handleSubmit} className="grid grid-cols-1 gap-3">
        <input type="hidden" name="id" value={row.id} />

        <div>
          <label className="block text-xs text-slate-400">Nome da conta</label>
          <input name="name" defaultValue={row.name} className={inputClass} />
        </div>

        <div>
          <label className="block text-xs text-slate-400">Grupo/telefone WhatsApp</label>
          <input
            name="whatsapp_group_id"
            defaultValue={row.whatsappGroupId ?? ""}
            placeholder="ex: 120363421960030596-group"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400">
            Mensagem personalizada (em branco = padrão)
          </label>
          <textarea
            name="custom_message"
            defaultValue={row.customMessage ?? ""}
            rows={3}
            placeholder="Marcadores: {conta}, {saldo}, {limite}, {gestor}, {status}"
            className={inputClass}
          />
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <label className="block text-xs text-slate-400">Limite (R$)</label>
            <input
              name="alert_threshold"
              type="number"
              step="0.01"
              defaultValue={row.alertThreshold}
              className="w-28 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              name="automation_enabled"
              defaultChecked={row.automationEnabled}
              className="h-4 w-4 accent-emerald-500"
            />
            Automação ativa
          </label>
        </div>

        {error && <p className="rounded bg-red-950 px-3 py-2 text-xs text-red-300">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 4: Abrir o modal a partir da tabela**

In `src/app/AccountsTable.tsx`:
Import: `import EditAccountModal from "@/app/EditAccountModal";`
Estado (junto dos outros `useState`): `const [editing, setEditing] = useState<AccountRow | null>(null);`
Na coluna de Ações (`{isAdmin && (<td …><div className="flex items-center gap-2">…`), adicionar um botão "Editar" antes do `ForceSendButton`:
```tsx
                        <button
                          type="button"
                          onClick={() => setEditing(row)}
                          className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-white hover:bg-slate-600"
                        >
                          Editar
                        </button>
```
Antes do fechamento do `</div>` externo do componente (logo antes do último `</div>` do `return`), renderizar o modal:
```tsx
      {editing && (
        <EditAccountModal row={editing} open={!!editing} onClose={() => setEditing(null)} />
      )}
```

- [ ] **Step 5: Verificar build**

Run: `npx tsc --noEmit && npm run build`
Expected: build sem erro.

- [ ] **Step 6: Verificação manual**

Run: `npm run dev`, abrir `http://localhost:3000`, logar como admin, clicar "Editar" numa linha. Esperado: modal abre com os valores da conta; alterar o limite e Salvar fecha o modal e a lista mostra o novo limite; `Esc` e clique fora fecham sem salvar.

- [ ] **Step 7: Commit**

```bash
git add src/app/EditAccountModal.tsx src/app/AccountsTable.tsx "src/app/(app)/page.tsx"
git commit -m "feat: modal de edição de conta na página de Relatórios"
```

---

## Task 10: Modal "+ Novo relatório" na página de Relatórios

**Files:**
- Create: `src/app/NewReportModal.tsx`
- Modify: `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `Modal`, `NovaAutomacaoSection` (server component que busca contas do Meta e renderiza `NewAutomationForm`).
- Produces: botão "+ Novo relatório" no cabeçalho da página que abre o modal com o fluxo de criação.

> `NovaAutomacaoSection` é um Server Component (faz fetch do Meta). Um Client Component (modal) pode recebê-lo como `children`/prop e renderizá-lo — o Next resolve o RSC no servidor e o injeta. Passamos o conteúdo já renderizado como prop `children`.

- [ ] **Step 1: Implementar `NewReportModal`**

Create `src/app/NewReportModal.tsx`:
```tsx
"use client";

import { useState } from "react";
import Modal from "@/app/Modal";

export default function NewReportModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
      >
        + Novo relatório
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo relatório">
        {children}
      </Modal>
    </>
  );
}
```

> Observação: o `NewAutomationForm` interno usa `<form action={createAccount}>`, que revalida `/`. Após criar, a página recarrega os dados; o modal permanece aberto mostrando "Todas as contas já têm automação" ou a lista atualizada — o usuário fecha no ✕. Fechar automático após criação exigiria refatorar `createAccount` para retornar status; fica fora do escopo desta rodada.

- [ ] **Step 2: Usar o modal no cabeçalho da página**

In `src/app/(app)/page.tsx`:
Imports:
```ts
import NewReportModal from "@/app/NewReportModal";
import NovaAutomacaoSection from "@/app/(app)/settings/NovaAutomacaoSection";
```
Carregar os dados que o `NovaAutomacaoSection` precisa (a página já tem `managersList`; falta `defaultWhatsappGroupId`). Antes do `return`, adicionar:
```ts
  const defaultWhatsappGroupId = process.env.ZAPI_GROUP_IDS ?? "";
```
No cabeçalho, dentro do bloco `{isAdmin && (<div className="flex items-center gap-3">…`, **substituir** o `<Link href="/settings#nova-automacao" …>+ Nova automação</Link>` por:
```tsx
            <NewReportModal>
              <NovaAutomacaoSection
                managers={managersList}
                defaultWhatsappGroupId={defaultWhatsappGroupId}
              />
            </NewReportModal>
```

- [ ] **Step 3: Verificar build**

Run: `npx tsc --noEmit && npm run build`
Expected: build sem erro.

- [ ] **Step 4: Verificação manual**

`npm run dev` → abrir `/` como admin → clicar "+ Novo relatório". Esperado: modal abre com o seletor de contas do Meta e o formulário; criar uma conta a insere e ela aparece na lista.

- [ ] **Step 5: Commit**

```bash
git add src/app/NewReportModal.tsx "src/app/(app)/page.tsx"
git commit -m "feat: modal + Novo relatório na página de Relatórios"
```

---

## Task 11: Toggle Tabela ⇄ Cards + modo Cards

**Files:**
- Modify: `src/app/AccountsTable.tsx`

**Interfaces:**
- Produces: botão de alternância que troca entre a tabela existente e uma grade de cartões; preferência salva em `localStorage` (`relatorios-view`).

- [ ] **Step 1: Estado de view com persistência**

In `src/app/AccountsTable.tsx`, adicionar estado e efeito (junto aos outros hooks):
```ts
  const [view, setView] = useState<"table" | "cards">("table");
  useEffect(() => {
    const saved = localStorage.getItem("relatorios-view");
    if (saved === "cards" || saved === "table") setView(saved);
  }, []);
  function changeView(v: "table" | "cards") {
    setView(v);
    localStorage.setItem("relatorios-view", v);
  }
```
Import do `useEffect`: ajustar a linha `import { useMemo, useState, useTransition } from "react";` para incluir `useEffect`.

- [ ] **Step 2: Botão de alternância**

Logo após `<RiskChart series={riskSeries} />`, adicionar a barra com o toggle:
```tsx
      <div className="mb-3 flex justify-end">
        <div className="inline-flex overflow-hidden rounded border border-slate-700 text-xs">
          <button
            type="button"
            onClick={() => changeView("table")}
            className={`px-3 py-1.5 ${view === "table" ? "bg-slate-700 text-slate-100" : "text-slate-400 hover:bg-slate-800"}`}
          >
            ▤ Tabela
          </button>
          <button
            type="button"
            onClick={() => changeView("cards")}
            className={`px-3 py-1.5 ${view === "cards" ? "bg-slate-700 text-slate-100" : "text-slate-400 hover:bg-slate-800"}`}
          >
            ▦ Cards
          </button>
        </div>
      </div>
```

- [ ] **Step 3: Extrair a grade de cartões**

Adicionar, dentro do componente antes do `return`, um sub-render dos cartões que reutiliza `filtered`, `PlatformBadge`, `Sparkline`, `sparkTone`, `TONE_CLASSES`, `setEditing`:
```tsx
  const cardsView = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map((row) => {
        const balanceLabel =
          row.balance === null
            ? "—"
            : row.balance.toLocaleString("pt-BR", { style: "currency", currency: row.currency });
        return (
          <div key={row.id} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="mb-2 flex items-start justify-between">
              <PlatformBadge platform={row.platform} />
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setEditing(row)}
                  className="text-xs text-sky-400 hover:text-sky-300"
                >
                  Editar
                </button>
              )}
            </div>
            <p className="text-lg font-semibold text-slate-100">{balanceLabel}</p>
            <p className="text-xs text-slate-400">{row.name}</p>
            <div className="my-2">
              <Sparkline values={row.sparkValues} tone={sparkTone(row.sparkValues)} width={200} height={28} />
            </div>
            <span className={`inline-block rounded px-2 py-0.5 text-xs ${TONE_CLASSES[row.situacaoTone]}`}>
              {row.situacaoLabel}
            </span>
          </div>
        );
      })}
      {filtered.length === 0 && (
        <p className="col-span-full py-6 text-center text-sm text-slate-500">
          Nenhuma conta encontrada para esses filtros.
        </p>
      )}
    </div>
  );
```

- [ ] **Step 4: Renderizar condicionalmente**

Envolver o bloco atual `<div className="overflow-x-auto rounded-lg border border-slate-800"><table>…</table></div>` de forma que só apareça quando `view === "table"`, e renderizar `cardsView` quando `view === "cards"`:
```tsx
      {view === "table" ? (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          {/* …tabela existente… */}
        </div>
      ) : (
        cardsView
      )}
```

- [ ] **Step 5: Verificar build**

Run: `npx tsc --noEmit && npm run build`
Expected: build sem erro.

- [ ] **Step 6: Verificação manual**

`npm run dev` → `/` → alternar Tabela/Cards; recarregar a página e confirmar que a última escolha persiste; abrir "Editar" a partir de um card.

- [ ] **Step 7: Commit**

```bash
git add src/app/AccountsTable.tsx
git commit -m "feat: alternância Tabela/Cards com preferência persistida"
```

---

## Task 12: Configurações → Integrações + padrões

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

**Interfaces:**
- Produces: `/settings` sem forms por conta; com seção Integrações/Plataformas e padrões informativos.

> A criação de relatório saiu para o modal em `/` (Task 10). Os templates de mensagem já têm página própria (`/templates`). O grupo padrão do WhatsApp vem de `process.env.ZAPI_GROUP_IDS`. Não criamos tabela de settings nesta rodada (YAGNI): os padrões são informativos + links.

- [ ] **Step 1: Reescrever a página de Configurações**

Replace o conteúdo de `src/app/(app)/settings/page.tsx` por:
```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getSupabaseAdmin();
  const { data: manager } = await admin
    .from("managers")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  if (!manager || manager.role !== "admin") redirect("/");

  const defaultWhatsappGroupId = process.env.ZAPI_GROUP_IDS ?? "";

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Configurações</h1>
        <p className="text-sm text-slate-400">
          Integrações de plataforma e padrões gerais. A criação e edição de relatórios agora
          ficam na página de Alertas.
        </p>
      </header>

      <section className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Integrações / Plataformas</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded border border-slate-800 px-3 py-2">
            <span className="inline-flex items-center gap-2 text-sm text-slate-200">
              <span className="h-2 w-2 rounded-full" style={{ background: "#1877f2" }} />
              Meta Ads
            </span>
            <span className="rounded bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">Conectado</span>
          </div>
          <div className="flex items-center justify-between rounded border border-slate-800 px-3 py-2 opacity-70">
            <span className="inline-flex items-center gap-2 text-sm text-slate-200">
              <span className="h-2 w-2 rounded-full" style={{ background: "#fbbc05" }} />
              Google Ads
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">Em breve</span>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Padrões gerais</h2>
        <p className="text-sm text-slate-300">
          Grupo de WhatsApp padrão (novos relatórios):{" "}
          <code className="rounded bg-slate-950 px-1.5 py-0.5 text-xs text-slate-200">
            {defaultWhatsappGroupId || "não configurado"}
          </code>
        </p>
        <p className="mt-2 text-sm text-slate-400">
          As mensagens de alerta ficam em{" "}
          <Link href="/templates" className="text-sky-400 hover:text-sky-300">
            Templates
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verificar build**

Run: `npx tsc --noEmit && npm run build`
Expected: build sem erro. (Os arquivos `NovaAutomacaoSection.tsx`/`NewAutomationForm.tsx` continuam existindo, agora usados pelo modal em `/`.)

- [ ] **Step 3: Verificação manual**

`npm run dev` → `/settings` como admin. Esperado: sem forms por conta; seção Integrações (Meta conectado, Google Ads "em breve") e Padrões gerais visíveis.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/settings/page.tsx"
git commit -m "feat: Configurações vira Integrações + padrões"
```

---

## Task 13: Verificação end-to-end e ajuste do menu

**Files:**
- Modify: `src/app/AppShell.tsx` (opcional — rótulo do menu)

- [ ] **Step 1: Renomear o item de menu (opcional)**

In `src/app/AppShell.tsx`, no `NAV`, trocar o rótulo do primeiro item para refletir "Relatórios" se o usuário preferir esse termo:
```ts
  { href: "/", label: "Relatórios", icon: "🔔" },
```
(Manter "Alertas" se preferir; decisão de copy.)

- [ ] **Step 2: Rodar toda a suíte de testes**

Run: `npm test`
Expected: todos os testes passam.

- [ ] **Step 3: Build de produção**

Run: `npm run lint && npm run build`
Expected: lint e build sem erro.

- [ ] **Step 4: Smoke test manual do fluxo completo**

`npm run dev`, como admin, verificar:
1. `/` mostra cards de resumo, o gráfico "Contas em risco ao longo do tempo" (ou o estado vazio), a coluna Plataforma e sparklines.
2. Alternância Tabela ⇄ Cards funciona e persiste ao recarregar.
3. "+ Novo relatório" abre modal e cria conta.
4. "Editar" abre modal, salva e fecha, refletindo a mudança na lista.
5. `/settings` mostra Integrações + padrões, sem forms por conta.

- [ ] **Step 5: Commit final**

```bash
git add src/app/AppShell.tsx
git commit -m "chore: rótulo do menu e verificação final do redesign de Relatórios"
```

---

## Self-Review (cobertura do spec)

- Modal de criar/editar na página de Relatórios → Tasks 8, 9, 10. ✅
- Coluna Plataforma + banco → Tasks 1, 7. ✅
- Gráfico "contas em risco" no topo → Tasks 4, 5, 6, 7. ✅
- Sparkline por conta → Tasks 3, 5, 6, 7. ✅
- Toggle Tabela ⇄ Cards com persistência → Task 11. ✅
- Configurações vira Integrações + padrões → Task 12. ✅
- Estados vazios de gráfico → Task 5 (RiskChart) e Task 5 (Sparkline "—"). ✅
- Google Ads fora de escopo (só coluna + slot "em breve") → respeitado em Tasks 1, 7, 12. ✅
```
