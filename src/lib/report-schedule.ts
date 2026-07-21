export type ReportFrequency = "daily" | "weekly" | "monthly";

const DAYS_TO_ADD: Record<ReportFrequency, number> = {
  daily: 1,
  weekly: 7,
  monthly: 0, // tratado à parte, avançando o mês
};

/** Calcula o próximo horário de envio a partir de `from`, no horário `sendHour` (UTC). */
export function computeNextSendAt(frequency: ReportFrequency, sendHour: number, from: Date): Date {
  const next = new Date(from);
  next.setUTCHours(sendHour, 0, 0, 0);

  if (frequency === "monthly") {
    next.setUTCMonth(next.getUTCMonth() + 1);
  } else {
    next.setUTCDate(next.getUTCDate() + DAYS_TO_ADD[frequency]);
  }

  return next;
}
