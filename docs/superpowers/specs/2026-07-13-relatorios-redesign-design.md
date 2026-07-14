# Design — Reorganização da página de Relatórios (Meta Payments)

**Data:** 2026-07-13
**Status:** Aprovado, pronto para plano de implementação

## Contexto

O Meta Payments monitora o saldo de contas de anúncio (hoje só Meta Ads) e
dispara alertas no WhatsApp via Z-API quando o saldo fica abaixo de um limite.

No vocabulário do usuário, "relatório" = um alerta de saldo = **uma conta
monitorada** (uma linha da tabela). A página inicial "Alertas de saldo"
(`src/app/(app)/page.tsx` + `AccountsTable.tsx`) é a "página de relatórios".

### Problema atual

- A página `/settings` (Configurações) lista **um formulário grande por conta**
  (nome, grupo WhatsApp, limite, mensagem, automação). Com muitas contas fica
  visualmente poluído.
- A criação de "relatórios" (form "Nova automação") também vive em Configurações.
- A página de relatórios é uma tabela puramente textual, sem apelo visual e sem
  usar o histórico de saldo já coletado em `balance_snapshots`.
- Não há distinção de plataforma — há intenção futura de adicionar Google Ads.

## Objetivos desta rodada

1. Concentrar **criação e edição de relatórios** na página de Relatórios, via
   **modais (pop-up)** — tirando a edição conta-a-conta de Configurações.
2. Adicionar coluna **Plataforma** (Meta hoje; Google Ads no futuro) já preparada
   no banco.
3. Deixar a página **mais bonita e funcional** com gráficos que aproveitam o
   histórico de saldo.
4. Repropor **Configurações** como "Integrações + padrões globais".

### Fora de escopo

- Integração real com a API do Google Ads. Nesta rodada entra apenas a coluna
  `platform` e um slot "em breve" na tela de Integrações. A coleta de saldo do
  Google é um projeto separado posterior.

## Design

### 1. Página de Relatórios (`src/app/(app)/page.tsx`) — hub central

Estrutura de cima para baixo:

1. **Cabeçalho** com título e ações: `+ Novo relatório` (abre modal) e
   `Atualizar agora` (já existe). Um **toggle Tabela ⇄ Cards** no canto direito.
2. **Cards de resumo** (já existem): Total, Ativas, Em risco, Automação.
3. **Gráfico do topo (novo):** "Contas em risco ao longo do tempo" — série
   temporal diária contando quantas contas estavam em risco
   (baixo/travada/problema) em cada dia. Métrica escolhida por ser
   currency-agnostic (não soma moedas diferentes) e por refletir a pergunta de
   negócio real ("a situação está piorando?").
4. **Lista de contas**, em um de dois modos alternáveis:
   - **Tabela** (default, layout A): colunas Conta, **Plataforma**, Saldo,
     **Tendência (sparkline)**, Situação, Gestor, Automação, Ações (Editar).
   - **Cards** (layout C): grade de cartões, um por conta, com saldo grande,
     sparkline, badge de plataforma, situação e Editar. Melhor em telas pequenas.
   - A preferência do modo é persistida em `localStorage` (client-side).

### 2. Modais de criar e editar

- **`+ Novo relatório`** abre um modal com o fluxo atual de "Nova automação"
  (hoje em `NovaAutomacaoSection` / `NewAutomationForm`): escolher a conta do
  Meta, definir limite, grupo WhatsApp, mensagem e automação. O componente de
  criação é movido/reaproveitado dentro do modal.
- **`Editar`** (por linha/card) abre um modal com os campos hoje presentes no
  form de `/settings`: nome, grupo/telefone WhatsApp, limite, mensagem
  personalizada, gestor e automação on/off. **Salvar** chama a server action
  `updateAccount` (já existente), fecha o modal e a lista reflete a mudança.
- O modal é um client component reutilizável (mesma casca para criar e editar).
- Comportamento: fecha no Salvar bem-sucedido, no botão Cancelar, no `Esc` e no
  clique fora. Estados de carregando/erro visíveis dentro do modal.

### 3. Coluna Plataforma + banco

- Nova migration `supabase/migrations/0002_platform.sql`:
  `alter table ad_accounts add column platform text not null default 'meta';`
  Valores previstos: `'meta'`, `'google'`.
- A UI exibe um badge por plataforma (ex.: ponto azul "Meta"). Todas as contas
  existentes assumem `meta` pelo default.
- A criação de conta grava `platform = 'meta'` explicitamente por enquanto.

### 4. Gráficos e dados

- **Sparkline por conta:** carregar os snapshots recentes (ex.: últimos 14 dias)
  de cada conta a partir de `balance_snapshots` e renderizar uma minilinha SVG.
- **Gráfico do topo:** série diária de "nº de contas em risco". Calculada a
  partir do histórico de `balance_snapshots` reaplicando a lógica de
  `getSituacao` (`src/lib/account-status.ts`) sobre o snapshot mais recente de
  cada conta por dia, comparado ao `alert_threshold` da conta.
- Renderização de gráficos com **SVG inline** (sem nova dependência de lib de
  chart, mantendo o bundle enxuto e coerente com o stack atual). Reavaliar só se
  a complexidade justificar.
- **Nota de UX:** sparklines e o gráfico do topo dependem de histórico
  acumulado; nos primeiros dias aparecem curtos/achatados. Comportamento
  esperado — exibir um estado vazio amigável quando não houver dados suficientes.

### 5. Configurações → "Integrações + padrões globais"

`src/app/(app)/settings/page.tsx` deixa de listar formulários conta-a-conta e
passa a conter:

- **Padrões globais:** grupo WhatsApp padrão, limite padrão, template de mensagem
  padrão (usados como valores iniciais ao criar um novo relatório).
- **Integrações / Plataformas:** Meta (conectado) e Google Ads (slot "em breve",
  sem funcionalidade nesta rodada).

O form "Nova automação" sai daqui (foi para o modal na página de Relatórios).

## Componentes afetados (mapa de alto nível)

- `src/app/(app)/page.tsx` — orquestra cards, gráfico do topo, dados de sparkline
  e passa tudo para a tabela/cards.
- `src/app/AccountsTable.tsx` — ganha coluna Plataforma, sparkline, botão Editar,
  toggle Tabela/Cards e o modo Cards.
- **Novo** componente de modal reutilizável (criar/editar).
- **Novo** componente de gráfico do topo (SVG) e de sparkline (SVG).
- `src/app/(app)/settings/page.tsx` — repropósito para integrações + padrões.
- `NovaAutomacaoSection` / `NewAutomationForm` — reaproveitados dentro do modal
  de criação.
- `supabase/migrations/0002_platform.sql` — nova coluna `platform`.
- `src/app/actions.ts` — `updateAccount` já existe; ajustar se necessário para o
  fluxo de modal e para gravar `platform` na criação.

## Critérios de sucesso

- Criar e editar um relatório sem sair da página de Relatórios, via modal que
  fecha ao salvar.
- Configurações não contém mais edição conta-a-conta; contém padrões globais e
  integrações.
- Tabela mostra a coluna Plataforma (todas "Meta") e um sparkline por conta.
- Existe um gráfico de "contas em risco ao longo do tempo" no topo.
- Alternar entre Tabela e Cards funciona e a preferência persiste.
- Estados vazios de gráfico tratados quando não há histórico suficiente.
