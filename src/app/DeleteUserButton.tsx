"use client";

import { useTransition } from "react";
import { deleteManager } from "@/app/actions";

export default function DeleteUserButton({
  managerId,
  managerName,
}: {
  managerId: string;
  managerName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const ok = window.confirm(
      `Excluir o usuário "${managerName}"? O login dele deixará de funcionar.`,
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteManager(managerId);
      } catch (err) {
        window.alert((err as Error).message);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="rounded border border-red-900 px-2 py-1 text-xs text-red-300 hover:bg-red-950 disabled:opacity-50"
    >
      Excluir
    </button>
  );
}
