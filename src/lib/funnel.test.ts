import { describe, it, expect } from "vitest";
import { computeFunnelSteps } from "./funnel";

describe("computeFunnelSteps", () => {
  it("calcula percentual do primeiro estágio e queda entre estágios consecutivos", () => {
    const result = computeFunnelSteps([
      { label: "Alcance", value: 1000 },
      { label: "Cliques", value: 400 },
      { label: "Checkout", value: 100 },
      { label: "Compra", value: 50 },
    ]);
    expect(result[0]).toEqual({ label: "Alcance", value: 1000, percentOfFirst: 100, dropFromPrevious: null });
    expect(result[1]).toEqual({ label: "Cliques", value: 400, percentOfFirst: 40, dropFromPrevious: 60 });
    expect(result[3]).toEqual({ label: "Compra", value: 50, percentOfFirst: 5, dropFromPrevious: 50 });
  });

  it("não quebra com primeiro estágio zerado (percentOfFirst vira 0, sem dividir por zero)", () => {
    const result = computeFunnelSteps([
      { label: "Alcance", value: 0 },
      { label: "Cliques", value: 0 },
    ]);
    expect(result[0].percentOfFirst).toBe(0);
    expect(result[1].percentOfFirst).toBe(0);
    expect(result[1].dropFromPrevious).toBeNull();
  });
});
