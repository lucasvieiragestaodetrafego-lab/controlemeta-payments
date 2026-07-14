import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  getAdAccountBalance,
  getAvailableBalance,
  MetaApiError,
  type MetaAdAccount,
} from "@/lib/meta";
import { sendWhatsAppMessage } from "@/lib/zapi";

const ACCOUNT_STATUS_LABELS: Record<number, string> = {
  1: "ACTIVE",
  2: "DISABLED",
  3: "UNSETTLED",
  7: "PENDING_RISK_REVIEW",
  8: "PENDING_SETTLEMENT",
  9: "IN_GRACE_PERIOD",
  100: "PENDING_CLOSURE",
  101: "CLOSED",
};

/** Não reenvia o mesmo tipo de alerta para a mesma conta dentro desta janela (checagem automática). */
const ALERT_COOLDOWN_HOURS = 6;

type TemplateKey = "saldo" | "pagamento" | "desativada";
type AlertType = "low_balance" | "account_disabled" | "payment_error";

const TEMPLATE_TO_ALERT: Record<TemplateKey, AlertType> = {
  saldo: "low_balance",
  pagamento: "payment_error",
  desativada: "account_disabled",
};

const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  saldo:
    "⚠️ *Saldo baixo*\n\nConta: *{conta}*\nSaldo atual: {saldo}\nLimite configurado: {limite}\nGestor responsável: {gestor}\n\nAdicione saldo antes que a conta pare de veicular.",
  pagamento:
    "🔴 *Conta travada — cobrança não realizada*\n\nConta: *{conta}*\nSituação: o Meta não conseguiu cobrar do cartão / há fatura em aberto ({status}).\nGestor responsável: {gestor}\n\nRegularize o pagamento no Business Manager para reativar a veiculação.",
  desativada:
    "🚫 *Conta travada / com problema*\n\nConta: *{conta}*\nStatus: {status}\nGestor responsável: {gestor}\n\nVerifique o Business Manager imediatamente.",
};

interface AdAccountRow {
  id: string;
  meta_account_id: string;
  name: string;
  whatsapp_group_id: string | null;
  alert_threshold: number;
  currency: string;
  automation_enabled: boolean;
  custom_message: string | null;
  manager: { name: string } | null;
}

export interface CheckResult {
  accountId: string;
  accountName: string;
  balance: number | null;
  status: string | null;
  alertSent: boolean;
  error?: string;
}

async function loadTemplates(supabase: SupabaseClient): Promise<Record<TemplateKey, string>> {
  const { data } = await supabase.from("message_templates").select("key, template");
  const templates = { ...DEFAULT_TEMPLATES };
  for (const row of data ?? []) {
    if (row.key in templates) templates[row.key as TemplateKey] = row.template;
  }
  return templates;
}

function render(
  template: string,
  vars: { conta: string; saldo: string; limite: string; gestor: string; status: string },
): string {
  return template
    .replaceAll("{conta}", vars.conta)
    .replaceAll("{saldo}", vars.saldo)
    .replaceAll("{limite}", vars.limite)
    .replaceAll("{gestor}", vars.gestor)
    .replaceAll("{status}", vars.status);
}

interface AlertContext {
  templateKey: TemplateKey;
  message: string;
  available: number | null;
  statusLabel: string;
}

/**
 * Busca o saldo/status atual no Meta, salva o snapshot no histórico e monta
 * a mensagem que se aplicaria à situação da conta agora (independente de
 * automação estar ligada, limite ou cooldown — isso é decidido por quem chama).
 */
async function evaluateAccount(
  supabase: SupabaseClient,
  account: AdAccountRow,
  templates: Record<TemplateKey, string>,
): Promise<AlertContext> {
  const metaData = await getAdAccountBalance(account.meta_account_id);

  // Saldo disponível só faz sentido em contas pré-pagas; cartão fica null.
  const available = getAvailableBalance(metaData);
  const statusLabel =
    ACCOUNT_STATUS_LABELS[metaData.account_status] ?? String(metaData.account_status);

  await supabase.from("balance_snapshots").insert({
    ad_account_id: account.id,
    balance: available,
    spend_cap: metaData.spend_cap ? Number(metaData.spend_cap) / 100 : null,
    amount_spent: metaData.amount_spent ? Number(metaData.amount_spent) / 100 : null,
    account_status: statusLabel,
    funding_source_status: metaData.funding_source_details?.display_string ?? null,
  });

  const gestor = account.manager?.name ?? "não definido";
  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: account.currency });
  const vars = {
    conta: account.name,
    saldo: available !== null ? fmt(available) : "—",
    limite: fmt(account.alert_threshold),
    gestor,
    status: statusLabel,
  };

  const isPaymentProblem =
    metaData.account_status === 3 /* UNSETTLED */ || metaData.disable_reason === 3 /* RISK_PAYMENT */;

  const custom = account.custom_message?.trim() || null;

  let templateKey: TemplateKey;
  if (isPaymentProblem) templateKey = "pagamento";
  else if (statusLabel !== "ACTIVE") templateKey = "desativada";
  else templateKey = "saldo";

  return {
    templateKey,
    message: render(custom ?? templates[templateKey], vars),
    available,
    statusLabel,
  };
}

/** Busca todas as contas ativas, verifica saldo/status na Meta e dispara alertas quando necessário. */
export async function checkAllBalances(): Promise<CheckResult[]> {
  const supabase = getSupabaseAdmin();
  const templates = await loadTemplates(supabase);

  const { data: accounts, error } = await supabase
    .from("ad_accounts")
    .select(
      "id, meta_account_id, name, whatsapp_group_id, alert_threshold, currency, automation_enabled, custom_message, manager:managers(name)",
    )
    .eq("is_active", true);

  if (error) throw new Error(`Erro ao buscar contas no Supabase: ${error.message}`);

  const list = (accounts ?? []) as unknown as AdAccountRow[];

  // Processa em lotes para não fazer requisições sequenciais (lento) nem
  // todas de uma vez (risco de rate limit). Lotes de 10 em paralelo.
  const BATCH_SIZE = 10;
  const results: CheckResult[] = [];
  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const batch = list.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((account) => checkOneAccount(supabase, account, templates)),
    );
    results.push(...batchResults);
  }
  return results;
}

async function checkOneAccount(
  supabase: SupabaseClient,
  account: AdAccountRow,
  templates: Record<TemplateKey, string>,
): Promise<CheckResult> {
  let ctx: AlertContext;
  try {
    ctx = await evaluateAccount(supabase, account, templates);
  } catch (err) {
    const message = err instanceof MetaApiError ? err.message : (err as Error).message;
    return {
      accountId: account.id,
      accountName: account.name,
      balance: null,
      status: null,
      alertSent: false,
      error: message,
    };
  }

  // Alerta de saldo baixo só faz sentido em pré-paga e abaixo do limite; nos
  // demais casos (cartão ativo, pré-paga com saldo ok) não há nada a avisar.
  const isLowBalanceCase =
    ctx.templateKey === "saldo" &&
    ctx.available !== null &&
    ctx.available < account.alert_threshold;
  const isBlockingCase = ctx.templateKey === "pagamento" || ctx.templateKey === "desativada";

  let alertSent = false;
  if (isBlockingCase || isLowBalanceCase) {
    alertSent = await maybeAlert(supabase, account, ctx.templateKey, ctx.available, ctx.message);
  }

  return {
    accountId: account.id,
    accountName: account.name,
    balance: ctx.available,
    status: ctx.statusLabel,
    alertSent,
  };
}

/**
 * Dispara um alerta se: (a) automação ligada, (b) a conta tem grupo de WhatsApp
 * configurado, e (c) não houve alerta do mesmo tipo nas últimas
 * ALERT_COOLDOWN_HOURS horas. Registra o envio em alerts_log.
 */
async function maybeAlert(
  supabase: SupabaseClient,
  account: AdAccountRow,
  templateKey: TemplateKey,
  balance: number | null,
  message: string,
): Promise<boolean> {
  if (!account.automation_enabled) return false;
  if (!account.whatsapp_group_id) return false;

  const alertType = TEMPLATE_TO_ALERT[templateKey];
  const cooldownStart = new Date(
    Date.now() - ALERT_COOLDOWN_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: recentAlerts, error } = await supabase
    .from("alerts_log")
    .select("id")
    .eq("ad_account_id", account.id)
    .eq("alert_type", alertType)
    .gte("sent_at", cooldownStart)
    .limit(1);

  if (error) throw new Error(`Erro ao consultar alertas recentes: ${error.message}`);
  if (recentAlerts && recentAlerts.length > 0) return false;

  const sendResult = await sendWhatsAppMessage(account.whatsapp_group_id, message);

  await supabase.from("alerts_log").insert({
    ad_account_id: account.id,
    alert_type: alertType,
    balance_at_alert: balance,
    message,
    whatsapp_message_id: sendResult.messageId,
  });

  return true;
}

export interface ForceSendResult {
  accountName: string;
  message: string;
}

/**
 * Dispara o alerta de uma conta AGORA, ignorando automação ligada/desligada,
 * limite de saldo e cooldown de 24h. Usado pelo botão "Disparar" no painel.
 * Continua exigindo que a conta tenha um grupo de WhatsApp configurado.
 */
export async function forceSendAlert(accountId: string): Promise<ForceSendResult> {
  const supabase = getSupabaseAdmin();
  const templates = await loadTemplates(supabase);

  const { data: account, error } = await supabase
    .from("ad_accounts")
    .select(
      "id, meta_account_id, name, whatsapp_group_id, alert_threshold, currency, automation_enabled, custom_message, manager:managers(name)",
    )
    .eq("id", accountId)
    .single();

  if (error || !account) throw new Error("Conta não encontrada.");
  const row = account as unknown as AdAccountRow;

  if (!row.whatsapp_group_id) {
    throw new Error("Esta conta não tem um grupo/número de WhatsApp configurado.");
  }

  const ctx = await evaluateAccount(supabase, row, templates);

  const sendResult = await sendWhatsAppMessage(row.whatsapp_group_id, ctx.message);

  await supabase.from("alerts_log").insert({
    ad_account_id: row.id,
    alert_type: TEMPLATE_TO_ALERT[ctx.templateKey],
    balance_at_alert: ctx.available,
    message: ctx.message,
    whatsapp_message_id: sendResult.messageId,
  });

  return { accountName: row.name, message: ctx.message };
}
