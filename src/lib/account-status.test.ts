import { describe, it, expect } from "vitest";
import { getSituacao, isAtRisk } from "./account-status";

describe("isAtRisk", () => {
  it("conta ativa não está em risco", () => {
    expect(isAtRisk(getSituacao("ACTIVE", false, null))).toBe(false);
  });

  it("conta travada por pagamento está em risco", () => {
    expect(isAtRisk(getSituacao("UNSETTLED", false, null))).toBe(true);
  });

  it("pré-paga com saldo abaixo do limite está em risco", () => {
    expect(isAtRisk(getSituacao("ACTIVE", true, 50, 100))).toBe(true);
  });

  it("pré-paga sem saldo está em risco", () => {
    expect(isAtRisk(getSituacao("ACTIVE", true, 0, 100))).toBe(true);
  });

  it("sem checagem não conta como risco", () => {
    expect(isAtRisk(getSituacao(null, false, null))).toBe(false);
  });
});
