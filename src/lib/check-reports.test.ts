// src/lib/check-reports.test.ts
import { describe, it, expect } from "vitest";
import { renderReportMessage } from "./check-reports";

describe("renderReportMessage", () => {
  it("substitui todas as variáveis presentes no template", () => {
    const template = "Conta: {conta}\nInvestido: {investimento}\nCliques: {cliques}";
    const result = renderReportMessage(template, {
      conta: "Mineirinha",
      investimento: "R$ 453,60",
      cliques: "395",
    });
    expect(result).toBe("Conta: Mineirinha\nInvestido: R$ 453,60\nCliques: 395");
  });

  it("mantém o texto de variáveis não fornecidas (não quebra o envio)", () => {
    const template = "Conta: {conta} | ROAS: {roas}";
    const result = renderReportMessage(template, { conta: "X" });
    expect(result).toBe("Conta: X | ROAS: {roas}");
  });
});
