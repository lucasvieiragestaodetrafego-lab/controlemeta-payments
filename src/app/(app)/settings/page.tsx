import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase";

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

  if (!manager || manager.role !== "admin") redirect("/");

  const defaultWhatsappGroupId = process.env.ZAPI_GROUP_IDS ?? "";

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Configurações</h1>
        <p className="text-sm text-slate-400">
          Integrações de plataforma e padrões gerais. A criação e edição de relatórios agora
          ficam na página de Alertas.
        </p>
      </header>

      <section className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Integrações / Plataformas</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded border border-slate-800 px-3 py-2">
            <span className="inline-flex items-center gap-2 text-sm text-slate-200">
              <span className="h-2 w-2 rounded-full" style={{ background: "#1877f2" }} />
              Meta Ads
            </span>
            <span className="rounded bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">Conectado</span>
          </div>
          <div className="flex items-center justify-between rounded border border-slate-800 px-3 py-2 opacity-70">
            <span className="inline-flex items-center gap-2 text-sm text-slate-200">
              <span className="h-2 w-2 rounded-full" style={{ background: "#fbbc05" }} />
              Google Ads
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">Em breve</span>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Padrões gerais</h2>
        <p className="text-sm text-slate-300">
          Grupo de WhatsApp padrão (novos relatórios):{" "}
          <code className="rounded bg-slate-950 px-1.5 py-0.5 text-xs text-slate-200">
            {defaultWhatsappGroupId || "não configurado"}
          </code>
        </p>
        <p className="mt-2 text-sm text-slate-400">
          As mensagens de alerta ficam em{" "}
          <Link href="/templates" className="text-sky-400 hover:text-sky-300">
            Templates
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
