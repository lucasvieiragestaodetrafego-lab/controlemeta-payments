"use client";

import { useTransition } from "react";
import { updateAccountManager } from "@/app/actions";

interface ManagerOption {
  id: string;
  name: string;
}

export default function ManagerSelect({
  accountId,
  currentManagerId,
  managers,
}: {
  accountId: string;
  currentManagerId: string | null;
  managers: ManagerOption[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const managerId = e.target.value;
    startTransition(() => {
      updateAccountManager(accountId, managerId);
    });
  }

  return (
    <select
      defaultValue={currentManagerId ?? ""}
      onChange={handleChange}
      disabled={isPending}
      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 disabled:opacity-50"
    >
      {managers.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
