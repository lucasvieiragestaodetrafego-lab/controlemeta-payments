import { describe, it, expect } from "vitest";
import {
  parsePeriodFromSearchParams,
  periodToSearchParams,
  searchParamsToURLSearchParams,
} from "./period-params";

describe("parsePeriodFromSearchParams", () => {
  it("lê preset válido da query string", () => {
    expect(parsePeriodFromSearchParams(new URLSearchParams("period=last_30_days"))).toEqual({
      type: "preset",
      period: "last_30_days",
    });
  });

  it("lê intervalo customizado quando since e until estão presentes", () => {
    expect(parsePeriodFromSearchParams(new URLSearchParams("since=2026-07-01&until=2026-07-15"))).toEqual({
      type: "custom",
      since: "2026-07-01",
      until: "2026-07-15",
    });
  });

  it("cai para last_7_days sem parâmetros", () => {
    expect(parsePeriodFromSearchParams(new URLSearchParams(""))).toEqual({
      type: "preset",
      period: "last_7_days",
    });
  });

  it("cai para last_7_days com preset inválido", () => {
    expect(parsePeriodFromSearchParams(new URLSearchParams("period=bogus"))).toEqual({
      type: "preset",
      period: "last_7_days",
    });
  });
});

describe("periodToSearchParams", () => {
  it("serializa preset", () => {
    expect(periodToSearchParams({ type: "preset", period: "today" }).toString()).toBe("period=today");
  });

  it("serializa intervalo customizado", () => {
    const params = periodToSearchParams({ type: "custom", since: "2026-07-01", until: "2026-07-15" });
    expect(params.get("since")).toBe("2026-07-01");
    expect(params.get("until")).toBe("2026-07-15");
  });
});

describe("searchParamsToURLSearchParams", () => {
  it("converte objeto do Next (com arrays e undefined) para URLSearchParams", () => {
    const result = searchParamsToURLSearchParams({ period: "today", tag: ["a", "b"], empty: undefined });
    expect(result.get("period")).toBe("today");
    expect(result.getAll("tag")).toEqual(["a", "b"]);
    expect(result.has("empty")).toBe(false);
  });
});
