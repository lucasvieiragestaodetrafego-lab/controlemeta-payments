import { getSupabaseAdmin } from "./supabase";
import { findMetric } from "./metrics-catalog";

/** Filtra pra só chaves conhecidas do catálogo, removendo duplicatas e preservando a ordem. Função pura. */
export function validateMetricKeys(keys: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const key of keys) {
    if (seen.has(key)) continue;
    if (!findMetric(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

/** Lê as colunas extras selecionadas atualmente (preferência global, linha única). */
export async function getSelectedMetricKeys(): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("dashboard_column_preferences")
    .select("metric_keys")
    .eq("id", 1)
    .single();
  if (error || !data) return [];
  return validateMetricKeys((data.metric_keys as string[]) ?? []);
}

/** Atualiza as colunas extras selecionadas (preferência global, linha única). Chaves desconhecidas são descartadas silenciosamente. */
export async function updateSelectedMetricKeys(keys: string[]): Promise<void> {
  const admin = getSupabaseAdmin();
  const validated = validateMetricKeys(keys);
  const { error } = await admin
    .from("dashboard_column_preferences")
    .update({ metric_keys: validated, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(`Erro ao salvar colunas do dashboard: ${error.message}`);
}
