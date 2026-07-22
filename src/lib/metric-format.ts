import type { MetricValueKind } from "./metrics-catalog";

/** Formata o valor de uma métrica do catálogo pro formato de exibição pt-BR correspondente ao seu tipo. */
export function formatMetricValue(value: number | null, valueKind: MetricValueKind): string {
  if (value == null) return "—";
  switch (valueKind) {
    case "currency":
      return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    case "count":
      return Math.round(value).toLocaleString("pt-BR");
    case "decimal":
      return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "percent":
      return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  }
}
