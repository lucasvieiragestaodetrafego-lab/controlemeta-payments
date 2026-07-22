// src/lib/dashboard-accounts.test.ts
import { describe, it, expect } from "vitest";
import { mergeAccountsWithMembership, type DashboardAccount } from "./dashboard-accounts";

describe("mergeAccountsWithMembership", () => {
  it("marca inDashboard=true para contas já presentes, ordenando por nome", () => {
    const metaAccounts = [
      { metaAccountId: "act_2", name: "Conta B" },
      { metaAccountId: "act_1", name: "Conta A" },
    ];
    const dashboardAccounts: DashboardAccount[] = [
      { id: "uuid-1", metaAccountId: "act_1", accountName: "Conta A", resultMetricKey: "compras" },
    ];
    const result = mergeAccountsWithMembership(metaAccounts, dashboardAccounts);
    expect(result).toEqual([
      { metaAccountId: "act_1", name: "Conta A", inDashboard: true },
      { metaAccountId: "act_2", name: "Conta B", inDashboard: false },
    ]);
  });

  it("retorna todas com inDashboard=false quando nenhuma está cadastrada", () => {
    const result = mergeAccountsWithMembership([{ metaAccountId: "act_1", name: "Conta A" }], []);
    expect(result).toEqual([{ metaAccountId: "act_1", name: "Conta A", inDashboard: false }]);
  });
});
