"use client";

import { useEffect, useState } from "react";
import { Marca, Prompt, PROVIDER_LABELS } from "@/lib/types";
import { PeriodoFiltro } from "./FiltrosGlobaisProvider";

interface BrandSwitcherProps {
  marcas: Marca[];
  selecionada: string | null;
  onChange: (id: string) => void;
}

export function BrandSwitcher({ marcas, selecionada, onChange }: BrandSwitcherProps) {
  const proprias = marcas.filter((m) => m.tipo === "propria" && m.ativo);

  if (proprias.length === 0) return null;

  return (
    <div className="inline-flex rounded-full border border-surface-200 bg-surface-0 p-1">
      {proprias.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
            selecionada === m.id
              ? "bg-signal-amber text-ink-950 font-medium"
              : "text-slate-700 hover:text-slate-900"
          }`}
        >
          {m.nome}
        </button>
      ))}
    </div>
  );
}

/**
 * Antes só dava pra escolher entre 7/30/90 dias fixos (contando de hoje pra
 * trás), depois (LAB-1064) virou calendário livre com esses três como atalho.
 * Agora os atalhos saíram e ficou só o calendário — os dois campos abaixo
 * ficam num estado local (pendente) e só disparam a busca de verdade quando
 * a pessoa clica em "Aplicar" (ou aperta Enter), pra escolher início e fim
 * sem disparar uma busca por engano no meio do caminho.
 */
export function RangeSwitcher({
  periodo,
  onChange,
}: {
  periodo: PeriodoFiltro;
  onChange: (periodo: PeriodoFiltro) => void;
}) {
  const [pendente, setPendente] = useState<PeriodoFiltro>(periodo);

  // Ressincroniza o rascunho quando o período aplicado muda por fora (restaurado
  // do localStorage ao abrir a página, por exemplo) — nunca por causa de uma
  // mudança feita aqui dentro, já que essa só chega em `periodo` depois que a
  // pessoa clicar em Aplicar.
  useEffect(() => {
    setPendente(periodo);
  }, [periodo.inicio, periodo.fim]);

  // Nunca deixa o início ficar depois do fim (ou vice-versa) — em vez de gerar
  // um período inválido/invertido, empurra a outra ponta junto.
  function alterarInicio(valor: string) {
    if (!valor) return;
    setPendente((p) => ({ inicio: valor, fim: valor > p.fim ? valor : p.fim }));
  }

  function alterarFim(valor: string) {
    if (!valor) return;
    setPendente((p) => ({ inicio: valor < p.inicio ? valor : p.inicio, fim: valor }));
  }

  const alterado = pendente.inicio !== periodo.inicio || pendente.fim !== periodo.fim;

  function aplicar() {
    if (alterado) onChange(pendente);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-1 rounded-full border border-surface-200 bg-surface-0 px-3 py-1.5">
        <input
          type="date"
          value={pendente.inicio}
          max={pendente.fim}
          onChange={(e) => alterarInicio(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && aplicar()}
          title="Início do período"
          className="w-[7.5rem] bg-transparent text-sm text-slate-700 focus:outline-none"
        />
        <span className="text-slate-400">–</span>
        <input
          type="date"
          value={pendente.fim}
          min={pendente.inicio}
          onChange={(e) => alterarFim(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && aplicar()}
          title="Fim do período"
          className="w-[7.5rem] bg-transparent text-sm text-slate-700 focus:outline-none"
        />
        <button
          onClick={aplicar}
          disabled={!alterado}
          title={alterado ? "Aplicar esse período" : "Escolha uma data diferente pra aplicar"}
          className={`ml-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            alterado
              ? "bg-signal-amber text-ink-950 hover:brightness-95"
              : "bg-surface-100 text-slate-400"
          }`}
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

/** Filtro por modelo de IA — restringe os dados do Dashboard a um provider específico (ChatGPT/Claude/Gemini/Perplexity). */
export function ProviderSwitcher({
  selecionado,
  onChange,
}: {
  selecionado: string | null;
  onChange: (provider: string | null) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-surface-200 bg-surface-0 p-1">
      <button
        onClick={() => onChange(null)}
        className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
          selecionado === null
            ? "bg-surface-100 text-slate-900 font-medium"
            : "text-slate-500 hover:text-slate-900"
        }`}
      >
        Todas as IAs
      </button>
      {Object.entries(PROVIDER_LABELS).map(([provider, label]) => (
        <button
          key={provider}
          onClick={() => onChange(provider)}
          className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
            selecionado === provider
              ? "bg-surface-100 text-slate-900 font-medium"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Filtro global "Todos os prompts" — restringe os dados da página a um prompt específico. */
export function PromptSwitcher({
  prompts,
  selecionado,
  onChange,
}: {
  prompts: Prompt[];
  selecionado: string | null;
  onChange: (id: string | null) => void;
}) {
  if (prompts.length === 0) return null;

  return (
    <select
      value={selecionado ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded-md border border-surface-200 bg-surface-0 px-3 py-2 text-sm text-slate-900 max-w-[220px]"
      title={selecionado ? prompts.find((p) => p.id === selecionado)?.texto : undefined}
    >
      <option value="">Todos os prompts</option>
      {prompts.map((p) => (
        <option key={p.id} value={p.id}>
          {p.texto.length > 60 ? `${p.texto.slice(0, 58)}…` : p.texto}
        </option>
      ))}
    </select>
  );
}
