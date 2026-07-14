import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createManager, updateManager } from "@/app/actions";
import DeleteUserButton from "@/app/DeleteUserButton";

interface ManagerRow {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default async function UsuariosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getSupabaseAdmin();

  const { data: me } = await admin
    .from("managers")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  if (!me || me.role !== "admin") {
    redirect("/");
  }

  const { data: managersData } = await admin
    .from("managers")
    .select("id, name, email, role")
    .order("name");
  const managers = (managersData ?? []) as ManagerRow[];

  // Conta quantas contas cada gestor é responsável (para avisar antes de excluir).
  const { data: accountsData } = await admin.from("ad_accounts").select("manager_id");
  const accountCount = new Map<string, number>();
  for (const a of accountsData ?? []) {
    if (a.manager_id) accountCount.set(a.manager_id, (accountCount.get(a.manager_id) ?? 0) + 1);
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Usuários</h1>
        <p className="text-sm text-slate-400">
          Administradores veem e editam tudo. Usuários padrão só veem as contas em que são
          responsáveis, sem edição.
        </p>
      </header>

      <section className="mb-8 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Novo usuário</h2>
        <form action={createManager} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-400">Nome</label>
            <input
              name="name"
              required
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400">E-mail</label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400">Papel</label>
            <select
              name="role"
              defaultValue="user"
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
            >
              <option value="user">Usuário padrão</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400">Senha inicial</label>
            <input
              name="password"
              type="text"
              placeholder="mín. 6 caracteres (peça para trocar depois)"
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Adicionar usuário
            </button>
          </div>
        </form>
      </section>

      <div className="space-y-3">
        {managers.map((m) => {
          const count = accountCount.get(m.id) ?? 0;
          return (
            <form
              key={m.id}
              action={updateManager}
              className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4"
            >
              <input type="hidden" name="id" value={m.id} />
              <div className="flex-1">
                <label className="block text-xs text-slate-400">Nome</label>
                <input
                  name="name"
                  defaultValue={m.name}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                />
                <p className="mt-1 text-xs text-slate-500">
                  {m.email} · {count} conta(s)
                </p>
              </div>
              <div>
                <label className="block text-xs text-slate-400">Papel</label>
                <select
                  name="role"
                  defaultValue={m.role}
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                >
                  <option value="user">Usuário padrão</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <button
                type="submit"
                className="rounded bg-slate-700 px-3 py-1 text-xs font-medium text-white hover:bg-slate-600"
              >
                Salvar
              </button>
              {m.id !== me.id && <DeleteUserButton managerId={m.id} managerName={m.name} />}
            </form>
          );
        })}
      </div>
    </main>
  );
}
