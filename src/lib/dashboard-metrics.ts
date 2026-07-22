// Motor genérico que liga o catálogo declarativo de metrics-catalog.ts à
// Graph API: monta os `fields` a pedir e extrai o valor de cada métrica de
// uma linha crua de /insights. Módulo puro — sem fetch — testável sem rede.
import { sumActionValue, computeRoas, computeTicketMedio, type InsightAction } from "./report-metrics";
import { findMetric, type MetricDefinition, type MetricSource } from "./metrics-catalog";

export type GraphInsightRow = Record<string, string | InsightAction[] | undefined>;

/** Lê um campo da linha: se for uma lista de ações, soma (filtrando por tipo, se informado); se for escalar, converte pra número. */
export function resolveFieldValue(row: GraphInsightRow, field: string, actionTypes?: string[]): number {
  const raw = row[field];
  if (Array.isArray(raw)) return sumActionValue(raw, actionTypes);
  return Number(raw ?? 0);
}

function fieldsForSource(source: MetricSource): string[] {
  switch (source.kind) {
    case "scalar":
      return [source.field];
    case "action_sum":
      return [source.field];
    case "cost_per":
      return ["spend", source.countField];
    case "rate":
      return [source.numeratorField, source.denominatorField];
    case "roas":
      return ["actions", "action_values"];
    case "ticket_medio":
      return ["actions", "action_values"];
  }
}

/**
 * Monta a lista de campos da Graph API necessários para buscar as métricas
 * pedidas, sempre incluindo "spend", sem duplicatas. `catalog` é injetável
 * (usado pelos testes); em produção, os chamadores usam o catálogo real.
 */
export function buildMetricFields(metricKeys: string[], catalog?: MetricDefinition[]): string[] {
  const fields = new Set<string>(["spend"]);
  for (const key of metricKeys) {
    const metric = catalog ? catalog.find((m) => m.key === key) : findMetric(key);
    if (!metric) continue;
    for (const field of fieldsForSource(metric.source)) fields.add(field);
  }
  return [...fields];
}

/** Extrai o valor de uma métrica específica de uma linha crua. Retorna null quando o denominador/contagem é 0 (evita divisão por zero). */
export function extractMetricValue(row: GraphInsightRow, metric: MetricDefinition): number | null {
  const { source } = metric;
  switch (source.kind) {
    case "scalar":
      return resolveFieldValue(row, source.field);
    case "action_sum":
      return resolveFieldValue(row, source.field, source.actionTypes);
    case "cost_per": {
      const spend = resolveFieldValue(row, "spend");
      const count = resolveFieldValue(row, source.countField, source.countActionTypes);
      return count > 0 ? spend / count : null;
    }
    case "rate": {
      const numerator = resolveFieldValue(row, source.numeratorField, source.numeratorActionTypes);
      const denominator = resolveFieldValue(row, source.denominatorField, source.denominatorActionTypes);
      return denominator > 0 ? (numerator / denominator) * source.multiplier : null;
    }
    case "roas": {
      const spend = resolveFieldValue(row, "spend");
      const value = resolveFieldValue(row, "action_values", source.actionTypes);
      return computeRoas(spend, value);
    }
    case "ticket_medio": {
      const count = resolveFieldValue(row, "actions", source.actionTypes);
      const value = resolveFieldValue(row, "action_values", source.actionTypes);
      return computeTicketMedio(value, count);
    }
  }
}

/** Extrai todas as métricas pedidas de uma linha crua. Chaves desconhecidas no catálogo são ignoradas silenciosamente. */
export function extractMetricValues(row: GraphInsightRow, metricKeys: string[]): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  for (const key of metricKeys) {
    const metric = findMetric(key);
    if (!metric) continue;
    result[key] = extractMetricValue(row, metric);
  }
  return result;
}
