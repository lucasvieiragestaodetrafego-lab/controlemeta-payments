// src/app/(app)/dashboard/ManageAccountsButton.tsx
"use client";

import { useState } from "react";
import Modal from "@/app/Modal";

export default function ManageAccountsButton({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
      >
        ⚙️ Gerenciar contas
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Gerenciar contas do dashboard">
        {children}
      </Modal>
    </>
  );
}
