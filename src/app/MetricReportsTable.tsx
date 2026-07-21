"use client";

import { useState, useTransition } from "react";
import {
  setMetricReportActive,
  deleteMetricReport,
  forceSendReportAction,
} from "@/app/actions";

export interface MetricReportRow {
  id: string;
  name: string;
  accountName: string;
  whatsappGroupName: string | null;
  frequency: string;
  nextSendAt: string | null;
  isActive: boolean;
}

const FREQUENCY_LABEL: Record<string, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

export default function MetricReportsTable({ rows }: { rows: MetricReportRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [sendingId, setSendingId] = useState<string | null>(null);

  function toggle(id: string, enabled: boolean) {
    startTransition(() => setMetricReportActive(id, enabled));
  }

  function remove(id: string) {
    if (!confirm("Excluir este relatório?")) return;
    startTransition(() => deleteMetricReport(id));
  }

  async function sendNow(id: string) {
    setSendingId(id);
    try {
      await forceSendReportAction(id);
    } finally {
      setSendingId(null);
    }
  }

  return (
    <table className="w-full text-left text-sm">
      <thead className="text-slate-400">
        <tr>
          <th className="px-4 py-2">Status</th>
          <th className="px-4 py-2">Nome</th>
          <th className="px-4 py-2">Conta</th>
          <th className="px-4 py-2">Destinatário</th>
          <th className="px-4 py-2">Frequência</th>
          <th className="px-4 py-2">Próximo envio</th>
          <th className="px-4 py-2">Ações</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t border-slate-800">
            <td className="px-4 py-3">
              <input
                type="checkbox"
                checked={row.isActive}
                disabled={isPending}
                onChange={(e) => toggle(row.id, e.target.checked)}
              />
            </td>
            <td className="px-4 py-3">{row.name}</td>
            <td className="px-4 py-3">{row.accountName}</td>
            <td className="px-4 py-3">{row.whatsappGroupName ?? "—"}</td>
            <td className="px-4 py-3">{FREQUENCY_LABEL[row.frequency] ?? row.frequency}</td>
            <td className="px-4 py-3">
              {row.nextSendAt ? new Date(row.nextSendAt).toLocaleString("pt-BR") : "—"}
            </td>
            <td className="px-4 py-3">
              <button
                type="button"
                onClick={() => sendNow(row.id)}
                disabled={sendingId === row.id}
                className="mr-2 rounded bg-sky-600 px-2 py-1 text-xs text-white hover:bg-sky-500 disabled:opacity-50"
              >
                📨 Enviar agora
              </button>
              <button
                type="button"
                onClick={() => remove(row.id)}
                className="rounded bg-red-950 px-2 py-1 text-xs text-red-300 hover:bg-red-900"
              >
                🗑
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
