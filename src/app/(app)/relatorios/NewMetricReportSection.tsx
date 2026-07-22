import { getSupabaseAdmin } from "@/lib/supabase";
import NewMetricReportForm from "./NewMetricReportForm";

export default async function NewMetricReportSection() {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("ad_accounts")
    .select("id, name")
    .eq("is_active", true)
    .eq("platform", "meta")
    .order("name");

  const accounts = (data ?? []) as { id: string; name: string }[];

  return <NewMetricReportForm accounts={accounts} />;
}
