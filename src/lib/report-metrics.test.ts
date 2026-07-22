import { describe, it, expect } from "vitest";
import {
  sumActionValue,
  computeRoas,
  computeTicketMedio,
  rankCreatives,
  formatCreativeRankingText,
  type CreativeInsight,
} from "./report-metrics";

describe("sumActionValue", () => {
  it("soma os valores dos tipos de ação informados", () => {
    const actions = [
      { action_type: "purchase", value: "10" },
      { action_type: "purchase", value: "5" },
      { action_type: "lead", value: "100" },
    ];
    expect(sumActionValue(actions, ["purchase"])).toBe(15);
  });

  it("retorna 0 quando não há ações ou não bate nenhum tipo", () => {
    expect(sumActionValue(undefined, ["purchase"])).toBe(0);
    expect(sumActionValue([{ action_type: "lead", value: "10" }], ["purchase"])).toBe(0);
  });

  it("soma todos os valores quando nenhum tipo é informado", () => {
    const actions = [
      { action_type: "video_view", value: "10" },
      { action_type: "video_view", value: "7" },
    ];
    expect(sumActionValue(actions)).toBe(17);
    expect(sumActionValue(actions, [])).toBe(17);
  });
});

describe("computeRoas", () => {
  it("calcula valor da conversão dividido pelo investimento", () => {
    expect(computeRoas(100, 2185)).toBeCloseTo(21.85);
  });

  it("retorna null quando o investimento é 0", () => {
    expect(computeRoas(0, 100)).toBeNull();
  });
});

describe("computeTicketMedio", () => {
  it("calcula valor da conversão dividido pela quantidade de conversões", () => {
    expect(computeTicketMedio(9176, 100)).toBeCloseTo(91.76);
  });

  it("retorna null quando não há conversões", () => {
    expect(computeTicketMedio(100, 0)).toBeNull();
  });
});

describe("rankCreatives", () => {
  const base: CreativeInsight = {
    adId: "1",
    adName: "A",
    permalink: null,
    conversions: 0,
    clicks: 0,
    ctr: 0,
    cpa: null,
  };

  it("ordena por conversões decrescente e corta no limite", () => {
    const rows: CreativeInsight[] = [
      { ...base, adId: "1", adName: "AD01", conversions: 10 },
      { ...base, adId: "2", adName: "AD02", conversions: 78 },
      { ...base, adId: "3", adName: "AD03", conversions: 17 },
    ];
    const ranked = rankCreatives(rows, 2);
    expect(ranked.map((r) => r.adId)).toEqual(["2", "3"]);
  });

  it("usa cliques como critério de desempate/fallback quando conversões são todas 0", () => {
    const rows: CreativeInsight[] = [
      { ...base, adId: "1", adName: "AD01", conversions: 0, clicks: 5 },
      { ...base, adId: "2", adName: "AD02", conversions: 0, clicks: 20 },
    ];
    const ranked = rankCreatives(rows, 2);
    expect(ranked.map((r) => r.adId)).toEqual(["2", "1"]);
  });
});

describe("formatCreativeRankingText", () => {
  it("monta o bloco de texto com medalhas, métricas e link", () => {
    const ranked: CreativeInsight[] = [
      {
        adId: "1",
        adName: "[AD03]",
        permalink: "https://www.instagram.com/p/DaqCFjmg-4t/",
        conversions: 78,
        clicks: 200,
        ctr: 0.5,
        cpa: 2.65,
      },
    ];
    const text = formatCreativeRankingText(ranked, "Resultados");
    expect(text).toContain("🏆 1. [AD03]");
    expect(text).toContain("Resultados: 78");
    expect(text).toContain("CPA: R$ 2,65");
    expect(text).toContain("CTR: 0,50 %");
    expect(text).toContain("https://www.instagram.com/p/DaqCFjmg-4t/");
  });

  it("omite a linha de link quando não há permalink", () => {
    const ranked: CreativeInsight[] = [
      { adId: "1", adName: "AD01", permalink: null, conversions: 5, clicks: 10, ctr: 1, cpa: 1 },
    ];
    const text = formatCreativeRankingText(ranked, "Resultados");
    expect(text).not.toContain("🔗");
  });
});
