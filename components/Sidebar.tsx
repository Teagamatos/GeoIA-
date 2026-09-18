"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconGrid, IconMessage, IconUsers, IconLink, IconFile, IconLogout } from "./icons";
import { supabase } from "@/lib/supabase";
import { getUltimaExecucao, UltimaExecucao } from "@/lib/queries";

const NAV = [
  { href: "/", label: "Dashboard", icon: IconGrid },
  { href: "/prompts", label: "Prompts", icon: IconMessage },
  { href: "/concorrentes", label: "Concorrentes", icon: IconUsers },
  { href: "/fontes", label: "Fontes", icon: IconLink },
  { href: "/respostas", label: "Respostas", icon: IconFile },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [ultimaExecucao, setUltimaExecucao] = useState<UltimaExecucao | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setEmail(sessao?.user?.email ?? null);
    });
    return () => assinatura.subscription.unsubscribe();
  }, []);

  // A Sidebar fica montada o tempo todo (vive no layout raiz, não dentro de
  // cada página) — então isso busca uma vez só e, depois disso, só de novo se
  // o cache do lib/queries expirar (20s) e a pessoa navegar de novo.
  useEffect(() => {
    getUltimaExecucao()
      .then(setUltimaExecucao)
      .catch(() => setUltimaExecucao(null));
  }, []);

  async function sair() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Não mostra a barra na tela de login.
  if (pathname === "/login") return null;

  return (
    <aside className="hidden md:flex sticky top-0 h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-ink-700 bg-ink-950 px-3 py-5">
      <div className="px-3 pb-6">
        <div className="font-display text-lg font-semibold text-paper-100 tracking-tight">
          The Foursales Company
        </div>
        <div className="text-xs text-paper-300 mt-0.5">Visibilidade em IA</div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-ink-700 text-paper-100"
                  : "text-paper-300 hover:bg-ink-800 hover:text-paper-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-3 pt-6">
        {email && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-ink-700 bg-ink-900/60 px-3 py-2">
            <span className="truncate text-xs text-paper-200" title={email}>
              {email}
            </span>
            <button
              onClick={sair}
              title="Sair"
              className="shrink-0 text-paper-300 hover:text-paper-100"
            >
              <IconLogout className="h-4 w-4" />
            </button>
          </div>
        )}
        {ultimaExecucao && (
          <div
            className="mb-3 text-xs text-paper-300/70"
            title="Data/hora em que a automação registrou a execução mais recente"
          >
            Motor atualizado em{" "}
            {new Date(ultimaExecucao.created_at).toLocaleDateString("pt-BR")} às{" "}
            {new Date(ultimaExecucao.created_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
        <div className="text-xs text-paper-300/70 leading-relaxed">
          Foursales · EasyHire · SalesJobs · WorkPass · The Foursales Company
        </div>
      </div>
    </aside>
  );
}
