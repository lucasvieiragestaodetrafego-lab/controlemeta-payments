import { describe, it, expect } from "vitest";
import { METRIC_CATALOG, findMetric, metricsByCategory } from "./metrics-catalog";
import { TRACKED_ACTIONS } from "./report-variables";

describe("METRIC_CATALOG", () => {
  it("não tem chaves duplicadas", () => {
    const keys = METRIC_CATALOG.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("inclui métricas de vídeo cobrindo todos os quartis", () => {
    const keys = METRIC_CATALOG.map((m) => m.key);
    expect(keys).toEqual(
      expect.arrayContaining(["video_p25", "video_p50", "video_p75", "video_p95", "video_p100"]),
    );
  });

  it("gera 3 métricas (contagem, custo, valor) para cada TRACKED_ACTION", () => {
    const compras = METRIC_CATALOG.filter((m) => m.key === "compras" || m.key === "custo_por_compra" || m.key === "valor_compras");
    expect(compras).toHaveLength(3);
  });
});

describe("findMetric", () => {
  it("encontra uma métrica pela chave", () => {
    expect(findMetric("alcance")?.label).toBe("Alcance");
  });

  it("retorna undefined para chave desconhecida", () => {
    expect(findMetric("nao_existe")).toBeUndefined();
  });
});

describe("metricsByCategory", () => {
  it("agrupa todas as métricas do catálogo, sem perder nenhuma", () => {
    const grouped = metricsByCategory();
    const total = grouped.reduce((sum, g) => sum + g.metrics.length, 0);
    expect(total).toBe(METRIC_CATALOG.length);
  });

  it("cada grupo tem pelo menos uma métrica", () => {
    const grouped = metricsByCategory();
    for (const g of grouped) {
      expect(g.metrics.length).toBeGreaterThan(0);
    }
  });
});

describe("Resultados e investimento", () => {
  it("inclui gasto, resultado e custo_por_resultado", () => {
    const keys = METRIC_CATALOG.map((m) => m.key);
    expect(keys).toEqual(expect.arrayContaining(["gasto", "resultado", "custo_por_resultado"]));
  });

  it("resultado e custo_por_resultado são pseudo-métricas (sem fonte de dado real)", () => {
    expect(findMetric("resultado")?.source).toEqual({ kind: "pseudo" });
    expect(findMetric("custo_por_resultado")?.source).toEqual({ kind: "pseudo" });
  });

  it("gasto é uma métrica real (campo escalar spend)", () => {
    expect(findMetric("gasto")?.source).toEqual({ kind: "scalar", field: "spend" });
  });
});

describe("objectiveKey nas métricas de custo por resultado rastreado", () => {
  it("toda métrica custo_por_X gerada de TRACKED_ACTIONS tem objectiveKey igual à chave rastreada", () => {
    for (const tracked of TRACKED_ACTIONS) {
      const metric = findMetric(tracked.costKey);
      expect(metric?.source).toEqual({
        kind: "cost_per",
        countField: "actions",
        countActionTypes: tracked.actionTypes,
        objectiveKey: tracked.key,
      });
    }
  });

  it("cpc_link tem objectiveKey cliques_link", () => {
    expect(findMetric("cpc_link")?.source).toEqual({
      kind: "cost_per",
      countField: "inline_link_clicks",
      objectiveKey: "cliques_link",
    });
  });
});
