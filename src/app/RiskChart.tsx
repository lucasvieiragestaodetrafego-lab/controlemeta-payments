import { sparklinePoints } from "@/lib/sparkline";

/**
 * Gráfico de "contas em risco ao longo do tempo". Área vermelha translúcida.
 * Mostra estado vazio amigável quando ainda não há histórico suficiente
 * (menos de 2 pontos). Com 2+ pontos, uma linha reta em zero é resultado válido.
 */
export default function RiskChart({
  series,
}: {
  series: { date: string; count: number }[];
}) {
  const values = series.map((p) => p.count);
  const hasSignal = values.length >= 2;

  const W = 640;
  const H = 80;
  const points = sparklinePoints(values, W, H);
  const peak = values.length ? Math.max(...values) : 0;
  const last = values[values.length - 1] ?? 0;

  return (
    <section className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Contas em risco ao longo do tempo</h2>
        <span className="text-xs text-slate-400">
          {series.length > 0 ? `hoje: ${last}` : ""}
        </span>
      </div>
      {hasSignal ? (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-24 w-full">
          <polyline fill="none" stroke="#f87171" strokeWidth={2} points={points} />
          <polyline
            fill="#f8717122"
            stroke="none"
            points={`${points} ${W},${H} 0,${H}`}
          />
        </svg>
      ) : (
        <p className="py-6 text-center text-xs text-slate-500">
          Ainda coletando histórico. O gráfico aparece após alguns dias de checagens.
        </p>
      )}
      <p className="mt-1 text-xs text-slate-500">Pico no período: {peak}</p>
    </section>
  );
}
