import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dominioPermitido } from "@/lib/auth";
import { origemPublica } from "@/lib/url";

// Troca o código do OAuth por uma sessão e confere se o e-mail pertence a
// um domínio autorizado. Essa é a checagem client/edge — a defesa
// server-side "de verdade" é o hook `hook_restrict_signup_by_email_domain`
// no Supabase, que impede a criação do usuário antes mesmo de chegar aqui.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = origemPublica(request);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?erro=falha_login`);
  }

  const supabase = criarClienteServidor();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/login?erro=falha_login`);
  }

  const email = data.session.user.email;

  if (!dominioPermitido(email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?erro=dominio_nao_permitido`);
  }

  return NextResponse.redirect(`${origin}${redirect.startsWith("/") ? redirect : "/"}`);
}
