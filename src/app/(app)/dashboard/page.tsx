import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { listDashboardAccounts } from "@/lib/dashboard-accounts";
import { getAccountObjectiveRollup, getAccountMetricValues, type PeriodSelection } from "@/lib/meta-insights";
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
const PSEUDO_RESULT_KEYS = new Set(["resultado", "custo_por_resultado"]);

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
  const columns = selectedMetricKeys.map(findMetric).filter((m) => m != null);
  const catalogKeysForFetch = selectedMetricKeys.filter((k) => !PSEUDO_RESULT_KEYS.has(k));
  const wantsResultado = selectedMetricKeys.some((k) => PSEUDO_RESULT_KEYS.has(k));

  const rows: OverviewRow[] = [];
  for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
    const batch = accounts.slice(i, i + BATCH_SIZE);
    const batchRows = await Promise.all(
      batch.map(async (account): Promise<OverviewRow> => {
        const resultMetric = TRACKED_ACTIONS.find((a) => a.key === account.resultMetricKey);
        try {
          const rollup = await getAccountObjectiveRollup(account.metaAccountId, selection);
          const extraMetrics = await getAccountMetricValues(
            account.metaAccountId,
            selection,
            catalogKeysForFetch,
            rollup,
          ).catch(() => ({}) as Record<string, number | null>);

          const values: Record<string, number | null> = { ...extraMetrics };
          const valueLabels: Record<string, string> = {};

          if (wantsResultado) {
            const isMixed = rollup.distinctActionKeys.length > 1;
            const entry = resultMetric ? rollup.byActionKey[resultMetric.key] : undefined;
            const resultValue = !isMixed && entry ? entry.count : null;
            const costPerResult = !isMixed && entry && entry.count > 0 ? entry.spend / entry.count : null;
            values.resultado = resultValue;
            values.custo_por_resultado = costPerResult;
            if (resultMetric) valueLabels.resultado = resultMetric.label;
          }

          return {
            id: account.id,
            metaAccountId: account.metaAccountId,
            name: account.accountName,
            values,
            valueLabels,
            error: null,
          };
        } catch (err) {
          return {
            id: account.id,
            metaAccountId: account.metaAccountId,
            name: account.accountName,
            values: {},
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
      <DashboardOverviewTable rows={rows} columns={columns} />
    </main>
  );
}
