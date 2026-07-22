"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyPoint } from "@/lib/meta-insights";

export default function SpendResultChart({ daily, resultLabel }: { daily: DailyPoint[]; resultLabel: string }) {
  if (daily.length === 0) {
    return (
      <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
        Sem dados no período.
      </div>
    );
  }

  const data = daily.map((d) => ({ date: d.date.slice(5), spend: d.spend, result: d.result }));

  return (
    <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-200">Gasto e {resultLabel} por dia</h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
          <YAxis yAxisId="spend" stroke="#38bdf8" fontSize={12} />
          <YAxis yAxisId="result" orientation="right" stroke="#34d399" fontSize={12} />
          <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
          <Legend />
          <Line
            yAxisId="spend"
            type="monotone"
            dataKey="spend"
            name="Gasto (R$)"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="result"
            type="monotone"
            dataKey="result"
            name={resultLabel}
            stroke="#34d399"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
