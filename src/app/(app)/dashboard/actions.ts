"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { addDashboardAccount, removeDashboardAccount, updateResultMetric } from "@/lib/dashboard-accounts";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const admin = getSupabaseAdmin();
  const { data: manager } = await admin.from("managers").select("id").eq("auth_user_id", user.id).single();
  if (!manager) throw new Error("Seu login não está vinculado a nenhum gestor.");
}

export async function addDashboardAccountAction(metaAccountId: string, accountName: string): Promise<void> {
  await requireAuth();
  await addDashboardAccount(metaAccountId, accountName);
  revalidatePath("/dashboard");
}

export async function removeDashboardAccountAction(metaAccountId: string): Promise<void> {
  await requireAuth();
  await removeDashboardAccount(metaAccountId);
  revalidatePath("/dashboard");
}

export async function updateResultMetricAction(metaAccountId: string, resultMetricKey: string): Promise<void> {
  await requireAuth();
  await updateResultMetric(metaAccountId, resultMetricKey);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/${metaAccountId}`);
}
