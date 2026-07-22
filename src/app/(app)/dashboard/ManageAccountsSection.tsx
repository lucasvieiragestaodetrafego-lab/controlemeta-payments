// src/app/(app)/dashboard/ManageAccountsSection.tsx
import { listBusinessAdAccountsCached } from "@/lib/meta";
import { listDashboardAccounts, mergeAccountsWithMembership } from "@/lib/dashboard-accounts";
import ManageAccountsForm from "./ManageAccountsForm";

export default async function ManageAccountsSection() {
  const dashboardAccounts = await listDashboardAccounts();

  try {
    const metaAccounts = await listBusinessAdAccountsCached();
    const merged = mergeAccountsWithMembership(
      metaAccounts.map((a) => ({ metaAccountId: a.id, name: a.name })),
      dashboardAccounts,
    );
    return <ManageAccountsForm accounts={merged} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar contas do Meta.";
    return <p className="rounded bg-red-950 px-3 py-2 text-sm text-red-300">{message}</p>;
  }
}
