"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";

const CHAVE_STORAGE = "geoia:filtros-globais";

interface FiltrosPersistidos {
  marcaSelecionada?: string | null;
  promptSelecionado?: string | null;
  diasRange?: number;
}

interface FiltrosGlobais {
  marcaSelecionada: string | null;
  setMarcaSelecionada: (id: string | null) => void;
  promptSelecionado: string | null;
  setPromptSelecionado: (id: string | null) => void;
  diasRange: number;
  setDiasRange: (dias: number) => void;
}

const FiltrosContext = createContext<FiltrosGlobais | null>(null);

/**
 * Marca/prompt/período eram um useState isolado em cada página (Dashboard,
 * Concorrentes, Fontes, Prompts) — trocar de marca no Dashboard e navegar pra
 * Fontes voltava tudo pro default, cada página com o seu. Agora os três vivem
 * aqui, num Provider na raiz (app/layout.tsx), e ficam salvos no localStorage
 * pra sobreviver também a um F5.
 *
 * A leitura do localStorage acontece só depois do mount (useEffect), nunca no
 * valor inicial do useState — isso evita mismatch de hidratação do Next (o
 * HTML renderizado no servidor não tem acesso ao localStorage do navegador).
 * Por isso, no primeiro carregamento de cada página pode rodar uma busca com
 * os defaults e, um instante depois, outra já com o filtro restaurado — é o
 * preço de fazer isso sem quebrar a hidratação.
 */
export function FiltrosGlobaisProvider({ children }: { children: ReactNode }) {
  const [marcaSelecionada, setMarcaSelecionada] = useState<string | null>(null);
  const [promptSelecionado, setPromptSelecionado] = useState<string | null>(null);
  const [diasRange, setDiasRange] = useState(7);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE);
      if (salvo) {
        const dados: FiltrosPersistidos = JSON.parse(salvo);
        if (dados.marcaSelecionada) setMarcaSelecionada(dados.marcaSelecionada);
        if (dados.promptSelecionado) setPromptSelecionado(dados.promptSelecionado);
        if (dados.diasRange) setDiasRange(dados.diasRange);
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
      const dados: FiltrosPersistidos = { marcaSelecionada, promptSelecionado, diasRange };
      localStorage.setItem(CHAVE_STORAGE, JSON.stringify(dados));
    } catch {
      // idem
    }
  }, [hidratado, marcaSelecionada, promptSelecionado, diasRange]);

  return (
    <FiltrosContext.Provider
      value={{
        marcaSelecionada,
        setMarcaSelecionada,
        promptSelecionado,
        setPromptSelecionado,
        diasRange,
        setDiasRange,
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
