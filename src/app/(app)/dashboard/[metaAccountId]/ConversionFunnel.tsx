import { computeFunnelSteps } from "@/lib/funnel";

export default function ConversionFunnel({
  reach,
  linkClicks,
  checkouts,
  resultLabel,
  resultValue,
}: {
  reach: number;
  linkClicks: number;
  checkouts: number;
  resultLabel: string;
  resultValue: number;
}) {
  const steps = computeFunnelSteps([
    { label: "Alcance", value: reach },
    { label: "Cliques no link", value: linkClicks },
    { label: "Checkout iniciado", value: checkouts },
    { label: resultLabel, value: resultValue },
  ]);

  return (
    <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-200">Funil de conversão</h2>
      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.label}>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{step.label}</span>
              <span>
                {step.value.toLocaleString("pt-BR")}
                {step.dropFromPrevious != null && (
                  <span className="ml-2 text-red-400">-{step.dropFromPrevious.toFixed(1)}%</span>
                )}
              </span>
            </div>
            <div className="mt-1 h-3 w-full rounded bg-slate-800">
              <div className="h-3 rounded bg-sky-600" style={{ width: `${Math.max(step.percentOfFirst, 2)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
