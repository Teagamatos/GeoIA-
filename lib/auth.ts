// Domínios de e-mail com permissão de acesso ao dashboard.
// Mantido em sincronia com a função `hook_restrict_signup_by_email_domain`
// no Supabase (Authentication → Hooks → Before User Created) — essa é a
// segunda camada de checagem, que roda no servidor mesmo que alguém
// consiga contornar a checagem feita aqui no cliente.
export const DOMINIOS_PERMITIDOS = [
  "foursales-company.com",
  "foursales.com.br",
  "easyhire.com.br",
  "salesjobs.com.br",
];

export function dominioPermitido(email: string | null | undefined): boolean {
  if (!email) return false;
  const dominio = email.split("@")[1]?.toLowerCase().trim();
  if (!dominio) return false;
  return DOMINIOS_PERMITIDOS.includes(dominio);
}
