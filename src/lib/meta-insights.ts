// src/lib/meta-insights.ts
import { getConfig, graphGet, graphGetAll } from "./meta";
import {
  sumActionValue,
  computeRoas,
  computeTicketMedio,
  rankCreatives,
  type CreativeInsight,
  type InsightAction,
} from "./report-metrics";
import { TRACKED_ACTIONS } from "./report-variables";

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
  cpm?: string;
  reach?: string;
  impressions?: string;
  frequency?: string;
  unique_clicks?: string;
  unique_ctr?: string;
  actions?: InsightAction[];
  action_values?: InsightAction[];
  date_start?: string;
  date_stop?: string;
  ad_id?: string;
  ad_name?: string;
}

/** Tipos de ação somados em {engajamento} — curtidas, comentários, compartilhamentos e cliques no post. */
const ENGAGEMENT_ACTION_TYPES = ["post_engagement"];
/** Tipo de ação somado em {visualizacoes_video}. */
const VIDEO_VIEW_ACTION_TYPES = ["video_view"];

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
      ? "spend,clicks,ctr,cpc,cpm,reach,impressions,frequency,unique_clicks,unique_ctr,actions,action_values,date_start,date_stop"
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
  cpm: number;
  reach: number;
  impressions: number;
  frequency: number;
  uniqueClicks: number;
  uniqueCtr: number;
  engagement: number;
  videoViews: number;
  /** Contagem de cada resultado específico (compras, carrinho, leads, etc.), por chave de TRACKED_ACTIONS. */
  detailedActions: Record<string, number>;
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
      cpm: 0,
      reach: 0,
      impressions: 0,
      frequency: 0,
      uniqueClicks: 0,
      uniqueCtr: 0,
      engagement: 0,
      videoViews: 0,
      detailedActions: Object.fromEntries(TRACKED_ACTIONS.map((a) => [a.key, 0])),
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
    cpm: Number(row.cpm ?? 0),
    reach: Number(row.reach ?? 0),
    impressions: Number(row.impressions ?? 0),
    frequency: Number(row.frequency ?? 0),
    uniqueClicks: Number(row.unique_clicks ?? 0),
    uniqueCtr: Number(row.unique_ctr ?? 0),
    engagement: sumActionValue(row.actions, ENGAGEMENT_ACTION_TYPES),
    videoViews: sumActionValue(row.actions, VIDEO_VIEW_ACTION_TYPES),
    detailedActions: Object.fromEntries(
      TRACKED_ACTIONS.map((a) => [a.key, sumActionValue(row.actions, a.actionTypes)]),
    ),
    conversions,
    costPerConversion,
    roas: computeRoas(spend, actionValue),
    ticketMedio: computeTicketMedio(actionValue, conversions),
    resultLabel: label,
    dateStart: row.date_start ?? "",
    dateStop: row.date_stop ?? "",
  };
}

interface AdCreativeFields {
  creative?: {
    instagram_permalink_url?: string;
    effective_object_story_id?: string;
  };
}

/**
 * Busca o link do post (Instagram ou Facebook) de um anúncio. Não vem no
 * endpoint /insights — é uma chamada à parte, feita só para os anúncios que
 * entram no ranking (no máximo 5), nunca para a lista inteira de anúncios.
 * Retorna null (sem quebrar o envio) se o anúncio não tiver post vinculado
 * ou a chamada falhar.
 */
async function getAdPermalink(adId: string): Promise<string | null> {
  try {
    const data = await graphGet<AdCreativeFields>(`/${adId}`, {
      fields: "creative{instagram_permalink_url,effective_object_story_id}",
    });
    const creative = data.creative;
    if (!creative) return null;
    if (creative.instagram_permalink_url) return creative.instagram_permalink_url;
    if (creative.effective_object_story_id) {
      const [pageId, postId] = creative.effective_object_story_id.split("_");
      if (pageId && postId) return `https://www.facebook.com/${pageId}/posts/${postId}`;
    }
    return null;
  } catch {
    return null;
  }
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
      permalink: null,
      conversions,
      clicks,
      ctr: Number(row.ctr ?? 0),
      cpa: conversions > 0 ? spend / conversions : null,
    };
  });

  const ranked = rankCreatives(creatives, limit);

  return Promise.all(
    ranked.map(async (c) => ({ ...c, permalink: await getAdPermalink(c.adId) })),
  );
}
