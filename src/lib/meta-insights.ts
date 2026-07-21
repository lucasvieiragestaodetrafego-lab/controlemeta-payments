// src/lib/meta-insights.ts
import { getConfig, graphGetAll } from "./meta";
import {
  sumActionValue,
  computeRoas,
  computeTicketMedio,
  rankCreatives,
  type CreativeInsight,
  type InsightAction,
} from "./report-metrics";

export type ReportPeriod = "today" | "last_7_days" | "last_30_days" | "current_month";

const DATE_PRESET: Record<ReportPeriod, string> = {
  today: "today",
  last_7_days: "last_7d",
  last_30_days: "last_30d",
  current_month: "this_month",
};

/**
 * Tipos de ação considerados "conversão" nesta ordem de prioridade — usa o
 * primeiro que tiver valor > 0. Cobre os objetivos mais comuns de campanha
 * (compra, lead, conversa iniciada no WhatsApp/Messenger).
 */
const CONVERSION_ACTION_TYPES: { types: string[]; label: string }[] = [
  { types: ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"], label: "Resultados" },
  { types: ["lead", "onsite_conversion.lead_grouped"], label: "Resultados" },
  {
    types: [
      "onsite_conversion.messaging_conversation_started_7d",
      "onsite_conversion.messaging_first_reply",
    ],
    label: "Mensagens",
  },
];

interface RawInsightRow {
  spend?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  reach?: string;
  actions?: InsightAction[];
  action_values?: InsightAction[];
  date_start?: string;
  date_stop?: string;
  ad_id?: string;
  ad_name?: string;
}

/** Escolhe o primeiro tipo de conversão com valor > 0; senão cai para o primeiro da lista (0). */
function pickConversions(actions: InsightAction[] | undefined): { conversions: number; actionValue: number; label: string } {
  for (const { types, label } of CONVERSION_ACTION_TYPES) {
    const conversions = sumActionValue(actions, types);
    if (conversions > 0) return { conversions, actionValue: 0, label };
  }
  return { conversions: 0, actionValue: 0, label: CONVERSION_ACTION_TYPES[0].label };
}

async function fetchInsights(adAccountId: string, period: ReportPeriod, level: "account" | "ad") {
  const { token, version } = getConfig();
  const fields =
    level === "account"
      ? "spend,clicks,ctr,cpc,reach,actions,action_values,date_start,date_stop"
      : "spend,clicks,ctr,actions,ad_id,ad_name";

  const params: Record<string, string> = {
    fields,
    date_preset: DATE_PRESET[period],
    access_token: token,
  };
  if (level === "ad") params.level = "ad";

  return graphGetAll<RawInsightRow>(`/${adAccountId}/insights`, params);
}

export interface AccountInsights {
  spend: number;
  clicks: number;
  ctr: number;
  cpc: number;
  reach: number;
  conversions: number;
  costPerConversion: number | null;
  roas: number | null;
  ticketMedio: number | null;
  resultLabel: string;
  dateStart: string;
  dateStop: string;
}

/** Busca métricas agregadas da conta para o período informado. */
export async function getAccountInsights(
  adAccountId: string,
  period: ReportPeriod,
): Promise<AccountInsights> {
  const rows = await fetchInsights(adAccountId, period, "account");
  const row = rows[0];

  if (!row) {
    return {
      spend: 0,
      clicks: 0,
      ctr: 0,
      cpc: 0,
      reach: 0,
      conversions: 0,
      costPerConversion: null,
      roas: null,
      ticketMedio: null,
      resultLabel: CONVERSION_ACTION_TYPES[0].label,
      dateStart: "",
      dateStop: "",
    };
  }

  const spend = Number(row.spend ?? 0);
  const { conversions, label } = pickConversions(row.actions);
  const actionValue = sumActionValue(row.action_values, CONVERSION_ACTION_TYPES.flatMap((c) => c.types));
  const costPerConversion = conversions > 0 ? spend / conversions : null;

  return {
    spend,
    clicks: Number(row.clicks ?? 0),
    ctr: Number(row.ctr ?? 0),
    cpc: Number(row.cpc ?? 0),
    reach: Number(row.reach ?? 0),
    conversions,
    costPerConversion,
    roas: computeRoas(spend, actionValue),
    ticketMedio: computeTicketMedio(actionValue, conversions),
    resultLabel: label,
    dateStart: row.date_start ?? "",
    dateStop: row.date_stop ?? "",
  };
}

/** Busca o ranking dos criativos com melhor desempenho no período. */
export async function getTopCreatives(
  adAccountId: string,
  period: ReportPeriod,
  limit: number,
): Promise<CreativeInsight[]> {
  const rows = await fetchInsights(adAccountId, period, "ad");

  const creatives: CreativeInsight[] = rows.map((row) => {
    const clicks = Number(row.clicks ?? 0);
    const spend = Number(row.spend ?? 0);
    const { conversions } = pickConversions(row.actions);
    return {
      adId: row.ad_id ?? "",
      adName: row.ad_name ?? "—",
      // Link do post não é um campo do endpoint /insights — buscar o
      // permalink exigiria uma chamada extra por anúncio (fora de escopo por ora).
      permalink: null,
      conversions,
      clicks,
      ctr: Number(row.ctr ?? 0),
      cpa: conversions > 0 ? spend / conversions : null,
    };
  });

  return rankCreatives(creatives, limit);
}
