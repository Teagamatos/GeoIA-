// Paleta pra distinguir várias marcas em gráficos multi-série e badges
// (amber/teal/rose são os "signal colors" já usados no resto do produto).
export const PALETA_MARCAS = [
  "#C9973E", // signal.amber
  "#1E9E86", // signal.teal
  "#2C5488", // ink.600
  "#D6455F", // signal.rose
  "#8FA0BA", // paper.300
  "#6B4FA0",
  "#3E8FC9",
  "#A05B2C",
];

export function corMarca(indice: number): string {
  return PALETA_MARCAS[indice % PALETA_MARCAS.length];
}

/** Mapa estável marca_id → cor, na ordem em que as marcas foram passadas. */
export function mapaCoresPorMarca(marcas: { id: string }[]): Map<string, string> {
  const mapa = new Map<string, string>();
  marcas.forEach((m, i) => mapa.set(m.id, corMarca(i)));
  return mapa;
}

/**
 * Interpola entre as cores de sinal do design system (rose → amber → teal)
 * pra colorir células de heatmap/badges de acordo com uma % de 0 a 100.
 */
export function corVisibilidade(pct: number): { bg: string; text: string } {
  const clamp = Math.max(0, Math.min(100, pct));
  const rose: [number, number, number] = [214, 69, 95];
  const amber: [number, number, number] = [201, 151, 62];
  const teal: [number, number, number] = [30, 158, 134];

  let c: number[];
  if (clamp <= 50) {
    const t = clamp / 50;
    c = rose.map((v, i) => Math.round(v + (amber[i] - v) * t));
  } else {
    const t = (clamp - 50) / 50;
    c = amber.map((v, i) => Math.round(v + (teal[i] - v) * t));
  }

  return {
    bg: `rgb(${c[0]} ${c[1]} ${c[2]} / 0.16)`,
    text: `rgb(${c[0]} ${c[1]} ${c[2]})`,
  };
}
