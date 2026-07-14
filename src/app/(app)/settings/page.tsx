import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { runCheckNow, updateAccount } from "@/app/actions";
import NovaAutomacaoSection from "./NovaAutomacaoSection";

interface SettingsAccount {
  id: string;
  meta_account_id: string;
  name: string;
  whatsapp_group_id: string | null;
  alert_threshold: number;
  currency: string;
  automation_enabled: boolean;
  is_active: boolean;
  custom_message: string | null;
  manager: { name: string } | null;
}

interface ManagerOption {
  id: string;
  name: string;
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getSupabaseAdmin();

  const { data: manager } = await admin
    .from("managers")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  if (!manager || manager.role !== "admin") {
    redirect("/");
  }

  const { data: accountsData } = await admin
    .from("ad_accounts")
    .select(
      "id, meta_account_id, name, whatsapp_group_id, alert_threshold, currency, automation_enabled, custom_message, is_active, manager:managers(name)",
    )
    .order("name");

  const accounts = (accountsData ?? []) as unknown as SettingsAccount[];

  const defaultWhatsappGroupId = process.env.ZAPI_GROUP_IDS ?? "";

  const { data: managersData } = await admin.from("managers").select("id, name").order("name");
  const managers = (managersData ?? []) as ManagerOption[];

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Configurações</h1>
          <p className="text-sm text-slate-400">
            Crie automações e edite o WhatsApp, o limite e a mensagem de cada conta.
          </p>
        </div>
        <form action={runCheckNow}>
          <button className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Atualizar saldos agora
          </button>
        </form>
      </header>

      <section
        id="nova-automacao"
        className="mb-8 scroll-mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4"
      >
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Nova automação</h2>
        <Suspense
          fallback={
            <p className="text-sm text-slate-500">Carregando contas do Meta…</p>
          }
        >
          <NovaAutomacaoSection
            managers={managers}
            defaultWhatsappGroupId={defaultWhatsappGroupId}
          />
        </Suspense>
      </section>

      <div className="space-y-3">
        {accounts.length === 0 && (
          <p className="text-sm text-slate-500">
            Nenhuma conta cadastrada ainda. Use o formulário acima.
          </p>
        )}

        {accounts.map((account) => (
          <form
            key={account.id}
            action={updateAccount}
            className="grid grid-cols-1 gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4 sm:grid-cols-[1fr_1fr_auto]"
          >
            <input type="hidden" name="id" value={account.id} />

            <div>
              <label className="block text-xs text-slate-400">Nome da conta</label>
              <input
                name="name"
                defaultValue={account.name}
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              />
              <p className="mt-1 text-xs text-slate-500">
                {account.meta_account_id} · Gestor: {account.manager?.name ?? "—"} · Limite:{" "}
                {account.alert_threshold.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: account.currency,
                })}
              </p>
            </div>

            <div>
              <label className="block text-xs text-slate-400">Grupo/telefone WhatsApp</label>
              <input
                name="whatsapp_group_id"
                defaultValue={account.whatsapp_group_id ?? ""}
                placeholder="ex: 120363421960030596-group"
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400">
                Mensagem personalizada (em branco = mensagem padrão)
              </label>
              <textarea
                name="custom_message"
                defaultValue={account.custom_message ?? ""}
                rows={3}
                placeholder="Marcadores: {conta}, {saldo}, {limite}, {gestor}, {status}"
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              />
            </div>

            <div className="flex items-end gap-3 sm:col-span-2">
              <div>
                <label className="block text-xs text-slate-400">Limite (R$)</label>
                <input
                  name="alert_threshold"
                  type="number"
                  step="0.01"
                  defaultValue={account.alert_threshold}
                  className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                />
              </div>
              <label className="flex items-center gap-1 text-xs text-slate-300">
                <input
                  type="checkbox"
                  name="automation_enabled"
                  defaultChecked={account.automation_enabled}
                />
                Automação ativa
              </label>
              <button
                type="submit"
                className="rounded bg-slate-700 px-3 py-1 text-xs font-medium text-white hover:bg-slate-600"
              >
                Salvar
              </button>
            </div>
          </form>
        ))}
      </div>
    </main>
  );
}
