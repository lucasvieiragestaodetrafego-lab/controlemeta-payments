// src/app/(app)/dashboard/ManageAccountsForm.tsx
"use client";

import { useTransition } from "react";
import { addDashboardAccountAction, removeDashboardAccountAction } from "./actions";
import type { MetaAccountWithMembership } from "@/lib/dashboard-accounts";

export default function ManageAccountsForm({ accounts }: { accounts: MetaAccountWithMembership[] }) {
  const [isPending, startTransition] = useTransition();

  function toggle(account: MetaAccountWithMembership) {
    startTransition(async () => {
      if (account.inDashboard) {
        await removeDashboardAccountAction(account.metaAccountId);
      } else {
        await addDashboardAccountAction(account.metaAccountId, account.name);
      }
    });
  }

  return (
    <div className="max-h-96 space-y-1 overflow-y-auto">
      {accounts.map((a) => (
        <label
          key={a.metaAccountId}
          className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
        >
          <input
            type="checkbox"
            checked={a.inDashboard}
            disabled={isPending}
            onChange={() => toggle(a)}
            className="h-4 w-4 accent-emerald-500"
          />
          {a.name}
        </label>
      ))}
    </div>
  );
}
