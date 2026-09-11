"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getMarcas,
  getPrompts,
  getExecucoesEntre,
  getFontesPorExecucoes,
  getMencoesPorExecucoes,
  calcularResumoFontes,
  ModoAgrupamentoFonte,
  ResumoFonte,
  rangeDias,
} from "@/lib/queries";
import { Marca, Prompt } from "@/lib/types";
import { mapaCoresPorMarca } from "@/lib/color";
import { RangeSwitcher, PromptSwitcher } from "@/components/TopControls";
import { MarcaBadge } from "@/components/MarcaBadge";
import { IconCaretDown, IconCaretUp } from "@/components/icons";

type SortKey = "chave" | "citadaPct" | "aparicoes" | "ordemMedia" | "vistoPorUltimo";

export default function FontesPage() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [resumos, setResumos] = useState<ResumoFonte[]>([]);
  const [totalExecucoes, setTotalExecucoes] = useState(0);

  const [diasRange, setDiasRange] = useState(30);
  const [promptSelecionado, setPromptSelecionado] = useState<string | null>(null);
  const [modo, setModo] = useState<ModoAgrupamentoFonte>("url");
  const [filtro, setFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("aparicoes");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      setCarregando(true);
      setErro(null);
      try {
        const { inicio, fim } = rangeDias(diasRange);
        const [marcasData, promptsData, execsPeriodo] = await Promise.all([
          getMarcas(),
          getPrompts(),
          getExecucoesEntre(inicio, fim),
        ]);
        const execs = promptSelecionado
          ? execsPeriodo.filter((e) => e.prompt_id === promptSelecionado)
          : execsPeriodo;
        const execIds = execs.map((e) => e.id);
        const [fontes, mencoes] = await Promise.all([
          getFontesPorExecucoes(execIds),
          getMencoesPorExecucoes(execIds),
        ]);
        if (cancelado) return;
        setMarcas(marcasData);
        setPrompts(promptsData);
        setTotalExecucoes(execs.length);
        setResumos(calcularResumoFontes(modo, execs, fontes, mencoes));
      } catch (e: any) {
        if (!cancelado) setErro(e.message ?? "Erro ao carregar fontes.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }
    carregar();
    return () => {
      cancelado = true;
    };
  }, [diasRange, modo, promptSelecionado]);

  const coresPorMarca = useMemo(() => mapaCoresPorMarca(marcas), [marcas]);
  const marcaPorId = useMemo(() => new Map(marcas.map((m) => [m.id, m])), [marcas]);

  const tiposDisponiveis = useMemo(() => {
    const set = new Set<string>();
    resumos.forEach((r) => r.tipo && set.add(r.tipo));
    return Array.from(set).sort();
  }, [resumos]);

  const filtrados = useMemo(() => {
    let lista = resumos;
    if (tipoFiltro) lista = lista.filter((r) => r.tipo === tipoFiltro);
    if (filtro.trim()) {
      const termo = filtro.toLowerCase();
      lista = lista.filter(
        (r) =>
          r.chave.toLowerCase().includes(termo) ||
          r.dominio.toLowerCase().includes(termo) ||
          (r.titulo ?? "").toLowerCase().includes(termo)
      );
    }
    return lista;
  }, [resumos, filtro, tipoFiltro]);

  const ordenados = useMemo(() => {
    const copia = [...filtrados];
    copia.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "chave") {
        av = a.chave.toLowerCase();
        bv = b.chave.toLowerCase();
      } else if (sortKey === "ordemMedia") {
        av = a.ordemMedia ?? Infinity;
        bv = b.ordemMedia ?? Infinity;
      } else if (sortKey === "vistoPorUltimo") {
        av = a.vistoPorUltimo ?? "";
        bv = b.vistoPorUltimo ?? "";
      } else {
        av = a[sortKey];
        bv = b[sortKey];
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copia;
  }, [filtrados, sortKey, sortDir]);

  function alternarOrdenacao(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "ordemMedia" ? "asc" : "desc");
    }
  }

  const topDominios = useMemo(() => {
    const contagem = new Map<string, number>();
    resumos.forEach((r) => contagem.set(r.dominio, (contagem.get(r.dominio) ?? 0) + r.aparicoes));
    return Array.from(contagem.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [resumos]);

  const colunas: { key: SortKey; label: string; align: "left" | "right" }[] = [
    { key: "chave", label: modo === "url" ? "URL" : "Domínio", align: "left" },
    { key: "citadaPct", label: "Citada", align: "right" },
    { key: "aparicoes", label: "Aparições", align: "right" },
    { key: "ordemMedia", label: "Ordem média", align: "right" },
    { key: "vistoPorUltimo", label: "Visto por último", align: "right" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Fontes</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Os links que a IA citou ao pesquisar na web pra responder um prompt, no período
            selecionado ({totalExecucoes} execuções).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PromptSwitcher prompts={prompts} selecionado={promptSelecionado} onChange={setPromptSelecionado} />
          <RangeSwitcher selecionado={diasRange} onChange={setDiasRange} />
        </div>
      </header>

      {erro && (
        <div className="mb-4 rounded-card border border-signal-rose/40 bg-signal-rose/10 px-4 py-3 text-sm text-signal-rose">
          {erro}
        </div>
      )}

      {topDominios.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {topDominios.map(([dominio, count]) => (
            <button
              key={dominio}
              onClick={() => setFiltro((f) => (f === dominio ? "" : dominio))}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                filtro === dominio
                  ? "border-signal-amber text-signal-amber bg-signal-amber/10"
                  : "border-surface-200 bg-surface-0 text-slate-700 hover:border-signal-amber hover:text-signal-amber"
              }`}
            >
              {dominio} · {count}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="inline-flex rounded-full border border-surface-200 bg-surface-0 p-1">
          <button
            onClick={() => setModo("url")}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              modo === "url" ? "bg-surface-100 text-slate-900 font-medium" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            URLs de origem
          </button>
          <button
            onClick={() => setModo("dominio")}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              modo === "dominio" ? "bg-surface-100 text-slate-900 font-medium" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Domínios de origem
          </button>
        </div>

        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Filtrar por domínio, título ou URL..."
          className="flex-1 min-w-[200px] rounded-md border border-surface-200 bg-surface-0 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500/60"
        />

        {tiposDisponiveis.length > 0 && (
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            className="rounded-md border border-surface-200 bg-surface-0 px-3 py-2 text-sm text-slate-900"
          >
            <option value="">Todos os tipos</option>
            {tiposDisponiveis.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
      </div>

      {carregando ? (
        <div className="animate-pulse h-64 rounded-card bg-surface-50" />
      ) : ordenados.length === 0 ? (
        <div className="rounded-card border border-surface-200 bg-surface-0 p-8 text-center text-sm text-slate-700">
          Nenhuma fonte encontrada no período selecionado.
        </div>
      ) : (
        <div className="rounded-card border border-surface-200 bg-surface-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-xs text-slate-500">
                {colunas.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 font-normal ${col.align === "right" ? "text-right" : "text-left"}`}
                  >
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
                <th className="px-4 py-3 font-normal text-left">Tipo</th>
                <th className="px-4 py-3 font-normal text-left">Marcas</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((r) => (
                <tr key={r.chave} className="border-b border-surface-100 last:border-0">
                  <td className="px-4 py-3 max-w-xs">
                    <a
                      href={modo === "url" ? r.chave : `https://${r.dominio}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-slate-900 hover:text-signal-amber hover:underline"
                      title={r.titulo ?? r.chave}
                    >
                      {r.titulo || r.chave}
                    </a>
                    {modo === "url" && <div className="truncate text-xs text-slate-500">{r.dominio}</div>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900 font-medium">{r.citadaPct.toFixed(0)}%</td>
                  <td className="px-4 py-3 text-right text-slate-900">{r.aparicoes}</td>
                  <td className="px-4 py-3 text-right text-slate-900">
                    {r.ordemMedia !== null ? r.ordemMedia.toFixed(1) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">
                    {r.vistoPorUltimo ? new Date(r.vistoPorUltimo).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {r.tipo ? (
                      <span className="rounded-full bg-surface-100 px-2.5 py-0.5 text-xs text-slate-700 whitespace-nowrap">
                        {r.tipo}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.marcaIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {r.marcaIds.map((id) => {
                          const marca = marcaPorId.get(id);
                          if (!marca) return null;
                          return (
                            <MarcaBadge key={id} nome={marca.nome} cor={coresPorMarca.get(id) ?? "#8FA0BA"} />
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-500/80">
        "Ordem média" é uma aproximação da posição da fonte dentro da resposta, com base na ordem em
        que foi registrada — não é necessariamente a posição exibida pelo modelo. A coluna "Marcas"
        só mostra uma marca quando há evidência direta de que o link é sobre ela (domínio próprio ou
        o título/URL da citação nomeia a marca) — link sem badge não significa que nenhuma marca foi
        citada na resposta, só que esse link específico não pôde ser atribuído com segurança a uma.
      </p>
    </div>
  );
}
