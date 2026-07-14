import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import AppShell from "@/app/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getSupabaseAdmin();
  const { data: manager } = await admin
    .from("managers")
    .select("name, role")
    .eq("auth_user_id", user.id)
    .single();

  const isAdmin = manager?.role === "admin";
  const userName = manager?.name ?? user.email ?? "Usuário";

  return (
    <AppShell isAdmin={isAdmin} userName={userName}>
      {children}
    </AppShell>
  );
}
