import { ReactNode } from "react";
import { Marca, MarcaAlias } from "./types";

export interface MarcaParaDestaque {
  id: string;
  nome: string;
  variantes: string[];
  cor: string;
}

/**
 * Monta a lista de marcas + variantes (nome + aliases) que "formatarRespostaLLM" deve
 * reconhecer e destacar dentro do texto bruto de uma resposta. Reaproveita o mesmo mapa de
 * cores por marca usado no Dashboard/Concorrentes (lib/color.ts) pra manter a cor de cada
 * marca consistente em todas as telas.
 */
export function prepararMarcasParaDestaque(
  marcas: Marca[],
  aliases: MarcaAlias[],
  cores: Map<string, string>
): MarcaParaDestaque[] {
  const aliasesPorMarca = new Map<string, string[]>();
  for (const a of aliases) {
    const lista = aliasesPorMarca.get(a.marca_id) ?? [];
    lista.push(a.alias);
    aliasesPorMarca.set(a.marca_id, lista);
  }
  return marcas
    .map((m) => {
      const variantes = [m.nome, ...(aliasesPorMarca.get(m.id) ?? [])]
        .filter((v): v is string => !!v && v.trim().length >= 3)
        // mais específica primeiro, pra "The Foursales Company" ganhar de "Foursales" quando colidem
        .sort((a, b) => b.length - a.length);
      return { id: m.id, nome: m.nome, variantes, cor: cores.get(m.id) ?? "#8FA0BA" };
    })
    .filter((m) => m.variantes.length > 0);
}

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function encurtarUrl(url: string): string {
  const semProtocolo = url.replace(/^https?:\/\//, "");
  return semProtocolo.length > 60 ? semProtocolo.slice(0, 58) + "…" : semProtocolo;
}

interface Marcador {
  start: number;
  end: number;
  render: (key: string) => ReactNode;
}

function sobrepoe(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && a.end > b.start;
}

/**
 * Converte o texto bruto de uma resposta de LLM numa árvore de React legível: parágrafos,
 * listas (com marcador "-"/"*" ou numeradas) e títulos ("#"/"##") viram blocos de verdade em
 * vez de uma parede de texto só; **negrito** é reconhecido; qualquer URL solta ou link em
 * markdown "[rótulo](url)" vira hiperlink clicável de verdade (abre em nova aba); e qualquer
 * menção ao nome ou a um alias de marca cadastrada (própria ou concorrente) fica destacada com
 * a cor daquela marca, igual à legenda usada no resto do dashboard.
 */
export function formatarRespostaLLM(texto: string, marcas: MarcaParaDestaque[]): ReactNode {
  if (!texto) return null;
  const blocos = parsearBlocos(texto);
  return (
    <div className="space-y-3">
      {blocos.map((bloco, i) => renderBloco(bloco, i, marcas))}
    </div>
  );
}

// ---------- Blocos: parágrafo / lista / título ----------

type Bloco =
  | { tipo: "paragrafo"; texto: string }
  | { tipo: "lista"; ordenada: boolean; itens: string[] }
  | { tipo: "titulo"; nivel: number; texto: string };

function parsearBlocos(textoBruto: string): Bloco[] {
  const linhas = textoBruto.replace(/\r\n/g, "\n").split("\n");
  const blocos: Bloco[] = [];
  let paragrafoAtual: string[] = [];
  let listaAtual: { ordenada: boolean; itens: string[] } | null = null;

  const fecharParagrafo = () => {
    if (paragrafoAtual.length > 0) {
      blocos.push({ tipo: "paragrafo", texto: paragrafoAtual.join(" ") });
      paragrafoAtual = [];
    }
  };
  const fecharLista = () => {
    if (listaAtual) {
      blocos.push({ tipo: "lista", ordenada: listaAtual.ordenada, itens: listaAtual.itens });
      listaAtual = null;
    }
  };

  for (const linhaBruta of linhas) {
    const linha = linhaBruta.trim();
    if (linha === "") {
      fecharParagrafo();
      fecharLista();
      continue;
    }
    const tituloMatch = linha.match(/^(#{1,4})\s+(.*)$/);
    if (tituloMatch) {
      fecharParagrafo();
      fecharLista();
      blocos.push({ tipo: "titulo", nivel: tituloMatch[1].length, texto: tituloMatch[2] });
      continue;
    }
    const bulletMatch = linha.match(/^[-*•]\s+(.*)$/);
    const numeradaMatch = linha.match(/^\d+[.)]\s+(.*)$/);
    if (bulletMatch || numeradaMatch) {
      fecharParagrafo();
      const ordenada = !!numeradaMatch;
      const itemTexto = (bulletMatch ?? numeradaMatch)![1];
      if (!listaAtual || listaAtual.ordenada !== ordenada) {
        fecharLista();
        listaAtual = { ordenada, itens: [] };
      }
      listaAtual.itens.push(itemTexto);
      continue;
    }
    fecharLista();
    paragrafoAtual.push(linha);
  }
  fecharParagrafo();
  fecharLista();
  return blocos;
}

function renderBloco(bloco: Bloco, key: number, marcas: MarcaParaDestaque[]): ReactNode {
  if (bloco.tipo === "titulo") {
    const Tag = bloco.nivel <= 2 ? "h3" : "h4";
    return (
      <Tag key={key} className="font-display text-sm font-semibold text-slate-900 mt-2 first:mt-0">
        {renderLinha(bloco.texto, marcas, `t${key}`)}
      </Tag>
    );
  }
  if (bloco.tipo === "lista") {
    const ListaTag = bloco.ordenada ? "ol" : "ul";
    return (
      <ListaTag
        key={key}
        className={`space-y-1 pl-5 text-sm leading-relaxed text-slate-700 ${
          bloco.ordenada ? "list-decimal" : "list-disc"
        }`}
      >
        {bloco.itens.map((item, i) => (
          <li key={i}>{renderLinha(item, marcas, `l${key}-${i}`)}</li>
        ))}
      </ListaTag>
    );
  }
  return (
    <p key={key} className="text-sm leading-relaxed text-slate-700">
      {renderLinha(bloco.texto, marcas, `p${key}`)}
    </p>
  );
}

// ---------- Linha: reconhece link/negrito/menção de marca e monta os nós de React ----------

function renderLinha(texto: string, marcas: MarcaParaDestaque[], keyPrefix: string): ReactNode[] {
  const marcadores = encontrarMarcadores(texto, marcas);
  marcadores.sort((a, b) => a.start - b.start);

  const nodes: ReactNode[] = [];
  let cursor = 0;
  marcadores.forEach((m, i) => {
    if (m.start > cursor) nodes.push(texto.slice(cursor, m.start));
    nodes.push(m.render(`${keyPrefix}-${i}`));
    cursor = m.end;
  });
  if (cursor < texto.length) nodes.push(texto.slice(cursor));
  return nodes;
}

function encontrarMarcadores(texto: string, marcas: MarcaParaDestaque[]): Marcador[] {
  const marcadores: Marcador[] = [];

  // 1) Links em markdown: [rótulo](url) -- prioridade máxima, nunca fica só como texto solto.
  const reMdLink = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = reMdLink.exec(texto))) {
    const start = m.index;
    const end = start + m[0].length;
    const label = m[1];
    const url = m[2];
    marcadores.push({
      start,
      end,
      render: (key) => (
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-signal-teal underline decoration-signal-teal/40 hover:decoration-signal-teal"
        >
          {label}
        </a>
      ),
    });
  }

  // 2) URLs soltas no meio do texto (fora dos links markdown já encontrados acima).
  const reUrl = /https?:\/\/[^\s)\]<>"']+/g;
  while ((m = reUrl.exec(texto))) {
    let url = m[0];
    const start = m.index;
    let end = start + url.length;
    // tira pontuação de fim de frase colada na URL (. , ; : ! ?)
    const semPontuacao = url.replace(/[.,;:!?]+$/, "");
    if (semPontuacao.length !== url.length) {
      end -= url.length - semPontuacao.length;
      url = semPontuacao;
    }
    if (marcadores.some((mk) => sobrepoe(mk, { start, end }))) continue;
    const urlFinal = url;
    marcadores.push({
      start,
      end,
      render: (key) => (
        <a
          key={key}
          href={urlFinal}
          target="_blank"
          rel="noopener noreferrer"
          className="text-signal-teal underline decoration-signal-teal/40 hover:decoration-signal-teal break-all"
        >
          {encurtarUrl(urlFinal)}
        </a>
      ),
    });
  }

  // 3) Negrito **texto** -- o conteúdo interno ainda passa pelo mesmo reconhecimento (link/marca).
  const reBold = /\*\*([^*\n]+)\*\*/g;
  while ((m = reBold.exec(texto))) {
    const start = m.index;
    const end = start + m[0].length;
    if (marcadores.some((mk) => sobrepoe(mk, { start, end }))) continue;
    const inner = m[1];
    marcadores.push({
      start,
      end,
      render: (key) => <strong key={key}>{renderLinha(inner, marcas, `${key}-b`)}</strong>,
    });
  }

  // 4) Menções a marcas cadastradas (nome ou alias), sem acento/maiúscula importando, fora do
  //    que já virou link/negrito acima.
  const textoNormalizado = normalizar(texto);
  const candidatos: { start: number; end: number; marca: MarcaParaDestaque }[] = [];
  for (const marca of marcas) {
    for (const variante of marca.variantes) {
      const variNorm = normalizar(variante);
      if (!variNorm) continue;
      let idx = 0;
      while ((idx = textoNormalizado.indexOf(variNorm, idx)) !== -1) {
        candidatos.push({ start: idx, end: idx + variNorm.length, marca });
        idx += variNorm.length;
      }
    }
  }
  // Mesma posição de início, mais longa primeiro -- "The Foursales Company" vence "Foursales".
  candidatos.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  for (const c of candidatos) {
    if (marcadores.some((mk) => sobrepoe(mk, c))) continue;
    const cor = c.marca.cor;
    marcadores.push({
      start: c.start,
      end: c.end,
      render: (key) => (
        <mark
          key={key}
          title={c.marca.nome}
          className="rounded px-0.5 font-medium"
          style={{ backgroundColor: `${cor}26`, color: cor }}
        >
          {texto.slice(c.start, c.end)}
        </mark>
      ),
    });
  }

  return marcadores;
}
