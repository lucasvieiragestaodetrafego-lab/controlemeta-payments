"use client";

import { useState, useTransition } from "react";
import Modal from "@/app/Modal";
import { updateAccount } from "@/app/actions";
import type { AccountRow } from "@/app/AccountsTable";

export default function EditAccountModal({
  row,
  open,
  onClose,
}: {
  row: AccountRow;
  open: boolean;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateAccount(formData);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao salvar.");
      }
    });
  }

  const inputClass =
    "w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100";

  return (
    <Modal open={open} onClose={onClose} title={`Editar: ${row.name}`}>
      <form action={handleSubmit} className="grid grid-cols-1 gap-3">
        <input type="hidden" name="id" value={row.id} />

        <div>
          <label className="block text-xs text-slate-400">Nome da conta</label>
          <input name="name" defaultValue={row.name} className={inputClass} />
        </div>

        <div>
          <label className="block text-xs text-slate-400">Grupo/telefone WhatsApp</label>
          <input
            name="whatsapp_group_id"
            defaultValue={row.whatsappGroupId ?? ""}
            placeholder="ex: 120363421960030596-group"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400">
            Mensagem personalizada (em branco = padrão)
          </label>
          <textarea
            name="custom_message"
            defaultValue={row.customMessage ?? ""}
            rows={3}
            placeholder="Marcadores: {conta}, {saldo}, {limite}, {gestor}, {status}"
            className={inputClass}
          />
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <label className="block text-xs text-slate-400">Limite (R$)</label>
            <input
              name="alert_threshold"
              type="number"
              step="0.01"
              defaultValue={row.alertThreshold}
              className="w-28 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              name="automation_enabled"
              defaultChecked={row.automationEnabled}
              className="h-4 w-4 accent-emerald-500"
            />
            Automação ativa
          </label>
        </div>

        {error && <p className="rounded bg-red-950 px-3 py-2 text-xs text-red-300">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
