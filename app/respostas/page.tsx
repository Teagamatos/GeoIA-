"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Marca, MarcaAlias, PROVIDER_LABELS } from "@/lib/types";
import { getMarcas, getMarcaAliases } from "@/lib/queries";
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
  status: string | null;
  geo_prompt: { texto: string } | null;
}

export default function RespostasPage() {
  const [execucoes, setExecucoes] = useState<ExecucaoComPrompt[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [aliases, setAliases] = useState<MarcaAlias[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const [{ data, error }, marcasData, aliasesData] = await Promise.all([
        supabase
          .from("geo_execucao")
          .select(
            "id, provider, modelo, regiao, data_execucao, texto_resposta, buscou_web, qtd_buscas, status, geo_prompt(texto)"
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
  const marcasDestaque = useMemo(
    () => prepararMarcasParaDestaque(marcas, aliases, mapaCoresPorMarca(marcas)),
    [marcas, aliases]
  );

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
            return (
              <div key={ex.id}>
                <button
                  onClick={() => setExpandido(aberto ? null : ex.id)}
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
                      {ex.buscou_web && <span>{ex.qtd_buscas ?? 0} buscas web</span>}
                    </div>
                  </div>
                  <StatusBadge status={ex.status} />
                </button>
                {aberto && (
                  <div className="border-t border-surface-100 bg-surface-50 px-5 py-4">
                    {ex.texto_resposta ? (
                      formatarRespostaLLM(ex.texto_resposta, marcasDestaque)
                    ) : (
                      <p className="text-sm text-slate-500">Sem texto de resposta registrado.</p>
                    )}
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
