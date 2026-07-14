import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

// Uso: node scripts/create-manager.mjs "Nome" email@dominio.com admin|user
const [, , name, email, role = "user"] = process.argv;

if (!name || !email) {
  console.error("Uso: node scripts/create-manager.mjs \"Nome\" email@dominio.com [admin|user]");
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente antes de rodar.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const password = randomBytes(12).toString("base64url");

const { data: userData, error: userError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (userError) {
  console.error("Erro ao criar usuário:", userError.message);
  process.exit(1);
}

const { error: managerError } = await supabase.from("managers").insert({
  name,
  email,
  auth_user_id: userData.user.id,
  role,
});

if (managerError) {
  console.error("Erro ao criar gestor:", managerError.message);
  process.exit(1);
}

console.log("Gestor criado com sucesso.");
console.log("Nome:", name);
console.log("Email:", email);
console.log("Papel:", role);
console.log("Senha provisória:", password);
console.log("(peça para trocar a senha no primeiro acesso)");
