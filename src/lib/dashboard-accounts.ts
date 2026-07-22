// src/lib/dashboard-accounts.ts
import { getSupabaseAdmin } from "./supabase";
import { TRACKED_ACTIONS } from "./report-variables";

export interface DashboardAccount {
  id: string;
  metaAccountId: string;
  accountName: string;
  resultMetricKey: string;
}

const DEFAULT_RESULT_METRIC_KEY = "compras";

interface DashboardAccountRow {
  id: string;
  meta_account_id: string;
  account_name: string;
  result_metric_key: string;
}

function mapRow(r: DashboardAccountRow): DashboardAccount {
  return {
    id: r.id,
    metaAccountId: r.meta_account_id,
    accountName: r.account_name,
    resultMetricKey: r.result_metric_key,
  };
}

/** Lista as contas visíveis no dashboard, ordenadas por nome. */
export async function listDashboardAccounts(): Promise<DashboardAccount[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("dashboard_accounts")
    .select("id, meta_account_id, account_name, result_metric_key")
    .order("account_name");
  if (error) throw new Error(`Erro ao buscar contas do dashboard: ${error.message}`);
  return ((data ?? []) as DashboardAccountRow[]).map(mapRow);
}

/** Busca uma conta do dashboard pelo meta_account_id (usado pela rota de detalhe). */
export async function getDashboardAccount(metaAccountId: string): Promise<DashboardAccount | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("dashboard_accounts")
    .select("id, meta_account_id, account_name, result_metric_key")
    .eq("meta_account_id", metaAccountId)
    .single();
  if (error || !data) return null;
  return mapRow(data as DashboardAccountRow);
}

/** Adiciona uma conta ao dashboard (idempotente por meta_account_id). Independente de ad_accounts. */
export async function addDashboardAccount(metaAccountId: string, accountName: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("dashboard_accounts").upsert(
    { meta_account_id: metaAccountId, account_name: accountName, result_metric_key: DEFAULT_RESULT_METRIC_KEY },
    { onConflict: "meta_account_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`Erro ao adicionar conta ao dashboard: ${error.message}`);
}

/** Remove uma conta do dashboard. Não afeta a automação de saldo em ad_accounts. */
export async function removeDashboardAccount(metaAccountId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("dashboard_accounts").delete().eq("meta_account_id", metaAccountId);
  if (error) throw new Error(`Erro ao remover conta do dashboard: ${error.message}`);
}

/** Atualiza a métrica de resultado principal de uma conta do dashboard. */
export async function updateResultMetric(metaAccountId: string, resultMetricKey: string): Promise<void> {
  if (!TRACKED_ACTIONS.some((a) => a.key === resultMetricKey)) {
    throw new Error(`Métrica de resultado inválida: ${resultMetricKey}`);
  }
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("dashboard_accounts")
    .update({ result_metric_key: resultMetricKey })
    .eq("meta_account_id", metaAccountId);
  if (error) throw new Error(`Erro ao atualizar métrica de resultado: ${error.message}`);
}

export interface MetaAccountOption {
  metaAccountId: string;
  name: string;
}

export interface MetaAccountWithMembership extends MetaAccountOption {
  inDashboard: boolean;
}

/** Cruza a lista de contas do Meta com as já presentes no dashboard, pra marcar checkboxes no modal de gerenciamento. Função pura, testável sem rede/DB. */
export function mergeAccountsWithMembership(
  metaAccounts: MetaAccountOption[],
  dashboardAccounts: DashboardAccount[],
): MetaAccountWithMembership[] {
  const memberIds = new Set(dashboardAccounts.map((a) => a.metaAccountId));
  return metaAccounts
    .map((a) => ({ ...a, inDashboard: memberIds.has(a.metaAccountId) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
