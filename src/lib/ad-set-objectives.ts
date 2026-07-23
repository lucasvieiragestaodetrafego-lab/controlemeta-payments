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
