import { describe, it, expect } from "vitest";
import { mapOptimizationGoalToActionKey, computeObjectiveRollups, type AdSetObjective, type AdSetInsightRow } from "./ad-set-objectives";

describe("mapOptimizationGoalToActionKey", () => {
  it("mapeia goals 1:1 conhecidos", () => {
    expect(mapOptimizationGoalToActionKey("LEAD_GENERATION")).toBe("leads");
    expect(mapOptimizationGoalToActionKey("QUALITY_LEAD")).toBe("leads");
    expect(mapOptimizationGoalToActionKey("LINK_CLICKS")).toBe("cliques_link");
    expect(mapOptimizationGoalToActionKey("LANDING_PAGE_VIEWS")).toBe("visualizacoes_pagina");
    expect(mapOptimizationGoalToActionKey("APP_INSTALLS")).toBe("instalacoes_app");
    expect(mapOptimizationGoalToActionKey("CONVERSATIONS")).toBe("conversas_iniciadas");
    expect(mapOptimizationGoalToActionKey("REPLIES")).toBe("conversas_iniciadas");
  });

  it("desambigua OFFSITE_CONVERSIONS pelo custom_event_type", () => {
    expect(mapOptimizationGoalToActionKey("OFFSITE_CONVERSIONS", "PURCHASE")).toBe("compras");
    expect(mapOptimizationGoalToActionKey("OFFSITE_CONVERSIONS", "ADD_TO_CART")).toBe("carrinho");
    expect(mapOptimizationGoalToActionKey("OFFSITE_CONVERSIONS", "INITIATED_CHECKOUT")).toBe("checkout_iniciado");
    expect(mapOptimizationGoalToActionKey("OFFSITE_CONVERSIONS", "COMPLETE_REGISTRATION")).toBe("cadastros");
    expect(mapOptimizationGoalToActionKey("OFFSITE_CONVERSIONS", "LEAD")).toBe("leads");
    expect(mapOptimizationGoalToActionKey("OFFSITE_CONVERSIONS", "ADD_PAYMENT_INFO")).toBe("info_pagamento");
  });

  it("retorna null pra OFFSITE_CONVERSIONS sem custom_event_type reconhecido", () => {
    expect(mapOptimizationGoalToActionKey("OFFSITE_CONVERSIONS")).toBeNull();
    expect(mapOptimizationGoalToActionKey("OFFSITE_CONVERSIONS", "SUBSCRIBE")).toBeNull();
  });

  it("retorna null pra goal desconhecido ou sem resultado comparável (ex: Reconhecimento)", () => {
    expect(mapOptimizationGoalToActionKey("BRAND_AWARENESS")).toBeNull();
    expect(mapOptimizationGoalToActionKey("REACH")).toBeNull();
    expect(mapOptimizationGoalToActionKey("IMPRESSIONS")).toBeNull();
  });
});

const ACTION_TYPES_BY_KEY: Record<string, string[]> = {
  leads: ["lead"],
  compras: ["purchase"],
};

describe("computeObjectiveRollups", () => {
  it("um único objetivo entre os conjuntos com gasto: não é misto", () => {
    const adSets: AdSetObjective[] = [
      { adSetId: "1", actionKey: "leads" },
      { adSetId: "2", actionKey: "leads" },
    ];
    const rows: AdSetInsightRow[] = [
      { adSetId: "1", spend: 100, actions: [{ action_type: "lead", value: "5" }], actionValues: [] },
      { adSetId: "2", spend: 50, actions: [{ action_type: "lead", value: "2" }], actionValues: [] },
    ];
    const rollup = computeObjectiveRollups(adSets, rows, ACTION_TYPES_BY_KEY);
    expect(rollup.distinctActionKeys).toEqual(["leads"]);
    expect(rollup.byActionKey.leads).toEqual({ spend: 150, count: 7, value: 0 });
  });

  it("múltiplos objetivos distintos entre os conjuntos com gasto: é misto", () => {
    const adSets: AdSetObjective[] = [
      { adSetId: "1", actionKey: "leads" },
      { adSetId: "2", actionKey: "compras" },
    ];
    const rows: AdSetInsightRow[] = [
      { adSetId: "1", spend: 100, actions: [{ action_type: "lead", value: "5" }], actionValues: [] },
      {
        adSetId: "2",
        spend: 200,
        actions: [{ action_type: "purchase", value: "3" }],
        actionValues: [{ action_type: "purchase", value: "450" }],
      },
    ];
    const rollup = computeObjectiveRollups(adSets, rows, ACTION_TYPES_BY_KEY);
    expect(rollup.distinctActionKeys.sort()).toEqual(["compras", "leads"]);
    expect(rollup.byActionKey.leads).toEqual({ spend: 100, count: 5, value: 0 });
    expect(rollup.byActionKey.compras).toEqual({ spend: 200, count: 3, value: 450 });
  });

  it("conjunto com actionKey null não conta pro misto nem pro rollup", () => {
    const adSets: AdSetObjective[] = [
      { adSetId: "1", actionKey: "leads" },
      { adSetId: "2", actionKey: null },
    ];
    const rows: AdSetInsightRow[] = [
      { adSetId: "1", spend: 100, actions: [{ action_type: "lead", value: "5" }], actionValues: [] },
      { adSetId: "2", spend: 300, actions: [], actionValues: [] },
    ];
    const rollup = computeObjectiveRollups(adSets, rows, ACTION_TYPES_BY_KEY);
    expect(rollup.distinctActionKeys).toEqual(["leads"]);
    expect(Object.keys(rollup.byActionKey)).toEqual(["leads"]);
  });

  it("conjunto sem gasto no período (sem linha de insight) é ignorado", () => {
    const adSets: AdSetObjective[] = [
      { adSetId: "1", actionKey: "leads" },
      { adSetId: "2", actionKey: "compras" },
    ];
    const rows: AdSetInsightRow[] = [
      { adSetId: "1", spend: 100, actions: [{ action_type: "lead", value: "5" }], actionValues: [] },
    ];
    const rollup = computeObjectiveRollups(adSets, rows, ACTION_TYPES_BY_KEY);
    expect(rollup.distinctActionKeys).toEqual(["leads"]);
  });
});
