import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabase";
import { getAccountInsights, getTopCreatives, type ReportPeriod } from "./meta-insights";
import { formatCreativeRankingText } from "./report-metrics";
import { computeNextSendAt, type ReportFrequency } from "./report-schedule";
import { sendWhatsAppMessage } from "./zapi";
import { TRACKED_ACTIONS } from "./report-variables";

interface MetricReportRow {
  id: string;
  name: string;
  ad_account_id: string;
  whatsapp_group_id: string;
  frequency: ReportFrequency;
  send_hour: number;
  send_minute: number;
  period: ReportPeriod;
  message_template: string;
  creative_ranking_size: number | null;
  account: { meta_account_id: string; name: string; currency: string } | null;
}

/** Substitui `{chave}` pelo valor correspondente; chaves sem valor ficam como estão. */
export function renderReportMessage(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? vars[key] : match,
  );
}

const currencyFmt = (v: number, currency: string) =>
  v.toLocaleString("pt-BR", { style: "currency", currency });

const PERIOD_LABEL: Record<ReportPeriod, string> = {
  today: "Hoje",
  last_7_days: "Últimos 7 dias",
  last_30_days: "Últimos 30 dias",
  current_month: "Mês atual",
};

async function buildMessage(report: MetricReportRow): Promise<string> {
  if (!report.account) throw new Error("Conta de anúncio não encontrada.");

  const insights = await getAccountInsights(report.account.meta_account_id, report.period);
  const currency = report.account.currency;

  let topCreativesText = "";
  if (report.creative_ranking_size) {
    try {
      const creatives = await getTopCreatives(
        report.account.meta_account_id,
        report.period,
        report.creative_ranking_size,
      );
      topCreativesText = formatCreativeRankingText(creatives, insights.resultLabel);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Erro ao buscar ranking de criativos (relatório "${report.name}"): ${message}`);
    }
  }

  const vars: Record<string, string> = {
    conta: report.account.name,
    periodo: PERIOD_LABEL[report.period] ?? report.period,
    data_inicio: insights.dateStart,
    data_fim: insights.dateStop,
    investimento: currencyFmt(insights.spend, currency),
    cliques: String(insights.clicks),
    cliques_unicos: String(insights.uniqueClicks),
    ctr: `${insights.ctr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} %`,
    ctr_unico: `${insights.uniqueCtr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} %`,
    cpc: currencyFmt(insights.cpc, currency),
    cpm: currencyFmt(insights.cpm, currency),
    alcance: String(insights.reach),
    impressoes: String(insights.impressions),
    frequencia: insights.frequency.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
    engajamento: String(insights.engagement),
    visualizacoes_video: String(insights.videoViews),
    conversoes: String(insights.conversions),
    custo_por_conversao:
      insights.costPerConversion != null ? currencyFmt(insights.costPerConversion, currency) : "—",
    roas: insights.roas != null ? insights.roas.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—",
    ticket_medio: insights.ticketMedio != null ? currencyFmt(insights.ticketMedio, currency) : "—",
    top_criativos: topCreativesText,
  };

  for (const action of TRACKED_ACTIONS) {
    const count = insights.detailedActions[action.key] ?? 0;
    const value = insights.detailedActionValues[action.valueKey] ?? 0;
    vars[action.key] = String(count);
    vars[action.costKey] = count > 0 ? currencyFmt(insights.spend / count, currency) : "—";
    vars[action.valueKey] = currencyFmt(value, currency);
  }

  return renderReportMessage(report.message_template, vars);
}

const SELECT_REPORT =
  "id, name, ad_account_id, whatsapp_group_id, frequency, send_hour, send_minute, period, message_template, creative_ranking_size, account:ad_accounts(meta_account_id, name, currency)";

/** Envia todos os relatórios agendados cujo `next_send_at` já venceu. */
export async function sendScheduledReports(): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("metric_reports")
    .select(SELECT_REPORT)
    .eq("is_active", true)
    .lte("next_send_at", new Date().toISOString());

  if (error) throw new Error(`Erro ao buscar relatórios agendados: ${error.message}`);

  const reports = (data ?? []) as unknown as MetricReportRow[];

  for (const report of reports) {
    try {
      await sendOne(supabase, report);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Erro ao enviar relatório "${report.name}" (${report.id}): ${message}`);
    }
  }
}

async function sendOne(supabase: SupabaseClient, report: MetricReportRow): Promise<void> {
  const message = await buildMessage(report);
  const sendResult = await sendWhatsAppMessage(report.whatsapp_group_id, message);

  await supabase.from("report_log").insert({
    metric_report_id: report.id,
    message,
    whatsapp_message_id: sendResult.messageId,
  });

  const nextSendAt = computeNextSendAt(report.frequency, report.send_hour, report.send_minute, new Date());
  await supabase
    .from("metric_reports")
    .update({ next_send_at: nextSendAt.toISOString() })
    .eq("id", report.id);
}

/** Dispara um relatório específico agora, sem alterar `next_send_at` (botão "Enviar agora"). */
export async function forceSendReport(reportId: string): Promise<{ reportName: string; message: string }> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("metric_reports")
    .select(SELECT_REPORT)
    .eq("id", reportId)
    .single();

  if (error || !data) throw new Error("Relatório não encontrado.");
  const report = data as unknown as MetricReportRow;

  const message = await buildMessage(report);
  const sendResult = await sendWhatsAppMessage(report.whatsapp_group_id, message);

  await supabase.from("report_log").insert({
    metric_report_id: report.id,
    message,
    whatsapp_message_id: sendResult.messageId,
  });

  return { reportName: report.name, message };
}
