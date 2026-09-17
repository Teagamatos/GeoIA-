import { supabase } from "./supabase";
import { Marca, MarcaAlias, DominioProprio, Prompt, Execucao, Fonte, Mencao, PROVIDER_LABELS } from "./types";

// ---------- Cache leve pra troca de página não parecer que está "carregando" de novo ----------

/**
 * O volume de dados aqui é pequeno (dezenas de execuções, ~100 marcas) — o banco
 * responde em milissegundos. O delay que dá a sensação de "travou" ao trocar de
 * aba não é o Supabase sendo lento: é que cada página (Dashboard, Concorrentes,
 * Fontes, Prompts) é desmontada e remontada do zero pelo Next.js a cada
 * navegação, e sem nenhuma memória do que já buscou, ela refaz a mesma consulta
 * de novo — e a viagem de rede até o Supabase (que essa sim tem uma latência
 * perceptível) acontece de novo, com o skeleton de "carregando" aparecendo cada
 * vez, mesmo que o dado não tenha mudado nesse meio-tempo.
 *
 * Esse cache guarda o resultado (na verdade, a Promise, o que também deduplica
 * chamadas concorrentes idênticas) por um TTL curto — o suficiente pra absorver
 * ida-e-volta entre páginas na mesma sessão do navegador, não pra evitar buscar
 * dado de verdade por muito tempo. Fica só na memória da aba (não é
 * localStorage): um F5 sempre busca fresco.
 */
const CACHE_TTL_MS = 20_000;
const cacheConsultas = new Map<string, { promessa: Promise<any>; buscadoEm: number }>();

function comCache<T>(chave: string, buscar: () => Promise<T>): Promise<T> {
  const cacheado = cacheConsultas.get(chave);
  if (cacheado && Date.now() - cacheado.buscadoEm < CACHE_TTL_MS) {
    return cacheado.promessa as Promise<T>;
  }
  const promessa = buscar().catch((erro) => {
    cacheConsultas.delete(chave); // não guarda erro em cache, senão a página fica presa nele até o TTL passar
    throw erro;
  });
  cacheConsultas.set(chave, { promessa, buscadoEm: Date.now() });
  return promessa;
}

/**
 * Invalida uma entrada específica do cache acima — chamado depois de qualquer
 * mutação (editar/arquivar marca ou prompt, cadastrar concorrente, etc.) pra
 * garantir que a próxima leitura veja o dado novo, em vez de esperar o TTL
 * passar. Sem argumento, limpa tudo.
 */
export function invalidarCache(chave?: string): void {
  if (!chave) {
    cacheConsultas.clear();
    return;
  }
  cacheConsultas.delete(chave);
}

export async function getMarcas(): Promise<Marca[]> {
  return comCache("marcas", async () => {
    const { data, error } = await supabase.from("geo_marca").select("*").order("nome");
    if (error) throw error;
    return data ?? [];
  });
}

export async function getMarcaAliases(): Promise<MarcaAlias[]> {
  return comCache("marcaAliases", async () => {
    const { data, error } = await supabase.from("geo_marca_alias").select("*");
    if (error) throw error;
    return data ?? [];
  });
}

export async function getDominiosProprios(): Promise<DominioProprio[]> {
  return comCache("dominiosProprios", async () => {
    const { data, error } = await supabase.from("geo_dominio_proprio").select("*");
    if (error) throw error;
    return data ?? [];
  });
}

export async function getPrompts(): Promise<Prompt[]> {
  return comCache("prompts", async () => {
    const { data, error } = await supabase
      .from("geo_prompt")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });
}

export async function getExecucoesEntre(dataInicio: string, dataFim: string): Promise<Execucao[]> {
  return comCache(`execucoes:${dataInicio}:${dataFim}`, async () => {
    const { data, error } = await supabase
      .from("geo_execucao")
      .select("*")
      .gte("data_execucao", dataInicio)
      .lte("data_execucao", dataFim)
      .order("data_execucao", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });
}

export async function getMencoesPorExecucoes(execucaoIds: string[]): Promise<Mencao[]> {
  if (execucaoIds.length === 0) return [];
  const chave = `mencoes:${[...execucaoIds].sort().join(",")}`;
  return comCache(chave, async () => {
    const { data, error } = await supabase
      .from("geo_mencao")
      .select("*")
      .in("execucao_id", execucaoIds);
    if (error) throw error;
    return data ?? [];
  });
}

export async function getFontesPorExecucoes(execucaoIds: string[]): Promise<Fonte[]> {
  if (execucaoIds.length === 0) return [];
  const chave = `fontes:${[...execucaoIds].sort().join(",")}`;
  return comCache(chave, async () => {
    const { data, error } = await supabase
      .from("geo_fonte")
      .select("*")
      .in("execucao_id", execucaoIds);
    if (error) throw error;
    return data ?? [];
  });
}

export interface UltimaExecucao {
  data_execucao: string;
  created_at: string;
}

/**
 * A execução mais recente registrada, de qualquer prompt/provider — usada só
 * pra mostrar "última atualização do motor" na barra lateral, pra quem usa o
 * dashboard saber quando foi o último processamento da automação, sem
 * precisar abrir o Prompts ou o Respostas pra descobrir isso.
 */
export async function getUltimaExecucao(): Promise<UltimaExecucao | null> {
  return comCache("ultimaExecucao", async () => {
    const { data, error } = await supabase
      .from("geo_execucao")
      .select("data_execucao, created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  });
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

function duracaoEmDias(inicio: string, fim: string): number {
  const a = new Date(`${inicio}T00:00:00Z`).getTime();
  const b = new Date(`${fim}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * Mesma ideia do rangeAnterior, mas pra um período escolhido livremente no
 * calendário (LAB-1064) — pega o intervalo imediatamente anterior, com a
 * mesma duração, pra comparar "esse período vs o anterior" mesmo quando o
 * período não é mais um número fixo de dias (7/30/90), e sim datas quaisquer.
 */
export function rangeAnteriorPersonalizado(inicio: string, fim: string): { inicio: string; fim: string } {
  const dias = duracaoEmDias(inicio, fim);
  const fimAnterior = new Date(`${inicio}T00:00:00Z`);
  fimAnterior.setUTCDate(fimAnterior.getUTCDate() - 1);
  const inicioAnterior = new Date(fimAnterior);
  inicioAnterior.setUTCDate(inicioAnterior.getUTCDate() - (dias - 1));
  return { inicio: toISODate(inicioAnterior), fim: toISODate(fimAnterior) };
}

/**
 * Todas as datas (YYYY-MM-DD) entre início e fim, inclusive — preenche também os
 * dias sem nenhuma execução. Sem isso, um gráfico que só desenha os dias que
 * aparecem em `execucoes` comprime o eixo e esconde exatamente o buraco que a
 * gente quer mostrar (período sem coleta), em vez de deixar ele visível.
 */
export function todasAsDatasEntre(inicio: string, fim: string): string[] {
  const datas: string[] = [];
  const atual = new Date(`${inicio}T00:00:00Z`);
  const limite = new Date(`${fim}T00:00:00Z`);
  while (atual <= limite) {
    datas.push(toISODate(atual));
    atual.setUTCDate(atual.getUTCDate() + 1);
  }
  return datas;
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
  /**
   * Nenhuma das execuções dessa célula disparou busca web (todas com
   * `buscou_web` falso/null). Isso é um caso diferente de "0% de
   * visibilidade": ali o modelo respondeu sem nem pesquisar, então 0% não
   * significa que a marca perdeu — significa que não teve como aparecer.
   * Quem renderiza a célula deve distinguir visualmente os dois casos.
   */
  semBuscaWeb: boolean;
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
      semBuscaWeb: execs.every((e) => !e.buscou_web),
    });
  }
  return resultado;
}

export interface SeriePorMarca {
  marcaId: string;
  nome: string;
  /**
   * Visibilidade % por dia, alinhado com `datas`. `null` num dia = não teve
   * nenhuma execução (de nenhuma marca) naquele dia — período sem coleta, que
   * quem desenha o gráfico deve tratar como uma lacuna na linha, não como um
   * 0% (0% real é quando teve execução mas nenhuma menção à marca).
   */
  pontos: (number | null)[];
}

/**
 * Visibilidade (%) por dia, para cada marca ativa, no conjunto de execuções dado.
 * `inicio`/`fim` definem o período pedido (ex: os mesmos 7/30/90 dias do filtro
 * de período) — a série cobre TODOS os dias do período, não só os dias que
 * aparecem em `execucoes`, senão um dia sem nenhuma coleta simplesmente
 * desaparecia do eixo (comprimindo o gráfico) em vez de aparecer como buraco.
 */
export function calcularSerieVisibilidadePorMarca(
  marcas: Marca[],
  execucoes: Execucao[],
  mencoes: Mencao[],
  inicio: string,
  fim: string
): { datas: string[]; series: SeriePorMarca[] } {
  const datas = todasAsDatasEntre(inicio, fim);

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
      const pontos = datas.map((d): number | null => {
        const total = totalPorDia.get(d) ?? 0;
        if (total === 0) return null; // sem coleta nesse dia — lacuna, não 0%
        const com = comMencaoPorDia.get(d) ?? 0;
        return (com / total) * 100;
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

export interface OcorrenciaFonte {
  execucaoId: string;
  promptId: string | null;
  promptTexto: string;
  provider: string;
  dataExecucao: string;
}

/**
 * Drill-down de uma linha da tela de Fontes: lista as execuções (prompt,
 * provider e data) em que aquela URL/domínio + tipo apareceu. `chave` e
 * `tipo` são os mesmos de um `ResumoFonte` — precisam bater com a mesma
 * lógica de agrupamento usada em `calcularResumoFontes` (por isso recebe
 * `modo` também), senão o drill-down mistura "consultada" com "citada" na
 * mesma lista.
 */
export function listarOcorrenciasDeFonte(
  chave: string,
  tipo: string | null,
  modo: ModoAgrupamentoFonte,
  execucoes: Execucao[],
  fontes: Fonte[],
  prompts: Prompt[]
): OcorrenciaFonte[] {
  const promptPorId = new Map(prompts.map((p) => [p.id, p]));
  const execucaoPorId = new Map(execucoes.map((e) => [e.id, e]));

  const execucaoIds = new Set<string>();
  for (const f of fontes) {
    const chaveFonte = modo === "url" ? f.url ?? f.dominio ?? "—" : f.dominio ?? "—";
    if (chaveFonte === chave && f.tipo === tipo) execucaoIds.add(f.execucao_id);
  }

  const ocorrencias: OcorrenciaFonte[] = [];
  execucaoIds.forEach((id) => {
    const exec = execucaoPorId.get(id);
    if (!exec) return;
    const prompt = exec.prompt_id ? promptPorId.get(exec.prompt_id) : undefined;
    ocorrencias.push({
      execucaoId: exec.id,
      promptId: exec.prompt_id,
      promptTexto: prompt?.texto ?? "Prompt removido",
      provider: exec.provider,
      dataExecucao: exec.data_execucao,
    });
  });

  return ocorrencias.sort((a, b) => b.dataExecucao.localeCompare(a.dataExecucao));
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

/**
 * `geo_execucao.queries_derivadas` é um jsonb sem formato fixo documentado —
 * já vi chegar como array de strings e como array de objetos com a query num
 * campo (`query`/`texto`/`q`). Normaliza pra uma lista de strings simples pra
 * exibir na tela de Respostas, sem quebrar se o formato mudar de novo.
 */
export function normalizarQueriesDerivadas(valor: unknown): string[] {
  if (!valor) return [];
  let lista: unknown = valor;
  if (typeof valor === "string") {
    try {
      lista = JSON.parse(valor);
    } catch {
      return [valor];
    }
  }
  if (!Array.isArray(lista)) return [];
  return lista
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const texto = obj.query ?? obj.texto ?? obj.q ?? obj.termo;
        if (typeof texto === "string") return texto;
      }
      return null;
    })
    .filter((v): v is string => !!v && v.trim().length > 0);
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
