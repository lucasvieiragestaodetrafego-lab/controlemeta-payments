import { getSupabaseAdmin } from "@/lib/supabase";
import { listBusinessAdAccountsCached, getAvailableBalance } from "@/lib/meta";
import NewAutomationForm from "./NewAutomationForm";

interface ManagerOption {
  id: string;
  name: string;
}

/**
 * Busca a lista de contas do Meta (chamada lenta, ~15s no primeiro acesso, depois
 * em cache). Fica dentro de um <Suspense> para não travar o resto da página.
 */
export default async function NovaAutomacaoSection({
  managers,
  defaultWhatsappGroupId,
}: {
  managers: ManagerOption[];
  defaultWhatsappGroupId: string;
}) {
  const admin = getSupabaseAdmin();
  const { data: registered } = await admin.from("ad_accounts").select("meta_account_id");
  const registeredIds = new Set((registered ?? []).map((a) => a.meta_account_id));

  let metaAccounts: {
    id: string;
    name: string;
    available: number | null;
    currency: string;
    isPrepay: boolean;
  }[] = [];
  let metaError: string | null = null;
  try {
    const businessAccounts = await listBusinessAdAccountsCached();
    metaAccounts = businessAccounts
      .filter((a) => !registeredIds.has(a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        available: getAvailableBalance(a),
        currency: a.currency,
        isPrepay: a.is_prepay_account,
      }));
  } catch (err) {
    metaError = err instanceof Error ? err.message : "Erro ao buscar contas do Meta.";
  }

  if (metaError) {
    return (
      <p className="rounded bg-red-950 px-3 py-2 text-sm text-red-300">
        Não foi possível buscar as contas do Meta agora: {metaError}
      </p>
    );
  }

  return (
    <NewAutomationForm
      metaAccounts={metaAccounts}
      managers={managers}
      defaultWhatsappGroupId={defaultWhatsappGroupId}
    />
  );
}
