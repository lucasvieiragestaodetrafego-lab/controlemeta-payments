import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para uso apenas no servidor (usa a service role key,
 * que ignora as regras de RLS). Nunca importar isto em código que roda
 * no navegador.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("SUPABASE_URL não está configurado.");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não está configurado.");

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
