import { describe, it, expect } from "vitest";
import { groupAccountsByClient } from "./group-accounts";

describe("groupAccountsByClient", () => {
  it("agrupa contas pelo nome do cliente", () => {
    const rows = [
      { name: "Conta B", clientName: "Cliente Z" },
      { name: "Conta A", clientName: "Cliente A" },
    ];
    const groups = groupAccountsByClient(rows);
    expect(groups.map((g) => g.clientName)).toEqual(["Cliente A", "Cliente Z"]);
    expect(groups[0].rows).toEqual([{ name: "Conta A", clientName: "Cliente A" }]);
  });

  it("mantém múltiplas contas do mesmo cliente no mesmo grupo, ordenadas pelo nome da conta", () => {
    const rows = [
      { name: "Conta Google", clientName: "Dr. Tarik" },
      { name: "Conta Meta", clientName: "Dr. Tarik" },
    ];
    const groups = groupAccountsByClient(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].clientName).toBe("Dr. Tarik");
    expect(groups[0].rows.map((r) => r.name)).toEqual(["Conta Google", "Conta Meta"]);
  });

  it("retorna lista vazia para entrada vazia", () => {
    expect(groupAccountsByClient([])).toEqual([]);
  });
});
