"use client";

import { Marca, Prompt } from "@/lib/types";

interface BrandSwitcherProps {
  marcas: Marca[];
  selecionada: string | null;
  onChange: (id: string) => void;
}

export function BrandSwitcher({ marcas, selecionada, onChange }: BrandSwitcherProps) {
  const proprias = marcas.filter((m) => m.tipo === "propria" && m.ativo);

  if (proprias.length === 0) return null;

  return (
    <div className="inline-flex rounded-full border border-surface-200 bg-surface-0 p-1">
      {proprias.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
            selecionada === m.id
              ? "bg-signal-amber text-ink-950 font-medium"
              : "text-slate-700 hover:text-slate-900"
          }`}
        >
          {m.nome}
        </button>
      ))}
    </div>
  );
}

const RANGES = [
  { dias: 7, label: "7 dias" },
  { dias: 30, label: "30 dias" },
  { dias: 90, label: "90 dias" },
];

export function RangeSwitcher({
  selecionado,
  onChange,
}: {
  selecionado: number;
  onChange: (dias: number) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-surface-200 bg-surface-0 p-1">
      {RANGES.map((r) => (
        <button
          key={r.dias}
          onClick={() => onChange(r.dias)}
          className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
            selecionado === r.dias
              ? "bg-surface-100 text-slate-900 font-medium"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

/** Filtro global "Todos os prompts" — restringe os dados da página a um prompt específico. */
export function PromptSwitcher({
  prompts,
  selecionado,
  onChange,
}: {
  prompts: Prompt[];
  selecionado: string | null;
  onChange: (id: string | null) => void;
}) {
  if (prompts.length === 0) return null;

  return (
    <select
      value={selecionado ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded-md border border-surface-200 bg-surface-0 px-3 py-2 text-sm text-slate-900 max-w-[220px]"
      title={selecionado ? prompts.find((p) => p.id === selecionado)?.texto : undefined}
    >
      <option value="">Todos os prompts</option>
      {prompts.map((p) => (
        <option key={p.id} value={p.id}>
          {p.texto.length > 60 ? `${p.texto.slice(0, 58)}…` : p.texto}
        </option>
      ))}
    </select>
  );
}
