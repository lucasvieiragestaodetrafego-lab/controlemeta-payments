"use client";

import { useTransition } from "react";
import { deleteAccount } from "@/app/actions";

export default function DeleteAccountButton({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const ok = window.confirm(
      `Excluir a conta "${accountName}"? Isso remove o histórico e os alertas dela. Esta ação não pode ser desfeita.`,
    );
    if (!ok) return;
    startTransition(() => {
      deleteAccount(accountId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title="Excluir conta"
      aria-label={`Excluir ${accountName}`}
      className="rounded p-1 text-slate-500 hover:bg-red-950 hover:text-red-400 disabled:opacity-50"
    >
      {/* ícone de lixeira */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M3 6h18" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
    </button>
  );
}
