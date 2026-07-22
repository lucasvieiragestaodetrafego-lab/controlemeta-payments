// src/lib/meta-insights.test.ts
import { describe, it, expect } from "vitest";
import { buildPeriodParams, type PeriodSelection } from "./meta-insights";

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
