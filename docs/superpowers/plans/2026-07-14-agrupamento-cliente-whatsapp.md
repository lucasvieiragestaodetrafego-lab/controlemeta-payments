# Agrupamento por Cliente + Seletor de Grupo do WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agrupar a tabela/cards de Relatórios por cliente (preparando para múltiplas contas/plataformas por cliente), trocar o campo de texto do grupo do WhatsApp por um seletor com busca pelo nome real do grupo, e criar um documento de registro geral do projeto.

**Architecture:** Duas funções puras testáveis (`groupAccountsByClient`, `parseGroupChats`) alimentam mudanças de UI em componentes client existentes (`AccountsTable`, `EditAccountModal`, `NewAutomationForm`). A lista de grupos do WhatsApp vem de uma nova chamada à Z-API (`GET /chats`), cacheada com `unstable_cache` (mesmo padrão já usado em `src/lib/meta.ts`), exposta ao client via uma nova Server Action. Uma coluna nova (`whatsapp_group_name`) guarda o nome do grupo já resolvido, para a tabela não depender de uma chamada de rede a cada carregamento.

**Tech Stack:** Next.js 15 App Router (Server Actions, RSC), Supabase (Postgres + `@supabase/supabase-js`), Tailwind CSS, Vitest.

## Global Constraints

- Nenhuma biblioteca de UI nova (sem date-pickers/combobox de terceiros) — o seletor de grupo é construído com componentes React simples, seguindo o estilo de `Modal.tsx`.
- Funções de lógica pura (agrupamento, parsing) ficam em `src/lib/`, com teste Vitest (`*.test.ts`), seguindo o padrão de `src/lib/risk-series.ts` / `risk-series.test.ts`.
- Toda ação que grava no banco continua passando por `requireAdmin()` em `src/app/actions.ts`.
- Migração numerada `0007_whatsapp_group_name.sql` (a última existente é `0006_platform.sql`).
- Mensagens de UI em português, no mesmo tom das existentes.

---

### Task 1: Documento de registro do projeto

**Files:**
- Create: `docs/PROJETO.md`

- [ ] **Step 1: Escrever o documento**

Crie `docs/PROJETO.md` com o conteúdo abaixo:

```markdown
# Meta Payments — Painel de Alertas de Saldo

## O que é

Painel interno para monitorar o saldo de contas de anúncio (hoje: Meta Ads;
Google Ads planejado) e avisar automaticamente, via grupo do WhatsApp, quando uma
conta está com saldo baixo ou travada — evitando que campanhas parem por falta de
pagamento sem que o time perceba a tempo.

## Por que existe

Antes deste painel, o acompanhamento de saldo de dezenas de contas de clientes era
manual. O objetivo é centralizar a visão de todas as contas, sinalizar risco cedo, e
automatizar o aviso para quem precisa agir (gestor de tráfego, cliente).

## Funcionalidades principais

- **Alertas de saldo** (`/`, chamado de "Relatórios" no menu): lista todas as contas
  de anúncio ativas, com saldo, situação (Ativa / Travada / Atenção), tendência
  recente (mini-gráfico) e um gráfico de "contas em risco ao longo do tempo".
- **Automação por conta**: cada conta pode ter um envio automático de alerta de
  saldo baixo, configurável (limite, grupo de destino, mensagem personalizada).
- **Criação/edição de relatórios**: feita via modal, direto na página de Relatórios
  (sem precisar navegar até Configurações).
- **Coluna de Plataforma**: cada conta tem uma plataforma (`meta` hoje, `google`
  reservado). Preparação para múltiplas plataformas por cliente.
- **Configurações**: virou uma página de Integrações (status de conexão por
  plataforma) + Padrões gerais (grupo padrão de WhatsApp, link para Templates).
- **Templates de mensagem** (`/templates`): mensagens de alerta customizáveis por
  conta, com marcadores (`{conta}`, `{saldo}`, `{limite}`, `{gestor}`, `{status}`).
- **Checagem automática**: rotina agendada (`/api/cron/check-balances`) que consulta
  o saldo real no Meta Ads e dispara alertas conforme a automação de cada conta.

## Em construção / próximos passos

- Agrupamento da tabela de Relatórios por cliente (uma linha de cabeçalho por
  cliente, sub-linhas por conta/plataforma) — preparação para clientes com mais de
  uma automação (ex: Meta + Google).
- Seletor de grupo do WhatsApp pelo nome real (em vez de colar o código do grupo
  manualmente), buscando a lista direto da Z-API.
- Integração real com Google Ads (hoje só existe a coluna/preparação estrutural).

## Stack técnica

Next.js 15 (App Router, Server Actions), Supabase (Postgres + Auth), Tailwind CSS,
Vitest para testes de funções puras. Integração com Meta Graph API (saldo das
contas) e Z-API (envio de mensagens no WhatsApp).
```

- [ ] **Step 2: Commit**

```bash
git add docs/PROJETO.md
git commit -m "docs: adiciona documento de registro geral do projeto"
```

---

### Task 2: Migração — coluna `whatsapp_group_name`

**Files:**
- Create: `supabase/migrations/0007_whatsapp_group_name.sql`

**Interfaces:**
- Produces: coluna `ad_accounts.whatsapp_group_name` (`text`, nullable), usada pelas Tasks 5, 8 e 9.

- [ ] **Step 1: Escrever a migração**

```sql
-- Guarda o nome real do grupo do WhatsApp (resolvido via seletor), evitando
-- depender de uma chamada à Z-API a cada carregamento da tabela de relatórios.
-- Nullable: contas antigas ficam sem nome até serem editadas de novo com o
-- seletor; a UI cai de volta para mostrar o código bruto nesse caso.
alter table ad_accounts
  add column if not exists whatsapp_group_name text;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0007_whatsapp_group_name.sql
git commit -m "feat: migração para guardar o nome do grupo do WhatsApp"
```

**NÃO aplique esta migração no banco.** A aplicação em produção é feita separadamente
(`npm run db:migrate`), depois que o branch inteiro for revisado — igual foi feito
com `0006_platform.sql`.

---

### Task 3: Função pura de agrupamento por cliente

**Files:**
- Create: `src/lib/group-accounts.ts`
- Test: `src/lib/group-accounts.test.ts`

**Interfaces:**
- Produces: `groupAccountsByClient<T extends { clientName: string; name: string }>(rows: T[]): { clientName: string; rows: T[] }[]`, usada pela Task 9 em `AccountsTable.tsx`.

- [ ] **Step 1: Escrever o teste**

Crie `src/lib/group-accounts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { groupAccountsByClient } from "./group-accounts";

describe("groupAccountsByClient", () => {
  it("agrupa contas pelo nome do cliente", () => {
    const rows = [
      { name: "Conta B", clientName: "Cliente Z" },
      { name: "Conta A", clientName: "Cliente A" },
    ];
    const groups = groupAccountsByClient(rows);
    expect(groups.map((g) => g.clientName)).toEqual(["Cliente A", "Cliente Z"]);
    expect(groups[0].rows).toEqual([{ name: "Conta A", clientName: "Cliente A" }]);
  });

  it("mantém múltiplas contas do mesmo cliente no mesmo grupo, ordenadas pelo nome da conta", () => {
    const rows = [
      { name: "Conta Google", clientName: "Dr. Tarik" },
      { name: "Conta Meta", clientName: "Dr. Tarik" },
    ];
    const groups = groupAccountsByClient(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].clientName).toBe("Dr. Tarik");
    expect(groups[0].rows.map((r) => r.name)).toEqual(["Conta Google", "Conta Meta"]);
  });

  it("retorna lista vazia para entrada vazia", () => {
    expect(groupAccountsByClient([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- group-accounts`
Expected: FAIL (`Cannot find module './group-accounts'` ou similar)

- [ ] **Step 3: Implementar**

Crie `src/lib/group-accounts.ts`:

```ts
export interface ClientGroup<T> {
  clientName: string;
  rows: T[];
}

/**
 * Agrupa uma lista plana de contas pelo nome do cliente, ordenando os grupos
 * pelo nome do cliente e as contas dentro de cada grupo pelo nome da conta.
 * Preparação para clientes com mais de uma conta/plataforma (ex: Meta + Google).
 */
export function groupAccountsByClient<T extends { clientName: string; name: string }>(
  rows: T[],
): ClientGroup<T>[] {
  const byClient = new Map<string, T[]>();
  for (const row of rows) {
    const list = byClient.get(row.clientName) ?? [];
    list.push(row);
    byClient.set(row.clientName, list);
  }

  return Array.from(byClient.entries())
    .map(([clientName, clientRows]) => ({
      clientName,
      rows: [...clientRows].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.clientName.localeCompare(b.clientName));
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- group-accounts`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/group-accounts.ts src/lib/group-accounts.test.ts
git commit -m "feat: função pura de agrupamento de contas por cliente"
```

---

### Task 4: Buscar grupos do WhatsApp na Z-API

**Files:**
- Modify: `src/lib/zapi.ts`
- Test: `src/lib/zapi.test.ts`

**Interfaces:**
- Consumes: `getConfig()` e `ZApiError` já existentes em `src/lib/zapi.ts`.
- Produces: `interface WhatsAppGroup { id: string; name: string }`, `parseGroupChats(chats: unknown[]): WhatsAppGroup[]`, `listWhatsAppGroups(): Promise<WhatsAppGroup[]>`, `listWhatsAppGroupsCached: () => Promise<WhatsAppGroup[]>` — usados pela Task 5.

- [ ] **Step 1: Escrever o teste da função pura de parsing**

Crie `src/lib/zapi.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseGroupChats } from "./zapi";

describe("parseGroupChats", () => {
  it("mantém apenas chats de grupo (phone termina em '-group')", () => {
    const chats = [
      { phone: "120363421960030596-group", name: "[CSS] Alerta de Saldos" },
      { phone: "5511999998888", name: "Contato individual" },
    ];
    expect(parseGroupChats(chats)).toEqual([
      { id: "120363421960030596-group", name: "[CSS] Alerta de Saldos" },
    ]);
  });

  it("usa o próprio id como nome quando o chat não tem nome", () => {
    const chats = [{ phone: "111-group", name: "" }];
    expect(parseGroupChats(chats)).toEqual([{ id: "111-group", name: "111-group" }]);
  });

  it("ignora itens malformados sem quebrar", () => {
    const chats = [null, { foo: "bar" }, { phone: "222-group", name: "Grupo B" }];
    expect(parseGroupChats(chats)).toEqual([{ id: "222-group", name: "Grupo B" }]);
  });

  it("ordena os grupos pelo nome", () => {
    const chats = [
      { phone: "b-group", name: "Zebra" },
      { phone: "a-group", name: "Abacaxi" },
    ];
    expect(parseGroupChats(chats).map((g) => g.name)).toEqual(["Abacaxi", "Zebra"]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- zapi`
Expected: FAIL (`parseGroupChats` não existe ainda)

- [ ] **Step 3: Implementar em `src/lib/zapi.ts`**

Adicione o import de `unstable_cache` no topo do arquivo (depois da linha `const ZAPI_BASE = ...` não é necessário, mas o import deve ficar junto dos outros no topo):

```ts
import { unstable_cache } from "next/cache";
```

Adicione uma função `get` auxiliar logo depois da função `post` existente (não altere `post`):

```ts
async function get<T>(path: string): Promise<T> {
  const { instanceId, token, clientToken } = getConfig();
  const url = `${ZAPI_BASE}/instances/${instanceId}/token/${token}${path}`;

  const res = await fetch(url, {
    headers: { "Client-Token": clientToken },
  });

  const data = await res.json().catch(() => []);

  if (!res.ok) {
    throw new ZApiError(
      (data as { message?: string }).message ?? `Z-API retornou status ${res.status}`,
      res.status,
    );
  }

  return data as T;
}
```

No final do arquivo, adicione:

```ts
export interface WhatsAppGroup {
  id: string;
  name: string;
}

/**
 * Filtra apenas os grupos da lista de chats da Z-API (ids terminados em
 * "-group", mesmo formato já usado em sendWhatsAppMessage) e ordena por nome.
 * Extraída como função pura para ser testável sem chamar a API de verdade.
 */
export function parseGroupChats(chats: unknown[]): WhatsAppGroup[] {
  const groups: WhatsAppGroup[] = [];

  for (const chat of chats) {
    if (typeof chat !== "object" || chat === null) continue;
    const c = chat as Record<string, unknown>;
    const phone = typeof c.phone === "string" ? c.phone : null;
    if (!phone || !phone.endsWith("-group")) continue;
    const rawName = typeof c.name === "string" ? c.name.trim() : "";
    groups.push({ id: phone, name: rawName || phone });
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

/** Busca a lista de chats da instância e retorna só os grupos (nome + id). */
export async function listWhatsAppGroups(): Promise<WhatsAppGroup[]> {
  const chats = await get<unknown[]>("/chats");
  return parseGroupChats(chats);
}

/**
 * Versão em cache de listWhatsAppGroups. Revalida a cada 5 minutos — grupos
 * novos no WhatsApp aparecem nesse intervalo, sem bater na Z-API a cada
 * abertura do modal de novo relatório.
 */
export const listWhatsAppGroupsCached = unstable_cache(
  listWhatsAppGroups,
  ["whatsapp-groups"],
  { revalidate: 300 },
);
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- zapi`
Expected: PASS (4 testes)

- [ ] **Step 5: Rodar o typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 6: Commit**

```bash
git add src/lib/zapi.ts src/lib/zapi.test.ts
git commit -m "feat: busca lista de grupos do WhatsApp na Z-API"
```

---

### Task 5: Server Action para listar grupos + gravar nome do grupo

**Files:**
- Modify: `src/app/actions.ts`

**Interfaces:**
- Consumes: `listWhatsAppGroupsCached()`, `type WhatsAppGroup` de `@/lib/zapi` (Task 4); `requireAdmin()` já existente.
- Produces: `listWhatsAppGroupsAction(): Promise<WhatsAppGroup[]>` — usada pela Task 6 (`GroupSelect.tsx`).

- [ ] **Step 1: Adicionar o import**

No topo de `src/app/actions.ts`, junto dos outros imports:

```ts
import { listWhatsAppGroupsCached, type WhatsAppGroup } from "@/lib/zapi";
```

- [ ] **Step 2: Adicionar a Server Action**

Adicione em qualquer ponto do arquivo, junto das outras actions relacionadas a conta (ex: logo antes de `updateAccount`):

```ts
/** Lista os grupos do WhatsApp disponíveis, para o seletor nos modais de relatório. */
export async function listWhatsAppGroupsAction(): Promise<WhatsAppGroup[]> {
  await requireAdmin();
  return listWhatsAppGroupsCached();
}
```

- [ ] **Step 3: Atualizar `updateAccount` para gravar o nome do grupo**

Localize a função `updateAccount` (por volta da linha 217) e substitua o corpo por:

```ts
export async function updateAccount(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const whatsappGroupId = ((formData.get("whatsapp_group_id") as string) || "").trim() || null;
  const whatsappGroupName = whatsappGroupId
    ? ((formData.get("whatsapp_group_name") as string) || "").trim() || null
    : null;
  const automationEnabled = formData.get("automation_enabled") === "on";
  const alertThreshold = Number(formData.get("alert_threshold") || "100");
  const customMessage = ((formData.get("custom_message") as string) || "").trim() || null;

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("ad_accounts")
    .update({
      name,
      whatsapp_group_id: whatsappGroupId,
      whatsapp_group_name: whatsappGroupName,
      automation_enabled: automationEnabled,
      alert_threshold: alertThreshold,
      custom_message: customMessage,
    })
    .eq("id", id);

  if (error) throw new Error(`Erro ao salvar conta: ${error.message}`);

  revalidatePath("/settings");
  revalidatePath("/");
}
```

- [ ] **Step 4: Atualizar `createAccount` para gravar o nome do grupo**

Localize a função `createAccount` (por volta da linha 246). Depois da linha:

```ts
  const whatsappGroupId = ((formData.get("whatsapp_group_id") as string) || "").trim() || null;
```

adicione logo abaixo:

```ts
  const whatsappGroupName = whatsappGroupId
    ? ((formData.get("whatsapp_group_name") as string) || "").trim() || null
    : null;
```

E no objeto passado para `admin.from("ad_accounts").insert({...})`, adicione o campo `whatsapp_group_name: whatsappGroupName,` junto de `whatsapp_group_id: whatsappGroupId,`.

- [ ] **Step 5: Rodar o typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros (a coluna `whatsapp_group_name` só existe no banco depois da migração da Task 2 ser aplicada — o Supabase client não tipa colunas em tempo de compilação neste projeto, então isso não quebra o build; confirme lendo `src/lib/supabase.ts` se houver tipagem gerada, mas pelo padrão já usado no projeto isso não é o caso)

- [ ] **Step 6: Commit**

```bash
git add src/app/actions.ts
git commit -m "feat: action para listar grupos do WhatsApp e gravar nome do grupo escolhido"
```

---

### Task 6: Componente `GroupSelect` (seletor com busca)

**Files:**
- Create: `src/app/GroupSelect.tsx`

**Interfaces:**
- Consumes: `listWhatsAppGroupsAction()` (Task 5), `type WhatsAppGroup` de `@/lib/zapi` (Task 4).
- Produces: `<GroupSelect defaultGroupId={string|null} defaultGroupName={string|null} />` — renderiza inputs ocultos `whatsapp_group_id` e `whatsapp_group_name` dentro do `<form>` pai. Usado pela Task 7 em `EditAccountModal.tsx` e `NewAutomationForm.tsx`.

- [ ] **Step 1: Criar o componente**

Crie `src/app/GroupSelect.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { listWhatsAppGroupsAction } from "@/app/actions";
import type { WhatsAppGroup } from "@/lib/zapi";

/**
 * Campo de formulário para escolher um grupo do WhatsApp pelo nome real.
 * Renderiza dois <input type="hidden"> (whatsapp_group_id, whatsapp_group_name)
 * para funcionar dentro de um <form action={...}> existente, sem precisar de
 * lógica extra no componente pai.
 */
export default function GroupSelect({
  defaultGroupId,
  defaultGroupName,
}: {
  defaultGroupId?: string | null;
  defaultGroupName?: string | null;
}) {
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<WhatsAppGroup | null>(
    defaultGroupId ? { id: defaultGroupId, name: defaultGroupName || defaultGroupId } : null,
  );

  useEffect(() => {
    let cancelled = false;
    listWhatsAppGroupsAction()
      .then((data) => {
        if (!cancelled) setGroups(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao buscar grupos.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = groups.filter((g) => g.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative">
      <input type="hidden" name="whatsapp_group_id" value={selected?.id ?? ""} />
      <input type="hidden" name="whatsapp_group_name" value={selected?.name ?? ""} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-left text-sm text-slate-100"
      >
        {selected ? selected.name : "Clique aqui para selecionar"}
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full rounded border border-slate-700 bg-slate-900 shadow-lg">
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar pelo nome"
            className="w-full border-b border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
          />
          <div className="max-h-56 overflow-y-auto">
            {loading && <p className="px-2 py-2 text-xs text-slate-500">Carregando grupos…</p>}
            {error && <p className="px-2 py-2 text-xs text-red-300">{error}</p>}
            {!loading && !error && filtered.length === 0 && (
              <p className="px-2 py-2 text-xs text-slate-500">Nenhum grupo encontrado.</p>
            )}
            {filtered.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setSelected(g);
                  setOpen(false);
                  setQuery("");
                }}
                className="block w-full px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800"
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rodar o typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 3: Commit**

```bash
git add src/app/GroupSelect.tsx
git commit -m "feat: componente GroupSelect (seletor de grupo do WhatsApp com busca)"
```

---

### Task 7: Trocar o campo de texto por `GroupSelect` nos modais

**Files:**
- Modify: `src/app/EditAccountModal.tsx`
- Modify: `src/app/(app)/settings/NewAutomationForm.tsx`

**Interfaces:**
- Consumes: `<GroupSelect defaultGroupId defaultGroupName />` (Task 6).
- Produces: `AccountRow.whatsappGroupName: string | null` (campo novo, adicionado no Step 1 desta task) — consumido por `EditAccountModal.tsx` aqui mesmo, e depois pela Task 9 na tabela/cards.

- [ ] **Step 1: Adicionar `whatsappGroupName` à interface `AccountRow`**

Em `src/app/AccountsTable.tsx`, localize a interface `AccountRow` (linha 14) e adicione o campo depois de `whatsappGroupId: string | null;`:

```ts
  whatsappGroupName: string | null;
```

- [ ] **Step 2: Atualizar `src/app/EditAccountModal.tsx`**

Adicione o import no topo:

```ts
import GroupSelect from "@/app/GroupSelect";
```

Substitua o bloco do campo de grupo (o `<div>` que contém `label` "Grupo/telefone WhatsApp" e o `<input name="whatsapp_group_id" ...>`) por:

```tsx
        <div>
          <label className="block text-xs text-slate-400">Grupo do WhatsApp</label>
          <GroupSelect
            defaultGroupId={row.whatsappGroupId}
            defaultGroupName={row.whatsappGroupName}
          />
        </div>
```

- [ ] **Step 3: Atualizar `src/app/(app)/settings/NewAutomationForm.tsx`**

Adicione o import no topo:

```ts
import GroupSelect from "@/app/GroupSelect";
```

Substitua o bloco (o `<div className="sm:col-span-2">` com o label "2. WhatsApp de destino..." e o `<input name="whatsapp_group_id" ...>`) por:

```tsx
      <div className="sm:col-span-2">
        <label className="block text-xs text-slate-400">
          2. WhatsApp de destino (grupo que recebe o alerta)
        </label>
        <GroupSelect defaultGroupId={defaultWhatsappGroupId || null} defaultGroupName={null} />
        <p className="mt-1 text-xs text-slate-500">
          Escolha o grupo pela lista. Você pode trocar por automação e alterar depois quando
          quiser.
        </p>
      </div>
```

- [ ] **Step 4: Rodar o typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 5: Commit**

```bash
git add src/app/AccountsTable.tsx src/app/EditAccountModal.tsx "src/app/(app)/settings/NewAutomationForm.tsx"
git commit -m "feat: usa GroupSelect nos modais de criar/editar relatório"
```

---

### Task 8: Trazer nome do cliente e do grupo na consulta do Dashboard

**Files:**
- Modify: `src/app/(app)/page.tsx`

**Interfaces:**
- Produces: `AccountRow.clientName: string`, `AccountRow.whatsappGroupName: string | null` preenchidos — consumidos pela Task 9 em `AccountsTable.tsx`.

- [ ] **Step 1: Atualizar a interface `DashboardAccount`**

Localize a interface `DashboardAccount` (linha 12) e substitua por:

```ts
interface DashboardAccount {
  id: string;
  name: string;
  currency: string;
  is_prepay: boolean | null;
  alert_threshold: number;
  automation_enabled: boolean;
  manager_id: string | null;
  whatsapp_group_id: string | null;
  whatsapp_group_name: string | null;
  platform: string;
  custom_message: string | null;
  clients: { name: string } | null;
}
```

- [ ] **Step 2: Atualizar a query para incluir o nome do grupo e o join com `clients`**

Localize a query `accountsQuery` (por volta da linha 60-66) e substitua a string do `.select(...)` por:

```ts
  let accountsQuery = admin
    .from("ad_accounts")
    .select(
      "id, name, currency, is_prepay, alert_threshold, automation_enabled, manager_id, whatsapp_group_id, whatsapp_group_name, platform, custom_message, clients(name)",
    )
    .eq("is_active", true)
    .order("name");
```

- [ ] **Step 3: Preencher `clientName` e `whatsappGroupName` no mapeamento de linhas**

Localize o `rows.map((account) => {...})` (por volta da linha 117) e, dentro do objeto retornado, adicione (junto de `whatsappGroupId: account.whatsapp_group_id,`):

```ts
      clientName: account.clients?.name ?? account.name,
      whatsappGroupName: account.whatsapp_group_name,
```

- [ ] **Step 4: Rodar o typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/page.tsx"
git commit -m "feat: dashboard busca nome do cliente e do grupo do WhatsApp"
```

---

### Task 9: Agrupar a tabela e os cards por cliente

**Files:**
- Modify: `src/app/AccountsTable.tsx`

**Interfaces:**
- Consumes: `groupAccountsByClient` de `@/lib/group-accounts` (Task 3); `AccountRow.clientName`, `AccountRow.whatsappGroupName` (Tasks 7 e 8).

- [ ] **Step 1: Adicionar `clientName` à interface `AccountRow`**

Adicione, junto de `whatsappGroupName: string | null;` (já adicionado na Task 7):

```ts
  clientName: string;
```

- [ ] **Step 2: Importar `groupAccountsByClient`**

No topo do arquivo, junto dos outros imports:

```ts
import { groupAccountsByClient } from "@/lib/group-accounts";
```

- [ ] **Step 3: Calcular os grupos a partir de `filtered`**

Logo depois da definição de `filtered` (o `useMemo` que já existe), adicione:

```ts
  const groups = useMemo(() => groupAccountsByClient(filtered), [filtered]);
```

- [ ] **Step 4: Mostrar o nome do grupo do WhatsApp na célula "Conta" (tabela)**

Localize a célula `<td className="px-4 py-3">{row.name}</td>` dentro do `filtered.map((row) => {...})` da tabela (por volta da linha 341) e substitua por:

```tsx
                  <td className="px-4 py-3">
                    {row.name}
                    {row.whatsappGroupName && (
                      <p className="text-xs text-slate-500">📱 {row.whatsappGroupName}</p>
                    )}
                  </td>
```

- [ ] **Step 5: Trocar `filtered.map` por iteração em grupos na tabela**

Localize o bloco `{filtered.map((row) => { ... return (<tr key={row.id} ...>...</tr>); })}` dentro do `<tbody>` da tabela (view "table") e substitua o `{filtered.map(...)}` por:

```tsx
            {groups.map((group) => (
              <FragmentGroup key={group.clientName} clientName={group.clientName} colSpan={isAdmin ? 10 : 5}>
                {group.rows.map((row) => {
                  const balanceLabel =
                    row.balance === null
                      ? "—"
                      : row.balance.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: row.currency,
                        });

                  return (
                    <tr key={row.id} className="border-t border-slate-800">
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(row.id)}
                            onChange={() => toggleOne(row.id)}
                            aria-label={`Selecionar ${row.name}`}
                            className="h-4 w-4 accent-emerald-500"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        {row.name}
                        {row.whatsappGroupName && (
                          <p className="text-xs text-slate-500">📱 {row.whatsappGroupName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3"><PlatformBadge platform={row.platform} /></td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-slate-400">
                          {row.isPrepay === null ? "—" : row.isPrepay ? "pré-pago" : "cartão"}
                        </td>
                      )}
                      <td className="px-4 py-3">{balanceLabel}</td>
                      <td className="px-4 py-3"><Sparkline values={row.sparkValues} tone={sparkTone(row.sparkValues)} /></td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs ${TONE_CLASSES[row.situacaoTone]}`}
                        >
                          {row.situacaoLabel}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <ManagerSelect
                            accountId={row.id}
                            currentManagerId={row.managerId}
                            managers={managers}
                          />
                        </td>
                      )}
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <AutomationToggle accountId={row.id} enabled={row.automationEnabled} />
                        </td>
                      )}
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditing(row)}
                              className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-white hover:bg-slate-600"
                            >
                              Editar
                            </button>
                            <ForceSendButton
                              accountId={row.id}
                              accountName={row.name}
                              hasWhatsapp={row.hasWhatsapp}
                            />
                            <DeleteAccountButton accountId={row.id} accountName={row.name} />
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </FragmentGroup>
            ))}
```

Remova o bloco antigo de `{filtered.map((row) => { ... })}` que esse trecho substitui (incluindo a declaração antiga de `balanceLabel` dentro dele).

- [ ] **Step 6: Criar o helper `FragmentGroup` no mesmo arquivo**

Adicione esta função de componente logo acima de `export default function AccountsTable(...)`:

```tsx
/** Renderiza a linha de cabeçalho do cliente seguida das linhas passadas como children. */
function FragmentGroup({
  clientName,
  colSpan,
  children,
}: {
  clientName: string;
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className="bg-slate-950/60">
        <td
          colSpan={colSpan}
          className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          {clientName}
        </td>
      </tr>
      {children}
    </>
  );
}
```

- [ ] **Step 7: Agrupar a visão de Cards**

Localize a constante `cardsView` (por volta da linha 156) e substitua todo o bloco por:

```tsx
  const cardsView = (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.clientName}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {group.clientName}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.rows.map((row) => {
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
                  {row.whatsappGroupName && (
                    <p className="text-xs text-slate-500">📱 {row.whatsappGroupName}</p>
                  )}
                  <div className="my-2">
                    <Sparkline values={row.sparkValues} tone={sparkTone(row.sparkValues)} width={200} height={28} />
                  </div>
                  <span className={`inline-block rounded px-2 py-0.5 text-xs ${TONE_CLASSES[row.situacaoTone]}`}>
                    {row.situacaoLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {filtered.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500">
          Nenhuma conta encontrada para esses filtros.
        </p>
      )}
    </div>
  );
```

- [ ] **Step 8: Rodar o typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 9: Rodar os testes**

Run: `npm test`
Expected: PASS (todos os testes existentes + os novos das Tasks 3 e 4)

- [ ] **Step 10: Commit**

```bash
git add src/app/AccountsTable.tsx
git commit -m "feat: agrupa tabela e cards de relatórios por cliente"
```

---

### Task 10: Verificação final

**Files:** nenhum (apenas checagem)

- [ ] **Step 1: Typecheck completo**

Run: `npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 2: Testes**

Run: `npm test`
Expected: todos os testes passam (existentes + novos: `group-accounts.test.ts` com 3 testes, `zapi.test.ts` com 4 testes)

- [ ] **Step 3: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros

- [ ] **Step 4: Smoke test manual (documentar para o usuário, não é automatizável aqui)**

Rodar `npm run dev`, logar como admin e conferir:
- A tabela de Relatórios mostra um cabeçalho por cliente (hoje, 1 sub-linha por
  cliente, já que ninguém tem 2 contas ainda).
- O nome do grupo do WhatsApp aparece embaixo do nome da conta quando cadastrado
  (contas antigas ainda mostram nada até serem editadas de novo).
- "+ Novo relatório" e "Editar" mostram o seletor de grupo com busca, listando
  grupos reais da Z-API (não mais o campo de texto livre).
- A visão de Cards também aparece agrupada por cliente.

- [ ] **Step 5: Commit final (se houver ajustes pendentes de lint/format)**

```bash
git status
```

Se não houver mudanças pendentes, este passo não gera commit — é só confirmação de
que a branch está limpa.
