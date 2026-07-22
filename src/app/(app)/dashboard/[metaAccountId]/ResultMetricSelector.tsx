"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { updateResultMetricAction } from "../actions";
import { TRACKED_ACTIONS } from "@/lib/report-variables";

export default function ResultMetricSelector({
  metaAccountId,
  selectedKey,
}: {
  metaAccountId: string;
  selectedKey: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function changeMetric(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("metric", key);
    router.push(`${pathname}?${params.toString()}`);
  }

  function saveAsDefault() {
    startTransition(() => updateResultMetricAction(metaAccountId, selectedKey));
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-400">Resultado:</label>
      <select
        value={selectedKey}
        onChange={(e) => changeMetric(e.target.value)}
        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
      >
        {TRACKED_ACTIONS.map((a) => (
          <option key={a.key} value={a.key}>
            {a.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={saveAsDefault}
        disabled={isPending}
        title="Salvar esta métrica como padrão desta conta"
        className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
      >
        {isPending ? "Salvando…" : "Definir como padrão"}
      </button>
    </div>
  );
}
