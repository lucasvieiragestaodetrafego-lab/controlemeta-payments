import { describe, it, expect } from "vitest";
import { mapOptimizationGoalToActionKey } from "./ad-set-objectives";

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
