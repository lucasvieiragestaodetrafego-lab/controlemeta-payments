import { describe, it, expect } from "vitest";
import { QUOTES, getQuoteForNow } from "./quotes";

describe("QUOTES", () => {
  it("tem um banco razoável de frases, todas com texto e autor", () => {
    expect(QUOTES.length).toBeGreaterThan(50);
    for (const q of QUOTES) {
      expect(q.text.length).toBeGreaterThan(0);
      expect(q.author.length).toBeGreaterThan(0);
    }
  });
});

describe("getQuoteForNow", () => {
  it("retorna a mesma frase em momentos diferentes dentro da mesma hora", () => {
    const a = getQuoteForNow(new Date("2026-01-01T10:00:00Z"));
    const b = getQuoteForNow(new Date("2026-01-01T10:59:59Z"));
    expect(a).toEqual(b);
  });

  it("muda quando a hora vira", () => {
    const a = getQuoteForNow(new Date("2026-01-01T10:59:59Z"));
    const b = getQuoteForNow(new Date("2026-01-01T11:00:00Z"));
    expect(a).not.toEqual(b);
  });

  it("sempre retorna uma frase válida do banco", () => {
    const q = getQuoteForNow(new Date("2026-06-15T03:00:00Z"));
    expect(QUOTES).toContainEqual(q);
  });
});
