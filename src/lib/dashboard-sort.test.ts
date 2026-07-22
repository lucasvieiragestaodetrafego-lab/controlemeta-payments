// src/lib/dashboard-sort.test.ts
import { describe, it, expect } from "vitest";
import { sortOverviewRows } from "./dashboard-sort";

const rows = [
  { name: "Conta C", spend: 300, resultValue: 10, costPerResult: 30, roas: 1.5 },
  { name: "Conta A", spend: 100, resultValue: 5, costPerResult: 20, roas: null },
  { name: "Conta B", spend: 200, resultValue: 8, costPerResult: null, roas: 3 },
];

describe("sortOverviewRows", () => {
  it("ordena numericamente por gasto, decrescente", () => {
    const result = sortOverviewRows(rows, "spend", "desc");
    expect(result.map((r) => r.name)).toEqual(["Conta C", "Conta B", "Conta A"]);
  });

  it("ordena alfabeticamente por nome, crescente", () => {
    const result = sortOverviewRows(rows, "name", "asc");
    expect(result.map((r) => r.name)).toEqual(["Conta A", "Conta B", "Conta C"]);
  });

  it("manda valores null pro fim independente da direção", () => {
    const asc = sortOverviewRows(rows, "roas", "asc");
    expect(asc[asc.length - 1].name).toBe("Conta A");
    const desc = sortOverviewRows(rows, "roas", "desc");
    expect(desc[desc.length - 1].name).toBe("Conta A");
  });

  it("não muta o array original", () => {
    const copy = [...rows];
    sortOverviewRows(rows, "spend", "asc");
    expect(rows).toEqual(copy);
  });
});
