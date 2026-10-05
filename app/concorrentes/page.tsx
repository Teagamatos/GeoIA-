"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Marca, MarcaAlias, Prompt, Execucao, Fonte, Mencao } from "@/lib/types";
import {
  getPrompts,
  getExecucoesEntre,
  getFontesPorExecucoes,
  getMencoesPorExecucoes,
  calcularSerieVisibilidadePorMarca,
  calcularFluxoFontesPorMarca,
  rankingPresencaPorMarca,
  invalidarCache,
} from "@/lib/queries";
import { mapaCoresPorMarca, corVisibilidade } from "@/lib/color";
import { IconPlus, IconArchive } from "@/components/icons";
import { RangeSwitcher, PromptSwitcher } from "@/components/TopControls";
import { MultiLineChart } from "@/components/MultiLineChart";
import { SourceFlowSankey } from "@/components/SourceFlowSankey";
import { useFiltrosGlobais } from "@/components/FiltrosGlobaisProvider";

interface MarcaComAliases extends Marca {
  aliasesTexto: string;
}

/** Quantas marcas cabem no gráfico ao mesmo tempo antes de virar um emaranhado. */
const MAX_MARCAS_NO_GRAFICO = 10;
/** Concorrentes sugeridos por padrão (os mais presentes no período), além das marcas próprias. */
const TOP_CONCORRENTES_PADRAO = 5;
/** Linhas mostradas por vez na aba Gerenciar. */
const PAGINA_GERENCIAR = 30;

export default function ConcorrentesPage() {
  const [aba, setAba] = useState<"visao-geral" | "gerenciar">("visao-geral");

  const [marcas, setMarcas] = useState<MarcaComAliases[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  // Aviso quando o nome digitado colide com uma marca própria (nome ou alias) —
  // não bloqueia, só pede confirmação antes de cadastrar mesmo assim.
  const [avisoColisao, setAvisoColisao] = useState<string | null>(null);

  // periodo/promptSelecionado são compartilhados com as outras páginas (LAB-1056),
  // via FiltrosGlobaisProvider — não são mais um useState só desta página.
  const { promptSelecionado, setPromptSelecionado, periodo, setPeriodo } = useFiltrosGlobais();
  // Marca destacada ao clicar no nome dela no gráfico de linhas ou no Sankey (aba Visão geral).
  // Clicar de novo na mesma marca tira o destaque.
  const [marcaEmFoco, setMarcaEmFoco] = useState<string | null>(null);
  const alternarFoco = (id: string) => setMarcaEmFoco((atual) => (atual === id ? null : id));
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [mencoes, setMencoes] = useState<Mencao[]>([]);
  const [carregandoVisaoGeral, setCarregandoVisaoGeral] = useState(false);

  // Marcas escolhidas pra aparecer no gráfico e no fluxo. `null` = seleção automática
  // (marcas próprias com presença + os concorrentes mais presentes do período).
  const [selecaoManual, setSelecaoManual] = useState<string[] | null>(null);
  const [buscaGrafico, setBuscaGrafico] = useState("");
  const [rankingExpandido, setRankingExpandido] = useState(false);

  // Aba Gerenciar
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"ativas" | "arquivadas" | "todas">("ativas");

  async function carregar() {
    setCarregando(true);
    const [{ data: marcasData, error: e1 }, { data: aliasData, error: e2 }] = await Promise.all([
      supabase.from("geo_marca").select("*").order("nome"),
      supabase.from("geo_marca_alias").select("*"),
    ]);
    if (e1) setErro(e1.message);
    else if (e2) setErro(e2.message);
    else {
      const aliasesPorMarca = new Map<string, string[]>();
      (aliasData as MarcaAlias[])?.forEach((a) => {
        const lista = aliasesPorMarca.get(a.marca_id) ?? [];
        lista.push(a.alias);
        aliasesPorMarca.set(a.marca_id, lista);
      });
      setMarcas(
        ((marcasData as Marca[]) ?? []).map((m) => ({
          ...m,
          aliasesTexto: (aliasesPorMarca.get(m.id) ?? []).join(", "),
        }))
      );
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    if (aba !== "visao-geral") return;
    let cancelado = false;
    async function carregarVisaoGeral() {
      setCarregandoVisaoGeral(true);
      try {
        const { inicio, fim } = periodo;
        const [promptsData, execsPeriodo] = await Promise.all([getPrompts(), getExecucoesEntre(inicio, fim)]);
        const execs = promptSelecionado
          ? execsPeriodo.filter((e) => e.prompt_id === promptSelecionado)
          : execsPeriodo;
        const execIds = execs.map((e) => e.id);
        const [fontesData, mencoesData] = await Promise.all([
          getFontesPorExecucoes(execIds),
          getMencoesPorExecucoes(execIds),
        ]);
        if (cancelado) return;
        setPrompts(promptsData);
        setExecucoes(execs);
        setFontes(fontesData);
        setMencoes(mencoesData);
      } finally {
        if (!cancelado) setCarregandoVisaoGeral(false);
      }
    }
    carregarVisaoGeral();
    return () => {
      cancelado = true;
    };
  }, [aba, periodo.inicio, periodo.fim, promptSelecionado]);

  // ---------- Visão geral: ranking, seleção de marcas, série e fluxo ----------

  const ranking = useMemo(
    () => rankingPresencaPorMarca(marcas, execucoes, mencoes),
    [marcas, execucoes, mencoes]
  );

  const idsPadrao = useMemo(() => {
    const proprias = ranking.filter((r) => r.tipo === "propria" && r.respostas > 0);
    const concorrentes = ranking
      .filter((r) => r.tipo !== "propria" && r.respostas > 0)
      .slice(0, TOP_CONCORRENTES_PADRAO);
    const ids = [...proprias, ...concorrentes].map((r) => r.marcaId);
    if (ids.length > 0) return ids;
    // Sem nenhuma menção no período: ao menos as marcas próprias, pra o gráfico não ficar vazio.
    return ranking.filter((r) => r.tipo === "propria").map((r) => r.marcaId);
  }, [ranking]);

  const idsSelecionados = selecaoManual ?? idsPadrao;

  // Marcas selecionadas, próprias primeiro e depois por presença (a mesma ordem da tabela).
  const marcasSelecionadas = useMemo(() => {
    const porId = new Map(marcas.map((m) => [m.id, m]));
    const ordemRanking = new Map(ranking.map((r, i) => [r.marcaId, i]));
    return idsSelecionados
      .map((id) => porId.get(id))
      .filter((m): m is MarcaComAliases => !!m && m.ativo)
      .sort((a, b) => {
        const pa = a.tipo === "propria" ? 0 : 1;
        const pb = b.tipo === "propria" ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return (ordemRanking.get(a.id) ?? 9999) - (ordemRanking.get(b.id) ?? 9999);
      });
  }, [marcas, ranking, idsSelecionados]);

  // Cores só para as marcas em exibição (com ~230 marcas e 8 cores, tudo se repetia).
  const coresPorMarca = useMemo(() => mapaCoresPorMarca(marcasSelecionadas), [marcasSelecionadas]);

  const { datas, series, totais } = useMemo(
    () => calcularSerieVisibilidadePorMarca(marcasSelecionadas, execucoes, mencoes),
    [marcasSelecionadas, execucoes, mencoes]
  );

  const fluxoFontes = useMemo(() => {
    const f = calcularFluxoFontesPorMarca(fontes, mencoes, marcasSelecionadas);
    const comLink = new Set(f.links.map((l) => l.dominio));
    return { dominios: f.dominios.filter((d) => comLink.has(d)), links: f.links };
  }, [fontes, mencoes, marcasSelecionadas]);

  function alternarSelecao(id: string) {
    setSelecaoManual((atual) => {
      const base = atual ?? idsPadrao;
      if (base.includes(id)) return base.filter((x) => x !== id);
      if (base.length >= MAX_MARCAS_NO_GRAFICO) return base; // limite: o gráfico perde a leitura acima disso
      return [...base, id];
    });
  }

  const limiteAtingido = idsSelecionados.length >= MAX_MARCAS_NO_GRAFICO;

  const sugestoesBusca = useMemo(() => {
    const termo = normalizarNome(buscaGrafico);
    if (!termo) return [];
    const sel = new Set(idsSelecionados);
    return ranking
      .filter((r) => !sel.has(r.marcaId) && normalizarNome(r.nome).includes(termo))
      .slice(0, 8);
  }, [buscaGrafico, ranking, idsSelecionados]);

  const rankingVisivel = rankingExpandido ? ranking.filter((r) => r.respostas > 0) : ranking.slice(0, 15);
  const totalComPresenca = ranking.filter((r) => r.respostas > 0).length;

  // ---------- Gerenciar ----------

  function normalizarNome(s: string): string {
    return s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  }

  // Confere se o nome digitado bate (ou já foi cadastrado como alias) com uma
  // marca PRÓPRIA — não com outro concorrente, já que dois concorrentes com
  // nome parecido é só coincidência de mercado, mas colidir com a holding é
  // provavelmente erro de digitação ou duplicidade.
  function encontrarColisaoComPropria(nome: string): MarcaComAliases | null {
    const normalizado = normalizarNome(nome);
    return (
      marcas.find((m) => {
        if (m.tipo !== "propria") return false;
        if (normalizarNome(m.nome) === normalizado) return true;
        const aliases = m.aliasesTexto
          .split(",")
          .map((a) => normalizarNome(a))
          .filter(Boolean);
        return aliases.includes(normalizado);
      }) ?? null
    );
  }

  function adicionarConcorrente() {
    if (!novoNome.trim()) return;
    setErro(null);

    const colisao = encontrarColisaoComPropria(novoNome);
    if (colisao) {
      setAvisoColisao(
        `"${novoNome.trim()}" bate com o nome (ou um alias) da marca própria "${colisao.nome}". Confirma que é um concorrente diferente mesmo?`
      );
      return; // não insere ainda — espera confirmar no aviso abaixo
    }

    inserirConcorrente();
  }

  async function inserirConcorrente() {
    setSalvando(true);
    setErro(null);
    const { error } = await supabase
      .from("geo_marca")
      .insert({ nome: novoNome.trim(), tipo: "concorrente", ativo: true });
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setNovoNome("");
    setAvisoColisao(null);
    invalidarCache("marcas"); // outras páginas (Dashboard, Fontes, Prompts) usam getMarcas() em cache
    carregar();
  }

  async function atualizarCampo(id: string, campo: "nome" | "tipo", valor: string) {
    setMarcas((prev) => prev.map((m) => (m.id === id ? { ...m, [campo]: valor } : m)));
  }

  async function salvarCampo(id: string, campo: "nome" | "tipo", valor: string) {
    const { error } = await supabase.from("geo_marca").update({ [campo]: valor }).eq("id", id);
    if (error) setErro(error.message);
    else invalidarCache("marcas");
  }

  async function alternarAtivo(m: MarcaComAliases) {
    setMarcas((prev) => prev.map((x) => (x.id === m.id ? { ...x, ativo: !x.ativo } : x)));
    const { error } = await supabase.from("geo_marca").update({ ativo: !m.ativo }).eq("id", m.id);
    if (error) setErro(error.message);
    else invalidarCache("marcas");
  }

  function editarAliasesTexto(id: string, texto: string) {
    setMarcas((prev) => prev.map((m) => (m.id === id ? { ...m, aliasesTexto: texto } : m)));
  }

  async function salvarAliases(m: MarcaComAliases) {
    const novos = m.aliasesTexto
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    const { data: existentes } = await supabase
      .from("geo_marca_alias")
      .select("*")
      .eq("marca_id", m.id);

    const existentesAlias = (existentes as MarcaAlias[]) ?? [];
    const paraRemover = existentesAlias.filter((e) => !novos.includes(e.alias));
    const paraAdicionar = novos.filter((n) => !existentesAlias.some((e) => e.alias === n));

    if (paraRemover.length > 0) {
      await supabase
        .from("geo_marca_alias")
        .delete()
        .in("id", paraRemover.map((r) => r.id));
    }
    if (paraAdicionar.length > 0) {
      await supabase
        .from("geo_marca_alias")
        .insert(paraAdicionar.map((alias) => ({ marca_id: m.id, alias })));
    }
    if (paraRemover.length > 0 || paraAdicionar.length > 0) invalidarCache("marcaAliases");
  }

  // Arquivar nunca apaga a linha em geo_marca: só marca ativo=false. geo_mencao, geo_marca_alias
  // e geo_dominio_proprio referenciam marca_id — excluir de verdade quebraria esse histórico
  // (ou a FK) sem necessidade, já que "ativo=false" já basta pra tirar a marca do ranking/filtros.
  async function arquivar(m: MarcaComAliases) {
    setMarcas((prev) => prev.map((x) => (x.id === m.id ? { ...x, ativo: false } : x)));
    const { error } = await supabase.from("geo_marca").update({ ativo: false }).eq("id", m.id);
    if (error) {
      setErro(error.message);
      carregar();
    } else {
      invalidarCache("marcas");
    }
  }

  const proprias = marcas.filter((m) => m.tipo === "propria");
  const concorrentesTodos = marcas.filter((m) => m.tipo !== "propria");
  const concorrentesAtivos = concorrentesTodos.filter((m) => m.ativo).length;
  const concorrentesArquivados = concorrentesTodos.length - concorrentesAtivos;

  const concorrentesFiltrados = useMemo(() => {
    const termo = normalizarNome(busca);
    return concorrentesTodos.filter((m) => {
      if (filtroStatus === "ativas" && !m.ativo) return false;
      if (filtroStatus === "arquivadas" && m.ativo) return false;
      if (!termo) return true;
      return normalizarNome(m.nome).includes(termo) || normalizarNome(m.aliasesTexto).includes(termo);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concorrentesTodos, busca, filtroStatus]);

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Concorrentes</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Marcas monitoradas nas respostas de IA. A coleta roda toda segunda e quinta-feira.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-surface-200 bg-surface-0 p-1 shrink-0">
          <button
            onClick={() => setAba("visao-geral")}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              aba === "visao-geral"
                ? "bg-surface-100 text-slate-900 font-medium"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Visão geral
          </button>
          <button
            onClick={() => setAba("gerenciar")}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              aba === "gerenciar"
                ? "bg-surface-100 text-slate-900 font-medium"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Gerenciar
          </button>
        </div>
      </header>

      {erro && (
        <div className="mb-4 rounded-card border border-signal-rose/40 bg-signal-rose/10 px-4 py-3 text-sm text-signal-rose">
          {erro}
        </div>
      )}

      {aba === "visao-geral" ? (
        <div className="space-y-8">
          <div className="flex flex-wrap justify-end gap-3">
            <PromptSwitcher prompts={prompts} selecionado={promptSelecionado} onChange={setPromptSelecionado} />
            <RangeSwitcher periodo={periodo} onChange={setPeriodo} />
          </div>

          {/* Escolha de marcas: o gráfico e o fluxo mostram só estas, não as ~230 cadastradas. */}
          <section className="rounded-card border border-surface-200 bg-surface-0 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="font-display text-sm font-semibold text-slate-700">
                Marcas no gráfico{" "}
                <span className="font-normal text-slate-500">
                  ({idsSelecionados.length}/{MAX_MARCAS_NO_GRAFICO})
                </span>
              </h2>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => setSelecaoManual(null)}
                  className="rounded-full border border-surface-200 px-3 py-1 text-slate-700 hover:bg-surface-100"
                  title="Marcas próprias + os concorrentes mais presentes do período"
                >
                  Padrão
                </button>
                <button
                  onClick={() => setSelecaoManual(proprias.filter((m) => m.ativo).map((m) => m.id))}
                  className="rounded-full border border-surface-200 px-3 py-1 text-slate-700 hover:bg-surface-100"
                >
                  Só marcas próprias
                </button>
                <button
                  onClick={() =>
                    setSelecaoManual([
                      ...ranking.filter((r) => r.tipo === "propria" && r.respostas > 0).map((r) => r.marcaId),
                      ...ranking
                        .filter((r) => r.tipo !== "propria" && r.respostas > 0)
                        .slice(0, MAX_MARCAS_NO_GRAFICO)
                        .map((r) => r.marcaId),
                    ].slice(0, MAX_MARCAS_NO_GRAFICO))
                  }
                  className="rounded-full border border-surface-200 px-3 py-1 text-slate-700 hover:bg-surface-100"
                >
                  Top {MAX_MARCAS_NO_GRAFICO}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {marcasSelecionadas.map((m) => (
                <button
                  key={m.id}
                  onClick={() => alternarSelecao(m.id)}
                  title="Remover do gráfico"
                  className="flex items-center gap-1.5 rounded-full border border-surface-200 bg-surface-50 py-1 pl-2.5 pr-2 text-xs text-slate-900 hover:bg-surface-100"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: coresPorMarca.get(m.id) ?? "#8FA0BA" }}
                  />
                  {m.nome}
                  {m.tipo === "propria" && <span className="text-slate-500">· própria</span>}
                  <span className="text-slate-400">×</span>
                </button>
              ))}
              {marcasSelecionadas.length === 0 && (
                <span className="text-xs text-slate-500">Nenhuma marca selecionada.</span>
              )}
            </div>

            <div className="relative mt-3 max-w-sm">
              <input
                value={buscaGrafico}
                onChange={(e) => setBuscaGrafico(e.target.value)}
                placeholder={limiteAtingido ? "Limite de marcas atingido — remova uma para adicionar" : "Adicionar marca ao gráfico…"}
                disabled={limiteAtingido}
                className="w-full rounded-md border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500/60 disabled:opacity-60"
              />
              {sugestoesBusca.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-surface-200 bg-surface-0 shadow-lg">
                  {sugestoesBusca.map((r) => (
                    <li key={r.marcaId}>
                      <button
                        onClick={() => {
                          alternarSelecao(r.marcaId);
                          setBuscaGrafico("");
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-100"
                      >
                        <span className="text-slate-900">{r.nome}</span>
                        <span className="text-xs text-slate-500">
                          {r.respostas} {r.respostas === 1 ? "resposta" : "respostas"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {carregandoVisaoGeral ? (
            <div className="animate-pulse h-56 rounded-card bg-surface-50" />
          ) : (
            <section>
              <h2 className="font-display text-sm font-semibold text-slate-700 mb-3">
                Visibilidade por coleta
              </h2>
              <MultiLineChart
                datas={datas}
                series={series}
                totais={totais}
                cores={coresPorMarca}
                emFoco={marcaEmFoco}
                onFocar={alternarFoco}
              />
              <p className="mt-2 text-xs text-slate-500">
                Cada ponto é uma coleta (segunda ou quinta): % das respostas daquele dia que citam a
                marca. Passe o mouse sobre um dia para ver os valores e a quantidade de respostas.
              </p>
            </section>
          )}

          {/* Ranking compacto: dá pra conferir os números sem ler o gráfico. */}
          {!carregandoVisaoGeral && (
            <section>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h2 className="font-display text-sm font-semibold text-slate-700">
                  Presença no período{" "}
                  <span className="font-normal text-slate-500">
                    · {execucoes.length} respostas · {totalComPresenca} marcas com presença
                  </span>
                </h2>
                {totalComPresenca > 15 && (
                  <button
                    onClick={() => setRankingExpandido((v) => !v)}
                    className="text-xs text-slate-700 underline-offset-2 hover:underline"
                  >
                    {rankingExpandido ? "Mostrar só o top 15" : `Ver todas (${totalComPresenca})`}
                  </button>
                )}
              </div>
              <div className="rounded-card border border-surface-200 bg-surface-0 overflow-hidden">
                <div className="max-h-[28rem] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface-50 text-xs text-slate-500">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Marca</th>
                        <th className="px-4 py-2 text-right font-medium">Respostas</th>
                        <th className="px-4 py-2 text-right font-medium">Presença</th>
                        <th className="px-4 py-2 text-right font-medium" title="Posição média de aparição na resposta (menor é melhor)">
                          Posição média
                        </th>
                        <th className="px-4 py-2 text-right font-medium">No gráfico</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {rankingVisivel.map((r) => {
                        const noGrafico = idsSelecionados.includes(r.marcaId);
                        const cor = corVisibilidade(r.pct);
                        return (
                          <tr key={r.marcaId} className={noGrafico ? "bg-surface-50/60" : undefined}>
                            <td className="px-4 py-2">
                              <span className="flex items-center gap-2">
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: noGrafico ? coresPorMarca.get(r.marcaId) ?? "#8FA0BA" : "#D3DAE6" }}
                                />
                                <span className="text-slate-900">{r.nome}</span>
                                {r.tipo === "propria" && (
                                  <span className="rounded-full bg-signal-amber/15 px-2 py-0.5 text-[10px] font-medium text-ink-950">
                                    própria
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right text-slate-700">{r.respostas}</td>
                            <td className="px-4 py-2 text-right">
                              <span
                                className="rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{ backgroundColor: cor.bg, color: cor.text }}
                              >
                                {r.pct.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right text-slate-700">
                              {r.posicaoMedia !== null ? r.posicaoMedia.toFixed(1) : "—"}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                onClick={() => alternarSelecao(r.marcaId)}
                                disabled={!noGrafico && limiteAtingido}
                                className={`rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-40 ${
                                  noGrafico
                                    ? "bg-signal-teal/10 text-signal-teal hover:bg-signal-teal/20"
                                    : "text-slate-500 hover:bg-surface-100 hover:text-slate-900"
                                }`}
                              >
                                {noGrafico ? "Remover" : "Adicionar"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {rankingVisivel.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                            Nenhuma marca foi citada no período selecionado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {carregandoVisaoGeral ? (
            <div className="animate-pulse h-80 rounded-card bg-surface-50" />
          ) : (
            <section>
              <h2 className="font-display text-sm font-semibold text-slate-700 mb-3">
                Fluxo de fontes → marca
              </h2>
              <SourceFlowSankey
                dominios={fluxoFontes.dominios}
                marcas={marcasSelecionadas}
                links={fluxoFontes.links}
                cores={coresPorMarca}
                emFoco={marcaEmFoco}
                onFocar={alternarFoco}
              />
            </section>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-card border border-surface-200 bg-surface-0 p-5 mb-8 flex flex-col sm:flex-row gap-3">
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Nome do concorrente (ex: Robert Half)"
              className="flex-1 rounded-md border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500/60"
              onKeyDown={(e) => e.key === "Enter" && adicionarConcorrente()}
            />
            <button
              onClick={adicionarConcorrente}
              disabled={salvando || !novoNome.trim()}
              className="flex items-center justify-center gap-1.5 rounded-md bg-signal-amber px-3.5 py-2 text-sm font-medium text-ink-950 disabled:opacity-40 whitespace-nowrap"
            >
              <IconPlus className="h-4 w-4" />
              Adicionar concorrente
            </button>
          </div>

          {avisoColisao && (
            <div className="mb-8 rounded-card border border-signal-amber/40 bg-signal-amber/10 px-4 py-3 text-sm text-ink-950 flex flex-wrap items-center justify-between gap-3">
              <span>{avisoColisao}</span>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setAvisoColisao(null)}
                  className="rounded-md px-3 py-1.5 text-xs text-slate-700 hover:bg-surface-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={inserirConcorrente}
                  disabled={salvando}
                  className="rounded-md bg-signal-amber px-3 py-1.5 text-xs font-medium text-ink-950 disabled:opacity-40"
                >
                  Cadastrar mesmo assim
                </button>
              </div>
            </div>
          )}

          {carregando ? (
            <div className="animate-pulse h-40 rounded-card bg-surface-50" />
          ) : (
            <>
              <MarcaGrupo
                titulo="Holding (marcas próprias)"
                marcas={proprias}
                onNome={atualizarCampo}
                onSalvarNome={salvarCampo}
                onAtivo={alternarAtivo}
                onAliases={editarAliasesTexto}
                onSalvarAliases={salvarAliases}
                onArquivar={arquivar}
                permiteArquivar={false}
              />
              <div className="h-8" />

              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h2 className="font-display text-sm font-semibold text-slate-700">
                  Concorrentes{" "}
                  <span className="font-normal text-slate-500">
                    · {concorrentesAtivos} ativos
                    {concorrentesArquivados > 0 && ` · ${concorrentesArquivados} arquivados`}
                  </span>
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar concorrente…"
                    className="w-56 rounded-md border border-surface-200 bg-surface-0 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-500/60"
                  />
                  <div className="inline-flex rounded-full border border-surface-200 bg-surface-0 p-0.5 text-xs">
                    {(
                      [
                        ["ativas", "Ativos"],
                        ["arquivadas", "Arquivados"],
                        ["todas", "Todos"],
                      ] as const
                    ).map(([valor, rotulo]) => (
                      <button
                        key={valor}
                        onClick={() => setFiltroStatus(valor)}
                        className={`rounded-full px-3 py-1 transition-colors ${
                          filtroStatus === valor
                            ? "bg-surface-100 text-slate-900 font-medium"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        {rotulo}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <MarcaGrupo
                key={`${busca}|${filtroStatus}`}
                marcas={concorrentesFiltrados}
                onNome={atualizarCampo}
                onSalvarNome={salvarCampo}
                onAtivo={alternarAtivo}
                onAliases={editarAliasesTexto}
                onSalvarAliases={salvarAliases}
                onArquivar={arquivar}
                permiteArquivar={true}
                limitePagina={PAGINA_GERENCIAR}
                vazio={
                  busca || filtroStatus !== "ativas"
                    ? "Nenhum concorrente encontrado com esse filtro."
                    : "Nenhum concorrente cadastrado ainda. Adicione acima."
                }
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function MarcaGrupo({
  titulo,
  marcas,
  onNome,
  onSalvarNome,
  onAtivo,
  onAliases,
  onSalvarAliases,
  onArquivar,
  permiteArquivar,
  limitePagina,
  vazio,
}: {
  titulo?: string;
  marcas: MarcaComAliases[];
  onNome: (id: string, campo: "nome" | "tipo", valor: string) => void;
  onSalvarNome: (id: string, campo: "nome" | "tipo", valor: string) => void;
  onAtivo: (m: MarcaComAliases) => void;
  onAliases: (id: string, texto: string) => void;
  onSalvarAliases: (m: MarcaComAliases) => void;
  onArquivar: (m: MarcaComAliases) => void;
  permiteArquivar: boolean;
  /** Quantas linhas mostrar por vez (com botão "Mostrar mais"). Sem isso, mostra todas. */
  limitePagina?: number;
  vazio?: string;
}) {
  const [visiveis, setVisiveis] = useState(limitePagina ?? Infinity);
  const [aliasAbertos, setAliasAbertos] = useState<Set<string>>(new Set());

  const alternarAlias = (id: string) =>
    setAliasAbertos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const lista = marcas.slice(0, visiveis);

  return (
    <section>
      {titulo && <h2 className="font-display text-sm font-semibold text-slate-700 mb-3">{titulo}</h2>}
      {marcas.length === 0 ? (
        <div className="rounded-card border border-surface-200 bg-surface-0 p-6 text-center text-sm text-slate-500">
          {vazio ?? "Nenhuma marca aqui."}
        </div>
      ) : (
        <div className="rounded-card border border-surface-200 bg-surface-0 divide-y divide-surface-100">
          {lista.map((m) => {
            const aberto = aliasAbertos.has(m.id) || (!limitePagina && true);
            const qtdAliases = m.aliasesTexto ? m.aliasesTexto.split(",").filter((a) => a.trim()).length : 0;
            return (
              <div key={m.id} className="flex flex-col gap-1.5 px-5 py-2.5">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onAtivo(m)}
                    title={m.ativo ? "Ativa — clique para desativar" : "Inativa — clique para ativar"}
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${m.ativo ? "bg-signal-teal" : "bg-slate-300"}`}
                  />
                  <input
                    value={m.nome}
                    onChange={(e) => onNome(m.id, "nome", e.target.value)}
                    onBlur={(e) => onSalvarNome(m.id, "nome", e.target.value)}
                    className="flex-1 bg-transparent text-sm font-medium text-slate-900 focus:bg-surface-50 rounded px-1"
                  />
                  {limitePagina && (
                    <button
                      onClick={() => alternarAlias(m.id)}
                      className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-surface-100 hover:text-slate-900"
                      title="Variações do nome usadas para encontrar a marca nas respostas"
                    >
                      Variações{qtdAliases > 0 ? ` (${qtdAliases})` : ""}
                    </button>
                  )}
                  {permiteArquivar &&
                    (m.ativo ? (
                      <button
                        onClick={() => onArquivar(m)}
                        className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-surface-100 hover:text-slate-900"
                        title="Arquivar — tira do ranking/filtros, mas mantém todo o histórico no banco"
                      >
                        <IconArchive className="h-4 w-4" />
                        Arquivar
                      </button>
                    ) : (
                      <button
                        onClick={() => onAtivo(m)}
                        className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-signal-teal hover:bg-signal-teal/10"
                        title="Reativar — volta a aparecer no ranking/filtros"
                      >
                        Reativar
                      </button>
                    ))}
                </div>
                {aberto && (
                  <input
                    value={m.aliasesTexto}
                    onChange={(e) => onAliases(m.id, e.target.value)}
                    onBlur={() => onSalvarAliases(m)}
                    placeholder="Variações do nome, separadas por vírgula (ex: TFC, Foursales Company)"
                    className="ml-5 rounded-md bg-transparent text-xs text-slate-500 placeholder:text-slate-500/50 focus:bg-surface-50 px-1 py-1"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      {marcas.length > lista.length && (
        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-slate-500">
          <span>
            Mostrando {lista.length} de {marcas.length}
          </span>
          <button
            onClick={() => setVisiveis((v) => v + (limitePagina ?? 30))}
            className="rounded-full border border-surface-200 bg-surface-0 px-3 py-1 text-slate-700 hover:bg-surface-100"
          >
            Mostrar mais
          </button>
        </div>
      )}
    </section>
  );
}
