"use client";

import { useState } from "react";
import { createMetricReport } from "@/app/actions";
import GroupSelect from "@/app/GroupSelect";
import MessageTemplateField from "./MessageTemplateField";
import HourMinuteInput from "./HourMinuteInput";

const DEFAULT_TEMPLATE =
  "📊 *Relatório de Campanha*\n\n" +
  "Conta: *{conta}*\n" +
  "Período: {periodo} ({data_inicio} até {data_fim})\n\n" +
  "💰 Valor investido: {investimento}\n" +
  "👆 Cliques: {cliques}\n" +
  "🎯 Alcance: {alcance}\n" +
  "🚀 Conversões: {conversoes}\n" +
  "📱 Custo por conversão: {custo_por_conversao}\n" +
  "📈 ROAS: {roas}\n" +
  "🎟️ Ticket médio: {ticket_medio}\n\n" +
  "{top_criativos}";

export default function NewMetricReportForm({
  accounts,
}: {
  accounts: { id: string; name: string }[];
}) {
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);

  return (
    <form action={createMetricReport} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-slate-300">Nome do relatório</label>
        <input
          name="name"
          required
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-slate-300">Conta de anúncio</label>
        <select
          name="ad_account_id"
          required
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        >
          <option value="">Selecione…</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm text-slate-300">Frequência</label>
          <select
            name="frequency"
            defaultValue="weekly"
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="daily">Diário</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
          </select>
        </div>
        <HourMinuteInput />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm text-slate-300">Período</label>
          <select
            name="period"
            defaultValue="last_7_days"
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="today">Hoje</option>
            <option value="last_7_days">Últimos 7 dias</option>
            <option value="last_30_days">Últimos 30 dias</option>
            <option value="current_month">Mês atual</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">Ranking de criativos</label>
          <select
            name="creative_ranking_size"
            defaultValue=""
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="">Sem ranking</option>
            <option value="1">Top 1</option>
            <option value="3">Top 3</option>
            <option value="5">Top 5</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-slate-300">
          Grupo/número de WhatsApp
        </label>
        <GroupSelect />
      </div>

      <MessageTemplateField value={template} onChange={setTemplate} />

      <button
        type="submit"
        className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
      >
        Criar relatório
      </button>
    </form>
  );
}
