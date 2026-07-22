import { describe, it, expect } from "vitest";
import { validateMetricKeys } from "./dashboard-columns";

describe("validateMetricKeys", () => {
  it("mantém só chaves que existem no catálogo, na ordem informada", () => {
    expect(validateMetricKeys(["alcance", "chave_inexistente", "impressoes"])).toEqual(["alcance", "impressoes"]);
  });

  it("remove duplicatas mantendo a primeira ocorrência", () => {
    expect(validateMetricKeys(["alcance", "alcance", "impressoes"])).toEqual(["alcance", "impressoes"]);
  });

  it("retorna array vazio para entrada vazia", () => {
    expect(validateMetricKeys([])).toEqual([]);
  });
});
