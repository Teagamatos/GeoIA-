"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getMarcas,
  getDominiosProprios,
  getPrompts,
  getExecucoesEntre,
  getMencoesPorExecucoes,
  getFontesPorExecucoes,
  calcularMetricasPorMarca,
  calcularPresencaDeFontes,
  calcularBreakdownPorDimensao,
  DIMENSOES_DETALHAMENTO,
  DimensaoDetalhamento,
  rangeDias,
  rangeAnterior,
  tendencia,
} from "@/lib/queries";
import { Marca, DominioProprio, Prompt, Execucao, Fonte, Mencao } from "@/lib/types";
import { StatCard } from "@/components/StatCard";
import { BrandSwitcher, RangeSwitcher, PromptSwitcher } from "@/components/TopControls";
import { RankingTable } from "@/components/RankingTable";
import { BreakdownTable } from "@/components/BreakdownTable";
import { IconRefresh } from "@/components/icons";

export default function DashboardPage() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [dominios, setDominios] = useState<DominioProprio[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [execucoesAtual, setExecucoesAtual] = useState<Execucao[]>([]);
  const [mencoesAtual, setMencoesAtual] = useState<Mencao[]>([]);
  const [fontesAtual, setFontesAtual] = useState<Fonte[]>([]);
  const [execucoesAnterior, setExecucoesAnterior] = useState<Execucao[]>([]);
  const [mencoesAnterior, setMencoesAnterior] = useState<Mencao[]>([]);
  const [fontesAnterior, setFontesAnterior] = useState<Fonte[]>([]);

  const [diasRange, setDiasRange] = useState(7);
  const [marcaSelecionada, setMarcaSelecionada] = useState<string | null>(null);
  const [dimensaoDetalhamento, setDimensaoDetalhamento] = useState<DimensaoDetalhamento>("modelo");
  const [promptSelecionado, setPromptSelecionado] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro(null);
      try {
        const [marcasData, dominiosData, promptsData] = await Promise.all([
          getMarcas(),
          getDominiosProprios(),
          getPrompts(),
        ]);
        setMarcas(marcasData);
        setDominios(dominiosData);
        setPrompts(promptsData);

        if (!marcaSelecionada) {
          const primeira = marcasData.find((m) => m.tipo === "propria" && m.ativo);
          if (primeira) setMarcaSelecionada(primeira.id);
        }

        const atual = rangeDias(diasRange);
        const anterior = rangeAnterior(diasRange);

        const [execAtual, execAnterior] = await Promise.all([
          getExecucoesEntre(atual.inicio, atual.fim),
          getExecucoesEntre(anterior.inicio, anterior.fim),
        ]);
        setExecucoesAtual(execAtual);
        setExecucoesAnterior(execAnterior);

        const [mencAtual, fontAtual, mencAnterior, fontAnterior] = await Promise.all([
          getMencoesPorExecucoes(execAtual.map((e) => e.id)),
          getFontesPorExecucoes(execAtual.map((e) => e.id)),
          getMencoesPorExecucoes(execAnterior.map((e) => e.id)),
          getFontesPorExecucoes(execAnterior.map((e) => e.id)),
        ]);
        setMencoesAtual(mencAtual);
        setFontesAtual(fontAtual);
        setMencoesAnterior(mencAnterior);
        setFontesAnterior(fontAnterior);
      } catch (e: any) {
        setErro(e.message ?? "Erro ao carregar dados do Supabase.");
      } finally {
        setCarregando(false);
      }
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diasRange, refreshKey]);

  // Quando um prompt específico é selecionado no filtro global, restringe
  // execuções/menções/fontes só àquele prompt antes de qualquer cálculo.
  const execucoesAtualFiltradas = useMemo(
    () =>
      promptSelecionado ? execucoesAtual.filter((e) => e.prompt_id === promptSelecionado) : execucoesAtual,
    [execucoesAtual, promptSelecionado]
  );
  const execucoesAnteriorFiltradas = useMemo(
    () =>
      promptSelecionado
        ? execucoesAnterior.filter((e) => e.prompt_id === promptSelecionado)
        : execucoesAnterior,
    [execucoesAnterior, promptSelecionado]
  );
  const mencoesAtualFiltradas = useMemo(() => {
    if (!promptSelecionado) return mencoesAtual;
    const idsValidos = new Set(execucoesAtualFiltradas.map((e) => e.id));
    return mencoesAtual.filter((m) => idsValidos.has(m.execucao_id));
  }, [mencoesAtual, execucoesAtualFiltradas, promptSelecionado]);
  const mencoesAnteriorFiltradas = useMemo(() => {
    if (!promptSelecionado) return mencoesAnterior;
    const idsValidos = new Set(execucoesAnteriorFiltradas.map((e) => e.id));
    return mencoesAnterior.filter((m) => idsValidos.has(m.execucao_id));
  }, [mencoesAnterior, execucoesAnteriorFiltradas, promptSelecionado]);
  const fontesAtualFiltradas = useMemo(() => {
    if (!promptSelecionado) return fontesAtual;
    const idsValidos = new Set(execucoesAtualFiltradas.map((e) => e.id));
    return fontesAtual.filter((f) => idsValidos.has(f.execucao_id));
  }, [fontesAtual, execucoesAtualFiltradas, promptSelecionado]);
  const fontesAnteriorFiltradas = useMemo(() => {
    if (!promptSelecionado) return fontesAnterior;
    const idsValidos = new Set(execucoesAnteriorFiltradas.map((e) => e.id));
    return fontesAnterior.filter((f) => idsValidos.has(f.execucao_id));
  }, [fontesAnterior, execucoesAnteriorFiltradas, promptSelecionado]);

  const metricasAtual = useMemo(
    () => calcularMetricasPorMarca(marcas, execucoesAtualFiltradas, mencoesAtualFiltradas),
    [marcas, execucoesAtualFiltradas, mencoesAtualFiltradas]
  );
  const metricasAnterior = useMemo(
    () => calcularMetricasPorMarca(marcas, execucoesAnteriorFiltradas, mencoesAnteriorFiltradas),
    [marcas, execucoesAnteriorFiltradas, mencoesAnteriorFiltradas]
  );

  const minhaMarcaAtual = metricasAtual.find((m) => m.marca.id === marcaSelecionada);
  const minhaMarcaAnterior = metricasAnterior.find((m) => m.marca.id === marcaSelecionada);

  const presencaVazia = {
    execucoesComFonteConsultada: 0,
    execucoesComFonteCitada: 0,
    totalExecucoes: 0,
    percentualConsultada: 0,
    percentualCitada: 0,
  };
  const presencaAtual = marcaSelecionada
    ? calcularPresencaDeFontes(marcaSelecionada, execucoesAtualFiltradas, fontesAtualFiltradas, dominios)
    : presencaVazia;
  const presencaAnterior = marcaSelecionada
    ? calcularPresencaDeFontes(marcaSelecionada, execucoesAnteriorFiltradas, fontesAnteriorFiltradas, dominios)
    : presencaVazia;

  const breakdown = marcaSelecionada
    ? calcularBreakdownPorDimensao(
        dimensaoDetalhamento,
        marcaSelecionada,
        execucoesAtualFiltradas,
        mencoesAtualFiltradas,
        prompts
      )
    : [];

  const marcaNome = marcas.find((m) => m.id === marcaSelecionada)?.nome ?? "";

  return (
    <div className="p-6 md:p-8 max-w-7xl">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            {marcaNome ? `Visibilidade — ${marcaNome}` : "Dashboard"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Como sua marca aparece nas respostas de IA, comparada aos concorrentes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <BrandSwitcher marcas={marcas} selecionada={marcaSelecionada} onChange={setMarcaSelecionada} />
          <PromptSwitcher prompts={prompts} selecionado={promptSelecionado} onChange={setPromptSelecionado} />
          <RangeSwitcher selecionado={diasRange} onChange={setDiasRange} />
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Atualizar dados"
            className="rounded-md border border-surface-200 bg-surface-0 p-2 text-slate-500 hover:text-slate-900 hover:border-slate-300"
          >
            <IconRefresh className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {erro && (
        <div className="mb-6 rounded-card border border-signal-rose/40 bg-signal-rose/10 px-4 py-3 text-sm text-signal-rose">
          Não consegui carregar os dados: {erro}
        </div>
      )}

      {carregando ? (
        <SkeletonDashboard />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 items-stretch">
            <StatCard
              label="Visibilidade"
              sublabel="Visibilidade média no período"
              value={`${(minhaMarcaAtual?.visibilidade ?? 0).toFixed(0)}%`}
              delta={
                minhaMarcaAtual
                  ? tendencia(minhaMarcaAtual.visibilidade, minhaMarcaAnterior?.visibilidade ?? 0) === "flat"
                    ? 0
                    : minhaMarcaAtual.visibilidade - (minhaMarcaAnterior?.visibilidade ?? 0)
                  : null
              }
              accent="amber"
              frac={{
                parte: minhaMarcaAtual?.execucoesComMencao ?? 0,
                total: minhaMarcaAtual?.totalExecucoes ?? 0,
                descricao: "respostas mencionam sua marca",
              }}
            />
            <StatCard
              label="Fonte consultada"
              sublabel="O modelo pesquisou um domínio próprio"
              value={`${presencaAtual.percentualConsultada.toFixed(0)}%`}
              delta={presencaAtual.percentualConsultada - presencaAnterior.percentualConsultada}
              accent="teal"
              frac={{
                parte: presencaAtual.execucoesComFonteConsultada,
                total: presencaAtual.totalExecucoes,
                descricao: "respostas consultam suas fontes",
              }}
            />
            <StatCard
              label="Fonte citada"
              sublabel="O modelo citou um domínio próprio como referência"
              value={`${presencaAtual.percentualCitada.toFixed(0)}%`}
              delta={presencaAtual.percentualCitada - presencaAnterior.percentualCitada}
              accent="rose"
              frac={{
                parte: presencaAtual.execucoesComFonteCitada,
                total: presencaAtual.totalExecucoes,
                descricao: "respostas citam suas fontes",
              }}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section>
              <h2 className="font-display text-sm font-semibold text-slate-700 mb-3">
                Ranking de marcas
              </h2>
              <RankingTable
                dados={metricasAtual}
                selecionada={marcaSelecionada}
                onSelecionar={setMarcaSelecionada}
              />
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h2 className="font-display text-sm font-semibold text-slate-700">Detalhamento</h2>
                <div className="inline-flex rounded-full border border-surface-200 bg-surface-0 p-1">
                  {DIMENSOES_DETALHAMENTO.map((d) => (
                    <button
                      key={d.valor}
                      onClick={() => setDimensaoDetalhamento(d.valor)}
                      className={`rounded-full px-3 py-1 text-xs transition-colors ${
                        dimensaoDetalhamento === d.valor
                          ? "bg-surface-100 text-slate-900 font-medium"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <BreakdownTable
                dados={breakdown}
                colunaLabel={DIMENSOES_DETALHAMENTO.find((d) => d.valor === dimensaoDetalhamento)?.label ?? "Modelo"}
              />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex gap-4">
        <div className="h-28 flex-1 rounded-card bg-surface-50" />
        <div className="h-28 flex-1 rounded-card bg-surface-50" />
        <div className="h-28 flex-1 rounded-card bg-surface-50" />
      </div>
      <div className="h-40 rounded-card bg-surface-50" />
      <div className="h-32 rounded-card bg-surface-50" />
    </div>
  );
}
