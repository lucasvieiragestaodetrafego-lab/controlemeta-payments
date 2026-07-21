export interface InsightAction {
  action_type: string;
  value: string;
}

/** Soma os valores de `actions`/`action_values` cujo tipo está em `types`. */
export function sumActionValue(actions: InsightAction[] | undefined, types: string[]): number {
  if (!actions) return 0;
  return actions
    .filter((a) => types.includes(a.action_type))
    .reduce((sum, a) => sum + Number(a.value), 0);
}

/** ROAS: valor gerado pelas conversões dividido pelo investimento. */
export function computeRoas(spend: number, actionValue: number): number | null {
  if (spend <= 0) return null;
  return actionValue / spend;
}

/** Ticket médio: valor gerado pelas conversões dividido pela quantidade delas. */
export function computeTicketMedio(actionValue: number, conversions: number): number | null {
  if (conversions <= 0) return null;
  return actionValue / conversions;
}

export interface CreativeInsight {
  adId: string;
  adName: string;
  permalink: string | null;
  conversions: number;
  clicks: number;
  ctr: number;
  cpa: number | null;
}

/**
 * Ordena os criativos pelo número de conversões (desempate/fallback por
 * cliques, para campanhas sem otimização de conversão) e retorna os top N.
 */
export function rankCreatives(rows: CreativeInsight[], limit: number): CreativeInsight[] {
  return [...rows]
    .sort((a, b) => {
      if (b.conversions !== a.conversions) return b.conversions - a.conversions;
      return b.clicks - a.clicks;
    })
    .slice(0, limit);
}

const MEDALS = ["🏆", "🥈", "🥉"];

function medalFor(position: number): string {
  return MEDALS[position] ?? `${position + 1}º`;
}

const currencyFmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");
const percentFmt = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

/** Monta o bloco de texto do ranking de criativos, pronto para entrar na mensagem do WhatsApp. */
export function formatCreativeRankingText(ranked: CreativeInsight[], resultLabel: string): string {
  return ranked
    .map((r, i) => {
      const lines = [
        `${medalFor(i)} ${i + 1}. ${r.adName}`,
        `${resultLabel}: ${r.conversions} | CPA: ${r.cpa != null ? currencyFmt(r.cpa) : "—"} | CTR: ${percentFmt(r.ctr)}`,
      ];
      if (r.permalink) lines.push(`🔗 ${r.permalink}`);
      return lines.join("\n");
    })
    .join("\n\n");
}
