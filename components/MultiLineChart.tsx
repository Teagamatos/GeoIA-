"use client";

import { useState } from "react";

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/**
 * "2026-10-01" -> { dia: "qui", data: "01/10" }. Monta a data pelas partes (ano, mês, dia)
 * em vez de `new Date("2026-10-01")`, que o JS lê como meia-noite UTC e, no fuso do Brasil,
 * mostrava o dia anterior (a coleta de 01/10 aparecia como 30/09).
 */
export function rotuloData(iso: string): { dia: string; data: string } {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    dia: DIAS_SEMANA[dt.getDay()],
    data: `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`,
  };
}

/**
 * Quebra a série em trechos contínuos, cortando nos pontos `null` — assim o SVG desenha
 * uma lacuna de verdade ali, em vez de uma linha reta ligando o antes e o depois.
 */
function segmentosContinuos(pontos: (number | null)[]): [number, number][][] {
  const segmentos: [number, number][][] = [];
  let atual: [number, number][] = [];
  pontos.forEach((v, i) => {
    if (v === null) {
      if (atual.length > 0) segmentos.push(atual);
      atual = [];
    } else {
      atual.push([i, v]);
    }
  });
  if (atual.length > 0) segmentos.push(atual);
  return segmentos;
}

interface SerieGrafico {
  marcaId: string;
  nome: string;
  pontos: (number | null)[];
  /** Respostas que mencionaram a marca em cada coleta (alinhado com `datas`). */
  contagens?: number[];
}

/**
 * Gráfico de linhas por COLETA. O eixo X tem só as datas em que o motor rodou (segunda e
 * quinta), uniformemente espaçadas e rotuladas com o dia da semana; cada coleta aparece como
 * um ponto e, ao passar o mouse, mostra o valor de cada marca e quantas respostas compõem o %.
 */
export function MultiLineChart({
  datas,
  series,
  totais,
  cores,
  height = 280,
  emFoco,
  onFocar,
}: {
  datas: string[];
  series: SerieGrafico[];
  /** Nº de respostas de cada coleta (alinhado com `datas`) — é o denominador do %. */
  totais?: number[];
  cores: Map<string, string>;
  height?: number;
  /** marcaId em destaque (clicado na legenda ou na linha) — as outras linhas ficam esmaecidas. */
  emFoco?: string | null;
  /** Clique no nome na legenda ou na própria linha: destaca essa marca (clicar de novo tira o destaque). */
  onFocar?: (id: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const width = 760;
  const padding = { top: 16, right: 20, bottom: 46, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  if (datas.length === 0 || series.length === 0) {
    return (
      <div className="rounded-card border border-surface-200 bg-surface-0 p-8 text-center text-sm text-slate-700">
        {datas.length === 0
          ? "Sem execuções no período selecionado."
          : "Nenhuma marca selecionada. Escolha marcas acima para ver o gráfico."}
      </div>
    );
  }

  // Escala do eixo Y se ajusta ao maior valor mostrado (as marcas próprias ficam em
  // 20-30%, então um eixo fixo em 0-100 deixava as linhas coladas na parte de baixo).
  let maxV = 0;
  for (const s of series) for (const v of s.pontos) if (v !== null && v > maxV) maxV = v;
  const alvo = maxV * 1.15;
  let yMax: number;
  let passo: number;
  if (alvo <= 50) {
    passo = 10;
    yMax = Math.max(20, Math.ceil(alvo / 10) * 10);
  } else {
    passo = 25;
    yMax = Math.min(100, Math.ceil(alvo / 25) * 25);
  }
  const ticks: number[] = [];
  for (let v = 0; v <= yMax; v += passo) ticks.push(v);

  const n = datas.length;
  const x = (i: number) => ((i + 0.5) / n) * innerW;
  const y = (v: number) => innerH - (v / yMax) * innerH;
  // Com muitas coletas os rótulos não cabem todos; mostra de 2 em 2, 3 em 3...
  const passoLabel = Math.max(1, Math.ceil(n / 12));

  const seriesOrdenadas =
    hover !== null
      ? [...series]
          .filter((s) => s.pontos[hover] !== null)
          .sort((a, b) => (b.pontos[hover] ?? 0) - (a.pontos[hover] ?? 0))
      : [];

  return (
    <div className="rounded-card border border-surface-200 bg-surface-0 p-5">
      <div className="relative" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
          <g transform={`translate(${padding.left},${padding.top})`}>
            {ticks.map((v) => (
              <g key={v}>
                <line x1={0} x2={innerW} y1={y(v)} y2={y(v)} stroke="#E1E6EE" strokeWidth={1} />
                <text x={-8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#76839C">
                  {v}%
                </text>
              </g>
            ))}

            {datas.map((d, i) => {
              if (i % passoLabel !== 0) return null;
              const { dia, data } = rotuloData(d);
              return (
                <g key={d}>
                  <text x={x(i)} y={innerH + 16} textAnchor="middle" fontSize={10} fill="#42506A" fontWeight={600}>
                    {dia} {data}
                  </text>
                  {totais && (
                    <text x={x(i)} y={innerH + 30} textAnchor="middle" fontSize={9} fill="#76839C">
                      {totais[i]} respostas
                    </text>
                  )}
                </g>
              );
            })}

            {hover !== null && (
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={0}
                y2={innerH}
                stroke="#8FA0BA"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            )}

            {series.map((s) => {
              const cor = cores.get(s.marcaId) ?? "#8FA0BA";
              const emDestaque = !emFoco || s.marcaId === emFoco;
              const largura = emFoco && s.marcaId === emFoco ? 3 : 2;
              const opacidade = emDestaque ? 1 : 0.15;
              const segmentos = segmentosContinuos(s.pontos);
              return (
                <g
                  key={s.marcaId}
                  style={{ transition: "opacity 150ms", cursor: onFocar ? "pointer" : undefined }}
                  opacity={opacidade}
                  onClick={() => onFocar?.(s.marcaId)}
                >
                  {segmentos.map(
                    (seg, si) =>
                      seg.length > 1 && (
                        <polyline
                          key={si}
                          points={seg.map(([i, v]) => `${x(i)},${y(v)}`).join(" ")}
                          fill="none"
                          stroke={cor}
                          strokeWidth={largura}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )
                  )}
                  {s.pontos.map((v, i) =>
                    v === null ? null : (
                      <circle
                        key={i}
                        cx={x(i)}
                        cy={y(v)}
                        r={hover === i ? 5 : 3.5}
                        fill={cor}
                        stroke="#fff"
                        strokeWidth={1.5}
                      />
                    )
                  )}
                </g>
              );
            })}

            {/* Faixas invisíveis por coleta: capturam o mouse pra mostrar o tooltip. */}
            {datas.map((d, i) => (
              <rect
                key={d}
                x={x(i) - innerW / n / 2}
                y={0}
                width={innerW / n}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            ))}
          </g>
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[190px] rounded-md border border-surface-200 bg-surface-0 px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${((padding.left + x(hover)) / width) * 100}%`,
              transform: hover > n / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            }}
          >
            <p className="font-semibold text-slate-900">
              {rotuloData(datas[hover]).dia} {rotuloData(datas[hover]).data}
              {totais && <span className="ml-1 font-normal text-slate-500">· {totais[hover]} respostas</span>}
            </p>
            <ul className="mt-1.5 space-y-1">
              {seriesOrdenadas.map((s) => (
                <li key={s.marcaId} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: cores.get(s.marcaId) ?? "#8FA0BA" }}
                  />
                  <span className="flex-1 text-slate-700">{s.nome}</span>
                  <span className="font-medium text-slate-900">{(s.pontos[hover] ?? 0).toFixed(1)}%</span>
                  {s.contagens && totais && (
                    <span className="text-slate-500">
                      ({s.contagens[hover]}/{totais[hover]})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {series.map((s) => {
          const focado = s.marcaId === emFoco;
          return (
            <button
              key={s.marcaId}
              onClick={() => onFocar?.(s.marcaId)}
              disabled={!onFocar}
              title={onFocar ? "Destacar essa marca no gráfico" : undefined}
              className={`flex items-center gap-1.5 rounded px-1 -mx-1 text-xs transition-colors ${
                onFocar ? "hover:bg-surface-100" : ""
              } ${focado ? "font-semibold text-slate-900" : "text-slate-700"} ${
                emFoco && !focado ? "opacity-40" : ""
              }`}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: cores.get(s.marcaId) ?? "#8FA0BA" }}
              />
              {s.nome}
            </button>
          );
        })}
      </div>
    </div>
  );
}
