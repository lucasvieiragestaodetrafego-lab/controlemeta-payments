import { describe, it, expect } from "vitest";
import { parseGroupChats } from "./zapi";

describe("parseGroupChats", () => {
  it("mantém apenas chats de grupo (phone termina em '-group')", () => {
    const chats = [
      { phone: "120363421960030596-group", name: "[CSS] Alerta de Saldos" },
      { phone: "5511999998888", name: "Contato individual" },
    ];
    expect(parseGroupChats(chats)).toEqual([
      { id: "120363421960030596-group", name: "[CSS] Alerta de Saldos" },
    ]);
  });

  it("usa o próprio id como nome quando o chat não tem nome", () => {
    const chats = [{ phone: "111-group", name: "" }];
    expect(parseGroupChats(chats)).toEqual([{ id: "111-group", name: "111-group" }]);
  });

  it("ignora itens malformados sem quebrar", () => {
    const chats = [null, { foo: "bar" }, { phone: "222-group", name: "Grupo B" }];
    expect(parseGroupChats(chats)).toEqual([{ id: "222-group", name: "Grupo B" }]);
  });

  it("ordena os grupos pelo nome", () => {
    const chats = [
      { phone: "b-group", name: "Zebra" },
      { phone: "a-group", name: "Abacaxi" },
    ];
    expect(parseGroupChats(chats).map((g) => g.name)).toEqual(["Abacaxi", "Zebra"]);
  });
});
