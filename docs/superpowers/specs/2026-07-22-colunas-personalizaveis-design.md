# Design — Colunas Personalizáveis do Dashboard (Meta Payments)

**Data:** 2026-07-22
**Status:** Rascunho — mapeamento de métricas concluído, UX e modelo de dados a validar com o usuário.

## Contexto

Pedido do usuário (recorrente desde antes da queda de energia de 2026-07-22,
que apagou o mapeamento feito numa sessão anterior — refeito nesta sessão):
o Dashboard visual (`/dashboard` e `/dashboard/[metaAccountId]`, ver
`docs/superpowers/plans/2026-07-21-dashboard-visual.md`) hoje mostra só 5
colunas fixas na visão geral (Conta, Gasto, Resultado, Custo por resultado,
ROAS). O usuário quer:

1. Poder **personalizar quais colunas de métricas aparecem**, com uma
   experiência de configuração **muito parecida com a do próprio Gerenciador
   de Anúncios do Meta** (modal "Personalizar colunas...": categorias,
   busca, lista de selecionados com drag-and-drop pra reordenar).
2. Ter acesso a **literalmente todas as métricas possíveis** do Meta Ads,
   incluindo **todas as métricas de vídeo** (não só as 10 conversões já
   rastreadas em `report-variables.ts`, que são usadas pelos Relatórios,
   não pelo Dashboard).

## Pesquisa — mapeamento feito no Gerenciador de Anúncios

Acessei `adsmanager.facebook.com` (conta `[CSS] <> OdontoGuará`) e abri o
modal **Personalizar colunas...** na visão de Campanhas. Leitura apenas —
nada foi alterado/salvo na conta do Meta. Abaixo, o catálogo completo tal
como o Meta organiza (aba "Principais métricas" + "Métricas de suporte";
a aba "Configurações de anúncios" só tem metadados não-métricos como nome,
programação, estratégia de lance — fora de escopo aqui).

### Resultados e investimento
- Resultados · Custo por resultado · ROAS de resultados · Índice de
  resultados · Valor dos resultados
- Valor usado (gasto) · Porcentagem do valor gasto

### Distribuição (alcance/impressões)
- Alcance · Frequência · CPM (custo por 1.000 impressões) · Impressões ·
  Custo por 1.000 Contas Meta alcançadas

### Vídeo (Reconhecimento/Mídia) — o usuário pediu explicitamente "todas"
- Reproduções de vídeo · ThruPlays · Custo por ThruPlay
- Reproduções do vídeo por no mínimo 3 segundos · Custo por reprodução de
  vídeo por no mínimo 3 segundos
- Reproduções contínuas únicas por no mínimo 2 segundos · Custo por
  reprodução contínua por no mínimo 2 segundos
- Reproduções contínuas por no mínimo 2 segundos
- Reproduções de vídeo: 25% · 50% · 75% · 95% · 100% (quartis, na aba
  "Métricas de suporte" → Mídia)
- Visualizadores

### Engajamento — Cliques
- Cliques (todos) · CPC (todos) · Cliques únicos (todos) · Custo por
  clique único (todos)
- Cliques no link · CTR (taxa de cliques no link) · CPC (custo por clique
  no link) · Cliques no link únicos · CTR único (taxa de cliques no link)
- CTR (todos) · CTR único (todos)
- Cliques na foto · Cliques na loja

### Engajamento — Tráfego
- Visualizações da página de destino · Custo por visualização da página
  de destino

### Engajamento — Seguidores e curtidas
- Curtidas do Facebook · Custo por curtida · Seguidores no Instagram

### Engajamento — Página/Post
- Engajamento com a Página · Custo por engajamento com a Página
- Engajamentos com o post · Custo por engajamento com o post
- Reações ao post · Comentários no post · Compartilhamentos do post ·
  Salvamentos do post
- Interações · Custo por interação
- Check-ins · Participações no evento · Custo por participação no evento
- Lembretes de rede ativados
- Solicitações para participar do grupo · Custo por solicitação para
  participar do grupo

### Mensagens
- Conversas por mensagem iniciadas · Custo por conversa por mensagem
  iniciada · Conversas por mensagem respondidas
- Novos contatos de mensagem · Custo por novo contato por mensagem ·
  Contatos por mensagem que retornam
- Assinaturas de mensagem · Custo por assinatura de mensagem ·
  Visualizações da mensagem de boas-vindas

### Conversões — Eventos padrão
- Conversões (total) · Valor · Custo
- Compras (com detalhamento: no app, no site, offline, na Meta) · Custo
  por compra
- Leads
- ROAS das compras · ROAS da doação

### Conversões — Eventos personalizados
- Lista dinâmica: eventos de conversão customizados configurados na conta
  (pixel/CAPI) — específico de cada cliente, não dá pra catalogar
  estaticamente; teríamos que buscar via Graph API por conta se quisermos
  suportar isso (fora do v1, ver "Fora de escopo").

### Diagnóstico (aba "Métricas de suporte", nível anúncio)
- Relevância do anúncio: Classificação da taxa de conversão, Classificação
  de qualidade, Classificação da taxa de engajamento
- Bloqueios (mensagens e ligações)

## Mapeamento para a Graph API (Insights)

A maioria dessas colunas do Ads Manager corresponde a campos do endpoint
`/insights` que já usamos em `meta-insights.ts`. Confirmar cada um durante a
implementação (Graph API versionada, nomes podem variar por breakdown), mas
o mapeamento esperado:

| Categoria Meta | Campo(s) Graph API |
|---|---|
| Alcance / Impressões / Frequência | `reach`, `impressions`, `frequency` |
| CPM / CPC / CTR (todos) | `cpm`, `cpc`, `ctr`, `clicks` |
| Cliques únicos / CTR único | `unique_clicks`, `unique_ctr` |
| Cliques no link | `inline_link_clicks`, `website_ctr` |
| Vídeo (plays, quartis, ThruPlay) | `video_play_actions`, `video_p25_watched_actions`, `video_p50_watched_actions`, `video_p75_watched_actions`, `video_p95_watched_actions`, `video_p100_watched_actions`, `video_thruplay_watched_actions`, `video_30_sec_watched_actions`, `video_avg_time_watched_actions`, `cost_per_thruplay` |
| Engajamento com post/página | `inline_post_engagement`, `actions` com tipos `post_reaction`, `comment`, `post`/`share`, `onsite_conversion.post_save`, `page_engagement` |
| Conversões (todos os tipos) | `actions` (por `action_type`) e `action_values`/`cost_per_action_type` para custo e valor por tipo — já é o padrão usado por `TRACKED_ACTIONS` em `report-variables.ts`, só que hoje limitado a 10 tipos |
| Mensagens | `actions` com tipos `onsite_conversion.messaging_conversation_started_7d`, `onsite_conversion.messaging_first_reply`, etc. |
| ROAS / Valor | `action_values`, `purchase_roas`, `website_purchase_roas` |

**Implicação prática:** dar suporte a "todas as métricas" de conversão (não
só as 10 hardcoded) significa não fixar uma lista estática de
`action_type`, e sim: (a) buscar `actions`/`action_values` sem lista de
tipos pré-definida, (b) apresentar ao usuário os `action_type` que
realmente aparecem nos dados retornados (com um label amigável quando
reconhecido, e o nome cru do Meta como fallback) — assim novas conversões
(ex: evento personalizado) aparecem automaticamente sem precisar alterar
código toda vez que o Meta lançar um novo tipo.

## UX — replicar o "Personalizar colunas" do Meta

Modal com:
- Busca por nome de métrica no topo.
- Abas/categorias iguais às listadas acima (Resultados, Gasto, Distribuição,
  Vídeo, Cliques, Página/Engajamento, Mensagens, Conversões — colapsáveis,
  contador "N selecionadas" por seção).
- Painel lateral direito: lista das colunas selecionadas, arrastável para
  reordenar, com botão de remover por item.
- Botões Cancelar / Salvar.
- Persistência por conta do dashboard (ou por usuário — a decidir) em nova
  coluna/tabela, análoga a `result_metric_key` em `dashboard_accounts`.

## Fora de escopo desta rodada

- Eventos de conversão personalizados (pixel/CAPI) dinâmicos por conta —
  possível v2.
- Diagnóstico de relevância de anúncio (nível anúncio, não conta/campanha)
  — o Dashboard atual trabalha em nível de conta, não de anúncio individual
  (exceto no ranking de criativos, que já tem seu próprio conjunto fixo de
  métricas).
- Breakdown por dispositivo/posicionamento/idade etc. — o pedido era sobre
  quais métricas aparecem, não sobre segmentação adicional.

## Próximo passo

Validar este catálogo e a UX com o usuário, depois escrever o plano de
implementação (`docs/superpowers/plans/`) seguindo o padrão de
`2026-07-21-dashboard-visual.md` (tarefas com TDD, uma por commit).
