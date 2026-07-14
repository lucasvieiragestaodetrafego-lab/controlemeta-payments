import { getSituacao, isAtRisk } from "./account-status";

export interface SnapshotRow {
  adAccountId: string;
  balance: number | null;
  accountStatus: string | null;
  checkedAt: string;
}

export interface RiskAccount {
  id: string;
  isPrepay: boolean | null;
  alertThreshold: number;
}

/** Formata uma data (UTC) como YYYY-MM-DD. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Série diária de "contas em risco". Para cada dia da janela, considera o
 * snapshot mais recente de cada conta até o fim daquele dia (23:59:59Z) e conta
 * quantas contas estavam em risco (via getSituacao + isAtRisk).
 */
export function buildRiskSeries(
  snapshots: SnapshotRow[],
  accounts: RiskAccount[],
  days: number,
  now: Date = new Date(),
): { date: string; count: number }[] {
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  // snapshots ordenados por tempo crescente por conta
  const byAccount = new Map<string, SnapshotRow[]>();
  for (const s of snapshots) {
    const arr = byAccount.get(s.adAccountId) ?? [];
    arr.push(s);
    byAccount.set(s.adAccountId, arr);
  }
  for (const arr of byAccount.values()) {
    arr.sort((x, y) => x.checkedAt.localeCompare(y.checkedAt));
  }

  const result: { date: string; count: number }[] = [];
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(todayUtc);
    day.setUTCDate(day.getUTCDate() - i);
    const endOfDay = new Date(day);
    endOfDay.setUTCHours(23, 59, 59, 999);

    let count = 0;
    for (const account of accounts) {
      const history = byAccount.get(account.id) ?? [];
      // último snapshot com checkedAt <= fim do dia
      let latest: SnapshotRow | undefined;
      for (const s of history) {
        if (new Date(s.checkedAt) <= endOfDay) latest = s;
        else break;
      }
      if (!latest) continue;
      const meta = accountById.get(account.id)!;
      const situacao = getSituacao(latest.accountStatus, meta.isPrepay, latest.balance, meta.alertThreshold);
      if (isAtRisk(situacao)) count++;
    }
    result.push({ date: dayKey(day), count });
  }

  return result;
}
