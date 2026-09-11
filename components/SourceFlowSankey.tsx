"use client";

import { useMemo } from "react";

interface Link {
  dominio: string;
  marcaId: string;
  peso: number;
}

export function SourceFlowSankey({
  dominios,
  marcas,
  links,
  cores,
  height = 380,
  emFoco,
  onFocar,
}: {
  dominios: string[];
  marcas: { id: string; nome: string }[];
  links: Link[];
  cores: Map<string, string>;
  height?: number;
  /** marcaId em destaque (clicado no nome à direita) — as demais faixas/nomes ficam esmaecidos. */
  emFoco?: string | null;
  /** Clique no nome da marca: destaca essa marca no diagrama (clicar de novo tira o destaque). */
  onFocar?: (id: string) => void;
}) {
  const width = 680;
  const nodeWidth = 10;
  const gap = 6;
  const marginLabel = 112;
  const leftNodeX = marginLabel;
  const rightNodeX = width - marginLabel - nodeWidth;
  const padding = { top: 8, bottom: 8 };
  const innerH = height - padding.top - padding.bottom;

  const { leftTotal, rightTotal, marcasOrdenadas } = useMemo(() => {
    const leftTotal = new Map<string, number>();
    const rightTotal = new Map<string, number>();
    for (const l of links) {
      leftTotal.set(l.dominio, (leftTotal.get(l.dominio) ?? 0) + l.peso);
      rightTotal.set(l.marcaId, (rightTotal.get(l.marcaId) ?? 0) + l.peso);
    }
    const marcasOrdenadas = marcas
      .filter((m) => (rightTotal.get(m.id) ?? 0) > 0)
      .sort((a, b) => (rightTotal.get(b.id) ?? 0) - (rightTotal.get(a.id) ?? 0));
    return { leftTotal, rightTotal, marcasOrdenadas };
  }, [links, marcas]);

  if (dominios.length === 0 || links.length === 0) {
    return (
      <div className="rounded-card border border-surface-200 bg-surface-0 p-8 text-center text-sm text-slate-700">
        Ainda não há fontes suficientes cruzadas com menções de marca no período.
      </div>
    );
  }

  const totalGeral = Array.from(leftTotal.values()).reduce((a, b) => a + b, 0) || 1;
  const escalaLeft = (innerH - (dominios.length - 1) * gap) / totalGeral;
  const escalaRight = (innerH - (marcasOrdenadas.length - 1) * gap) / totalGeral;

  const yLeft = new Map<string, { y0: number; y1: number }>();
  let cursor = padding.top;
  for (const d of dominios) {
    const h = (leftTotal.get(d) ?? 0) * escalaLeft;
    yLeft.set(d, { y0: cursor, y1: cursor + h });
    cursor += h + gap;
  }

  const yRight = new Map<string, { y0: number; y1: number }>();
  cursor = padding.top;
  for (const m of marcasOrdenadas) {
    const h = (rightTotal.get(m.id) ?? 0) * escalaRight;
    yRight.set(m.id, { y0: cursor, y1: cursor + h });
    cursor += h + gap;
  }

  const cursorLeft = new Map<string, number>();
  const cursorRight = new Map<string, number>();
  dominios.forEach((d) => cursorLeft.set(d, yLeft.get(d)?.y0 ?? 0));
  marcasOrdenadas.forEach((m) => cursorRight.set(m.id, yRight.get(m.id)?.y0 ?? 0));

  const ribbons = links
    .filter((l) => yLeft.has(l.dominio) && yRight.has(l.marcaId))
    .sort((a, b) => b.peso - a.peso)
    .map((l, i) => {
      const alturaEsq = l.peso * escalaLeft;
      const alturaDir = l.peso * escalaRight;
      const y0Esq = cursorLeft.get(l.dominio) ?? 0;
      const y0Dir = cursorRight.get(l.marcaId) ?? 0;
      cursorLeft.set(l.dominio, y0Esq + alturaEsq);
      cursorRight.set(l.marcaId, y0Dir + alturaDir);

      const x0 = leftNodeX + nodeWidth;
      const x1 = rightNodeX;
      const xm = (x0 + x1) / 2;

      const path = `M ${x0},${y0Esq} C ${xm},${y0Esq} ${xm},${y0Dir} ${x1},${y0Dir} L ${x1},${y0Dir + alturaDir} C ${xm},${y0Dir + alturaDir} ${xm},${y0Esq + alturaEsq} ${x0},${y0Esq + alturaEsq} Z`;

      const nomeMarca = marcasOrdenadas.find((m) => m.id === l.marcaId)?.nome ?? l.marcaId;
      return {
        key: `${l.dominio}::${l.marcaId}::${i}`,
        path,
        marcaId: l.marcaId,
        cor: cores.get(l.marcaId) ?? "#8FA0BA",
        titulo: `${l.dominio} → ${nomeMarca}: ${l.peso} ${l.peso === 1 ? "ocorrência" : "ocorrências"}`,
      };
    });

  return (
    <div className="rounded-card border border-surface-200 bg-surface-0 p-5 overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height, minWidth: 520 }}>
        {ribbons.map((r) => (
          <path
            key={r.key}
            d={r.path}
            fill={r.cor}
            fillOpacity={!emFoco ? 0.22 : r.marcaId === emFoco ? 0.55 : 0.05}
            stroke="none"
            style={{ transition: "fill-opacity 150ms" }}
          >
            <title>{r.titulo}</title>
          </path>
        ))}

        {dominios.map((d) => {
          const pos = yLeft.get(d);
          if (!pos) return null;
          const ligadoAoFoco = !emFoco || links.some((l) => l.dominio === d && l.marcaId === emFoco);
          return (
            <g key={d} opacity={ligadoAoFoco ? 1 : 0.25} style={{ transition: "opacity 150ms" }}>
              <rect
                x={leftNodeX}
                y={pos.y0}
                width={nodeWidth}
                height={Math.max(2, pos.y1 - pos.y0)}
                fill="#8FA0BA"
                rx={2}
              />
              <text
                x={leftNodeX - 6}
                y={(pos.y0 + pos.y1) / 2}
                dominantBaseline="middle"
                textAnchor="end"
                fontSize={10}
                fill="#42506A"
              >
                {d.length > 22 ? d.slice(0, 20) + "…" : d}
              </text>
            </g>
          );
        })}

        {marcasOrdenadas.map((m) => {
          const pos = yRight.get(m.id);
          if (!pos) return null;
          const cor = cores.get(m.id) ?? "#8FA0BA";
          const focado = m.id === emFoco;
          const alturaNode = Math.max(2, pos.y1 - pos.y0);
          const meioY = (pos.y0 + pos.y1) / 2;
          return (
            <g
              key={m.id}
              opacity={!emFoco || focado ? 1 : 0.3}
              style={{ transition: "opacity 150ms", cursor: onFocar ? "pointer" : undefined }}
              onClick={() => onFocar?.(m.id)}
            >
              {focado && (
                <rect
                  x={rightNodeX - 2}
                  y={pos.y0 - 3}
                  width={nodeWidth + 4}
                  height={alturaNode + 6}
                  fill={cor}
                  fillOpacity={0.12}
                  rx={4}
                />
              )}
              <rect x={rightNodeX} y={pos.y0} width={nodeWidth} height={alturaNode} fill={cor} rx={2} />
              <text
                x={rightNodeX + nodeWidth + 6}
                y={meioY}
                dominantBaseline="middle"
                fontSize={10}
                fill={focado ? cor : "#0B1A2E"}
                fontWeight={600}
              >
                {m.nome}
              </text>
              {onFocar && (
                <title>Clique para destacar {m.nome} no diagrama</title>
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-xs text-slate-500">
        Cada faixa conecta um domínio de fonte (esquerda) a uma marca mencionada na mesma resposta
        (direita). Quanto mais larga, mais vezes isso aconteceu no período.
      </p>
    </div>
  );
}
