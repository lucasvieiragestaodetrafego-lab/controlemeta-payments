import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { updateTemplate } from "@/app/actions";

interface MessageTemplate {
  key: string;
  label: string;
  template: string;
}

export default async function TemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getSupabaseAdmin();

  const { data: manager } = await admin
    .from("managers")
    .select("role")
    .eq("auth_user_id", user.id)
    .single();

  if (!manager) {
    redirect("/");
  }

  const { data: templatesData } = await admin
    .from("message_templates")
    .select("key, label, template")
    .order("key");
  const templates = (templatesData ?? []) as MessageTemplate[];

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Templates de mensagem</h1>
        <p className="text-sm text-slate-400">
          Texto padrão enviado no WhatsApp em cada situação. Cada conta pode ter uma mensagem
          própria (em Configurações) que substitui estes textos.
        </p>
      </header>

      <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs text-slate-400">
        Marcadores disponíveis (trocados pelos valores reais no envio):{" "}
        <code className="text-slate-200">{"{conta}"}</code>{" "}
        <code className="text-slate-200">{"{saldo}"}</code>{" "}
        <code className="text-slate-200">{"{limite}"}</code>{" "}
        <code className="text-slate-200">{"{gestor}"}</code>{" "}
        <code className="text-slate-200">{"{status}"}</code>
      </div>

      <div className="space-y-6">
        {templates.map((tmpl) => (
          <form
            key={tmpl.key}
            action={updateTemplate}
            className="space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-4"
          >
            <input type="hidden" name="key" value={tmpl.key} />
            <label className="block text-sm font-medium text-slate-200">{tmpl.label}</label>
            <textarea
              name="template"
              defaultValue={tmpl.template}
              rows={6}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
            <button
              type="submit"
              className="rounded bg-slate-700 px-3 py-1 text-xs font-medium text-white hover:bg-slate-600"
            >
              Salvar mensagem
            </button>
          </form>
        ))}
      </div>
    </main>
  );
}
