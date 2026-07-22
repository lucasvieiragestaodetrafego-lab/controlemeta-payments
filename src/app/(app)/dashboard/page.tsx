import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { listDashboardAccounts } from "@/lib/dashboard-accounts";
import { getAccountInsights, getAccountMetricValues, type PeriodSelection } from "@/lib/meta-insights";
import { TRACKED_ACTIONS } from "@/lib/report-variables";
import { getSelectedMetricKeys } from "@/lib/dashboard-columns";
import { findMetric } from "@/lib/metrics-catalog";
import { parsePeriodFromSearchParams, searchParamsToURLSearchParams } from "@/lib/period-params";
import DashboardOverviewTable, { type OverviewRow } from "./DashboardOverviewTable";
import PeriodSelector from "./PeriodSelector";
import ManageAccountsButton from "./ManageAccountsButton";
import ManageAccountsSection from "./ManageAccountsSection";
import ColumnPickerButton from "./ColumnPickerButton";

const BATCH_SIZE = 10;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const selection: PeriodSelection = parsePeriodFromSearchParams(searchParamsToURLSearchParams(sp));

  const accounts = await listDashboardAccounts();
  const selectedMetricKeys = await getSelectedMetricKeys();
  const extraColumns = selectedMetricKeys.map(findMetric).filter((m) => m != null);

  const rows: OverviewRow[] = [];
  for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
    const batch = accounts.slice(i, i + BATCH_SIZE);
    const batchRows = await Promise.all(
      batch.map(async (account): Promise<OverviewRow> => {
        const resultMetric = TRACKED_ACTIONS.find((a) => a.key === account.resultMetricKey);
        try {
          const [insights, extraMetrics] = await Promise.all([
            getAccountInsights(account.metaAccountId, selection),
            getAccountMetricValues(account.metaAccountId, selection, selectedMetricKeys),
          ]);
          const resultValue = resultMetric
            ? insights.detailedActions[resultMetric.key] ?? 0
            : insights.conversions;
          return {
            id: account.id,
            metaAccountId: account.metaAccountId,
            name: account.accountName,
            spend: insights.spend,
            resultLabel: resultMetric?.label ?? insights.resultLabel,
            resultValue,
            costPerResult: resultValue > 0 ? insights.spend / resultValue : null,
            roas: insights.roas,
            extraMetrics,
            error: null,
          };
        } catch (err) {
          return {
            id: account.id,
            metaAccountId: account.metaAccountId,
            name: account.accountName,
            spend: 0,
            resultLabel: resultMetric?.label ?? "Resultado",
            resultValue: 0,
            costPerResult: null,
            roas: null,
            extraMetrics: {},
            error: err instanceof Error ? err.message : "Erro ao buscar métricas.",
          };
        }
      }),
    );
    rows.push(...batchRows);
  }

  return (
    <main className="mx-auto max-w-[1600px] p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-400">Métricas em tempo real das contas Meta Ads.</p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector selection={selection} />
          <ColumnPickerButton selectedKeys={selectedMetricKeys} />
          <ManageAccountsButton>
            <Suspense fallback={<p className="text-sm text-slate-500">Carregando contas…</p>}>
              <ManageAccountsSection />
            </Suspense>
          </ManageAccountsButton>
        </div>
      </header>
      <DashboardOverviewTable rows={rows} extraColumns={extraColumns} />
    </main>
  );
}
