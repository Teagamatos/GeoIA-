import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { dominioPermitido } from "@/lib/auth";
import { origemPublica } from "@/lib/url";

// Rotas que não exigem login.
const ROTAS_PUBLICAS = ["/login", "/auth/callback"];

// request.nextUrl.clone() herda o host que o Next enxergou na requisição —
// que atrás do proxy do Railway é o endereço interno (localhost:<porta>),
// não o domínio público. Por isso todo redirect daqui reconstrói a URL a
// partir da origem pública de verdade (via X-Forwarded-Host/Proto).
function construirRedirect(request: NextRequest, pathname: string, params?: Record<string, string>) {
  const destino = new URL(pathname, origemPublica(request));
  if (params) {
    for (const [chave, valor] of Object.entries(params)) {
      destino.searchParams.set(chave, valor);
    }
  }
  return destino;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // getUser() revalida o token direto com o Supabase (mais seguro que só
  // ler a sessão do cookie) e também renova o cookie se estiver perto de expirar.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rotaPublica = ROTAS_PUBLICAS.some((rota) => request.nextUrl.pathname.startsWith(rota));

  if (!user && !rotaPublica) {
    return NextResponse.redirect(
      construirRedirect(request, "/login", { redirect: request.nextUrl.pathname })
    );
  }

  // Segunda camada: se por algum motivo existe uma sessão válida mas de um
  // e-mail fora dos domínios permitidos (ex.: sessão antiga de antes dessa
  // regra existir), derruba e manda pro login com um aviso.
  if (user && !dominioPermitido(user.email) && !rotaPublica) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      construirRedirect(request, "/login", { erro: "dominio_nao_permitido" })
    );
  }

  if (user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(construirRedirect(request, "/"));
  }

  return response;
}

export const config = {
  matcher: [
    // Roda em tudo, exceto assets estáticos do Next e arquivos públicos.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
