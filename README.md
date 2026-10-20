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

## Amigos e conta-corrente

A aba **Amigos** (`/dividas`) guarda uma conta-corrente por pessoa: "paguei por ele", "ele pagou por mim" e devoluções (banco, dinheiro ou desconto). O saldo é sempre calculado (view `friend_balances`), nunca guardado. Só as devoluções por banco criam uma transação. Spec e plano em `docs/superpowers/`.

- Migrations: `20261021000000_friends_ledger.sql` (tabelas e saldo) e `20261021010000_migrate_debts_to_ledger.sql` (copia as dívidas antigas; `debts` fica intacta). Aplicar **antes** do deploy do frontend.
- Função `send-overdue-debts`: lê o novo modelo (data limite passada e saldo ainda a favor).
- Testes: `npm test` (lógica em `src/lib/`). SQL em `supabase/tests/`, a correr numa base de dados descartável (ver cabeçalho de cada ficheiro).

## Fluxo de trabalho e deploy

1. Criar uma branch a partir da `main`, fazer as alterações e abrir um Pull Request.
2. Fazer merge do PR com "Create a merge commit". A Vercel faz o deploy da `main` automaticamente.
3. Migrações SQL novas (`supabase/migrations/`) têm de ser aplicadas ao projeto Supabase **antes** de fazer o deploy do código que as usa.
4. Na PWA instalada, fechar e abrir a app duas vezes para carregar a versão nova.

## Estado

Ver plano completo e progresso documentado em `CerebroPessoal/Projects/FinancasApp.md` (Obsidian, fora deste repo).
