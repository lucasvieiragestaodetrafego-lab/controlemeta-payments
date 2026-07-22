import { describe, it, expect } from "vitest";
import { METRIC_CATALOG, findMetric, metricsByCategory } from "./metrics-catalog";

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
