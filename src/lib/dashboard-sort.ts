// src/lib/dashboard-sort.ts

export interface SortableRow {
  name: string;
  /** Valor de cada coluna selecionada, por chave do catálogo (ou pseudo-chave como "resultado"). */
  values: Record<string, number | null>;
}

/**
 * Ordena linhas da visão geral por "name" (alfabético) ou por qualquer
 * chave presente em `values` (numérico). Nulls (e chaves ausentes) vão
 * sempre pro fim, independente da direção. Função pura, não muta o array.
 */
export function sortOverviewRows<T extends SortableRow>(
  rows: T[],
  sortKey: string,
  direction: "asc" | "desc",
): T[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortKey === "name") return factor * a.name.localeCompare(b.name);
    const av = a.values[sortKey] ?? null;
    const bv = b.values[sortKey] ?? null;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return factor * (av - bv);
  });
}
