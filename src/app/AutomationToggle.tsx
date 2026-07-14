"use client";

import { useState, useTransition } from "react";
import { setAutomation } from "@/app/actions";

export default function AutomationToggle({
  accountId,
  enabled,
}: {
  accountId: string;
  enabled: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next); // atualização otimista
    startTransition(() => {
      setAutomation(accountId, next);
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      disabled={isPending}
      title={on ? "Automação ligada" : "Automação desligada"}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
        on ? "bg-emerald-500" : "bg-slate-600"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          on ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  );
}
