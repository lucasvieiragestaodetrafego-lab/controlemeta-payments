"use client";

import { useEffect, useRef, useState } from "react";

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
    name: "Alcance e Frequência",
    variables: [
      { key: "alcance", label: "Alcance" },
      { key: "impressoes", label: "Impressões" },
      { key: "frequencia", label: "Frequência" },
    ],
  },
  {
    name: "Cliques",
    variables: [
      { key: "cliques", label: "Cliques" },
      { key: "cliques_unicos", label: "Cliques únicos" },
      { key: "ctr", label: "CTR" },
      { key: "ctr_unico", label: "CTR único" },
    ],
  },
  {
    name: "Custo",
    variables: [
      { key: "investimento", label: "Investimento" },
      { key: "cpc", label: "CPC (custo por clique)" },
      { key: "cpm", label: "CPM (custo por mil impressões)" },
      { key: "custo_por_conversao", label: "Custo por conversão" },
    ],
  },
  {
    name: "Conversão e Resultado",
    variables: [
      { key: "conversoes", label: "Conversões" },
      { key: "roas", label: "ROAS" },
      { key: "ticket_medio", label: "Ticket médio" },
    ],
  },
  {
    name: "Engajamento",
    variables: [
      { key: "engajamento", label: "Engajamento (curtidas, comentários, cliques no post)" },
      { key: "visualizacoes_video", label: "Visualizações de vídeo" },
    ],
  },
  {
    name: "Criativos",
    variables: [{ key: "top_criativos", label: "Top criativos" }],
  },
];

const ALL_VARIABLES = CATEGORIES.flatMap((c) => c.variables);

/**
 * Campo de mensagem com um seletor de variáveis (busca + categorias). Clicar
 * numa variável COPIA {chave} pra área de transferência — o usuário cola
 * manualmente onde quiser no texto (evita "colar" no lugar errado quando o
 * cursor perde a posição por causa do próprio clique no seletor).
 */
export default function MessageTemplateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("Todas");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function copyVariable(key: string) {
    const token = `{${key}}`;
    try {
      await navigator.clipboard.writeText(token);
    } catch {
      // clipboard indisponível (ex: contexto não seguro) — usuário digita manualmente
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
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

      <div ref={containerRef} className="relative mb-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-left text-sm text-slate-400"
        >
          {"<>"} Clique aqui para copiar uma variável
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
                  onClick={() => copyVariable(v.key)}
                  className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800"
                >
                  <span>{v.label}</span>
                  <span className="rounded bg-sky-950 px-1.5 py-0.5 font-mono text-xs text-sky-300">
                    {copiedKey === v.key ? "Copiado!" : `{${v.key}}`}
                  </span>
                </button>
              ))}
            </div>
            <p className="border-t border-slate-800 px-2 py-1.5 text-xs text-slate-500">
              Clique numa variável pra copiar, depois cole (Ctrl+V) onde quiser no texto.
            </p>
          </div>
        )}
      </div>

      <textarea
        name="message_template"
        rows={10}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
      />
    </div>
  );
}
