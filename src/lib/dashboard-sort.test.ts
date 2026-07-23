import { describe, it, expect } from "vitest";
import { sortOverviewRows, type SortableRow } from "./dashboard-sort";

const rows: SortableRow[] = [
  { name: "Conta C", values: { spend: 300, resultValue: 10, roas: 1.5 } },
  { name: "Conta A", values: { spend: 100, resultValue: 5, roas: null } },
  { name: "Conta B", values: { spend: 200, resultValue: 8, roas: 3 } },
];

describe("sortOverviewRows", () => {
  it("ordena numericamente por uma chave de values, decrescente", () => {
    const result = sortOverviewRows(rows, "spend", "desc");
    expect(result.map((r) => r.name)).toEqual(["Conta C", "Conta B", "Conta A"]);
  });

  it("ordena alfabeticamente por name, crescente", () => {
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

  it("ordena por qualquer chave dinâmica presente em values (ex: uma coluna do catálogo)", () => {
    const dynamicRows: SortableRow[] = [
      { name: "X", values: { video_p25: 40 } },
      { name: "Y", values: { video_p25: 10 } },
      { name: "Z", values: { video_p25: 25 } },
    ];
    const result = sortOverviewRows(dynamicRows, "video_p25", "asc");
    expect(result.map((r) => r.name)).toEqual(["Y", "Z", "X"]);
  });

  it("chave ausente em values é tratada como null (vai pro fim)", () => {
    const partialRows: SortableRow[] = [
      { name: "X", values: { video_p25: 40 } },
      { name: "Y", values: {} },
    ];
    const result = sortOverviewRows(partialRows, "video_p25", "desc");
    expect(result.map((r) => r.name)).toEqual(["X", "Y"]);
  });
});
