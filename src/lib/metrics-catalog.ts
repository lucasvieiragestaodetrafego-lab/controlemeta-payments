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
