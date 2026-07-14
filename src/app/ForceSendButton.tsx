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
      className="rounded border border-sky-800 px-2 py-1 text-xs text-sky-300 hover:bg-sky-950 disabled:opacity-50"
    >
      {isPending ? "Enviando…" : "📨 Disparar"}
    </button>
  );
}
