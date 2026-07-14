"use client";

import { useState } from "react";
import Modal from "@/app/Modal";

export default function NewReportModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
      >
        + Novo relatório
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo relatório">
        {children}
      </Modal>
    </>
  );
}
