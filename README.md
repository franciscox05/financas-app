# FinancasApp

PWA pessoal/multi-utilizador para registo de gastos e ganhos diários, balanço mensal e acompanhamento de património (conta à ordem + investimentos).

## Stack

- React 19 + Vite 8 + Tailwind CSS v4
- Supabase (Postgres + Auth + RLS)
- `vite-plugin-pwa` — instalável no iPhone via Safari ("Partilhar" → "Adicionar ao Ecrã Principal")
- Deploy: Vercel

## Setup local

```bash
npm install
cp .env.example .env.local   # preencher com URL/anon key do projeto Supabase
npm run dev
```

## Base de dados

Schema em `supabase/migrations/`. Para aplicar a um projeto Supabase novo:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

## Estado

Ver plano completo e progresso documentado em `CerebroPessoal/Projects/FinancasApp.md` (Obsidian, fora deste repo).
