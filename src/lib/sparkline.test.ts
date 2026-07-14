import { describe, it, expect } from "vitest";
import { sparklinePoints } from "./sparkline";

describe("sparklinePoints", () => {
  it("lista vazia retorna string vazia", () => {
    expect(sparklinePoints([], 100, 20)).toBe("");
  });

  it("um único valor vira linha reta no meio", () => {
    expect(sparklinePoints([5], 100, 20)).toBe("0,10 100,10");
  });

  it("valores iguais viram linha reta no meio", () => {
    expect(sparklinePoints([3, 3, 3], 100, 20)).toBe("0,10 50,10 100,10");
  });

  it("crescente: primeiro no fundo, último no topo", () => {
    // 3 pontos, largura 100 -> x = 0, 50, 100; altura 20 -> y de 20 (min) a 0 (max)
    expect(sparklinePoints([0, 5, 10], 100, 20)).toBe("0,20 50,10 100,0");
  });
});
