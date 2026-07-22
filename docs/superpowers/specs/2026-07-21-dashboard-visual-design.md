# Design — Dashboard Visual de Métricas (Meta Payments)

**Data:** 2026-07-21
**Status:** Aprovado, pronto para plano de implementação

## Contexto

O Meta Payments hoje tem duas frentes: alertas de saldo (`/`) e Relatórios de
Métricas de Campanha enviados por WhatsApp em texto (`/relatorios`, ver
`docs/superpowers/specs/2026-07-21-relatorios-metricas-design.md`).

O usuário quer um **dashboard visual** — gráficos, cards, ranking de
criativos com imagem — pra uso interno dos gestores acompanharem contas Meta
a qualquer momento, com período customizável. Diferente dos Relatórios: isso
**não é enviado a clientes nem por automação** — é uma tela que o gestor abre
e consulta quando quiser, sempre com dado buscado na hora (sem cache).

"Análise por IA" foi considerada na mesma conversa mas fica **fora de
escopo** deste documento — pode ser um projeto separado depois.

## Escopo

1. **Tela de Visão Geral** (`/dashboard`): tabela compacta com todas as
   contas monitoradas no dashboard, período selecionável, ordenável por
   coluna.
2. **Tela de Detalhe da conta** (`/dashboard/[accountId]`): cards de KPI,
   gráfico de evolução diária (gasto x resultado), funil de conversão,
   ranking de criativos.
3. **Gerenciamento de contas do dashboard**: lista própria de contas
   visíveis no dashboard, independente do cadastro de automação de saldo —
   por padrão as 35 já cadastradas, mas qualquer uma das 107 contas do Meta
   pode ser adicionada.

Fora de escopo: análise por IA, envio/automação para clientes, métricas de
Página do Facebook (mesma limitação já registrada no doc de Relatórios).

## Arquitetura

### Dados: nova tabela `dashboard_accounts`

Controla quais contas aparecem no dashboard e qual é a "métrica de resultado
principal" de cada uma (uma das 10 conversões rastreadas em
`TRACKED_ACTIONS`, ex: compras, leads, cadastros).

```sql
create table dashboard_accounts (
  id uuid primary key default gen_random_uuid(),
  meta_account_id text not null unique,   -- ex: act_123456789
  account_name text not null,
  result_metric_key text not null default 'compras', -- chave de TRACKED_ACTIONS
  created_at timestamptz not null default now()
);
```

Migração seed inicial: popular com as 35 contas hoje em `ad_accounts`
(mesmo `meta_account_id`/nome), `result_metric_key` default `'compras'`
(gestor ajusta depois pelas contas que fazem sentido).

Independente de `ad_accounts` (automação de saldo) — uma conta pode estar
numa tabela, na outra, nas duas, ou em nenhuma. Adicionar uma conta ao
dashboard não cria automação de saldo, e vice-versa.

### `meta-insights.ts`: duas capacidades novas

Hoje só busca total agregado do período via `date_preset`. Precisa de:

1. **Intervalo customizado** — aceitar `time_range: {since, until}` além do
   `date_preset` atual, pro calendário manual do seletor de período.
2. **Série diária** — nova função (ex: `getAccountInsightsDaily`) que busca
   com `time_increment: 1`, retornando um array de `{date, spend, conversions}`
   por dia, usado só pelo gráfico de evolução da tela de detalhe (a Visão
   Geral e os cards de KPI continuam usando o total agregado que já existe).

Ambas reaproveitam `TRACKED_ACTIONS` e a lógica de soma de `actions`/
`action_values` já existente em `report-metrics.ts` — nenhuma duplicação de
regra de negócio, só variação de parâmetros da chamada à Graph API.

### Período customizável

Componente de seletor compartilhado entre as duas telas: presets (Hoje, 7
dias, 30 dias, Mês atual — mesmos 4 já usados em Relatórios) + opção de
calendário para escolher datas manualmente. Ao mudar o período, refaz a
busca (sem cache, sempre ao vivo).

### Gráficos: Recharts

Nenhuma lib de gráfico está instalada hoje. Recomenda-se **Recharts** —
React-nativa, leve, boa integração com Tailwind, suficiente para os 3 tipos
de visualização necessários (linha/barra temporal, funil, cards).

### Menu

Novo item **📈 Dashboard** no `AppShell`, entre 🔔 Alertas e 📊 Relatórios.
Visível pra todos os gestores (não é exclusivo de admin, como Alertas e
Relatórios hoje não são).

## Tela 1 — Visão Geral (`/dashboard`)

- Seletor de período no topo, aplicado a toda a tabela.
- Tabela compacta, 1 linha por conta em `dashboard_accounts`, colunas:
  Conta · Gasto · Resultado (label e valor conforme `result_metric_key` da
  conta) · Custo por resultado · ROAS. Cada coluna numérica é ordenável.
- Botão "⚙️ Gerenciar contas do dashboard" → modal/página com as 107 contas
  do Meta (reaproveita a mesma busca de `listBusinessAdAccountsCached` usada
  em Nova Automação), checkbox pra incluir/excluir do dashboard, e um select
  por conta incluída pra escolher `result_metric_key`.
- Clicar numa linha da tabela leva para `/dashboard/[accountId]` com o
  mesmo período selecionado (via query string).
- Buscar os dados de todas as contas da tabela em paralelo (mesmo padrão de
  lotes já usado em `checkAllBalances`), já que pode ter dezenas de contas.

## Tela 2 — Detalhe da conta (`/dashboard/[accountId]`)

- Mesmo seletor de período + seletor de "métrica de resultado" (pré-selecionado
  com `result_metric_key` da conta, mas pode trocar só pra visualização,
  sem alterar o valor salvo a menos que o gestor confirme).
- **Cards de KPI**: Gasto · Resultado · Custo por resultado · ROAS (total
  agregado do período, `getAccountInsights` já existente).
- **Gráfico de evolução diária**: linha/barra com gasto e resultado por dia
  no período (`getAccountInsightsDaily`, nova).
- **Funil de conversão**: 4 estágios fixos — Alcance → Cliques no link →
  Checkout iniciado → Resultado (métrica escolhida) — com % de queda entre
  estágios consecutivos.
- **Ranking de criativos**: reaproveita `getTopCreatives` (já existe, usado
  em Relatórios) — cards visuais com imagem/link do post, Top 1/3/5
  configurável na própria tela (não precisa ser salvo, é só visualização).

## Tratamento de erros

- Conta sem dado no período (ex: campanha pausada): mostra "Sem dados no
  período" ao invés de gráfico/funil vazio quebrado — mesmo padrão de
  fallback que `getAccountInsights` já retorna hoje (zeros) quando não há
  linha na resposta da Graph API.
- Falha ao buscar ranking de criativos: isolada, resto da tela carrega
  normalmente (mesmo princípio já aplicado em Relatórios).
- Falha ao buscar uma conta na Visão Geral (ex: token expirado, conta
  desativada): linha mostra erro inline, não derruba a tabela inteira.

## Testes

- `meta-insights.ts`: teste de `time_range` customizado e de
  `getAccountInsightsDaily` retornando série diária correta (reaproveitar
  mocks de Graph API já existentes nos testes de Relatórios).
- Componentes de gráfico/funil: verificação visual manual (não há suíte de
  teste de UI no projeto hoje).
