export interface ClientGroup<T> {
  clientName: string;
  rows: T[];
}

/**
 * Agrupa uma lista plana de contas pelo nome do cliente, ordenando os grupos
 * pelo nome do cliente e as contas dentro de cada grupo pelo nome da conta.
 * Preparação para clientes com mais de uma conta/plataforma (ex: Meta + Google).
 */
export function groupAccountsByClient<T extends { clientName: string; name: string }>(
  rows: T[],
): ClientGroup<T>[] {
  const byClient = new Map<string, T[]>();
  for (const row of rows) {
    const list = byClient.get(row.clientName) ?? [];
    list.push(row);
    byClient.set(row.clientName, list);
  }

  return Array.from(byClient.entries())
    .map(([clientName, clientRows]) => ({
      clientName,
      rows: [...clientRows].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.clientName.localeCompare(b.clientName));
}
