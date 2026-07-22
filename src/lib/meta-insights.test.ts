// src/lib/meta-insights.test.ts
import { describe, it, expect } from "vitest";
import { buildPeriodParams, parseDailyRows, type PeriodSelection } from "./meta-insights";

describe("buildPeriodParams", () => {
  it("monta date_preset para seleção do tipo preset", () => {
    const selection: PeriodSelection = { type: "preset", period: "last_7_days" };
    expect(buildPeriodParams(selection)).toEqual({ date_preset: "last_7d" });
  });

  it("monta time_range para seleção do tipo custom", () => {
    const selection: PeriodSelection = { type: "custom", since: "2026-07-01", until: "2026-07-15" };
    expect(buildPeriodParams(selection)).toEqual({
      time_range: JSON.stringify({ since: "2026-07-01", until: "2026-07-15" }),
    });
  });
});

describe("parseDailyRows", () => {
  it("converte linhas cruas em pontos {date, spend, result}, ordenados por data", () => {
    const rows = [
      {
        date_start: "2026-07-02",
        spend: "50",
        actions: [{ action_type: "purchase", value: "3" }],
      },
      {
        date_start: "2026-07-01",
        spend: "30",
        actions: [{ action_type: "purchase", value: "1" }],
      },
    ];
    const result = parseDailyRows(rows, ["purchase", "omni_purchase"]);
    expect(result).toEqual([
      { date: "2026-07-01", spend: 30, result: 1 },
      { date: "2026-07-02", spend: 50, result: 3 },
    ]);
  });

  it("retorna resultado 0 quando não há ações do tipo procurado", () => {
    const rows = [{ date_start: "2026-07-01", spend: "10", actions: [] }];
    expect(parseDailyRows(rows, ["purchase"])).toEqual([{ date: "2026-07-01", spend: 10, result: 0 }]);
  });
});
