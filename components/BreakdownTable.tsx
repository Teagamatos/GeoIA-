"use client";

import { useMemo, useState } from "react";
import { BreakdownItem } from "@/lib/queries";
import { IconCaretDown, IconCaretUp } from "./icons";

type SortKey = "chave" | "respostas" | "mencoes" | "visibilidade";

export function BreakdownTable({
  dados,
  colunaLabel = "Modelo",
}: {
  dados: BreakdownItem[];
  colunaLabel?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("respostas");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function alternarOrdenacao(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const ordenados = useMemo(() => {
    const copia = [...dados];
    copia.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copia;
  }, [dados, sortKey, sortDir]);

  if (dados.length === 0) {
    return (
      <div className="rounded-card border border-surface-200 bg-surface-0 p-8 text-center">
        <p className="text-sm text-slate-700">Nenhuma execução no período selecionado.</p>
      </div>
    );
  }

  const colunas: { key: SortKey; label: string; align: "left" | "right" }[] = [
    { key: "chave", label: colunaLabel, align: "left" },
    { key: "respostas", label: "Respostas", align: "right" },
    { key: "mencoes", label: "Menções", align: "right" },
    { key: "visibilidade", label: "Visibilidade", align: "right" },
  ];

  return (
    <div className="rounded-card border border-surface-200 bg-surface-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-200 text-left text-xs text-slate-500">
            {colunas.map((col) => (
              <th key={col.key} className={`px-5 py-3 font-normal ${col.align === "right" ? "text-right" : "text-left"}`}>
                <button
                  onClick={() => alternarOrdenacao(col.key)}
                  className={`inline-flex items-center gap-1 hover:text-slate-900 ${
                    col.align === "right" ? "flex-row-reverse" : ""
                  }`}
                >
                  {col.label}
                  <span className="flex flex-col -space-y-1 text-[8px] leading-none">
                    <IconCaretUp
                      className={`h-2 w-2 ${
                        sortKey === col.key && sortDir === "asc" ? "text-slate-700" : "text-slate-300"
                      }`}
                    />
                    <IconCaretDown
                      className={`h-2 w-2 ${
                        sortKey === col.key && sortDir === "desc" ? "text-slate-700" : "text-slate-300"
                      }`}
                    />
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordenados.map((d) => (
            <tr key={d.chave} className="border-b border-surface-100 last:border-0">
              <td className="px-5 py-3 text-slate-900">
                {d.chave}
                {d.detalhe && <span className="ml-2 text-xs text-slate-500">{d.detalhe}</span>}
              </td>
              <td className="px-5 py-3 text-right text-slate-900">{d.respostas}</td>
              <td className="px-5 py-3 text-right text-slate-900">{d.mencoes}</td>
              <td className="px-5 py-3 text-right text-slate-900 font-medium">{d.visibilidade.toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
