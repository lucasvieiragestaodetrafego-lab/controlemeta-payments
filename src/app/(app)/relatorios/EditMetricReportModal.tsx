"use client";

import { useState } from "react";
import Modal from "@/app/Modal";
import { updateMetricReport } from "@/app/actions";
import type { MetricReportRow } from "@/app/MetricReportsTable";
import GroupSelect from "@/app/GroupSelect";
import MessageTemplateField from "./MessageTemplateField";
import HourMinuteInput from "./HourMinuteInput";

export default function EditMetricReportModal({ report }: { report: MetricReportRow }) {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState(report.messageTemplate);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mr-2 rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
      >
        ✏️ Editar
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Editar — ${report.name}`}>
        <form
          action={async (formData) => {
            await updateMetricReport(formData);
            setOpen(false);
          }}
          className="space-y-4"
        >
          <input type="hidden" name="id" value={report.id} />

          <div>
            <label className="mb-1 block text-sm text-slate-300">Nome do relatório</label>
            <input
              name="name"
              defaultValue={report.name}
              required
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Frequência</label>
              <select
                name="frequency"
                defaultValue={report.frequency}
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </select>
            </div>
            <HourMinuteInput defaultHour={report.sendHour} defaultMinute={report.sendMinute} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Período</label>
              <select
                name="period"
                defaultValue={report.period}
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
                defaultValue={report.creativeRankingSize ? String(report.creativeRankingSize) : ""}
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
            <GroupSelect
              defaultGroupId={report.whatsappGroupId}
              defaultGroupName={report.whatsappGroupName}
            />
          </div>

          <MessageTemplateField value={template} onChange={setTemplate} />

          <button
            type="submit"
            className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            Salvar alterações
          </button>
        </form>
      </Modal>
    </>
  );
}
