import { createClient } from "@supabase/supabase-js";

// Cadastra em lote, no Supabase, todas as contas do Business Manager que
// ainda não existem no banco. Usa o nome da conta do Meta como nome/cliente
// provisórios e um gestor + grupo de WhatsApp fixos — ajuste depois pela
// tela de Configurações.
//
// Uso:
//   ADMIN_MANAGER_EMAIL=... WHATSAPP_GROUP_ID=... node scripts/sync-accounts-from-meta.mjs

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const metaToken = process.env.META_SYSTEM_USER_TOKEN;
const businessId = process.env.META_BUSINESS_ID;
const apiVersion = process.env.META_API_VERSION || "v21.0";
const whatsappGroupId = process.env.WHATSAPP_GROUP_ID;
const adminManagerEmail = process.env.ADMIN_MANAGER_EMAIL;

if (!supabaseUrl || !serviceKey || !metaToken || !businessId || !adminManagerEmail) {
  console.error(
    "Defina SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, META_SYSTEM_USER_TOKEN, META_BUSINESS_ID e ADMIN_MANAGER_EMAIL antes de rodar.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const { data: manager, error: managerError } = await supabase
  .from("managers")
  .select("id, name")
  .eq("email", adminManagerEmail)
  .single();

if (managerError || !manager) {
  console.error("Gestor não encontrado:", managerError?.message);
  process.exit(1);
}

const fields =
  "name,account_status,balance,amount_spent,spend_cap,currency,funding_source_details,is_prepay_account";

async function fetchEdge(edge) {
  const url = `https://graph.facebook.com/${apiVersion}/${businessId}/${edge}?fields=${fields}&access_token=${metaToken}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(`${edge}: ${json.error.message}`);
  return json.data;
}

// owned_ad_accounts = contas que a agência é dona (geralmente internas).
// client_ad_accounts = contas de clientes que compartilharam acesso com a
// agência (geralmente são as contas reais dos clientes).
const [owned, client] = await Promise.all([
  fetchEdge("owned_ad_accounts"),
  fetchEdge("client_ad_accounts"),
]);

const seen = new Set();
const allAccounts = [];
for (const account of [...owned, ...client]) {
  if (seen.has(account.id)) continue;
  seen.add(account.id);
  allAccounts.push(account);
}

const { data: existingAccounts } = await supabase.from("ad_accounts").select("meta_account_id");
const registeredIds = new Set((existingAccounts ?? []).map((a) => a.meta_account_id));

const toRegister = allAccounts.filter((a) => !registeredIds.has(a.id));

console.log(`Encontradas ${allAccounts.length} contas no Meta, ${toRegister.length} para cadastrar.`);

for (const account of toRegister) {
  const clientName = account.name;

  const { data: existingClient } = await supabase
    .from("clients")
    .select("id")
    .ilike("name", clientName)
    .maybeSingle();

  let clientId = existingClient?.id;

  if (!clientId) {
    const { data: newClient, error: clientError } = await supabase
      .from("clients")
      .insert({ name: clientName })
      .select("id")
      .single();
    if (clientError) {
      console.error(`Erro ao criar cliente para ${account.name}:`, clientError.message);
      continue;
    }
    clientId = newClient.id;
  }

  const { error: accountError } = await supabase.from("ad_accounts").insert({
    name: account.name,
    meta_account_id: account.id,
    client_id: clientId,
    manager_id: manager.id,
    whatsapp_group_id: whatsappGroupId,
    alert_threshold: 100,
    currency: account.currency,
  });

  if (accountError) {
    console.error(`Erro ao cadastrar ${account.name} (${account.id}):`, accountError.message);
  } else {
    console.log(
      `Cadastrada: ${account.name} (${account.id}) — ${account.is_prepay_account ? "pré-paga" : "cartão/linha de crédito"}`,
    );
  }
}

console.log("Concluído.");
