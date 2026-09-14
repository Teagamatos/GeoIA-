import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import { FiltrosGlobaisProvider } from "@/components/FiltrosGlobaisProvider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "The Foursales Company · Visibilidade em IA",
  description: "Monitoramento de visibilidade da marca em respostas de IA (ChatGPT, Claude, Gemini, Perplexity).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${spaceGrotesk.variable} ${inter.variable} font-body bg-surface-50 text-slate-900`}>
        <FiltrosGlobaisProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 min-w-0">{children}</main>
          </div>
        </FiltrosGlobaisProvider>
      </body>
    </html>
  );
}
