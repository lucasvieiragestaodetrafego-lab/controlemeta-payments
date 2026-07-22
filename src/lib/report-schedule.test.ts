import { describe, it, expect } from "vitest";
import { computeNextSendAt } from "./report-schedule";

describe("computeNextSendAt", () => {
  it("avança 1 dia para frequência diária, no horário configurado", () => {
    const from = new Date("2026-07-21T09:15:00Z");
    const next = computeNextSendAt("daily", 9, 0, from);
    expect(next.toISOString()).toBe("2026-07-22T09:00:00.000Z");
  });

  it("avança 7 dias para frequência semanal", () => {
    const from = new Date("2026-07-21T09:15:00Z");
    const next = computeNextSendAt("weekly", 9, 0, from);
    expect(next.toISOString()).toBe("2026-07-28T09:00:00.000Z");
  });

  it("avança 1 mês para frequência mensal", () => {
    const from = new Date("2026-07-21T09:15:00Z");
    const next = computeNextSendAt("monthly", 9, 0, from);
    expect(next.toISOString()).toBe("2026-08-21T09:00:00.000Z");
  });

  it("respeita o minuto configurado", () => {
    const from = new Date("2026-07-21T09:15:00Z");
    const next = computeNextSendAt("daily", 18, 8, from);
    expect(next.toISOString()).toBe("2026-07-22T18:08:00.000Z");
  });
});
