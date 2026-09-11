export type TipoMarca = "propria" | "concorrente";

export interface Marca {
  id: string;
  nome: string;
  tipo: TipoMarca | null;
  ativo: boolean;
  created_at: string;
}

export interface MarcaAlias {
  id: string;
  marca_id: string;
  alias: string;
  created_at: string;
}

export interface DominioProprio {
  id: string;
  marca_id: string;
  dominio: string;
  created_at: string;
}

export interface Prompt {
  id: string;
  texto: string;
  categoria: string | null;
  persona: string | null;
  pais: string | null;
  cidade: string | null;
  ativo: boolean;
  created_at: string;
}

export type Provider = "openai" | "anthropic" | "gemini" | "perplexity";

export interface Execucao {
  id: string;
  prompt_id: string | null;
  provider: string;
  modelo: string;
  regiao: string | null;
  data_execucao: string;
  texto_resposta: string | null;
  queries_derivadas: unknown;
  buscou_web: boolean | null;
  qtd_buscas: number | null;
  tokens_entrada: number | null;
  tokens_saida: number | null;
  payload_bruto: unknown;
  status: string | null;
  created_at: string;
}

export interface Fonte {
  id: string;
  execucao_id: string;
  url: string | null;
  dominio: string | null;
  titulo: string | null;
  tipo: string | null;
  /**
   * Marca específica que essa fonte cita, quando há evidência textual direta
   * (domínio próprio da marca, ou o título/URL da própria citação nomeia a
   * marca). Null quando não há essa evidência — nesse caso a fonte é "geral"
   * da resposta, não atribuída a uma marca específica.
   */
  marca_id: string | null;
  created_at: string;
}

export interface Mencao {
  id: string;
  execucao_id: string;
  marca_id: string;
  posicao_no_texto: number | null;
  ordem: number | null;
  created_at: string;
}

export const PROVIDER_LABELS: Record<string, string> = {
  openai: "ChatGPT",
  anthropic: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
};
