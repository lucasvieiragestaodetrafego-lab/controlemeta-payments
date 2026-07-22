import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardAccount } from "@/lib/dashboard-accounts";
import { getAccountInsights, getAccountInsightsDaily, type PeriodSelection } from "@/lib/meta-insights";
import { TRACKED_ACTIONS } from "@/lib/report-variables";
import { parsePeriodFromSearchParams, searchParamsToURLSearchParams } from "@/lib/period-params";
import PeriodSelector from "../PeriodSelector";
import ResultMetricSelector from "./ResultMetricSelector";
import KpiCards from "./KpiCards";
import SpendResultChart from "./SpendResultChart";

export default async function DashboardAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ metaAccountId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { metaAccountId } = await params;
  const account = await getDashboardAccount(metaAccountId);
  if (!account) notFound();

  const sp = await searchParams;
  const urlParams = searchParamsToURLSearchParams(sp);
  const selection: PeriodSelection = parsePeriodFromSearchParams(urlParams);
  const resultMetricKeyParam = urlParams.get("metric");
  const resultMetric =
    TRACKED_ACTIONS.find((a) => a.key === resultMetricKeyParam) ??
    TRACKED_ACTIONS.find((a) => a.key === account.resultMetricKey) ??
    TRACKED_ACTIONS[0];

  const [insights, daily] = await Promise.all([
    getAccountInsights(metaAccountId, selection),
    getAccountInsightsDaily(metaAccountId, selection, resultMetric.actionTypes),
  ]);
  const resultValue = insights.detailedActions[resultMetric.key] ?? 0;
  const costPerResult = resultValue > 0 ? insights.spend / resultValue : null;

  return (
    <main className="mx-auto max-w-[1600px] p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{account.accountName}</h1>
          <p className="text-sm text-slate-400">Dashboard de métricas em tempo real.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ResultMetricSelector metaAccountId={metaAccountId} selectedKey={resultMetric.key} />
          <PeriodSelector selection={selection} />
        </div>
      </header>

      <KpiCards
        spend={insights.spend}
        resultLabel={resultMetric.label}
        resultValue={resultValue}
        costPerResult={costPerResult}
        roas={insights.roas}
      />

      <SpendResultChart daily={daily} resultLabel={resultMetric.label} />
    </main>
  );
}
