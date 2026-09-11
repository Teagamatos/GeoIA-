import type { NextRequest } from "next/server";

// Em produção (Railway, e qualquer outro host atrás de proxy/reverse-proxy),
// o Next.js roda dentro de um container que só sabe que está escutando em
// "localhost:<porta interna>" — o domínio público de verdade
// (ex.: geoia.up.railway.app) só existe nos headers X-Forwarded-* que o
// proxy adiciona na requisição. Se a gente confiar em `request.url` puro
// pra montar um redirect, ele monta a URL errada (localhost:8080) em vez
// do domínio público — foi exatamente esse o bug do login em produção.
export function origemPublica(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";

  if (host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}
