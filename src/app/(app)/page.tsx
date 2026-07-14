import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { runCheckNow } from "@/app/actions";
import { getSituacao, type SituacaoTone } from "@/lib/account-status";
import { buildRiskSeries } from "@/lib/risk-series";
import AccountsTable, { type AccountRow } from "@/app/AccountsTable";
import NewReportModal from "@/app/NewReportModal";
import NovaAutomacaoSection from "@/app/(app)/settings/NovaAutomacaoSection";

interface DashboardAccount {
  id: string;
  name: string;
  currency: string;
  is_prepay: boolean | null;
  alert_threshold: number;
  automation_enabled: boolean;
  manager_id: string | null;
  whatsapp_group_id: string | null;
  whatsapp_group_name: string | null;
  platform: string;
  custom_message: string | null;
  clients: { name: string } | null;
}

interface LatestSnapshot {
  ad_account_id: string;
  balance: number | null;
  account_status: string | null;
  checked_at: string;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getSupabaseAdmin();

  const { data: manager } = await admin
    .from("managers")
    .select("id, name, role")
    .eq("auth_user_id", user.id)
    .single();

  if (!manager) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-slate-300">
          Seu login não está vinculado a nenhum gestor ainda. Peça para o administrador
          configurar seu acesso.
        </p>
      </main>
    );
  }

  const isAdmin = manager.role === "admin";

  let accountsQuery = admin
    .from("ad_accounts")
    .select(
      "id, name, currency, is_prepay, alert_threshold, automation_enabled, manager_id, whatsapp_group_id, whatsapp_group_name, platform, custom_message, clients(name)",
    )
    .eq("is_active", true)
    .order("name");

  if (!isAdmin) {
    accountsQuery = accountsQuery.eq("manager_id", manager.id);
  }

  const { data: accountsData, error: accountsError } = await accountsQuery;
  if (accountsError) {
    console.error("Erro ao buscar contas:", accountsError.message);
  }
  const accounts = (accountsData ?? []) as unknown as DashboardAccount[];

  const accountIds = accounts.map((a) => a.id);
  const { data: snapshotsData, error: snapshotsError } = accountIds.length
    ? await admin
        .from("latest_balance_snapshots")
        .select("ad_account_id, balance, account_status, checked_at")
        .in("ad_account_id", accountIds)
    : { data: [] as LatestSnapshot[], error: null };
  if (snapshotsError) {
    console.error("Erro ao buscar snapshots:", snapshotsError.message);
  }

  const snapshots = new Map(
    (snapshotsData ?? []).map((s) => [s.ad_account_id, s as LatestSnapshot]),
  );

  const since = new Date();
  since.setDate(since.getDate() - 14);
  const { data: historyData, error: historyError } = accountIds.length
    ? await admin
        .from("balance_snapshots")
        .select("ad_account_id, balance, account_status, checked_at")
        .in("ad_account_id", accountIds)
        .gte("checked_at", since.toISOString())
        .order("checked_at", { ascending: true })
    : { data: [], error: null };
  if (historyError) {
    console.error("Erro ao buscar histórico:", historyError.message);
  }

  const history = (historyData ?? []) as {
    ad_account_id: string;
    balance: number | null;
    account_status: string | null;
    checked_at: string;
  }[];

  const sparkByAccount = new Map<string, number[]>();
  for (const h of history) {
    if (h.balance == null) continue;
    const arr = sparkByAccount.get(h.ad_account_id) ?? [];
    arr.push(Number(h.balance));
    sparkByAccount.set(h.ad_account_id, arr);
  }

  const managersList = ((await admin.from("managers").select("id, name").order("name")).data ??
    []) as { id: string; name: string }[];
  const managerNameById = new Map(managersList.map((m) => [m.id, m.name]));

  const rows: (AccountRow & { travada: boolean })[] = accounts.map((account) => {
    const snapshot = snapshots.get(account.id);
    const balance = snapshot?.balance != null ? Number(snapshot.balance) : null;
    const situacao = getSituacao(
      snapshot?.account_status ?? null,
      account.is_prepay,
      balance,
      account.alert_threshold,
    );
    return {
      id: account.id,
      name: account.name,
      isPrepay: account.is_prepay,
      currency: account.currency,
      balance,
      situacaoLabel: situacao.label,
      situacaoTone: situacao.tone,
      automationEnabled: account.automation_enabled,
      managerId: account.manager_id,
      managerName: account.manager_id ? managerNameById.get(account.manager_id) ?? "—" : "—",
      hasWhatsapp: !!account.whatsapp_group_id,
      travada: situacao.travada,
      platform: account.platform,
      sparkValues: sparkByAccount.get(account.id) ?? [],
      alertThreshold: account.alert_threshold,
      whatsappGroupId: account.whatsapp_group_id,
      customMessage: account.custom_message,
      clientName: account.clients?.name ?? account.name,
      whatsappGroupName: account.whatsapp_group_name,
    };
  });

  const riskSeries = buildRiskSeries(
    history.map((h) => ({
      adAccountId: h.ad_account_id,
      balance: h.balance,
      accountStatus: h.account_status,
      checkedAt: h.checked_at,
    })),
    accounts.map((a) => ({
      id: a.id,
      isPrepay: a.is_prepay,
      alertThreshold: a.alert_threshold,
    })),
    14,
  );

  const total = rows.length;
  const ativas = rows.filter((r) => r.situacaoLabel === "Ativa").length;
  const travadas = rows.filter((r) => r.travada).length;
  const automacaoLigada = rows.filter((r) => r.automationEnabled).length;

  const defaultWhatsappGroupId = process.env.ZAPI_GROUP_IDS ?? "";

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Alertas de saldo</h1>
          <p className="text-sm text-slate-400">Olá, {manager.name}.</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-3">
            <form action={runCheckNow}>
              <button className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500">
                Atualizar agora
              </button>
            </form>
            <NewReportModal>
              <Suspense fallback={<p className="text-sm text-slate-500">Carregando contas do Meta…</p>}>
                <NovaAutomacaoSection
                  managers={managersList}
                  defaultWhatsappGroupId={defaultWhatsappGroupId}
                />
              </Suspense>
            </NewReportModal>
          </div>
        )}
      </header>

      {isAdmin && (
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Total de contas" value={total} tone="muted" />
          <SummaryCard label="Ativas" value={ativas} tone="green" />
          <SummaryCard label="Travadas / problema" value={travadas} tone="red" />
          <SummaryCard label="Automação ligada" value={automacaoLigada} tone="green" />
        </section>
      )}

      <AccountsTable rows={rows} isAdmin={isAdmin} managers={managersList} riskSeries={riskSeries} />
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: SituacaoTone;
}) {
  const accent: Record<SituacaoTone, string> = {
    green: "text-emerald-400",
    red: "text-red-400",
    amber: "text-amber-400",
    muted: "text-slate-100",
  };
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent[tone]}`}>{value}</p>
    </div>
  );
}
