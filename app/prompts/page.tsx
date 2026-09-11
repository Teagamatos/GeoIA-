"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Marca, Execucao, Mencao, Prompt, PROVIDER_LABELS } from "@/lib/types";
import {
  getMarcas,
  getExecucoesEntre,
  getMencoesPorExecucoes,
  calcularHeatmapPrompts,
  rangeDias,
  CelulaHeatmap,
} from "@/lib/queries";
import { corVisibilidade } from "@/lib/color";
import { IconPlus, IconArchive } from "@/components/icons";
import { BrandSwitcher, RangeSwitcher } from "@/components/TopControls";

const VAZIO = { texto: "", categoria: "", persona: "", pais: "", cidade: "" };
const PROVIDERS_ORDEM = Object.keys(PROVIDER_LABELS);

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novo, setNovo] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [visualizacao, setVisualizacao] = useState<"tabela" | "heatmap">("tabela");
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [marcaSelecionada, setMarcaSelecionada] = useState<string | null>(null);
  const [diasRange, setDiasRange] = useState(7);
  const [execucoesHeatmap, setExecucoesHeatmap] = useState<Execucao[]>([]);
  const [mencoesHeatmap, setMencoesHeatmap] = useState<Mencao[]>([]);
  const [carregandoHeatmap, setCarregandoHeatmap] = useState(false);

  async function carregar() {
    setCarregando(true);
    const { data, error } = await supabase
      .from("geo_prompt")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setErro(error.message);
    else setPrompts(data ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    getMarcas().then((data) => {
      setMarcas(data);
      const primeira = data.find((m) => m.tipo === "propria" && m.ativo);
      if (primeira) setMarcaSelecionada(primeira.id);
    });
  }, []);

  useEffect(() => {
    if (visualizacao !== "heatmap") return;
    let cancelado = false;
    async function carregarHeatmap() {
      setCarregandoHeatmap(true);
      try {
        const { inicio, fim } = rangeDias(diasRange);
        const execs = await getExecucoesEntre(inicio, fim);
        const mencs = await getMencoesPorExecucoes(execs.map((e) => e.id));
        if (!cancelado) {
          setExecucoesHeatmap(execs);
          setMencoesHeatmap(mencs);
        }
      } finally {
        if (!cancelado) setCarregandoHeatmap(false);
      }
    }
    carregarHeatmap();
    return () => {
      cancelado = true;
    };
  }, [visualizacao, diasRange]);

  const heatmap = useMemo<Map<string, CelulaHeatmap>>(
    () =>
      marcaSelecionada
        ? calcularHeatmapPrompts(marcaSelecionada, execucoesHeatmap, mencoesHeatmap)
        : new Map(),
    [marcaSelecionada, execucoesHeatmap, mencoesHeatmap]
  );

  async function criarPrompt() {
    if (!novo.texto.trim()) return;
    setSalvando(true);
    setErro(null);
    const { error } = await supabase.from("geo_prompt").insert({
      texto: novo.texto.trim(),
      categoria: novo.categoria.trim() || null,
      persona: novo.persona.trim() || null,
      pais: novo.pais.trim() || null,
      cidade: novo.cidade.trim() || null,
      ativo: true,
    });
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setNovo(VAZIO);
    carregar();
  }

  async function alternarAtivo(p: Prompt) {
    setPrompts((prev) => prev.map((x) => (x.id === p.id ? { ...x, ativo: !x.ativo } : x)));
    const { error } = await supabase.from("geo_prompt").update({ ativo: !p.ativo }).eq("id", p.id);
    if (error) setErro(error.message);
  }

  async function editarTexto(p: Prompt, texto: string) {
    setPrompts((prev) => prev.map((x) => (x.id === p.id ? { ...x, texto } : x)));
  }

  async function salvarTexto(p: Prompt) {
    const { error } = await supabase.from("geo_prompt").update({ texto: p.texto }).eq("id", p.id);
    if (error) setErro(error.message);
  }

  // Arquivar NUNCA apaga a linha em geo_prompt: só marca ativo=false (mesmo campo que já
  // controla o que a automação diária roda). Isso preserva geo_execucao/geo_mencao/geo_fonte
  // ligados ao prompt_id — deletar de verdade quebraria o histórico (ou a FK) sem ganho nenhum.
  async function arquivar(p: Prompt) {
    setPrompts((prev) => prev.map((x) => (x.id === p.id ? { ...x, ativo: false } : x)));
    const { error } = await supabase.from("geo_prompt").update({ ativo: false }).eq("id", p.id);
    if (error) {
      setErro(error.message);
      carregar();
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Prompts</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            As perguntas que a automação envia diariamente pra cada IA. Só prompts ativos rodam no
            próximo ciclo.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-surface-200 bg-surface-0 p-1 shrink-0">
          <button
            onClick={() => setVisualizacao("tabela")}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              visualizacao === "tabela"
                ? "bg-surface-100 text-slate-900 font-medium"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Tabela
          </button>
          <button
            onClick={() => setVisualizacao("heatmap")}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              visualizacao === "heatmap"
                ? "bg-surface-100 text-slate-900 font-medium"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Mapa de calor
          </button>
        </div>
      </header>

      {erro && (
        <div className="mb-4 rounded-card border border-signal-rose/40 bg-signal-rose/10 px-4 py-3 text-sm text-signal-rose">
          {erro}
        </div>
      )}

      {visualizacao === "heatmap" ? (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p className="text-sm text-slate-500">
              Visibilidade de cada prompt por modelo de IA — quanto mais próximo do verde, mais a
              marca aparece nas respostas.
            </p>
            <div className="flex items-center gap-3">
              <BrandSwitcher marcas={marcas} selecionada={marcaSelecionada} onChange={setMarcaSelecionada} />
              <RangeSwitcher selecionado={diasRange} onChange={setDiasRange} />
            </div>
          </div>

          {carregandoHeatmap ? (
            <div className="animate-pulse h-64 rounded-card bg-surface-50" />
          ) : prompts.length === 0 ? (
            <div className="rounded-card border border-surface-200 bg-surface-0 p-8 text-center text-sm text-slate-700">
              Nenhum prompt cadastrado ainda.
            </div>
          ) : (
            <div className="rounded-card border border-surface-200 bg-surface-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 text-left text-xs text-slate-500">
                    <th className="px-5 py-3 font-normal min-w-[220px]">Prompt</th>
                    {PROVIDERS_ORDEM.map((provider) => (
                      <th key={provider} className="px-3 py-3 font-normal text-center whitespace-nowrap">
                        {PROVIDER_LABELS[provider]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {prompts.map((p) => (
                    <tr key={p.id} className="border-b border-surface-100 last:border-0">
                      <td className="px-5 py-3 text-slate-900 max-w-xs align-top">{p.texto}</td>
                      {PROVIDERS_ORDEM.map((provider) => {
                        const celula = heatmap.get(`${p.id}::${provider}`);
                        if (!celula) {
                          return (
                            <td key={provider} className="px-3 py-3 text-center">
                              <span className="inline-block rounded-md px-2 py-1 text-xs text-slate-400 bg-surface-50">
                                —
                              </span>
                            </td>
                          );
                        }
                        const { bg, text } = corVisibilidade(celula.visibilidade);
                        return (
                          <td key={provider} className="px-3 py-3 text-center">
                            <span
                              className="inline-block min-w-[3.5rem] rounded-md px-2 py-1 text-xs font-medium"
                              style={{ backgroundColor: bg, color: text }}
                              title={`${celula.mencoes}/${celula.respostas} respostas com menção`}
                            >
                              {celula.visibilidade.toFixed(0)}%
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <>
      <div className="rounded-card border border-surface-200 bg-surface-0 p-5 mb-8">
        <h2 className="text-sm font-medium text-slate-700 mb-3">Novo prompt</h2>
        <textarea
          value={novo.texto}
          onChange={(e) => setNovo({ ...novo, texto: e.target.value })}
          placeholder="Ex: Qual a melhor empresa de recrutamento e seleção?"
          rows={2}
          className="w-full rounded-md border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500/60 mb-3"
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <input
            value={novo.categoria}
            onChange={(e) => setNovo({ ...novo, categoria: e.target.value })}
            placeholder="Categoria"
            className="rounded-md border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500/60"
          />
          <input
            value={novo.persona}
            onChange={(e) => setNovo({ ...novo, persona: e.target.value })}
            placeholder="Persona"
            className="rounded-md border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500/60"
          />
          <input
            value={novo.pais}
            onChange={(e) => setNovo({ ...novo, pais: e.target.value })}
            placeholder="País (ex: BR)"
            className="rounded-md border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500/60"
          />
          <input
            value={novo.cidade}
            onChange={(e) => setNovo({ ...novo, cidade: e.target.value })}
            placeholder="Cidade"
            className="rounded-md border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500/60"
          />
        </div>
        <button
          onClick={criarPrompt}
          disabled={salvando || !novo.texto.trim()}
          className="flex items-center gap-1.5 rounded-md bg-signal-amber px-3.5 py-2 text-sm font-medium text-ink-950 disabled:opacity-40"
        >
          <IconPlus className="h-4 w-4" />
          Adicionar prompt
        </button>
      </div>

      {carregando ? (
        <div className="animate-pulse h-40 rounded-card bg-surface-50" />
      ) : prompts.length === 0 ? (
        <div className="rounded-card border border-surface-200 bg-surface-0 p-8 text-center text-sm text-slate-700">
          Nenhum prompt cadastrado ainda. Adicione o primeiro acima.
        </div>
      ) : (
        <div className="rounded-card border border-surface-200 bg-surface-0 divide-y divide-surface-100">
          {prompts.map((p) => (
            <div key={p.id} className="flex items-start gap-3 px-5 py-4">
              <button
                onClick={() => alternarAtivo(p)}
                title={p.ativo ? "Ativo — clique para desativar" : "Inativo — clique para ativar"}
                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                  p.ativo ? "bg-signal-teal" : "bg-slate-300"
                }`}
              />
              <div className="flex-1 min-w-0">
                <PromptTextarea
                  valor={p.texto}
                  onChange={(texto) => editarTexto(p, texto)}
                  onBlur={() => salvarTexto(p)}
                />
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  {p.categoria && <span>{p.categoria}</span>}
                  {p.persona && <span>{p.persona}</span>}
                  {(p.pais || p.cidade) && (
                    <span>
                      {[p.cidade, p.pais].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {!p.ativo && (
                    <span className="rounded-full bg-surface-100 px-2 py-0.5 text-slate-500">Arquivado</span>
                  )}
                </div>
              </div>
              {p.ativo ? (
                <button
                  onClick={() => arquivar(p)}
                  className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-surface-100 hover:text-slate-900"
                  title="Arquivar — para de rodar na automação, mas mantém todo o histórico no banco"
                >
                  <IconArchive className="h-4 w-4" />
                  Arquivar
                </button>
              ) : (
                <button
                  onClick={() => alternarAtivo(p)}
                  className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-signal-teal hover:bg-signal-teal/10"
                  title="Reativar — volta a rodar no próximo ciclo da automação"
                >
                  Reativar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}

// Textarea que cresce pra caber o prompt inteiro (várias linhas quando precisar), em vez do
// campo de 1 linha só que cortava prompts um pouco mais longos. Continua editável in-place.
function PromptTextarea({
  valor,
  onChange,
  onBlur,
}: {
  valor: string;
  onChange: (texto: string) => void;
  onBlur: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const ajustarAltura = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    ajustarAltura();
  }, [valor]);

  return (
    <textarea
      ref={ref}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      onInput={ajustarAltura}
      onBlur={onBlur}
      rows={1}
      className="w-full resize-none overflow-hidden rounded-md bg-transparent px-0 py-0 text-sm leading-relaxed text-slate-900 focus:bg-surface-50 focus:px-2 focus:py-1"
    />
  );
}
