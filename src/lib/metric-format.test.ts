import { describe, it, expect } from "vitest";
import { formatMetricValue } from "./metric-format";

describe("formatMetricValue", () => {
  it("formata currency em pt-BR", () => {
    expect(formatMetricValue(1234.5, "currency")).toBe(
      (1234.5).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    );
  });

  it("formata count como inteiro", () => {
    expect(formatMetricValue(1234.7, "count")).toBe("1.235");
  });

  it("formata decimal com 2 casas", () => {
    expect(formatMetricValue(3.14159, "decimal")).toBe("3,14");
  });

  it("formata percent com símbolo %", () => {
    expect(formatMetricValue(2.5, "percent")).toBe("2,50%");
  });

  it("retorna travessão para valores null", () => {
    expect(formatMetricValue(null, "currency")).toBe("—");
    expect(formatMetricValue(null, "count")).toBe("—");
  });
});
