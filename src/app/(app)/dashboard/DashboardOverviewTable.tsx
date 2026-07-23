"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { sortOverviewRows } from "@/lib/dashboard-sort";
import { formatMetricValue } from "@/lib/metric-format";
import type { MetricDefinition } from "@/lib/metrics-catalog";

export interface OverviewRow {
  id: string;
  metaAccountId: string;
  name: string;
  /** Valor de cada coluna selecionada, por chave do catálogo. */
  values: Record<string, number | null>;
  /** Rótulo dinâmico por coluna quando difere do label padrão (ex: "Resultado" mostra o nome da métrica escolhida pela conta, tipo "Compras"). */
  valueLabels?: Record<string, string>;
  error: string | null;
}

export default function DashboardOverviewTable({
  rows,
  columns,
}: {
  rows: OverviewRow[];
  columns: MetricDefinition[];
}) {
  const [sortKey, setSortKey] = useState<string>("gasto");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => sortOverviewRows(rows, sortKey, direction), [rows, sortKey, direction]);

  function toggleSort(key: string) {
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
          <th className="cursor-pointer select-none px-4 py-2" onClick={() => toggleSort("name")}>
            Conta {sortKey === "name" ? (direction === "asc" ? "▲" : "▼") : ""}
          </th>
          {columns.map((col) => (
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
              <td colSpan={columns.length} className="px-4 py-2 text-xs text-red-400">
                {row.error}
              </td>
            ) : (
              columns.map((col) => (
                <td key={col.key} className="px-4 py-2">
                  {formatMetricValue(row.values[col.key] ?? null, col.valueKind)}
                  {row.valueLabels?.[col.key] && (
                    <span className="ml-1 text-xs text-slate-500">{row.valueLabels[col.key]}</span>
                  )}
                </td>
              ))
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
