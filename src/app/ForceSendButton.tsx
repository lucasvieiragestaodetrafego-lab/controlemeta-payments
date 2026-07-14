"use client";

import { useTransition } from "react";
import { forceSendAlertAction } from "@/app/actions";

export default function ForceSendButton({
  accountId,
  accountName,
  hasWhatsapp,
}: {
  accountId: string;
  accountName: string;
  hasWhatsapp: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!hasWhatsapp) {
      window.alert(
        `"${accountName}" não tem um grupo/número de WhatsApp configurado. Configure em Configurações antes de disparar.`,
      );
      return;
    }

    const ok = window.confirm(
      `Enviar agora uma mensagem de alerta para "${accountName}"? Isso dispara de verdade no WhatsApp, mesmo com automação desligada.`,
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        await forceSendAlertAction(accountId);
        window.alert(`Mensagem enviada para "${accountName}".`);
      } catch (err) {
        window.alert(`Erro ao enviar: ${(err as Error).message}`);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title="Disparar alerta agora"
      className="inline-flex items-center gap-1 rounded-md border border-sky-700 bg-sky-950/40 px-2.5 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-900/40 disabled:opacity-50"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
      >
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </svg>
      {isPending ? "Enviando…" : "Disparar"}
    </button>
  );
}
