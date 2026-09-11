"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MetricasMarca } from "@/lib/queries";
import { IconCaretDown, IconCaretUp } from "./icons";

type SortKey = "marca" | "shareOfVoice" | "posicaoMedia" | "visibilidade";

const COLUNAS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "marca", label: "Marca", align: "left" },
  { key: "shareOfVoice", label: "Share of Voice", align: "right" },
  { key: "posicaoMedia", label: "Posição", align: "right" },
  { key: "visibilidade", label: "Visibilidade", align: "right" },
];

interface RankingTableProps {
  dados: MetricasMarca[];
  /** id da marca em foco no resto do dashboard (StatCards, Detalhamento) — a linha correspondente fica destacada. */
  selecionada?: string | null;
  /** Clique no nome da marca: foca essa marca no dashboard (mesmo state do BrandSwitcher). */
  onSelecionar?: (id: string) => void;
}

export function RankingTable({ dados, selecionada, onSelecionar }: RankingTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("shareOfVoice");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function alternarOrdenacao(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "posicaoMedia" ? "asc" : "desc");
    }
  }

  const ordenados = useMemo(() => {
    const copia = [...dados];
    copia.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "marca") {
        av = a.marca.nome.toLowerCase();
        bv = b.marca.nome.toLowerCase();
      } else if (sortKey === "posicaoMedia") {
        av = a.posicaoMedia ?? Infinity;
        bv = b.posicaoMedia ?? Infinity;
      } else {
        av = a[sortKey];
        bv = b[sortKey];
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copia;
  }, [dados, sortKey, sortDir]);

  if (dados.length === 0) {
    return (
      <div className="rounded-card border border-surface-200 bg-surface-0 p-8 text-center">
        <p className="text-sm text-slate-700">Nenhuma marca ativa encontrada.</p>
      </div>
    );
  }

  const semConcorrentes = dados.filter((d) => d.marca.tipo === "concorrente").length === 0;

  return (
    <div className="rounded-card border border-surface-200 bg-surface-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-200 text-left text-xs text-slate-500">
            <th className="px-5 py-3 font-normal">#</th>
            {COLUNAS.map((col) => (
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
          {ordenados.map((d, i) => {
            const emFoco = d.marca.id === selecionada;
            const propria = d.marca.tipo === "propria";
            // Foco (clique) sempre "ganha" visualmente do destaque de marca própria -- é um
            // estado temporário e mais específico. Sem foco, marca própria fica com um leve
            // realce permanente (borda + fundo em teal) pra distinguir da holding à primeira vista.
            const corBorda = emFoco
              ? "border-l-signal-amber"
              : propria
              ? "border-l-signal-teal"
              : "border-l-transparent";
            const corFundo = emFoco ? "bg-signal-amber/10" : propria ? "bg-signal-teal/[0.04]" : "";
            return (
              <tr
                key={d.marca.id}
                className={`border-b border-surface-100 last:border-0 border-l-2 transition-colors ${corBorda} ${corFundo}`}
              >
                <td className="px-5 py-3 text-slate-500">{i + 1}</td>
                <td className="px-5 py-3">
                  {onSelecionar ? (
                    <button
                      onClick={() => onSelecionar(d.marca.id)}
                      title="Focar essa marca no dashboard"
                      className={`text-left hover:underline ${
                        emFoco
                          ? "font-semibold text-signal-amber"
                          : propria
                          ? "font-semibold text-slate-900"
                          : "text-slate-900"
                      }`}
                    >
                      {d.marca.nome}
                    </button>
                  ) : (
                    <span
                      className={
                        emFoco
                          ? "font-semibold text-signal-amber"
                          : propria
                          ? "font-semibold text-slate-900"
                          : "text-slate-900"
                      }
                    >
                      {d.marca.nome}
                    </span>
                  )}
                  {propria && (
                    <span className="ml-2 rounded-full bg-signal-teal/15 px-2 py-0.5 text-[11px] font-medium text-signal-teal">
                      holding
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right text-slate-900">{d.shareOfVoice.toFixed(0)}%</td>
                <td className="px-5 py-3 text-right text-slate-900">
                  {d.posicaoMedia !== null ? d.posicaoMedia.toFixed(1) : "—"}
                </td>
                <td className="px-5 py-3 text-right text-slate-900 font-medium">{d.visibilidade.toFixed(0)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {semConcorrentes && (
        <div className="border-t border-surface-200 px-5 py-3 text-xs text-slate-500">
          Nenhum concorrente cadastrado ainda.{" "}
          <Link href="/concorrentes" className="text-signal-amber hover:underline">
            Cadastrar concorrentes
          </Link>
        </div>
      )}
    </div>
  );
}
