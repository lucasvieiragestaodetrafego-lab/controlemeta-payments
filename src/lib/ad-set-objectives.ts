import { sumActionValue, type InsightAction } from "./report-metrics";

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
    const actionTypes = actionTypesByKey[actionKey];
    if (!actionTypes) continue;
    const current = byActionKey[actionKey] ?? { spend: 0, count: 0, value: 0 };
    byActionKey[actionKey] = {
      spend: current.spend + row.spend,
      count: current.count + sumActionValue(row.actions, actionTypes),
      value: current.value + sumActionValue(row.actionValues, actionTypes),
    };
  }

  return { distinctActionKeys: Object.keys(byActionKey), byActionKey };
}
