"use client";

import { useRef } from "react";

const VARIABLES: { key: string; label: string }[] = [
  { key: "conta", label: "Conta" },
  { key: "periodo", label: "Período" },
  { key: "data_inicio", label: "Data início" },
  { key: "data_fim", label: "Data fim" },
  { key: "investimento", label: "Investimento" },
  { key: "cliques", label: "Cliques" },
  { key: "alcance", label: "Alcance" },
  { key: "conversoes", label: "Conversões" },
  { key: "custo_por_conversao", label: "Custo por conversão" },
  { key: "roas", label: "ROAS" },
  { key: "ticket_medio", label: "Ticket médio" },
  { key: "top_criativos", label: "Top criativos" },
];

/**
 * Campo de mensagem com botões que inserem as variáveis {chave} na posição
 * do cursor do textarea — evita o usuário ter que decorar/digitar os nomes.
 */
export default function MessageTemplateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(key: string) {
    const token = `{${key}}`;
    const textarea = textareaRef.current;

    if (!textarea) {
      onChange(value + token);
      return;
    }

    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + token.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div>
      <label className="mb-1 block text-sm text-slate-300">Mensagem</label>
      <div className="mb-2 flex flex-wrap gap-1">
        {VARIABLES.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => insertVariable(v.key)}
            title={`Inserir {${v.key}}`}
            className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
          >
            {v.label}
          </button>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        name="message_template"
        rows={10}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
      />
    </div>
  );
}
