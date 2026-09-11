# Foursales Company · Visibilidade em IA

Dashboard interno que lê direto do Supabase (projeto **Vendas e Marketing**, tabelas `geo_*`)
pra acompanhar como as marcas da holding (Foursales, EasyHire, SalesJobs) aparecem nas respostas
de ChatGPT, Claude, Gemini e Perplexity, e como isso se compara aos concorrentes.

## Páginas

- **Dashboard** (`/`) — visibilidade, presença de fontes, ranking de marcas e detalhamento por modelo. Tem seletor de marca (Foursales / EasyHire / SalesJobs) e de período (7/30/90 dias).
- **Prompts** (`/prompts`) — CRUD das perguntas que a automação testa diariamente.
- **Concorrentes** (`/concorrentes`) — CRUD de todas as marcas monitoradas (própria + concorrentes), incluindo aliases.
- **Fontes** (`/fontes`) — os links que a IA retornou nas buscas web.
- **Respostas** (`/respostas`) — o texto bruto de cada execução (prompt × provider × dia).

## Login

O acesso é feito com login do Google, restrito aos domínios corporativos
`foursales-company.com`, `foursales.com.br`, `easyhire.com.br` e
`salesjobs.com.br`. Quem tentar entrar com um e-mail fora desses domínios
é barrado tanto no front-end quanto no servidor (hook
`hook_restrict_signup_by_email_domain` no Supabase, que impede a própria
criação do usuário).

Pra isso funcionar é preciso configurar duas coisas manualmente (uma vez só):

1. **Google Cloud Console** — criar um OAuth 2.0 Client ID (Web application)
   com o redirect URI `https://oxfluxwgbwgfcimwiwuy.supabase.co/auth/v1/callback`.
2. **Supabase Dashboard** — colar o Client ID/Secret em
   Authentication → Providers → Google, adicionar `http://localhost:3000` e a
   URL de produção em Authentication → URL Configuration, e ativar o hook
   `hook_restrict_signup_by_email_domain` em Authentication → Hooks →
   Before User Created.

## Rodando localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:3000`. As variáveis de ambiente já estão em `.env.local`
(URL do projeto Supabase + chave `publishable`, que é segura de expor no frontend).

## Deploy no Railway

1. Suba esse projeto pra um repositório no GitHub.
2. No Railway: **New Project → Deploy from GitHub repo**.
3. Railway detecta automaticamente que é um projeto Next.js (via Nixpacks) e usa os scripts
   `build`/`start` do `package.json`.
4. Em **Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://oxfluxwgbwgfcimwiwuy.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (a chave publishable, veja `.env.local`)
5. Deploy. O Railway injeta a variável `PORT` automaticamente — o `npm start` já está
   configurado pra usar ela (`next start -p $PORT`).

## O que já está pronto no banco

- As 7 tabelas `geo_*` têm RLS habilitado com policy de **leitura pública** (SELECT) —
  necessário pra esse site funcionar com a chave `anon`/`publishable`.
- `geo_prompt` e `geo_marca` (+ `geo_marca_alias`) também têm policies de **escrita pública**
  (INSERT/UPDATE/DELETE), pra alimentar o CRUD das páginas Prompts e Concorrentes.
- `geo_execucao`, `geo_fonte`, `geo_mencao` e `geo_dominio_proprio` continuam **só leitura**
  pelo site — quem escreve nelas é a automação (n8n, com a `service_role` key).
- `geo_marca`: Foursales, EasyHire e SalesJobs marcadas como `propria` (holding). Nenhum
  concorrente cadastrado ainda — a ideia é a automação diária (ou você, pela página
  Concorrentes) ir populando isso.

## Pontos de atenção

- **Login com Google habilitado**, restrito por domínio de e-mail (veja seção
  "Login" acima). Falta rodar `migration_geo_rls_authenticated.sql` pra trocar
  as policies das tabelas `geo_*` de público (`to public`) pra exigir sessão
  (`to authenticated`) — só depois de confirmar que o login está funcionando
  ponta a ponta, pra não travar o próprio acesso antes da hora.
- **`geo_dominio_proprio` está vazia** — o card "Presença de fontes" sempre vai mostrar 0%
  até cadastrar os domínios próprios (foursales.com.br, etc.) nessa tabela.
- **Segurança do projeto Supabase, fora do escopo desse site:** o projeto "Vendas e Marketing"
  tem **15 outras tabelas com RLS desabilitado** (`wix_leads`, `sympla_leads`, `companies`,
  `apollo_phones`, etc.) — dados de leads/vendas hoje totalmente expostos pra chave `anon`.
  Isso é independente desse projeto (essas tabelas não são usadas aqui), mas vale corrigir
  antes de publicar qualquer chave desse projeto Supabase em outro lugar público.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind CSS + `@supabase/supabase-js`, sem backend
próprio — o frontend fala direto com o Supabase.
