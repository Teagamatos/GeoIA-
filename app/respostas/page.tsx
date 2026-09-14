"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Marca, MarcaAlias, Fonte, Mencao, PROVIDER_LABELS } from "@/lib/types";
import { getMarcas, getMarcaAliases, getFontesPorExecucoes, getMencoesPorExecucoes, normalizarQueriesDerivadas } from "@/lib/queries";
import { mapaCoresPorMarca } from "@/lib/color";
import { prepararMarcasParaDestaque, formatarRespostaLLM } from "@/lib/textoResposta";

interface ExecucaoComPrompt {
  id: string;
  provider: string;
  modelo: string;
  regiao: string | null;
  data_execucao: string;
  texto_resposta: string | null;
  buscou_web: boolean | null;
  qtd_buscas: number | null;
  queries_derivadas: unknown;
  status: string | null;
  geo_prompt: { texto: string } | null;
}

interface DetalheExecucao {
  fontes: Fonte[];
  mencoes: Mencao[];
}

export default function RespostasPage() {
  const [execucoes, setExecucoes] = useState<ExecucaoComPrompt[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [aliases, setAliases] = useState<MarcaAlias[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  // Fontes/menções de cada execução só são buscadas quando a pessoa expande — não faz
  // sentido carregar isso pras 200 execuções da lista de uma vez. Cacheado por id pra
  // não refazer a busca se a pessoa fechar e abrir a mesma execução de novo.
  const [detalhesPorExecucao, setDetalhesPorExecucao] = useState<Map<string, DetalheExecucao>>(new Map());
  const [carregandoDetalhe, setCarregandoDetalhe] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const [{ data, error }, marcasData, aliasesData] = await Promise.all([
        supabase
          .from("geo_execucao")
          .select(
            "id, provider, modelo, regiao, data_execucao, texto_resposta, buscou_web, qtd_buscas, queries_derivadas, status, geo_prompt(texto)"
          )
          .order("data_execucao", { ascending: false })
          .limit(200),
        getMarcas(),
        getMarcaAliases(),
      ]);
      if (error) setErro(error.message);
      else setExecucoes((data as any) ?? []);
      setMarcas(marcasData);
      setAliases(aliasesData);
      setCarregando(false);
    }
    carregar();
  }, []);

  // Nomes/aliases de marca reconhecidos no texto da resposta, com a mesma cor por marca usada
  // no resto do dashboard -- usado só quando a resposta está expandida (formatarRespostaLLM).
  const coresPorMarca = useMemo(() => mapaCoresPorMarca(marcas), [marcas]);
  const marcaPorId = useMemo(() => new Map(marcas.map((m) => [m.id, m])), [marcas]);
  const marcasDestaque = useMemo(
    () => prepararMarcasParaDestaque(marcas, aliases, coresPorMarca),
    [marcas, aliases, coresPorMarca]
  );

  async function alternarExpandido(id: string) {
    setExpandido((atual) => (atual === id ? null : id));
    if (detalhesPorExecucao.has(id)) return;
    setCarregandoDetalhe(id);
    try {
      const [fontes, mencoes] = await Promise.all([getFontesPorExecucoes([id]), getMencoesPorExecucoes([id])]);
      setDetalhesPorExecucao((prev) => new Map(prev).set(id, { fontes, mencoes }));
    } catch (e: any) {
      setErro(e.message ?? "Erro ao carregar fontes/menções dessa execução.");
    } finally {
      setCarregandoDetalhe((atual) => (atual === id ? null : atual));
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-slate-900">Respostas</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Respostas brutas de cada execução: prompt × provider × dia.
        </p>
      </header>

      {erro && (
        <div className="mb-4 rounded-card border border-signal-rose/40 bg-signal-rose/10 px-4 py-3 text-sm text-signal-rose">
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="animate-pulse h-64 rounded-card bg-surface-50" />
      ) : execucoes.length === 0 ? (
        <div className="rounded-card border border-surface-200 bg-surface-0 p-8 text-center text-sm text-slate-700">
          Nenhuma execução registrada ainda.
        </div>
      ) : (
        <div className="rounded-card border border-surface-200 bg-surface-0 divide-y divide-surface-100">
          {execucoes.map((ex) => {
            const aberto = expandido === ex.id;
            const detalhe = detalhesPorExecucao.get(ex.id);
            const buscas = normalizarQueriesDerivadas(ex.queries_derivadas);
            return (
              <div key={ex.id}>
                <button
                  onClick={() => alternarExpandido(ex.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-surface-50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-slate-900">
                      {ex.geo_prompt?.texto ?? "Prompt removido"}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      <span>{PROVIDER_LABELS[ex.provider] ?? ex.provider}</span>
                      <span>{ex.modelo}</span>
                      <span>{ex.data_execucao}</span>
                      {ex.regiao && <span>{ex.regiao}</span>}
                      {ex.buscou_web && <span>{ex.qtd_buscas ?? 0} buscas web</span>}
                    </div>
                  </div>
                  <StatusBadge status={ex.status} />
                </button>
                {aberto && (
                  <div className="border-t border-surface-100 bg-surface-50 px-5 py-4 space-y-4">
                    {ex.texto_resposta ? (
                      formatarRespostaLLM(ex.texto_resposta, marcasDestaque)
                    ) : (
                      <p className="text-sm text-slate-500">Sem texto de resposta registrado.</p>
                    )}

                    {buscas.length > 0 && (
                      <div>
                        <h3 className="text-xs font-medium text-slate-700 mb-1.5">
                          Buscas que a IA fez pra responder
                        </h3>
                        <ul className="space-y-1">
                          {buscas.map((q, i) => (
                            <li
                              key={i}
                              className="rounded-md bg-surface-0 border border-surface-200 px-2.5 py-1.5 text-xs text-slate-700"
                            >
                              {q}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {carregandoDetalhe === ex.id ? (
                      <div className="animate-pulse h-16 rounded-md bg-surface-100" />
                    ) : detalhe ? (
                      <>
                        <MencoesEmOrdem mencoes={detalhe.mencoes} marcaPorId={marcaPorId} cores={coresPorMarca} />
                        <FontesSeparadas fontes={detalhe.fontes} />
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Marcas mencionadas nessa execução, como dado explícito e em ordem de
 * aparição (por `ordem`, com `posicao_no_texto` como fallback) — até aqui a
 * ordem só existia visualmente, pela posição em que o destaque aparecia
 * dentro do texto corrido.
 */
function MencoesEmOrdem({
  mencoes,
  marcaPorId,
  cores,
}: {
  mencoes: Mencao[];
  marcaPorId: Map<string, Marca>;
  cores: Map<string, string>;
}) {
  const ordenadas = [...mencoes].sort((a, b) => {
    const oa = a.ordem ?? a.posicao_no_texto ?? Infinity;
    const ob = b.ordem ?? b.posicao_no_texto ?? Infinity;
    return oa - ob;
  });

  return (
    <div>
      <h3 className="text-xs font-medium text-slate-700 mb-1.5">Marcas mencionadas, em ordem de aparição</h3>
      {ordenadas.length === 0 ? (
        <p className="text-xs text-slate-500">Nenhuma marca monitorada foi mencionada nessa resposta.</p>
      ) : (
        <ol className="flex flex-wrap gap-2">
          {ordenadas.map((m, i) => {
            const marca = marcaPorId.get(m.marca_id);
            if (!marca) return null;
            const cor = cores.get(marca.id) ?? "#8FA0BA";
            return (
              <li
                key={m.id}
                className="flex items-center gap-1.5 rounded-full border border-surface-200 bg-surface-0 px-2.5 py-1 text-xs text-slate-900"
              >
                <span className="text-slate-400">{i + 1}.</span>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cor }} />
                {marca.nome}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Fontes dessa execução, separadas por tipo — "consultada" (o modelo pesquisou) e
 * "citada" (virou referência na resposta) são eventos diferentes, mesma distinção
 * já usada no Dashboard e na tela de Fontes. */
function FontesSeparadas({ fontes }: { fontes: Fonte[] }) {
  const consultadas = fontes.filter((f) => f.tipo === "consultada");
  const citadas = fontes.filter((f) => f.tipo === "citada");
  const semTipo = fontes.filter((f) => f.tipo !== "consultada" && f.tipo !== "citada");

  if (fontes.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-medium text-slate-700 mb-1.5">Fontes</h3>
        <p className="text-xs text-slate-500">Nenhuma fonte registrada nessa execução.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <ListaDeFontes titulo="Fontes consultadas" fontes={[...consultadas, ...semTipo]} />
      <ListaDeFontes titulo="Fontes citadas" fontes={citadas} />
    </div>
  );
}

function ListaDeFontes({ titulo, fontes }: { titulo: string; fontes: Fonte[] }) {
  return (
    <div>
      <h3 className="text-xs font-medium text-slate-700 mb-1.5">{titulo}</h3>
      {fontes.length === 0 ? (
        <p className="text-xs text-slate-500">Nenhuma.</p>
      ) : (
        <ul className="space-y-1">
          {fontes.map((f) => (
            <li key={f.id} className="truncate text-xs">
              <a
                href={f.url ?? (f.dominio ? `https://${f.dominio}` : undefined)}
                target="_blank"
                rel="noreferrer"
                className="text-slate-700 hover:text-signal-amber hover:underline"
                title={f.titulo ?? f.url ?? f.dominio ?? undefined}
              >
                {f.titulo || f.dominio || f.url || "—"}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const cor =
    status === "erro"
      ? "bg-signal-rose/15 text-signal-rose"
      : status === "sucesso" || status === "ok"
      ? "bg-signal-teal/15 text-signal-teal"
      : "bg-surface-100 text-slate-700";
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${cor}`}>{status ?? "—"}</span>
  );
}
