# Design — Relatórios de Métricas de Campanha (Meta Payments)

**Data:** 2026-07-21
**Status:** Aprovado, pronto para plano de implementação

## Contexto

O Meta Payments hoje monitora saldo/status de contas de anúncio e dispara
alertas no WhatsApp. O usuário quer expandir a ferramenta para também enviar
**relatórios de métricas de campanha** (investimento, cliques, conversões,
ranking de criativos), inspirado no concorrente Metrifiquei, com o objetivo de
futuramente vender o Meta Payments como produto para outras agências (não
nesta rodada — hoje é uso interno da CliniSales).

Duas frentes foram discutidas nesta sessão e são **projetos separados**:

1. **Conectar Google Ads** (acessos: Developer Token, MCC, OAuth) — depende de
   decisão em aberto sobre como tratar saldo pré-pago (API do Google Ads não
   expõe esse valor; usuário pausou essa decisão). Fora do escopo deste doc.
2. **Relatórios de Métricas** (este documento) — nova funcionalidade,
   entregue primeiro só para contas Meta (já conectado), com Google Ads
   entrando depois que a Fase 1 de acessos estiver pronta.

### Pesquisa de referência

Métricas e formato de mensagem foram levantados navegando a conta Metrifiquei
do usuário (leitura apenas, nada foi criado/salvo/enviado lá). Exemplo real de
mensagem de relatório (Meta Ads):

```
Bom dia, pessoal! Excelente semana todos!

Mineirinha - Caldas Novas

🔵 RELATÓRIO FACEBOOK/INSTAGRAM 🔵

📅 Período: Últimos 7 dias
Data: 13/07/2026 até 19/07/2026

🎯 Alcance: 32.541 pessoas foram alcançadas com seu anúncio
👆 Cliques: 395 pessoas interessadas em saber mais sobre seu produto
🚀 Conversões: 108 vendas realizadas no período
📱 Custo por Conversão: R$ 4,20
💰 Valor investido: R$ 453,60
21,85 Retorno sobre o Investimento.
R$ 91,76 Ticket Médio

🏆 1. [AD03]
Resultados: 78 | CPA: R$ 2,65 | CTR: 0,50 %
🔗 https://www.instagram.com/p/DaqCFjmg-4t/

🥈 2. AD007 - INFLU dia da pizza
Mensagens: 13 | CPA: R$ 1,28 | CTR: 0,55 %
🔗 https://www.instagram.com/p/DZxu1-bAzPi/

🥉 3. [AD03]
Resultados: 17 | CPA: R$ 6,03 | CTR: 0,48 %
🔗 https://www.instagram.com/p/DaqCFjmg-4t/
```

## Objetivos desta rodada

1. Renomear a área hoje chamada "Relatórios" (`/`, lista de contas com
   saldo/status) para **"Alertas"** — é o que ela já faz de fato.
2. Criar nova seção **"Relatórios"** (`/relatorios`): relatórios agendados de
   métricas de campanha, entregues por WhatsApp.
3. Coletar métricas de performance (Meta Ads Insights) e ranking de
   criativos, com mensagem totalmente personalizável por variáveis.
4. Reaproveitar a infraestrutura já existente (cron, Z-API, templates,
   modelo de "conta cadastrada") em vez de duplicar conceitos.

### Fora de escopo desta rodada

- Canal Google Ads nos Relatórios (entra quando a Fase 1 de acessos Google
  estiver pronta — arquivo `google-ads.ts` análogo ao `meta.ts`).
- Análise por IA (resumo automático) — Metrifiquei tem um toggle "Análise
  IA"; fica para uma rodada futura.
- Múltiplos blocos (contas/períodos diferentes) numa mesma mensagem —
  v1 é 1 conta por relatório.
- Miniatura de imagem do criativo no ranking — só nome, métricas e link.

## Modelo de dados

Nova tabela `metric_reports` (relatório de métricas — distinto de
`ad_accounts`, pois uma mesma conta pode ter mais de um relatório, ex: um
semanal para o cliente e outro mensal para a equipe interna):

```sql
create table metric_reports (
  id uuid primary key default gen_random_uuid(),
  ad_account_id uuid not null references ad_accounts(id) on delete cascade,
  name text not null,
  whatsapp_group_id text not null,
  frequency text not null,              -- 'daily' | 'weekly' | 'monthly'
  send_hour smallint not null default 9,
  period text not null default 'last_7_days', -- 'today' | 'last_7_days' | 'last_30_days' | 'current_month'
  message_template text not null,
  creative_ranking_size smallint,       -- null = sem ranking; 1, 3, 5, ou 0 = todos
  is_active boolean not null default true,
  next_send_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_metric_reports_account on metric_reports(ad_account_id);
create index idx_metric_reports_next_send on metric_reports(next_send_at) where is_active;
```

Nova tabela `report_log` (histórico de envio, espelhando `alerts_log`):

```sql
create table report_log (
  id uuid primary key default gen_random_uuid(),
  metric_report_id uuid not null references metric_reports(id) on delete cascade,
  message text not null,
  whatsapp_message_id text,
  sent_at timestamptz not null default now()
);

create index idx_report_log_report_time on report_log(metric_report_id, sent_at desc);
```

## Coleta de métricas

Novo arquivo `src/lib/meta-insights.ts` (ao lado de `meta.ts`):

- `getAccountInsights(adAccountId, period)`: busca `/act_.../insights` com
  `fields=spend,clicks,ctr,cpc,reach,actions,action_values,cost_per_action_type`
  e `date_preset` mapeado do `period` escolhido (hoje, últimos 7 dias,
  últimos 30 dias, mês atual). Calcula ROAS (`action_values / spend`) e
  ticket médio (`action_values / conversions`) quando aplicável — ambos
  dependem da campanha ter otimização de valor de conversão configurada;
  quando o dado não vier, a variável correspondente fica vazia/"—" na
  mensagem (não quebra o envio).
- `getTopCreatives(adAccountId, period, limit)`: mesma chamada com
  `level=ad`, ordenando pelo resultado principal (conversões, ou cliques se
  não houver conversão configurada) e retornando os top N com nome do
  anúncio, CPA, CTR e `effective_object_story_id`/permalink do post.

## Variáveis de mensagem

Seguindo o padrão `{chave}` já usado nos templates de alerta:

`{conta}` `{periodo}` `{data_inicio}` `{data_fim}` `{investimento}`
`{cliques}` `{alcance}` `{conversoes}` `{custo_por_conversao}` `{roas}`
`{ticket_medio}` `{top_criativos}` (bloco de texto já formatado, pronto para
colar na mensagem, com ranking + link de cada criativo).

## Interface

**Nova rota `/relatorios`:** tabela igual ao padrão visual da tela de Alertas
(nome, conta, destinatário, frequência, próximo envio, ações), com botão
"+ Novo relatório" abrindo modal com os passos:

1. Nome + conta de anúncio (lista de contas Meta já cadastradas em Alertas).
2. Métricas a incluir (checkboxes) + tamanho do ranking de criativos.
3. Mensagem personalizável a partir de um template padrão editável.
4. Destinatário WhatsApp + frequência + horário.

Ações por linha: liga/desliga, editar, excluir, "📨 Enviar agora" (dispara na
hora, reaproveitando o mesmo padrão do `forceSendAlert` já existente).

## Envio agendado

Estende o cron diário existente: nova função `sendScheduledReports()` em
`src/lib/check-reports.ts`, chamada do mesmo endpoint de cron
(`/api/cron/check-balances`, ou endpoint irmão), que:

1. Busca `metric_reports` ativos com `next_send_at <= now()`.
2. Para cada um, chama `getAccountInsights` (+ `getTopCreatives` se
   configurado), renderiza `message_template` com as variáveis, envia via
   `sendWhatsAppMessage` (já existe em `zapi.ts`), grava em `report_log` e
   atualiza `next_send_at` conforme a frequência.

## Testes

- Testes unitários de `meta-insights.ts` (mock da Graph API) cobrindo:
  cálculo de ROAS/ticket médio quando o dado existe e quando não existe;
  ordenação do ranking de criativos.
- Teste de `render()`/interpolação de variáveis (reaproveitando o padrão já
  testado em `check-balances.ts`, se houver).
- Teste de agendamento: `next_send_at` avança corretamente para
  diário/semanal/mensal após um envio.
