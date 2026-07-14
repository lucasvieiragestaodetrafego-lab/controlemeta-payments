"use client";

import { useMemo, useState, useTransition } from "react";
import type { SituacaoTone } from "@/lib/account-status";
import ManagerSelect from "@/app/ManagerSelect";
import AutomationToggle from "@/app/AutomationToggle";
import DeleteAccountButton from "@/app/DeleteAccountButton";
import ForceSendButton from "@/app/ForceSendButton";
import { deleteAccounts } from "@/app/actions";

export interface AccountRow {
  id: string;
  name: string;
  isPrepay: boolean | null;
  currency: string;
  balance: number | null;
  situacaoLabel: string;
  situacaoTone: SituacaoTone;
  automationEnabled: boolean;
  managerId: string | null;
  managerName: string;
  hasWhatsapp: boolean;
}

interface ManagerOption {
  id: string;
  name: string;
}

const TONE_CLASSES: Record<SituacaoTone, string> = {
  green: "bg-emerald-950 text-emerald-300",
  red: "bg-red-950 text-red-300",
  amber: "bg-amber-950 text-amber-300",
  muted: "bg-slate-800 text-slate-400",
};

const selectClass =
  "rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100";

export default function AccountsTable({
  rows,
  isAdmin,
  managers,
}: {
  rows: AccountRow[];
  isAdmin: boolean;
  managers: ManagerOption[];
}) {
  const [search, setSearch] = useState("");
  const [situacao, setSituacao] = useState("");
  const [tipo, setTipo] = useState("");
  const [gestor, setGestor] = useState("");
  const [automacao, setAutomacao] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const situacaoOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.situacaoLabel))).sort(),
    [rows],
  );
  const gestorOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.managerName))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (situacao && r.situacaoLabel !== situacao) return false;
      if (tipo === "prepago" && r.isPrepay !== true) return false;
      if (tipo === "cartao" && r.isPrepay !== false) return false;
      if (gestor && r.managerName !== gestor) return false;
      if (automacao === "ligada" && !r.automationEnabled) return false;
      if (automacao === "desligada" && r.automationEnabled) return false;
      return true;
    });
  }, [rows, search, situacao, tipo, gestor, automacao]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredIds = filtered.map((r) => r.id);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function handleBulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const ok = window.confirm(
      `Excluir ${ids.length} conta(s) selecionada(s)? Isso remove o histórico e os alertas delas. Esta ação não pode ser desfeita.`,
    );
    if (!ok) return;
    startTransition(async () => {
      await deleteAccounts(ids);
      setSelected(new Set());
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar conta pelo nome…"
          className="min-w-[220px] flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
        <select value={situacao} onChange={(e) => setSituacao(e.target.value)} className={selectClass}>
          <option value="">Situação: todas</option>
          {situacaoOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {isAdmin && (
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={selectClass}>
            <option value="">Tipo: todos</option>
            <option value="prepago">Pré-pago</option>
            <option value="cartao">Cartão</option>
          </select>
        )}
        {isAdmin && (
          <select value={gestor} onChange={(e) => setGestor(e.target.value)} className={selectClass}>
            <option value="">Gestor: todos</option>
            {gestorOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
        {isAdmin && (
          <select
            value={automacao}
            onChange={(e) => setAutomacao(e.target.value)}
            className={selectClass}
          >
            <option value="">Automação: todas</option>
            <option value="ligada">Ligada</option>
            <option value="desligada">Desligada</option>
          </select>
        )}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {filtered.length} de {rows.length} contas
        </p>
        {isAdmin && selected.size > 0 && (
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={isPending}
            className="rounded bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            Excluir selecionadas ({selected.size})
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              {isAdmin && (
                <th className="px-4 py-2 font-medium">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAll}
                    aria-label="Selecionar todas"
                    className="h-4 w-4 accent-emerald-500"
                  />
                </th>
              )}
              <th className="px-4 py-2 font-medium">Conta</th>
              {isAdmin && <th className="px-4 py-2 font-medium">Tipo</th>}
              <th className="px-4 py-2 font-medium">Saldo</th>
              <th className="px-4 py-2 font-medium">Situação</th>
              {isAdmin && <th className="px-4 py-2 font-medium">Gestor</th>}
              {isAdmin && <th className="px-4 py-2 font-medium">Automação</th>}
              {isAdmin && <th className="px-4 py-2 font-medium">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 8 : 3}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  {rows.length === 0
                    ? "Nenhuma conta disponível ainda."
                    : "Nenhuma conta encontrada para esses filtros."}
                </td>
              </tr>
            )}
            {filtered.map((row) => {
              const balanceLabel =
                row.balance === null
                  ? "—"
                  : row.balance.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: row.currency,
                    });

              return (
                <tr key={row.id} className="border-t border-slate-800">
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                        aria-label={`Selecionar ${row.name}`}
                        className="h-4 w-4 accent-emerald-500"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">{row.name}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-slate-400">
                      {row.isPrepay === null ? "—" : row.isPrepay ? "pré-pago" : "cartão"}
                    </td>
                  )}
                  <td className="px-4 py-3">{balanceLabel}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs ${TONE_CLASSES[row.situacaoTone]}`}
                    >
                      {row.situacaoLabel}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <ManagerSelect
                        accountId={row.id}
                        currentManagerId={row.managerId}
                        managers={managers}
                      />
                    </td>
                  )}
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <AutomationToggle accountId={row.id} enabled={row.automationEnabled} />
                    </td>
                  )}
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ForceSendButton
                          accountId={row.id}
                          accountName={row.name}
                          hasWhatsapp={row.hasWhatsapp}
                        />
                        <DeleteAccountButton accountId={row.id} accountName={row.name} />
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
