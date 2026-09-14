"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Marca, MarcaAlias, TipoMarca, Prompt, Execucao, Fonte, Mencao } from "@/lib/types";
import {
  getPrompts,
  getExecucoesEntre,
  getFontesPorExecucoes,
  getMencoesPorExecucoes,
  calcularSerieVisibilidadePorMarca,
  calcularFluxoFontesPorMarca,
  rangeDias,
  invalidarCache,
} from "@/lib/queries";
import { mapaCoresPorMarca } from "@/lib/color";
import { IconPlus, IconArchive } from "@/components/icons";
import { RangeSwitcher, PromptSwitcher } from "@/components/TopControls";
import { MultiLineChart } from "@/components/MultiLineChart";
import { SourceFlowSankey } from "@/components/SourceFlowSankey";
import { useFiltrosGlobais } from "@/components/FiltrosGlobaisProvider";

interface MarcaComAliases extends Marca {
  aliasesTexto: string;
}

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

  // diasRange/promptSelecionado são compartilhados com as outras páginas (LAB-1056),
  // via FiltrosGlobaisProvider — não são mais um useState só desta página.
  const { promptSelecionado, setPromptSelecionado, diasRange, setDiasRange } = useFiltrosGlobais();
  // Marca destacada ao clicar no nome dela no gráfico de linhas ou no Sankey (aba Visão geral).
  // Clicar de novo na mesma marca tira o destaque.
  const [marcaEmFoco, setMarcaEmFoco] = useState<string | null>(null);
  const alternarFoco = (id: string) => setMarcaEmFoco((atual) => (atual === id ? null : id));
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [mencoes, setMencoes] = useState<Mencao[]>([]);
  const [carregandoVisaoGeral, setCarregandoVisaoGeral] = useState(false);

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
        const { inicio, fim } = rangeDias(diasRange);
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
  }, [aba, diasRange, promptSelecionado]);

  const coresPorMarca = useMemo(() => mapaCoresPorMarca(marcas), [marcas]);

  // A série cobre o período inteiro (não só os dias que tiveram execução) pra
  // um dia sem nenhuma coleta virar uma lacuna real no gráfico, não um "pulo".
  const { inicio: inicioSerie, fim: fimSerie } = rangeDias(diasRange);
  const { datas, series } = useMemo(
    () => calcularSerieVisibilidadePorMarca(marcas, execucoes, mencoes, inicioSerie, fimSerie),
    [marcas, execucoes, mencoes, inicioSerie, fimSerie]
  );

  const fluxoFontes = useMemo(
    () => calcularFluxoFontesPorMarca(fontes, mencoes, marcas),
    [fontes, mencoes, marcas]
  );

  function normalizarNome(s: string): string {
    return s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
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
  const concorrentes = marcas.filter((m) => m.tipo !== "propria");

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Concorrentes</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Marcas monitoradas nas respostas de IA. A automação diária também pode sugerir novos
            concorrentes aqui — revise e ajuste como preferir.
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
            <RangeSwitcher selecionado={diasRange} onChange={setDiasRange} />
          </div>

          {carregandoVisaoGeral ? (
            <div className="animate-pulse h-56 rounded-card bg-surface-50" />
          ) : (
            <section>
              <h2 className="font-display text-sm font-semibold text-slate-700 mb-3">
                Visibilidade ao longo do tempo
              </h2>
              <MultiLineChart
                datas={datas}
                series={series}
                cores={coresPorMarca}
                emFoco={marcaEmFoco}
                onFocar={alternarFoco}
              />
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
                marcas={marcas}
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
              <MarcaGrupo
                titulo="Concorrentes"
                marcas={concorrentes}
                onNome={atualizarCampo}
                onSalvarNome={salvarCampo}
                onAtivo={alternarAtivo}
                onAliases={editarAliasesTexto}
                onSalvarAliases={salvarAliases}
                onArquivar={arquivar}
                permiteArquivar={true}
                vazio="Nenhum concorrente cadastrado ainda. Adicione acima ou espere a automação diária sugerir."
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
  vazio,
}: {
  titulo: string;
  marcas: MarcaComAliases[];
  onNome: (id: string, campo: "nome" | "tipo", valor: string) => void;
  onSalvarNome: (id: string, campo: "nome" | "tipo", valor: string) => void;
  onAtivo: (m: MarcaComAliases) => void;
  onAliases: (id: string, texto: string) => void;
  onSalvarAliases: (m: MarcaComAliases) => void;
  onArquivar: (m: MarcaComAliases) => void;
  permiteArquivar: boolean;
  vazio?: string;
}) {
  return (
    <section>
      <h2 className="font-display text-sm font-semibold text-slate-700 mb-3">{titulo}</h2>
      {marcas.length === 0 ? (
        <div className="rounded-card border border-surface-200 bg-surface-0 p-6 text-center text-sm text-slate-500">
          {vazio ?? "Nenhuma marca aqui."}
        </div>
      ) : (
        <div className="rounded-card border border-surface-200 bg-surface-0 divide-y divide-surface-100">
          {marcas.map((m) => (
            <div key={m.id} className="flex flex-col gap-2 px-5 py-4">
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
              <input
                value={m.aliasesTexto}
                onChange={(e) => onAliases(m.id, e.target.value)}
                onBlur={() => onSalvarAliases(m)}
                placeholder="Variações do nome, separadas por vírgula (ex: TFC, Foursales Company)"
                className="ml-5 rounded-md bg-transparent text-xs text-slate-500 placeholder:text-slate-500/50 focus:bg-surface-50 px-1 py-1"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
