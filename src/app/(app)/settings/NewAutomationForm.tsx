"use client";

import { useState } from "react";
import { createAccount } from "@/app/actions";
import GroupSelect from "@/app/GroupSelect";

interface MetaAccountOption {
  id: string;
  name: string;
  available: number | null;
  currency: string;
  isPrepay: boolean;
}

interface ManagerOption {
  id: string;
  name: string;
}

export default function NewAutomationForm({
  metaAccounts,
  managers,
  defaultWhatsappGroupId,
}: {
  metaAccounts: MetaAccountOption[];
  managers: ManagerOption[];
  defaultWhatsappGroupId: string;
}) {
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [isPrepay, setIsPrepay] = useState("");

  function handleSelectAccount(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = metaAccounts.find((a) => a.id === e.target.value);
    if (selected) {
      setName(selected.name);
      setClientName(selected.name);
      setIsPrepay(selected.isPrepay ? "true" : "false");
    }
  }

  if (metaAccounts.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Todas as contas do seu Business Manager já têm automação cadastrada.
      </p>
    );
  }

  return (
    <form action={createAccount} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input type="hidden" name="is_prepay" value={isPrepay} />

      <div className="sm:col-span-2">
        <label className="block text-xs text-slate-400">1. Escolha a conta do Meta</label>
        <select
          name="meta_account_id"
          required
          defaultValue=""
          onChange={handleSelectAccount}
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
        >
          <option value="">Selecione a conta…</option>
          {metaAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} — {a.id} —{" "}
              {a.isPrepay
                ? `pré-paga — saldo ${
                    a.available !== null
                      ? a.available.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: a.currency,
                        })
                      : "—"
                  }`
                : "cartão/linha de crédito"}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Lista com todas as contas do seu Business Manager. As que já têm automação não
          aparecem aqui.
        </p>
      </div>

      <div>
        <label className="block text-xs text-slate-400">Nome que aparece no painel</label>
        <input
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex: Clínica Vida Nova"
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
        />
      </div>

      <div>
        <label className="block text-xs text-slate-400">Cliente</label>
        <input
          name="client_name"
          required
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="ex: Clínica Vida Nova"
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
        />
      </div>

      <div>
        <label className="block text-xs text-slate-400">Gestor responsável</label>
        <select
          name="manager_id"
          required
          defaultValue=""
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
        >
          <option value="">Selecione…</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-slate-400">Limite de saldo para alertar (R$)</label>
        <input
          name="alert_threshold"
          type="number"
          step="0.01"
          defaultValue="100"
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="block text-xs text-slate-400">
          2. WhatsApp de destino (grupo que recebe o alerta)
        </label>
        <GroupSelect defaultGroupId={defaultWhatsappGroupId || null} defaultGroupName={null} />
        <p className="mt-1 text-xs text-slate-500">
          Escolha o grupo pela lista. Você pode trocar por automação e alterar depois quando
          quiser.
        </p>
      </div>

      <div className="sm:col-span-2">
        <label className="block text-xs text-slate-400">
          3. Mensagem personalizada (opcional)
        </label>
        <textarea
          name="custom_message"
          rows={4}
          placeholder="Deixe em branco para usar a mensagem padrão. Marcadores: {conta}, {saldo}, {limite}, {gestor}, {status}"
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
        />
      </div>

      <div className="flex items-center justify-between sm:col-span-2">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" name="automation_enabled" className="h-4 w-4 accent-emerald-500" />
          Já criar com a automação ligada
        </label>
        <button
          type="submit"
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Criar automação
        </button>
      </div>
    </form>
  );
}
