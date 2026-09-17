"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { rangeDias } from "@/lib/queries";

const CHAVE_STORAGE = "geoia:filtros-globais";

export interface PeriodoFiltro {
  inicio: string; // YYYY-MM-DD
  fim: string; // YYYY-MM-DD
}

interface FiltrosPersistidos {
  marcaSelecionada?: string | null;
  promptSelecionado?: string | null;
  // periodo NÃO entra aqui de propósito (LAB-1064 fase 2) — o calendário sempre
  // deve abrir nos últimos 7 dias num carregamento novo da página, em vez de
  // lembrar um intervalo customizado escolhido há muito tempo. Continua
  // compartilhado entre as páginas durante a mesma sessão (Context), só não
  // sobrevive a um F5/nova aba.
}

interface FiltrosGlobais {
  marcaSelecionada: string | null;
  setMarcaSelecionada: (id: string | null) => void;
  promptSelecionado: string | null;
  setPromptSelecionado: (id: string | null) => void;
  /** Período selecionado no calendário (LAB-1064) — antes era só um número de dias fixo. */
  periodo: PeriodoFiltro;
  setPeriodo: (periodo: PeriodoFiltro) => void;
}

const FiltrosContext = createContext<FiltrosGlobais | null>(null);

/**
 * Marca/prompt/período eram um useState isolado em cada página (Dashboard,
 * Concorrentes, Fontes, Prompts) — trocar de marca no Dashboard e navegar pra
 * Fontes voltava tudo pro default, cada página com o seu. Agora os três vivem
 * aqui, num Provider na raiz (app/layout.tsx). Marca e prompt ficam salvos no
 * localStorage pra sobreviver também a um F5; o período não (LAB-1064 fase 2)
 * — o calendário sempre parte dos últimos 7 dias num carregamento novo, em
 * vez de ficar preso num intervalo customizado escolhido há muito tempo.
 *
 * A leitura do localStorage acontece só depois do mount (useEffect), nunca no
 * valor inicial do useState — isso evita mismatch de hidratação do Next (o
 * HTML renderizado no servidor não tem acesso ao localStorage do navegador).
 * Por isso, no primeiro carregamento de cada página pode rodar uma busca com
 * os defaults de marca/prompt e, um instante depois, outra já com o filtro
 * restaurado — é o preço de fazer isso sem quebrar a hidratação.
 */
export function FiltrosGlobaisProvider({ children }: { children: ReactNode }) {
  const [marcaSelecionada, setMarcaSelecionada] = useState<string | null>(null);
  const [promptSelecionado, setPromptSelecionado] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(() => rangeDias(7));
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE);
      if (salvo) {
        const dados: FiltrosPersistidos = JSON.parse(salvo);
        if (dados.marcaSelecionada) setMarcaSelecionada(dados.marcaSelecionada);
        if (dados.promptSelecionado) setPromptSelecionado(dados.promptSelecionado);
        // período não é restaurado de propósito — sempre nasce em rangeDias(7)
        // (useState acima), num carregamento novo da página.
      }
    } catch {
      // localStorage indisponível (aba anônima, storage bloqueado etc.) — segue com os defaults.
    } finally {
      setHidratado(true);
    }
  }, []);

  useEffect(() => {
    if (!hidratado) return; // não sobrescreve o localStorage com o default antes de ler ele
    try {
      // periodo fica fora de propósito — ver FiltrosPersistidos acima.
      const dados: FiltrosPersistidos = { marcaSelecionada, promptSelecionado };
      localStorage.setItem(CHAVE_STORAGE, JSON.stringify(dados));
    } catch {
      // idem
    }
  }, [hidratado, marcaSelecionada, promptSelecionado]);

  return (
    <FiltrosContext.Provider
      value={{
        marcaSelecionada,
        setMarcaSelecionada,
        promptSelecionado,
        setPromptSelecionado,
        periodo,
        setPeriodo,
      }}
    >
      {children}
    </FiltrosContext.Provider>
  );
}

export function useFiltrosGlobais(): FiltrosGlobais {
  const ctx = useContext(FiltrosContext);
  if (!ctx) {
    throw new Error("useFiltrosGlobais precisa ser usado dentro de <FiltrosGlobaisProvider>.");
  }
  return ctx;
}
