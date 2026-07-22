"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PeriodSelection, ReportPeriod } from "@/lib/meta-insights";
import { periodToSearchParams } from "@/lib/period-params";

const PRESETS: { key: ReportPeriod; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "last_7_days", label: "7 dias" },
  { key: "last_30_days", label: "30 dias" },
  { key: "current_month", label: "Mês atual" },
];

export default function PeriodSelector({ selection }: { selection: PeriodSelection }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [customSince, setCustomSince] = useState(selection.type === "custom" ? selection.since : "");
  const [customUntil, setCustomUntil] = useState(selection.type === "custom" ? selection.until : "");

  function apply(next: PeriodSelection) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("period");
    params.delete("since");
    params.delete("until");
    for (const [key, value] of periodToSearchParams(next).entries()) {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => apply({ type: "preset", period: p.key })}
          className={`rounded px-2.5 py-1 text-xs ${
            selection.type === "preset" && selection.period === p.key
              ? "bg-sky-600 text-white"
              : "border border-slate-700 text-slate-300 hover:bg-slate-800"
          }`}
        >
          {p.label}
        </button>
      ))}
      <input
        type="date"
        value={customSince}
        onChange={(e) => setCustomSince(e.target.value)}
        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
      />
      <span className="text-xs text-slate-500">até</span>
      <input
        type="date"
        value={customUntil}
        onChange={(e) => setCustomUntil(e.target.value)}
        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
      />
      <button
        type="button"
        disabled={!customSince || !customUntil}
        onClick={() => apply({ type: "custom", since: customSince, until: customUntil })}
        className="rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
      >
        Aplicar
      </button>
    </div>
  );
}
