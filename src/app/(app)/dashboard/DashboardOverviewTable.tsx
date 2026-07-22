"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { sortOverviewRows, type OverviewSortKey } from "@/lib/dashboard-sort";

export interface OverviewRow {
  id: string;
  metaAccountId: string;
  name: string;
  spend: number;
  resultLabel: string;
  resultValue: number;
  costPerResult: number | null;
  roas: number | null;
  error: string | null;
}

const currencyFmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const COLUMNS: { key: OverviewSortKey; label: string }[] = [
  { key: "name", label: "Conta" },
  { key: "spend", label: "Gasto" },
  { key: "resultValue", label: "Resultado" },
  { key: "costPerResult", label: "Custo por resultado" },
  { key: "roas", label: "ROAS" },
];

export default function DashboardOverviewTable({ rows }: { rows: OverviewRow[] }) {
  const [sortKey, setSortKey] = useState<OverviewSortKey>("spend");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => sortOverviewRows(rows, sortKey, direction), [rows, sortKey, direction]);

  function toggleSort(key: OverviewSortKey) {
    if (key === sortKey) {
      setDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDirection("desc");
    }
  }

  if (rows.length === 0) {
    return (
      <p className="rounded border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
        Nenhuma conta no dashboard ainda. Use &quot;Gerenciar contas&quot; para adicionar.
      </p>
    );
  }

  return (
    <table className="w-full text-left text-sm">
      <thead className="text-slate-400">
        <tr>
          {COLUMNS.map((col) => (
            <th
              key={col.key}
              className="cursor-pointer select-none px-4 py-2"
              onClick={() => toggleSort(col.key)}
            >
              {col.label} {sortKey === col.key ? (direction === "asc" ? "▲" : "▼") : ""}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr key={row.id} className="border-t border-slate-800 hover:bg-slate-900/60">
            <td className="px-4 py-2">
              <Link href={`/dashboard/${row.metaAccountId}`} className="text-sky-400 hover:underline">
                {row.name}
              </Link>
            </td>
            {row.error ? (
              <td colSpan={4} className="px-4 py-2 text-xs text-red-400">
                {row.error}
              </td>
            ) : (
              <>
                <td className="px-4 py-2">{currencyFmt(row.spend)}</td>
                <td className="px-4 py-2">
                  {row.resultValue} <span className="text-xs text-slate-500">{row.resultLabel}</span>
                </td>
                <td className="px-4 py-2">
                  {row.costPerResult != null ? currencyFmt(row.costPerResult) : "—"}
                </td>
                <td className="px-4 py-2">
                  {row.roas != null ? row.roas.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}
                </td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
