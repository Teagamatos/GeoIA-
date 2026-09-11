"use client";

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly em dev em vez de retornar dados vazios silenciosamente.
  console.warn(
    "Supabase env vars ausentes. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

// Cliente do navegador — guarda a sessão em cookies (não só localStorage),
// pra que o middleware e a rota de callback (server-side) também consigam
// ler quem está logado.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
