"use client";

import { useEffect, useState } from "react";
import { listWhatsAppGroupsAction } from "@/app/actions";
import type { WhatsAppGroup } from "@/lib/zapi";

/**
 * Campo de formulário para escolher um grupo do WhatsApp pelo nome real.
 * Renderiza dois <input type="hidden"> (whatsapp_group_id, whatsapp_group_name)
 * para funcionar dentro de um <form action={...}> existente, sem precisar de
 * lógica extra no componente pai.
 */
export default function GroupSelect({
  defaultGroupId,
  defaultGroupName,
}: {
  defaultGroupId?: string | null;
  defaultGroupName?: string | null;
}) {
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<WhatsAppGroup | null>(
    defaultGroupId ? { id: defaultGroupId, name: defaultGroupName || defaultGroupId } : null,
  );

  useEffect(() => {
    let cancelled = false;
    listWhatsAppGroupsAction()
      .then((data) => {
        if (!cancelled) setGroups(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao buscar grupos.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = groups.filter((g) => g.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative">
      <input type="hidden" name="whatsapp_group_id" value={selected?.id ?? ""} />
      <input type="hidden" name="whatsapp_group_name" value={selected?.name ?? ""} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-left text-sm text-slate-100"
      >
        {selected ? selected.name : "Clique aqui para selecionar"}
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full rounded border border-slate-700 bg-slate-900 shadow-lg">
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar pelo nome"
            className="w-full border-b border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
          />
          <div className="max-h-56 overflow-y-auto">
            {loading && <p className="px-2 py-2 text-xs text-slate-500">Carregando grupos…</p>}
            {error && <p className="px-2 py-2 text-xs text-red-300">{error}</p>}
            {!loading && !error && filtered.length === 0 && (
              <p className="px-2 py-2 text-xs text-slate-500">Nenhum grupo encontrado.</p>
            )}
            {filtered.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setSelected(g);
                  setOpen(false);
                  setQuery("");
                }}
                className="block w-full px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800"
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
