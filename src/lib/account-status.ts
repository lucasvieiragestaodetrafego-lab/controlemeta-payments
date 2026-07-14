export type SituacaoTone = "green" | "red" | "amber" | "muted";

export interface Situacao {
  label: string;
  tone: SituacaoTone;
  /** true quando a conta está efetivamente parada/travada (para contagem). */
  travada: boolean;
}

const FRIENDLY_STATUS: Record<string, string> = {
  DISABLED: "Desativada",
  UNSETTLED: "Travada (pagamento)",
  PENDING_RISK_REVIEW: "Em análise",
  PENDING_SETTLEMENT: "Aguardando pagamento",
  IN_GRACE_PERIOD: "Período de carência",
  PENDING_CLOSURE: "Fechamento pendente",
  CLOSED: "Fechada",
};

/**
 * Deriva a situação da conta para exibição, a partir do último status do Meta,
 * do tipo (pré-paga) e do saldo. Uma conta pré-paga ATIVA mas com saldo <= 0
 * está parada por falta de saldo.
 */
export function getSituacao(
  status: string | null,
  isPrepay: boolean | null,
  balance: number | null,
  threshold?: number,
): Situacao {
  if (!status) return { label: "Sem checagem", tone: "muted", travada: false };

  if (status === "UNSETTLED") {
    return { label: "Travada (pagamento)", tone: "red", travada: true };
  }

  if (status !== "ACTIVE") {
    return { label: FRIENDLY_STATUS[status] ?? status, tone: "red", travada: true };
  }

  if (isPrepay && balance !== null && balance <= 0) {
    return { label: "Sem saldo", tone: "red", travada: true };
  }

  if (isPrepay && balance !== null && threshold !== undefined && balance < threshold) {
    return { label: "Saldo baixo", tone: "amber", travada: false };
  }

  return { label: "Ativa", tone: "green", travada: false };
}
