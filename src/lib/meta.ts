import { unstable_cache } from "next/cache";

const GRAPH_BASE = "https://graph.facebook.com";

const ACCOUNT_FIELDS =
  "name,account_status,disable_reason,balance,amount_spent,spend_cap,currency,funding_source_details,is_prepay_account";

export type MetaAccountStatus = 1 | 2 | 3 | 7 | 8 | 9 | 100 | 101;

export interface MetaAdAccount {
  id: string;
  name: string;
  account_status: MetaAccountStatus;
  /**
   * Motivo pelo qual a conta foi desativada, quando aplicável.
   * 0 = nenhum, 3 = RISK_PAYMENT (problema de cobrança/pagamento).
   */
  disable_reason?: number;
  /**
   * Contas pré-pagas (is_prepay_account=true): `balance` é o saldo
   * disponível pra gastar — baixo = perigo de parar de veicular.
   * Contas com linha de crédito/cartão (is_prepay_account=false):
   * `balance` é o valor JÁ DEVIDO que será cobrado do cartão ao atingir
   * o limite de faturamento — baixo é normal, não indica risco.
   */
  balance: string;
  is_prepay_account: boolean;
  amount_spent: string;
  spend_cap?: string;
  currency: string;
  funding_source_details?: {
    id: string;
    display_string: string;
    type: number;
  };
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly type?: string,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

export function getConfig() {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  const businessId = process.env.META_BUSINESS_ID;
  const version = process.env.META_API_VERSION || "v21.0";

  if (!token) throw new Error("META_SYSTEM_USER_TOKEN não está configurado.");
  if (!businessId) throw new Error("META_BUSINESS_ID não está configurado.");

  return { token, businessId, version };
}

export async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const { token, version } = getConfig();
  const url = new URL(`${GRAPH_BASE}/${version}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new MetaApiError(
      data.error?.message ?? `Graph API retornou status ${res.status}`,
      data.error?.code,
      data.error?.type,
    );
  }

  return data as T;
}

interface Paged<T> {
  data: T[];
  paging?: { next?: string };
}

/** Busca todas as páginas de um edge, seguindo os cursores de paginação. */
export async function graphGetAll<T>(
  path: string,
  params: Record<string, string>,
): Promise<T[]> {
  const first = await graphGet<Paged<T>>(path, { ...params, limit: "100" });
  const all = [...first.data];
  let next = first.paging?.next;
  while (next) {
    const res = await fetch(next);
    const page = (await res.json()) as Paged<T> & { error?: { message?: string } };
    if (page.error) throw new MetaApiError(page.error.message ?? "Erro na paginação");
    all.push(...page.data);
    next = page.paging?.next;
  }
  return all;
}

/** Busca saldo e status de uma conta de anúncio específica (ex: "act_1234567890"). */
export async function getAdAccountBalance(adAccountId: string): Promise<MetaAdAccount> {
  return graphGet<MetaAdAccount>(`/${adAccountId}`, { fields: ACCOUNT_FIELDS });
}

/**
 * Saldo disponível REAL de uma conta pré-paga, em reais.
 *
 * Atenção: o campo `balance` da Graph API NÃO é o saldo disponível — é o valor
 * de fatura em aberto (em centavos). Para contas pré-pagas, o saldo disponível
 * só vem no texto de `funding_source_details.display_string`, no formato
 * "Saldo disponível (R$601,30 BRL)". Para contas de cartão não existe saldo
 * disponível (o display mostra o cartão, ex: "VISA *3854"), então retorna null.
 */
export function getAvailableBalance(account: MetaAdAccount): number | null {
  if (!account.is_prepay_account) return null;
  const display = account.funding_source_details?.display_string;
  if (!display) return null;
  // Captura um valor monetário no formato pt-BR: 601,30 ou 1.234,56
  const match = display.match(/(\d[\d.]*),(\d{2})/);
  if (!match) return null;
  const intPart = match[1].replace(/\./g, "");
  return Number(`${intPart}.${match[2]}`);
}

/**
 * Lista todas as contas de anúncio visíveis pelo Business Manager: tanto as
 * que a agência é dona (owned_ad_accounts, geralmente contas internas) quanto
 * as de clientes que compartilharam acesso com a agência (client_ad_accounts
 * — normalmente são as contas reais dos clientes).
 */
export async function listBusinessAdAccounts(): Promise<MetaAdAccount[]> {
  const { businessId } = getConfig();
  const [owned, client] = await Promise.all([
    graphGetAll<MetaAdAccount>(`/${businessId}/owned_ad_accounts`, { fields: ACCOUNT_FIELDS }),
    graphGetAll<MetaAdAccount>(`/${businessId}/client_ad_accounts`, { fields: ACCOUNT_FIELDS }),
  ]);

  const seen = new Set<string>();
  const merged: MetaAdAccount[] = [];
  for (const account of [...owned, ...client]) {
    if (seen.has(account.id)) continue;
    seen.add(account.id);
    merged.push(account);
  }
  return merged;
}

/**
 * Versão em cache de listBusinessAdAccounts (a chamada ao Meta leva ~18s).
 * Revalida a cada 10 minutos — contas novas no Meta aparecem nesse intervalo.
 * O filtro de "já cadastradas" continua vindo fresco do banco.
 */
export const listBusinessAdAccountsCached = unstable_cache(
  listBusinessAdAccounts,
  ["business-ad-accounts"],
  { revalidate: 1800 },
);
