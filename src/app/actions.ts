"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { checkAllBalances, forceSendAlert } from "@/lib/check-balances";
import { listWhatsAppGroupsCached, type WhatsAppGroup } from "@/lib/zapi";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const admin = getSupabaseAdmin();
  const { data: manager } = await admin
    .from("managers")
    .select("id, role, auth_user_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!manager || manager.role !== "admin") {
    throw new Error("Apenas administradores podem executar essa ação.");
  }

  return manager;
}

/**
 * Dispara o alerta de UMA conta na hora, ignorando automação, limite e
 * cooldown. Usado pelo botão "Disparar" na coluna de ações do painel.
 */
export async function forceSendAlertAction(accountId: string) {
  await requireAdmin();
  const result = await forceSendAlert(accountId);
  revalidatePath("/");
  return result;
}

/** Dispara a checagem de saldo na hora, fora do horário automático. */
export async function runCheckNow() {
  await requireAdmin();
  await checkAllBalances();
  revalidatePath("/");
  revalidatePath("/settings");
}

/** Troca o gestor responsável por uma conta (usado no dashboard editável). */
export async function updateAccountManager(accountId: string, managerId: string) {
  await requireAdmin();

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("ad_accounts")
    .update({ manager_id: managerId })
    .eq("id", accountId);

  if (error) throw new Error(`Erro ao trocar gestor: ${error.message}`);

  revalidatePath("/");
  revalidatePath("/settings");
}

/** Liga/desliga o envio automático de alertas de uma conta (dashboard). */
export async function setAutomation(accountId: string, enabled: boolean) {
  await requireAdmin();

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("ad_accounts")
    .update({ automation_enabled: enabled })
    .eq("id", accountId);

  if (error) throw new Error(`Erro ao alterar automação: ${error.message}`);

  revalidatePath("/");
  revalidatePath("/settings");
}

/** Exclui uma conta (e seu histórico/alertas em cascata). */
export async function deleteAccount(accountId: string) {
  await requireAdmin();

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("ad_accounts").delete().eq("id", accountId);

  if (error) throw new Error(`Erro ao excluir conta: ${error.message}`);

  revalidatePath("/");
  revalidatePath("/settings");
}

/** Exclui várias contas de uma vez (seleção em lote). */
export async function deleteAccounts(accountIds: string[]) {
  await requireAdmin();
  if (accountIds.length === 0) return;

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("ad_accounts").delete().in("id", accountIds);

  if (error) throw new Error(`Erro ao excluir contas: ${error.message}`);

  revalidatePath("/");
  revalidatePath("/settings");
}

/** Cria um novo usuário (login + gestor). Admin define nome, e-mail, papel e senha. */
export async function createManager(formData: FormData) {
  await requireAdmin();

  const name = (formData.get("name") as string).trim();
  const email = (formData.get("email") as string).trim().toLowerCase();
  const role = (formData.get("role") as string) === "admin" ? "admin" : "user";
  let password = ((formData.get("password") as string) || "").trim();

  if (!name || !email) throw new Error("Preencha nome e e-mail.");
  if (!password) password = randomBytes(9).toString("base64url");
  if (password.length < 6) throw new Error("A senha precisa ter ao menos 6 caracteres.");

  const admin = getSupabaseAdmin();

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userError) throw new Error(`Erro ao criar login: ${userError.message}`);

  const { error: managerError } = await admin.from("managers").insert({
    name,
    email,
    role,
    auth_user_id: userData.user.id,
  });
  if (managerError) {
    // desfaz o usuário de auth para não deixar órfão
    await admin.auth.admin.deleteUser(userData.user.id);
    throw new Error(`Erro ao criar gestor: ${managerError.message}`);
  }

  revalidatePath("/usuarios");
}

/** Edita nome e papel de um usuário. */
export async function updateManager(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const name = (formData.get("name") as string).trim();
  const role = (formData.get("role") as string) === "admin" ? "admin" : "user";

  if (!name) throw new Error("O nome não pode ficar vazio.");

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("managers").update({ name, role }).eq("id", id);
  if (error) throw new Error(`Erro ao salvar usuário: ${error.message}`);

  revalidatePath("/usuarios");
}

/** Exclui um usuário (login + gestor). Bloqueia se ainda tiver contas atribuídas. */
export async function deleteManager(managerId: string) {
  const currentAdmin = await requireAdmin();
  if (managerId === currentAdmin.id) {
    throw new Error("Você não pode excluir o seu próprio usuário.");
  }

  const admin = getSupabaseAdmin();

  const { count } = await admin
    .from("ad_accounts")
    .select("*", { count: "exact", head: true })
    .eq("manager_id", managerId);

  if (count && count > 0) {
    throw new Error(
      `Este usuário é responsável por ${count} conta(s). Reatribua essas contas a outro gestor antes de excluir.`,
    );
  }

  const { data: manager } = await admin
    .from("managers")
    .select("auth_user_id")
    .eq("id", managerId)
    .single();

  const { error } = await admin.from("managers").delete().eq("id", managerId);
  if (error) throw new Error(`Erro ao excluir usuário: ${error.message}`);

  if (manager?.auth_user_id) {
    await admin.auth.admin.deleteUser(manager.auth_user_id);
  }

  revalidatePath("/usuarios");
}

/** Salva o texto de uma mensagem de alerta (template). */
export async function updateTemplate(formData: FormData) {
  await requireAdmin();

  const key = formData.get("key") as string;
  const template = (formData.get("template") as string) ?? "";

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("message_templates")
    .update({ template })
    .eq("key", key);

  if (error) throw new Error(`Erro ao salvar mensagem: ${error.message}`);

  revalidatePath("/settings");
}

/** Lista os grupos do WhatsApp disponíveis, para o seletor nos modais de relatório. */
export async function listWhatsAppGroupsAction(): Promise<WhatsAppGroup[]> {
  await requireAdmin();
  return listWhatsAppGroupsCached();
}

/** Salva as edições de uma conta feitas na tela de Configurações. */
export async function updateAccount(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const clientId = formData.get("client_id") as string;
  const clientName = ((formData.get("client_name") as string) || "").trim();
  const name = formData.get("name") as string;
  const whatsappGroupId = ((formData.get("whatsapp_group_id") as string) || "").trim() || null;
  const whatsappGroupName = whatsappGroupId
    ? ((formData.get("whatsapp_group_name") as string) || "").trim() || null
    : null;
  const automationEnabled = formData.get("automation_enabled") === "on";
  const alertThreshold = Number(formData.get("alert_threshold") || "100");
  const customMessage = ((formData.get("custom_message") as string) || "").trim() || null;

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("ad_accounts")
    .update({
      name,
      whatsapp_group_id: whatsappGroupId,
      whatsapp_group_name: whatsappGroupName,
      automation_enabled: automationEnabled,
      alert_threshold: alertThreshold,
      custom_message: customMessage,
    })
    .eq("id", id);

  if (error) throw new Error(`Erro ao salvar conta: ${error.message}`);

  if (clientId && clientName) {
    const { error: clientError } = await admin
      .from("clients")
      .update({ name: clientName })
      .eq("id", clientId);

    if (clientError) throw new Error(`Erro ao salvar nome do cliente: ${clientError.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/");
}

/** Cadastra uma nova conta de anúncio, criando o cliente se ainda não existir. */
export async function createAccount(formData: FormData) {
  await requireAdmin();

  const name = (formData.get("name") as string).trim();
  const metaAccountId = (formData.get("meta_account_id") as string).trim();
  const clientName = (formData.get("client_name") as string).trim();
  const managerId = formData.get("manager_id") as string;
  const whatsappGroupId = ((formData.get("whatsapp_group_id") as string) || "").trim() || null;
  const whatsappGroupName = whatsappGroupId
    ? ((formData.get("whatsapp_group_name") as string) || "").trim() || null
    : null;
  const alertThreshold = Number(formData.get("alert_threshold") || "100");
  const currency = ((formData.get("currency") as string) || "BRL").trim();
  const isPrepayRaw = formData.get("is_prepay") as string;
  const isPrepay = isPrepayRaw === "true" ? true : isPrepayRaw === "false" ? false : null;
  const customMessage = ((formData.get("custom_message") as string) || "").trim() || null;
  const automationEnabled = formData.get("automation_enabled") === "on";

  if (!name || !metaAccountId || !clientName || !managerId) {
    throw new Error("Preencha nome da conta, ID da conta Meta, cliente e gestor.");
  }

  const admin = getSupabaseAdmin();

  const { data: existingClient } = await admin
    .from("clients")
    .select("id")
    .ilike("name", clientName)
    .maybeSingle();

  let clientId = existingClient?.id as string | undefined;

  if (!clientId) {
    const { data: newClient, error: clientError } = await admin
      .from("clients")
      .insert({ name: clientName })
      .select("id")
      .single();

    if (clientError) throw new Error(`Erro ao criar cliente: ${clientError.message}`);
    clientId = newClient.id;
  }

  const { error: accountError } = await admin.from("ad_accounts").insert({
    name,
    meta_account_id: metaAccountId,
    client_id: clientId,
    manager_id: managerId,
    whatsapp_group_id: whatsappGroupId,
    whatsapp_group_name: whatsappGroupName,
    alert_threshold: alertThreshold,
    currency,
    is_prepay: isPrepay,
    custom_message: customMessage,
    automation_enabled: automationEnabled,
    platform: "meta",
  });

  if (accountError) throw new Error(`Erro ao criar conta: ${accountError.message}`);

  revalidatePath("/settings");
  revalidatePath("/");
}
