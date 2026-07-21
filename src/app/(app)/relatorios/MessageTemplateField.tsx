"use client";

import { useRef, useState } from "react";

interface Variable {
  key: string;
  label: string;
}

interface Category {
  name: string;
  variables: Variable[];
}

const CATEGORIES: Category[] = [
  {
    name: "Geral",
    variables: [
      { key: "conta", label: "Conta" },
      { key: "periodo", label: "Período" },
      { key: "data_inicio", label: "Data início" },
      { key: "data_fim", label: "Data fim" },
    ],
  },
  {
    name: "Cliques e Alcance",
    variables: [
      { key: "cliques", label: "Cliques" },
      { key: "alcance", label: "Alcance" },
    ],
  },
  {
    name: "Investimento e Resultado",
    variables: [
      { key: "investimento", label: "Investimento" },
      { key: "conversoes", label: "Conversões" },
      { key: "custo_por_conversao", label: "Custo por conversão" },
      { key: "roas", label: "ROAS" },
      { key: "ticket_medio", label: "Ticket médio" },
    ],
  },
  {
    name: "Criativos",
    variables: [{ key: "top_criativos", label: "Top criativos" }],
  },
];

const ALL_VARIABLES = CATEGORIES.flatMap((c) => c.variables);

/**
 * Campo de mensagem com um seletor de variáveis (busca + categorias, igual ao
 * padrão do dropdown de grupo do WhatsApp) que insere {chave} na posição do
 * cursor do textarea.
 */
export default function MessageTemplateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("Todas");

  function insertVariable(key: string) {
    const token = `{${key}}`;
    const textarea = textareaRef.current;

    if (!textarea) {
      onChange(value + token);
      setOpen(false);
      return;
    }

    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    setOpen(false);
    setQuery("");

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + token.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  const pool = category === "Todas"
    ? ALL_VARIABLES
    : CATEGORIES.find((c) => c.name === category)?.variables ?? [];
  const filtered = pool.filter(
    (v) =>
      v.label.toLowerCase().includes(query.toLowerCase()) ||
      v.key.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div>
      <label className="mb-1 block text-sm text-slate-300">Mensagem</label>

      <div className="relative mb-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-left text-sm text-slate-400"
        >
          {"<>"} Clique aqui para selecionar uma variável
        </button>

        {open && (
          <div className="absolute z-10 mt-1 w-full rounded border border-slate-700 bg-slate-900 shadow-lg">
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar busca"
              className="w-full border-b border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border-b border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
            >
              <option value="Todas">Todas as categorias</option>
              {CATEGORIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="px-2 py-2 text-xs text-slate-500">Nenhuma variável encontrada.</p>
              )}
              {filtered.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  className="flex w-full items-center justify-between px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800"
                >
                  <span>{v.label}</span>
                  <span className="rounded bg-sky-950 px-1.5 py-0.5 font-mono text-xs text-sky-300">
                    {`{${v.key}}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
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
