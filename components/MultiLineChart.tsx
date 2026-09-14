/**
 * Quebra a série em trechos contínuos, cortando nos pontos `null` (dias sem
 * nenhuma coleta) — assim o SVG desenha uma lacuna de verdade ali, em vez de
 * uma linha reta ligando o antes e o depois como se fosse dado real.
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

export function MultiLineChart({
  datas,
  series,
  cores,
  height = 220,
  emFoco,
  onFocar,
}: {
  datas: string[];
  series: { marcaId: string; nome: string; pontos: (number | null)[] }[];
  cores: Map<string, string>;
  height?: number;
  /** marcaId em destaque (clicado na legenda ou na linha) — as outras linhas ficam esmaecidas. */
  emFoco?: string | null;
  /** Clique no nome na legenda ou na própria linha: destaca essa marca (clicar de novo tira o destaque). */
  onFocar?: (id: string) => void;
}) {
  const width = 640;
  const padding = { top: 12, right: 12, bottom: 24, left: 34 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  if (datas.length === 0 || series.length === 0) {
    return (
      <div className="rounded-card border border-surface-200 bg-surface-0 p-8 text-center text-sm text-slate-700">
        Sem execuções no período selecionado.
      </div>
    );
  }

  const x = (i: number) => (datas.length > 1 ? (i / (datas.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => innerH - (v / 100) * innerH;
  const passoLabel = Math.max(1, Math.ceil(datas.length / 6));

  return (
    <div className="rounded-card border border-surface-200 bg-surface-0 p-5">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
        <g transform={`translate(${padding.left},${padding.top})`}>
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={0} x2={innerW} y1={y(v)} y2={y(v)} stroke="#E1E6EE" strokeWidth={1} />
              <text x={-8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#76839C">
                {v}%
              </text>
            </g>
          ))}

          {datas.map((d, i) =>
            i % passoLabel === 0 ? (
              <text key={d} x={x(i)} y={innerH + 16} textAnchor="middle" fontSize={9} fill="#76839C">
                {new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
              </text>
            ) : null
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
                {segmentos.map((seg, si) =>
                  seg.length === 1 ? (
                    // Um único dia de dado isolado entre lacunas — sem isso ficaria invisível,
                    // já que uma polyline de 1 ponto não desenha nada. O círculo maior e
                    // transparente por baixo aumenta a área de clique sem alterar o visual.
                    <g key={si}>
                      <circle cx={x(seg[0][0])} cy={y(seg[0][1])} r={9} fill="transparent" />
                      <circle cx={x(seg[0][0])} cy={y(seg[0][1])} r={3} fill={cor} />
                    </g>
                  ) : (
                    <g key={si}>
                      {/* Traço largo e invisível por baixo só pra facilitar o clique —
                          a linha visível em si é fina demais pra ser um alvo confortável. */}
                      <polyline
                        points={seg.map(([i, v]) => `${x(i)},${y(v)}`).join(" ")}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={16}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <polyline
                        points={seg.map(([i, v]) => `${x(i)},${y(v)}`).join(" ")}
                        fill="none"
                        stroke={cor}
                        strokeWidth={largura}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ pointerEvents: "none" }}
                      />
                    </g>
                  )
                )}
              </g>
            );
          })}
        </g>
      </svg>

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
