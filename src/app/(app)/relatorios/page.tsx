import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import MetricReportsTable, { type MetricReportRow } from "@/app/MetricReportsTable";
import NewReportModal from "@/app/NewReportModal";
import NewMetricReportSection from "./NewMetricReportSection";

interface RawReport {
  id: string;
  name: string;
  whatsapp_group_name: string | null;
  frequency: string;
  next_send_at: string | null;
  is_active: boolean;
  ad_accounts: { name: string } | null;
}

export default async function RelatoriosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("metric_reports")
    .select(
      "id, name, whatsapp_group_name, frequency, next_send_at, is_active, ad_accounts(name)",
    )
    .order("name");

  if (error) console.error("Erro ao buscar relatórios:", error.message);

  const rows: MetricReportRow[] = ((data ?? []) as unknown as RawReport[]).map((r) => ({
    id: r.id,
    name: r.name,
    accountName: r.ad_accounts?.name ?? "—",
    whatsappGroupName: r.whatsapp_group_name,
    frequency: r.frequency,
    nextSendAt: r.next_send_at,
    isActive: r.is_active,
  }));

  return (
    <main className="mx-auto max-w-[1600px] p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Relatórios</h1>
          <p className="text-sm text-slate-400">Métricas de campanha enviadas por WhatsApp.</p>
        </div>
        <NewReportModal>
          <Suspense fallback={<p className="text-sm text-slate-500">Carregando contas…</p>}>
            <NewMetricReportSection />
          </Suspense>
        </NewReportModal>
      </header>
      <MetricReportsTable rows={rows} />
    </main>
  );
}
