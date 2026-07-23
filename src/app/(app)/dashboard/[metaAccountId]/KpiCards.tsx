const currencyFmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function KpiCards({
  spend,
  resultLabel,
  resultValue,
  costPerResult,
  roas,
}: {
  spend: number;
  resultLabel: string;
  resultValue: number | null;
  costPerResult: number | null;
  roas: number | null;
}) {
  const cards = [
    { label: "Gasto", value: currencyFmt(spend) },
    { label: resultLabel, value: resultValue != null ? String(resultValue) : "—" },
    { label: "Custo por resultado", value: costPerResult != null ? currencyFmt(costPerResult) : "—" },
    { label: "ROAS", value: roas != null ? roas.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—" },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-400">{c.label}</p>
          <p className="mt-1 text-lg font-semibold text-slate-100">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
