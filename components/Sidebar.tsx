"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconGrid, IconMessage, IconUsers, IconLink, IconFile, IconLogout } from "./icons";
import { supabase } from "@/lib/supabase";

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setEmail(sessao?.user?.email ?? null);
    });
    return () => assinatura.subscription.unsubscribe();
  }, []);

  async function sair() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Não mostra a barra na tela de login.
  if (pathname === "/login") return null;

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-ink-700 bg-ink-950 px-3 py-5">
      <div className="px-3 pb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="The Foursales Company"
          className="mb-2 h-7 w-auto"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
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
        <div className="text-xs text-paper-300/70 leading-relaxed">
          Foursales · EasyHire · SalesJobs · WorkPass
        </div>
      </div>
    </aside>
  );
}
