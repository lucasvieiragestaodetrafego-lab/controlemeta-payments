import { unstable_cache } from "next/cache";

const ZAPI_BASE = "https://api.z-api.io";

export class ZApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ZApiError";
  }
}

function getConfig() {
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;

  if (!instanceId) throw new Error("ZAPI_INSTANCE_ID não está configurado.");
  if (!token) throw new Error("ZAPI_TOKEN não está configurado.");
  if (!clientToken) throw new Error("ZAPI_CLIENT_TOKEN não está configurado.");

  return { instanceId, token, clientToken };
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { instanceId, token, clientToken } = getConfig();
  const url = `${ZAPI_BASE}/instances/${instanceId}/token/${token}${path}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": clientToken,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ZApiError(
      (data as { message?: string }).message ?? `Z-API retornou status ${res.status}`,
      res.status,
    );
  }

  return data as T;
}

async function get<T>(path: string): Promise<T> {
  const { instanceId, token, clientToken } = getConfig();
  const url = `${ZAPI_BASE}/instances/${instanceId}/token/${token}${path}`;

  const res = await fetch(url, {
    headers: { "Client-Token": clientToken },
  });

  const data = await res.json().catch(() => []);

  if (!res.ok) {
    throw new ZApiError(
      (data as { message?: string }).message ?? `Z-API retornou status ${res.status}`,
      res.status,
    );
  }

  return data as T;
}

interface SendTextResponse {
  zaapId: string;
  messageId: string;
  id: string;
}

/**
 * Envia uma mensagem de texto para um número ou grupo do WhatsApp.
 * `phone` aceita tanto um número (com DDI+DDD) quanto um ID de grupo
 * (formato retornado pela Z-API em /chats, ex: "1203634...-group").
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string,
): Promise<SendTextResponse> {
  return post<SendTextResponse>("/send-text", { phone, message });
}

/** Formata e envia o alerta padrão de saldo baixo para o grupo responsável. */
export async function sendLowBalanceAlert(params: {
  groupId: string;
  accountName: string;
  balance: number;
  threshold: number;
  currency: string;
  managerName: string;
}): Promise<SendTextResponse> {
  const { groupId, accountName, balance, threshold, currency, managerName } = params;

  const formattedBalance = balance.toLocaleString("pt-BR", {
    style: "currency",
    currency,
  });
  const formattedThreshold = threshold.toLocaleString("pt-BR", {
    style: "currency",
    currency,
  });

  const message =
    `⚠️ *Alerta de saldo baixo*\n\n` +
    `Conta: *${accountName}*\n` +
    `Saldo atual: ${formattedBalance}\n` +
    `Limite configurado: ${formattedThreshold}\n` +
    `Gestor responsável: ${managerName}\n\n` +
    `Verifique o pagamento para evitar que a conta seja desativada.`;

  return sendWhatsAppMessage(groupId, message);
}

export interface WhatsAppGroup {
  id: string;
  name: string;
}

/**
 * Filtra apenas os grupos da lista de chats da Z-API (ids terminados em
 * "-group", mesmo formato já usado em sendWhatsAppMessage) e ordena por nome.
 * Extraída como função pura para ser testável sem chamar a API de verdade.
 */
export function parseGroupChats(chats: unknown[]): WhatsAppGroup[] {
  const groups: WhatsAppGroup[] = [];

  for (const chat of chats) {
    if (typeof chat !== "object" || chat === null) continue;
    const c = chat as Record<string, unknown>;
    const phone = typeof c.phone === "string" ? c.phone : null;
    if (!phone || !phone.endsWith("-group")) continue;
    const rawName = typeof c.name === "string" ? c.name.trim() : "";
    groups.push({ id: phone, name: rawName || phone });
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

/** Busca a lista de chats da instância e retorna só os grupos (nome + id). */
export async function listWhatsAppGroups(): Promise<WhatsAppGroup[]> {
  const chats = await get<unknown[]>("/chats");
  return parseGroupChats(chats);
}

/**
 * Versão em cache de listWhatsAppGroups. Revalida a cada 5 minutos — grupos
 * novos no WhatsApp aparecem nesse intervalo, sem bater na Z-API a cada
 * abertura do modal de novo relatório.
 */
export const listWhatsAppGroupsCached = unstable_cache(
  listWhatsAppGroups,
  ["whatsapp-groups"],
  { revalidate: 300 },
);
