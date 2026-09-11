"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function LoginConteudo() {
  const searchParams = useSearchParams();
  const erro = searchParams.get("erro");
  const [carregando, setCarregando] = useState(false);

  async function entrarComGoogle() {
    setCarregando(true);
    const redirect = searchParams.get("redirect") || "/";
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 px-4">
      <div className="w-full max-w-sm rounded-card border border-surface-200 bg-surface-0 p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="font-display text-lg font-semibold text-slate-900 tracking-tight">
            Foursales Company
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Visibilidade em IA</div>
        </div>

        <h1 className="font-display text-base font-semibold text-slate-900 text-center mb-1">
          Entrar no dashboard
        </h1>
        <p className="text-sm text-slate-500 text-center mb-6">
          Acesso restrito aos domínios corporativos da Foursales, EasyHire e SalesJobs.
        </p>

        {erro === "dominio_nao_permitido" && (
          <div className="mb-4 rounded-card border border-signal-rose/40 bg-signal-rose/10 px-4 py-3 text-sm text-signal-rose">
            Esse e-mail não pertence a um domínio autorizado. Entre com uma conta Google
            corporativa da empresa.
          </div>
        )}
        {erro === "falha_login" && (
          <div className="mb-4 rounded-card border border-signal-rose/40 bg-signal-rose/10 px-4 py-3 text-sm text-signal-rose">
            Não foi possível concluir o login. Tente novamente.
          </div>
        )}

        <button
          onClick={entrarComGoogle}
          disabled={carregando}
          className="flex w-full items-center justify-center gap-3 rounded-md border border-surface-200 bg-surface-0 px-4 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:border-slate-300 hover:bg-surface-50 disabled:opacity-60"
        >
          <IconGoogle className="h-4 w-4" />
          {carregando ? "Redirecionando…" : "Entrar com Google"}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginConteudo />
    </Suspense>
  );
}

function IconGoogle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" className={className}>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 009 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 013.68 9c0-.59.1-1.17.27-1.7V4.97H.9A9 9 0 000 9c0 1.45.35 2.83.9 4.03l3.05-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 00.9 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}
