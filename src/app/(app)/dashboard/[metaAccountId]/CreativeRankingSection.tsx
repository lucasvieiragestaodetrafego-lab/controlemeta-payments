import { getTopCreatives, type PeriodSelection } from "@/lib/meta-insights";

export default async function CreativeRankingSection({
  metaAccountId,
  selection,
  resultLabel,
}: {
  metaAccountId: string;
  selection: PeriodSelection;
  resultLabel: string;
}) {
  try {
    const creatives = await getTopCreatives(metaAccountId, selection, 5);

    if (creatives.length === 0) {
      return <p className="text-sm text-slate-400">Sem criativos com resultado no período.</p>;
    }

    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Ranking de criativos</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {creatives.map((c, i) => (
            <div key={c.adId} className="rounded border border-slate-800 p-3 text-sm">
              <p className="text-xs text-slate-500">#{i + 1}</p>
              <p className="truncate font-medium text-slate-100">{c.adName}</p>
              <p className="mt-1 text-xs text-slate-400">
                {resultLabel}: {c.conversions} · CPA:{" "}
                {c.cpa != null ? c.cpa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
              </p>
              {c.permalink && (
                <a
                  href={c.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-xs text-sky-400 hover:underline"
                >
                  Ver post ↗
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar ranking de criativos.";
    return <p className="text-xs text-red-400">Ranking de criativos indisponível: {message}</p>;
  }
}
