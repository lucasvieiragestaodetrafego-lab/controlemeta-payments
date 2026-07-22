import { describe, it, expect } from "vitest";
import {
  resolveFieldValue,
  buildMetricFields,
  extractMetricValue,
  extractMetricValues,
  type GraphInsightRow,
} from "./dashboard-metrics";
import type { MetricDefinition } from "./metrics-catalog";

describe("resolveFieldValue", () => {
  it("lê um campo escalar", () => {
    expect(resolveFieldValue({ reach: "1234" }, "reach")).toBe(1234);
  });

  it("retorna 0 quando o campo escalar não existe", () => {
    expect(resolveFieldValue({}, "reach")).toBe(0);
  });

  it("soma um campo de lista de ações, filtrando por tipo", () => {
    const row: GraphInsightRow = {
      actions: [
        { action_type: "purchase", value: "3" },
        { action_type: "lead", value: "100" },
      ],
    };
    expect(resolveFieldValue(row, "actions", ["purchase"])).toBe(3);
  });

  it("soma tudo de um campo de lista de ações quando não filtra por tipo", () => {
    const row: GraphInsightRow = { video_play_actions: [{ action_type: "video_view", value: "50" }] };
    expect(resolveFieldValue(row, "video_play_actions")).toBe(50);
  });
});

describe("buildMetricFields", () => {
  it("inclui sempre spend, e os campos de cada métrica, sem duplicar", () => {
    const scalarMetric: MetricDefinition = {
      key: "alcance",
      label: "Alcance",
      category: "Distribuição",
      valueKind: "count",
      source: { kind: "scalar", field: "reach" },
    };
    const costMetric: MetricDefinition = {
      key: "custo_link",
      label: "Custo por clique no link",
      category: "Distribuição",
      valueKind: "currency",
      source: { kind: "cost_per", countField: "inline_link_clicks" },
    };
    const fields = buildMetricFields(["alcance", "custo_link"], [scalarMetric, costMetric]);
    expect(fields).toEqual(expect.arrayContaining(["spend", "reach", "inline_link_clicks"]));
    expect(new Set(fields).size).toBe(fields.length);
  });

  it("inclui numerador e denominador de métricas do tipo rate", () => {
    const rateMetric: MetricDefinition = {
      key: "ctr_link",
      label: "CTR link",
      category: "Distribuição",
      valueKind: "percent",
      source: { kind: "rate", numeratorField: "inline_link_clicks", denominatorField: "impressions", multiplier: 100 },
    };
    const fields = buildMetricFields(["ctr_link"], [rateMetric]);
    expect(fields).toEqual(expect.arrayContaining(["inline_link_clicks", "impressions"]));
  });

  it("inclui actions e action_values para métricas roas/ticket_medio", () => {
    const roasMetric: MetricDefinition = {
      key: "roas_compras",
      label: "ROAS",
      category: "ROAS e ticket médio",
      valueKind: "decimal",
      source: { kind: "roas", actionTypes: ["purchase"] },
    };
    const fields = buildMetricFields(["roas_compras"], [roasMetric]);
    expect(fields).toEqual(expect.arrayContaining(["actions", "action_values"]));
  });
});

describe("extractMetricValue", () => {
  it("resolve uma métrica scalar", () => {
    const metric: MetricDefinition = { key: "alcance", label: "Alcance", category: "Distribuição", valueKind: "count", source: { kind: "scalar", field: "reach" } };
    expect(extractMetricValue({ reach: "500" }, metric)).toBe(500);
  });

  it("resolve uma métrica cost_per, null quando a contagem é 0", () => {
    const metric: MetricDefinition = { key: "cpc_link", label: "CPC link", category: "Distribuição", valueKind: "currency", source: { kind: "cost_per", countField: "inline_link_clicks" } };
    expect(extractMetricValue({ spend: "100", inline_link_clicks: "20" }, metric)).toBe(5);
    expect(extractMetricValue({ spend: "100", inline_link_clicks: "0" }, metric)).toBeNull();
  });

  it("resolve uma métrica rate, null quando o denominador é 0", () => {
    const metric: MetricDefinition = { key: "ctr_link", label: "CTR link", category: "Distribuição", valueKind: "percent", source: { kind: "rate", numeratorField: "inline_link_clicks", denominatorField: "impressions", multiplier: 100 } };
    expect(extractMetricValue({ inline_link_clicks: "10", impressions: "1000" }, metric)).toBe(1);
    expect(extractMetricValue({ inline_link_clicks: "10", impressions: "0" }, metric)).toBeNull();
  });

  it("resolve roas e ticket_medio a partir de actions/action_values", () => {
    const row: GraphInsightRow = {
      spend: "100",
      actions: [{ action_type: "purchase", value: "4" }],
      action_values: [{ action_type: "purchase", value: "500" }],
    };
    const roas: MetricDefinition = { key: "roas_compras", label: "ROAS", category: "ROAS e ticket médio", valueKind: "decimal", source: { kind: "roas", actionTypes: ["purchase"] } };
    const ticket: MetricDefinition = { key: "ticket_medio_compras", label: "Ticket médio", category: "ROAS e ticket médio", valueKind: "currency", source: { kind: "ticket_medio", actionTypes: ["purchase"] } };
    expect(extractMetricValue(row, roas)).toBe(5);
    expect(extractMetricValue(row, ticket)).toBe(125);
  });
});

describe("extractMetricValues", () => {
  it("monta um mapa chave -> valor para as métricas pedidas, ignorando chaves desconhecidas", () => {
    const row: GraphInsightRow = { reach: "10", impressions: "100" };
    const result = extractMetricValues(row, ["alcance", "chave_inexistente"]);
    expect(result).toEqual({ alcance: 10 });
  });
});
