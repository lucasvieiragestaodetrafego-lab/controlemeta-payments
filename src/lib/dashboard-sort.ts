// src/lib/dashboard-sort.ts
export type OverviewSortKey = "name" | "spend" | "resultValue" | "costPerResult" | "roas";

export interface SortableRow {
  name: string;
  spend: number;
  resultValue: number;
  costPerResult: number | null;
  roas: number | null;
}

/** Ordena linhas da visão geral por coluna. Nulls vão sempre pro fim, independente da direção. Função pura, não muta o array. */
export function sortOverviewRows<T extends SortableRow>(
  rows: T[],
  key: OverviewSortKey,
  direction: "asc" | "desc",
): T[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "string" || typeof bv === "string") {
      return factor * String(av).localeCompare(String(bv));
    }
    return factor * ((av as number) - (bv as number));
  });
}
