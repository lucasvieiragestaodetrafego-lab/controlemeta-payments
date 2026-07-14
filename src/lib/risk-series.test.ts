import { describe, it, expect } from "vitest";
import { buildRiskSeries } from "./risk-series";

const accounts = [
  { id: "a", isPrepay: true, alertThreshold: 100 },
  { id: "b", isPrepay: false, alertThreshold: 100 },
];

describe("buildRiskSeries", () => {
  it("retorna um ponto por dia na ordem cronológica", () => {
    const now = new Date("2026-01-03T12:00:00Z");
    const series = buildRiskSeries([], accounts, 3, now);
    expect(series.map((p) => p.date)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
    expect(series.every((p) => p.count === 0)).toBe(true);
  });

  it("conta a conta pré-paga como em risco quando o saldo fica abaixo do limite", () => {
    const now = new Date("2026-01-02T12:00:00Z");
    const snapshots = [
      // dia 1: conta 'a' com saldo cheio (não em risco)
      { adAccountId: "a", balance: 500, accountStatus: "ACTIVE", checkedAt: "2026-01-01T10:00:00Z" },
      // dia 2: conta 'a' cai para 50 (< 100 -> em risco)
      { adAccountId: "a", balance: 50, accountStatus: "ACTIVE", checkedAt: "2026-01-02T10:00:00Z" },
    ];
    const series = buildRiskSeries(snapshots, accounts, 2, now);
    expect(series).toEqual([
      { date: "2026-01-01", count: 0 },
      { date: "2026-01-02", count: 1 },
    ]);
  });

  it("usa o snapshot mais recente até o fim do dia, não posteriores", () => {
    const now = new Date("2026-01-01T23:59:00Z");
    const snapshots = [
      { adAccountId: "b", balance: null, accountStatus: "UNSETTLED", checkedAt: "2026-01-01T08:00:00Z" },
    ];
    const series = buildRiskSeries(snapshots, accounts, 1, now);
    expect(series).toEqual([{ date: "2026-01-01", count: 1 }]);
  });
});
