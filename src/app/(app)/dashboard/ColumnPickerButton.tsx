"use client";

import { useMemo, useState, useTransition } from "react";
import Modal from "@/app/Modal";
import { metricsByCategory, type MetricDefinition } from "@/lib/metrics-catalog";
import { updateSelectedColumnsAction } from "./actions";

const CATEGORIES = metricsByCategory();
const ALL_METRICS = CATEGORIES.flatMap((c) => c.metrics);

function metricByKey(key: string): MetricDefinition | undefined {
  return ALL_METRICS.find((m) => m.key === key);
}

export default function ColumnPickerButton({ selectedKeys }: { selectedKeys: string[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string[]>(selectedKeys);
  const [search, setSearch] = useState("");
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return CATEGORIES;
    return CATEGORIES.map((c) => ({
      ...c,
      metrics: c.metrics.filter((m) => m.label.toLowerCase().includes(term)),
    })).filter((c) => c.metrics.length > 0);
  }, [search]);

  function openModal() {
    setPending(selectedKeys);
    setSearch("");
    setOpen(true);
  }

  function toggle(key: string) {
    setPending((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function remove(key: string) {
    setPending((prev) => prev.filter((k) => k !== key));
  }

  function reorder(overKey: string) {
    if (!dragKey || dragKey === overKey) return;
    setPending((prev) => {
      const next = prev.filter((k) => k !== dragKey);
      const overIndex = next.indexOf(overKey);
      next.splice(overIndex, 0, dragKey);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      await updateSelectedColumnsAction(pending);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
      >
        📊 Colunas
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Personalizar colunas" widthClassName="max-w-4xl">
        <input
          type="text"
          placeholder="Pesquisar métricas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
        <div className="flex gap-4">
          <div className="max-h-96 flex-1 space-y-4 overflow-y-auto pr-2">
            {filteredCategories.map((c) => (
              <div key={c.category}>
                <p className="mb-1 text-xs font-semibold uppercase text-slate-500">{c.category}</p>
                {c.metrics.map((m) => (
                  <label
                    key={m.key}
                    className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={pending.includes(m.key)}
                      onChange={() => toggle(m.key)}
                      className="h-4 w-4 accent-emerald-500"
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            ))}
            {filteredCategories.length === 0 && (
              <p className="text-sm text-slate-500">Nenhuma métrica encontrada.</p>
            )}
          </div>
          <div className="w-64 shrink-0 border-l border-slate-800 pl-4">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
              {pending.length} coluna(s) selecionada(s)
            </p>
            <ul className="max-h-96 space-y-1 overflow-y-auto">
              {pending.map((key) => {
                const metric = metricByKey(key);
                if (!metric) return null;
                return (
                  <li
                    key={key}
                    draggable
                    onDragStart={() => setDragKey(key)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => reorder(key)}
                    className="flex cursor-move items-center justify-between rounded bg-slate-800 px-2 py-1 text-xs text-slate-200"
                  >
                    <span>⠿ {metric.label}</span>
                    <button type="button" onClick={() => remove(key)} className="text-slate-500 hover:text-red-400">
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={save}
            className="rounded bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </Modal>
    </>
  );
}
