import { supabase } from "./supabase";
import { Marca, MarcaAlias, DominioProprio, Prompt, Execucao, Fonte, Mencao, PROVIDER_LABELS } from "./types";

export async function getMarcas(): Promise<Marca[]> {
  const { data, error } = await supabase.from("geo_marca").select("*").order("nome");
  if (error) throw error;
  return data ?? [];
}

export async function getMarcaAliases(): Promise<MarcaAlias[]> {
  const { data, error } = await supabase.from("geo_marca_alias").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function getDominiosProprios(): Promise<DominioProprio[]> {
  const { data, error } = await supabase.from("geo_dominio_proprio").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function getPrompts(): Promise<Prompt[]> {
  const { data, error } = await supabase
    .from("geo_prompt")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getExecucoesEntre(dataInicio: string, dataFim: string): Promise<Execucao[]> {
  const { data, error } = await supabase
    .from("geo_execucao")
    .select("*")
    .gte("data_execucao", dataInicio)
    .lte("data_execucao", dataFim)
    .order("data_execucao", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getMencoesPorExecucoes(execucaoIds: string[]): Promise<Mencao[]> {
  if (execucaoIds.length === 0) return [];
  const { data, error } = await supabase
    .from("geo_mencao")
    .select("*")
    .in("execucao_id", execucaoIds);
  if (error) throw error;
  return data ?? [];
}

export async function getFontesPorExecucoes(execucaoIds: string[]): Promise<Fonte[]> {
  if (execucaoIds.length === 0) return [];
  const { data, error } = await supabase
    .from("geo_fonte")
    .select("*")
    .in("execucao_id", execucaoIds);
  if (error) throw error;
  return data ?? [];
}

// ---------- Helpers de data ----------

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function rangeDias(dias: number): { inicio: string; fim: string } {
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - (dias - 1));
  return { inicio: toISODate(inicio), fim: toISODate(fim) };
}

export function rangeAnterior(dias: number): { inicio: string; fim: string } {
  const fim = new Date();
  fim.setDate(fim.getDate() - dias);
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - dias * 2 + 1);
  return { inicio: toISODate(inicio), fim: toISODate(fim) };
}

// ---------- Métricas ----------

export interface MetricasMarca {
  marca: Marca;
  execucoesComMencao: number;
  totalExecucoes: number;
  visibilidade: number; // %
  totalMencoes: number;
  shareOfVoice: number; // %
  posicaoMedia: number | null;
}

export function calcularMetricasPorMarca(
  marcas: Marca[],
  execucoes: Execucao[],
  mencoes: Mencao[]
): MetricasMarca[] {
  const totalExecucoes = execucoes.length;
  const totalMencoes = mencoes.length;

  return marcas
    .filter((m) => m.ativo)
    .map((marca) => {
      const mencoesDaMarca = mencoes.filter((mc) => mc.marca_id === marca.id);
      const execucoesUnicas = new Set(mencoesDaMarca.map((mc) => mc.execucao_id));
      const posicoes = mencoesDaMarca
        .map((mc) => mc.ordem ?? mc.posicao_no_texto)
        .filter((v): v is number => v !== null && v !== undefined);

      return {
        marca,
        execucoesComMencao: execucoesUnicas.size,
        totalExecucoes,
        visibilidade: totalExecucoes > 0 ? (execucoesUnicas.size / totalExecucoes) * 100 : 0,
        totalMencoes: mencoesDaMarca.length,
        shareOfVoice: totalMencoes > 0 ? (mencoesDaMarca.length / totalMencoes) * 100 : 0,
        posicaoMedia: posicoes.length > 0 ? posicoes.reduce((a, b) => a + b, 0) / posicoes.length : null,
      };
    })
    .sort((a, b) => b.shareOfVoice - a.shareOfVoice);
}

export interface PresencaFontes {
  execucoesComFonteConsultada: number;
  execucoesComFonteCitada: number;
  totalExecucoes: number;
  percentualConsultada: number;
  percentualCitada: number;
}

/**
 * Separa "o modelo pesquisou um domínio próprio" (fonte.tipo = "consultada")
 * de "o modelo citou um domínio próprio como referência na resposta"
 * (fonte.tipo = "citada"). São eventos diferentes — a marca pode ser
 * consultada sem ser citada (o modelo leu e não usou como referência final),
 * então tratar como uma métrica só escondia essa diferença.
 */
export function calcularPresencaDeFontes(
  marcaId: string,
  execucoes: Execucao[],
  fontes: Fonte[],
  dominiosProprios: DominioProprio[]
): PresencaFontes {
  const dominiosDaMarca = new Set(
    dominiosProprios.filter((d) => d.marca_id === marcaId).map((d) => d.dominio.toLowerCase())
  );
  const totalExecucoes = execucoes.length;

  if (dominiosDaMarca.size === 0 || totalExecucoes === 0) {
    return {
      execucoesComFonteConsultada: 0,
      execucoesComFonteCitada: 0,
      totalExecucoes,
      percentualConsultada: 0,
      percentualCitada: 0,
    };
  }

  const fontesDaMarca = fontes.filter((f) => f.dominio && dominiosDaMarca.has(f.dominio.toLowerCase()));

  const execucoesComFonteConsultada = new Set(
    fontesDaMarca.filter((f) => f.tipo === "consultada").map((f) => f.execucao_id)
  );
  const execucoesComFonteCitada = new Set(
    fontesDaMarca.filter((f) => f.tipo === "citada").map((f) => f.execucao_id)
  );

  return {
    execucoesComFonteConsultada: execucoesComFonteConsultada.size,
    execucoesComFonteCitada: execucoesComFonteCitada.size,
    totalExecucoes,
    percentualConsultada: (execucoesComFonteConsultada.size / totalExecucoes) * 100,
    percentualCitada: (execucoesComFonteCitada.size / totalExecucoes) * 100,
  };
}

export type DimensaoDetalhamento = "modelo" | "pais" | "persona" | "categoria";

export const DIMENSOES_DETALHAMENTO: { valor: DimensaoDetalhamento; label: string }[] = [
  { valor: "modelo", label: "Modelos" },
  { valor: "pais", label: "Localização" },
  { valor: "persona", label: "Persona" },
  { valor: "categoria", label: "Oferta" },
];

export interface BreakdownItem {
  chave: string;
  detalhe?: string;
  respostas: number;
  mencoes: number;
  visibilidade: number;
}

/**
 * Agrupa execuções por uma dimensão (modelo/provider, ou pais/persona/categoria
 * do prompt que originou a execução) e calcula respostas/menções/visibilidade
 * da marca selecionada em cada grupo.
 */
export function calcularBreakdownPorDimensao(
  dimensao: DimensaoDetalhamento,
  marcaId: string,
  execucoes: Execucao[],
  mencoes: Mencao[],
  prompts: Prompt[]
): BreakdownItem[] {
  const promptPorId = new Map(prompts.map((p) => [p.id, p]));
  const mencoesDaMarcaPorExecucao = new Set(
    mencoes.filter((m) => m.marca_id === marcaId).map((m) => m.execucao_id)
  );

  function chaveBruta(ex: Execucao): string {
    if (dimensao === "modelo") return ex.provider;
    const prompt = ex.prompt_id ? promptPorId.get(ex.prompt_id) : undefined;
    if (dimensao === "pais") return prompt?.pais?.trim() || "Sem localização";
    if (dimensao === "persona") return prompt?.persona?.trim() || "Sem persona";
    return prompt?.categoria?.trim() || "Sem oferta";
  }

  const porChave = new Map<string, Execucao[]>();
  for (const ex of execucoes) {
    const chave = chaveBruta(ex);
    const lista = porChave.get(chave) ?? [];
    lista.push(ex);
    porChave.set(chave, lista);
  }

  return Array.from(porChave.entries())
    .map(([chave, execs]) => {
      const mencoesCount = execs.filter((e) => mencoesDaMarcaPorExecucao.has(e.id)).length;
      return {
        chave: dimensao === "modelo" ? PROVIDER_LABELS[chave] ?? chave : chave,
        detalhe: dimensao === "modelo" ? execs[0]?.modelo : undefined,
        respostas: execs.length,
        mencoes: mencoesCount,
        visibilidade: execs.length > 0 ? (mencoesCount / execs.length) * 100 : 0,
      };
    })
    .sort((a, b) => b.respostas - a.respostas);
}

export interface CelulaHeatmap {
  respostas: number;
  mencoes: number;
  visibilidade: number;
}

/**
 * Visibilidade da marca selecionada, por prompt × provider (modelo de IA).
 * Chave do mapa retornado: `${promptId}::${provider}`.
 */
export function calcularHeatmapPrompts(
  marcaId: string,
  execucoes: Execucao[],
  mencoes: Mencao[]
): Map<string, CelulaHeatmap> {
  const mencoesDaMarcaPorExecucao = new Set(
    mencoes.filter((m) => m.marca_id === marcaId).map((m) => m.execucao_id)
  );

  const porChave = new Map<string, Execucao[]>();
  for (const ex of execucoes) {
    if (!ex.prompt_id) continue;
    const chave = `${ex.prompt_id}::${ex.provider}`;
    const lista = porChave.get(chave) ?? [];
    lista.push(ex);
    porChave.set(chave, lista);
  }

  const resultado = new Map<string, CelulaHeatmap>();
  for (const [chave, execs] of porChave.entries()) {
    const mencoesCount = execs.filter((e) => mencoesDaMarcaPorExecucao.has(e.id)).length;
    resultado.set(chave, {
      respostas: execs.length,
      mencoes: mencoesCount,
      visibilidade: execs.length > 0 ? (mencoesCount / execs.length) * 100 : 0,
    });
  }
  return resultado;
}

export interface SeriePorMarca {
  marcaId: string;
  nome: string;
  pontos: number[]; // visibilidade % por dia, alinhado com `datas`
}

/** Visibilidade (%) por dia, para cada marca ativa, no conjunto de execuções dado. */
export function calcularSerieVisibilidadePorMarca(
  marcas: Marca[],
  execucoes: Execucao[],
  mencoes: Mencao[]
): { datas: string[]; series: SeriePorMarca[] } {
  const datas = Array.from(new Set(execucoes.map((e) => e.data_execucao))).sort();

  const totalPorDia = new Map<string, number>();
  for (const ex of execucoes) {
    totalPorDia.set(ex.data_execucao, (totalPorDia.get(ex.data_execucao) ?? 0) + 1);
  }

  const series = marcas
    .filter((m) => m.ativo)
    .map((marca) => {
      const execIdsComMencao = new Set(
        mencoes.filter((m) => m.marca_id === marca.id).map((m) => m.execucao_id)
      );
      const comMencaoPorDia = new Map<string, number>();
      for (const ex of execucoes) {
        if (execIdsComMencao.has(ex.id)) {
          comMencaoPorDia.set(ex.data_execucao, (comMencaoPorDia.get(ex.data_execucao) ?? 0) + 1);
        }
      }
      const pontos = datas.map((d) => {
        const total = totalPorDia.get(d) ?? 0;
        const com = comMencaoPorDia.get(d) ?? 0;
        return total > 0 ? (com / total) * 100 : 0;
      });
      return { marcaId: marca.id, nome: marca.nome, pontos };
    });

  return { datas, series };
}

export type ModoAgrupamentoFonte = "url" | "dominio";

export interface ResumoFonte {
  chave: string;
  dominio: string;
  titulo: string | null;
  tipo: string | null;
  aparicoes: number;
  citadaPct: number;
  ordemMedia: number | null;
  vistoPorUltimo: string | null;
  marcaIds: string[];
}

/**
 * Agrega as fontes (por URL ou por domínio) e cruza com execuções pra
 * calcular: % das execuções do período que citam essa fonte, quantas vezes
 * apareceu, a ordem média em que aparece dentro da resposta (proxy de posição,
 * baseada na ordem de inserção dentro de cada execução), quando foi vista pela
 * última vez, e quais marcas essa fonte especificamente cita.
 *
 * `marcaIds` vem do `fonte.marca_id` gravado pelo motor (n8n) — só é
 * preenchido quando há evidência textual direta (domínio próprio da marca, ou
 * o título/URL da citação nomeia a marca). NÃO é "quais marcas foram
 * mencionadas na mesma execução" — isso gerava atribuições erradas (uma fonte
 * sobre a Michael Page aparecendo com badge da Foursales só por estarem na
 * mesma resposta). O parâmetro `mencoes` não é mais necessário aqui, mas a
 * assinatura foi mantida por compatibilidade com quem já chama essa função.
 */
export function calcularResumoFontes(
  modo: ModoAgrupamentoFonte,
  execucoes: Execucao[],
  fontes: Fonte[],
  _mencoes: Mencao[]
): ResumoFonte[] {
  const totalExecucoes = execucoes.length;

  const fontesPorExecucao = new Map<string, Fonte[]>();
  for (const f of fontes) {
    const lista = fontesPorExecucao.get(f.execucao_id) ?? [];
    lista.push(f);
    fontesPorExecucao.set(f.execucao_id, lista);
  }
  const ordemPorFonteId = new Map<string, number>();
  for (const lista of fontesPorExecucao.values()) {
    const ordenada = [...lista].sort((a, b) => a.created_at.localeCompare(b.created_at));
    ordenada.forEach((f, i) => ordemPorFonteId.set(f.id, i + 1));
  }

  // Agrupa por (chave, tipo) — não só por chave. Uma mesma URL/domínio pode
  // ter sido "consultada" numa execução e "citada" em outra; juntar as duas
  // num grupo só escondia uma das duas (ficava só o tipo da primeira
  // ocorrência encontrada). Agora viram duas linhas, uma por tipo.
  const grupos = new Map<string, { chave: string; tipo: string | null; lista: Fonte[] }>();
  for (const f of fontes) {
    const chave = modo === "url" ? f.url ?? f.dominio ?? "—" : f.dominio ?? "—";
    const chaveGrupo = `${chave} ${f.tipo ?? ""}`;
    const grupo = grupos.get(chaveGrupo) ?? { chave, tipo: f.tipo, lista: [] };
    grupo.lista.push(f);
    grupos.set(chaveGrupo, grupo);
  }

  return Array.from(grupos.values())
    .map(({ chave, tipo, lista }) => {
      const dominio = lista.find((f) => f.dominio)?.dominio ?? "—";
      const titulo = lista.find((f) => f.titulo)?.titulo ?? null;
      const ordens = lista
        .map((f) => ordemPorFonteId.get(f.id))
        .filter((v): v is number => v !== undefined);
      const marcaIds = new Set<string>();
      lista.forEach((f) => {
        if (f.marca_id) marcaIds.add(f.marca_id);
      });
      const vistoPorUltimo = lista.reduce<string | null>(
        (max, f) => (!max || f.created_at > max ? f.created_at : max),
        null
      );

      return {
        chave,
        dominio,
        titulo,
        tipo,
        aparicoes: lista.length,
        citadaPct: totalExecucoes > 0 ? (lista.length / totalExecucoes) * 100 : 0,
        ordemMedia: ordens.length > 0 ? ordens.reduce((a, b) => a + b, 0) / ordens.length : null,
        vistoPorUltimo,
        marcaIds: Array.from(marcaIds),
      };
    })
    .sort((a, b) => b.aparicoes - a.aparicoes);
}

export interface FluxoFonteLink {
  dominio: string;
  marcaId: string;
  peso: number;
}

export interface FluxoFontesResultado {
  dominios: string[];
  links: FluxoFonteLink[];
}

/**
 * Cruza fontes com as marcas mencionadas na mesma execução, pra alimentar o
 * diagrama de fluxo "Fonte → Marca". Mantém só os `topN` domínios mais citados.
 */
export function calcularFluxoFontesPorMarca(
  fontes: Fonte[],
  mencoes: Mencao[],
  marcas: Marca[],
  topN = 10
): FluxoFontesResultado {
  const marcasPorExecucao = new Map<string, Set<string>>();
  for (const m of mencoes) {
    const set = marcasPorExecucao.get(m.execucao_id) ?? new Set<string>();
    set.add(m.marca_id);
    marcasPorExecucao.set(m.execucao_id, set);
  }

  const marcasAtivasIds = new Set(marcas.filter((m) => m.ativo).map((m) => m.id));
  const pesoPorDominioTotal = new Map<string, number>();
  const pesoPorPar = new Map<string, number>();

  for (const f of fontes) {
    if (!f.dominio) continue;
    const marcasDaExecucao = marcasPorExecucao.get(f.execucao_id);
    if (!marcasDaExecucao || marcasDaExecucao.size === 0) continue;
    pesoPorDominioTotal.set(f.dominio, (pesoPorDominioTotal.get(f.dominio) ?? 0) + 1);
    for (const marcaId of marcasDaExecucao) {
      if (!marcasAtivasIds.has(marcaId)) continue;
      const chave = `${f.dominio}::${marcaId}`;
      pesoPorPar.set(chave, (pesoPorPar.get(chave) ?? 0) + 1);
    }
  }

  const topDominios = Array.from(pesoPorDominioTotal.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([d]) => d);

  const dominiosSet = new Set(topDominios);
  const links = Array.from(pesoPorPar.entries())
    .map(([chave, peso]) => {
      const [dominio, marcaId] = chave.split("::");
      return { dominio, marcaId, peso };
    })
    .filter((l) => dominiosSet.has(l.dominio));

  return { dominios: topDominios, links };
}

export function tendencia(atual: number, anterior: number): "up" | "down" | "flat" {
  const diff = atual - anterior;
  if (Math.abs(diff) < 0.01) return "flat";
  return diff > 0 ? "up" : "down";
}

/**
 * Filtro avançado (equivalente ao ícone de funil do Temso): permite restringir
 * o dashboard por múltiplas facetas dos prompts + provider, ao mesmo tempo,
 * em vez de um único prompt (isso é o que PromptSwitcher já resolve).
 */
export interface FiltroAvancado {
  personas: string[];
  paises: string[];
  categorias: string[];
  providers: string[];
}

export const FILTRO_AVANCADO_VAZIO: FiltroAvancado = {
  personas: [],
  paises: [],
  categorias: [],
  providers: [],
};

export function filtroAvancadoContagem(filtro: FiltroAvancado): number {
  return (
    filtro.personas.length + filtro.paises.length + filtro.categorias.length + filtro.providers.length
  );
}

/** Opções disponíveis pra cada faceta, derivadas dos prompts carregados. */
export function opcoesFiltroAvancado(prompts: Prompt[]) {
  const personas = new Set<string>();
  const paises = new Set<string>();
  const categorias = new Set<string>();
  for (const p of prompts) {
    if (p.persona) personas.add(p.persona);
    if (p.pais) paises.add(p.pais);
    if (p.categoria) categorias.add(p.categoria);
  }
  return {
    personas: Array.from(personas).sort(),
    paises: Array.from(paises).sort(),
    categorias: Array.from(categorias).sort(),
  };
}

/** Um prompt passa no filtro se bater em todas as facetas com valores selecionados. */
export function promptPassaFiltroAvancado(prompt: Prompt | undefined, filtro: FiltroAvancado): boolean {
  if (!prompt) return false;
  if (filtro.personas.length > 0 && !filtro.personas.includes(prompt.persona ?? "")) return false;
  if (filtro.paises.length > 0 && !filtro.paises.includes(prompt.pais ?? "")) return false;
  if (filtro.categorias.length > 0 && !filtro.categorias.includes(prompt.categoria ?? "")) return false;
  return true;
}
