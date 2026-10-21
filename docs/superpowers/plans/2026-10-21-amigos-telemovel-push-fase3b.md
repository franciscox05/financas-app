# Amigos por telemóvel e push, Fase 3b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Pedir amizade por número de telemóvel (com confirmação de quem pediu) e notificações push automáticas para pedidos e movimentos partilhados.

**Architecture:** Extensão das funções `security definer` da Fase 3a; triggers em `friend_requests`/`ledger_entries` chamam `notify-user` (Edge Function) via pg_net; cliente ganha número no perfil, formulário de amigo com pedido, confirmação do remetente e foco/navegação ao tocar na notificação.

**Tech Stack:** igual à Fase 3a (Postgres/RLS, React 19, Tailwind 4, `node:test`, Deno Edge Functions, web-push).

**Spec:** `docs/superpowers/specs/2026-10-21-amigos-telemovel-push-design.md` (aprovado pelo utilizador, opção A).

## Global Constraints

- Copy em português europeu simples. Nunca revelar se um número tem conta. Notificações sem valores.
- Funções `security definer`, `set search_path = public`, `auth.uid()` verificado; só contas com email confirmado veem/aceitam pedidos (como na 3a).
- Os triggers de push têm `exception when others then null`: nunca bloqueiam a operação.
- **Tarefas SQL (1-2) são escritas pela sessão principal** (os subagentes herdam o bloqueio do modo automático sobre `supabase/`). Testar com `bash <scratchpad>/localdb/reset-db.sh` + testes em `docker exec financas-pg psql`; os testes de push criam um stub de `net.http_post`.
- Nada é aplicado ao Supabase real, publicado ou fundido na `main` sem autorização explícita. Migrations reais só com `apply_migration`, uma a uma; função nova publicada depois das migrations.

## Review Focus

1. Um número sem conta e um número com conta dão a mesma resposta ao remetente. Teste na Task 1.
2. Alguém que não é o dono do número (conta com o número no perfil, mas pessoa errada) não fica ligado sem a confirmação do remetente; recusar devolve o pedido a `pending` e a pessoa certa ainda o pode aceitar. Teste na Task 1.
3. Cada evento de push chega só ao utilizador certo, sem valores, e uma falha de `net.http_post` não impede a operação. Teste na Task 2.
4. Dois contactos com o mesmo número, números mal formatados (`912 345 678`, `+351 912345678`, `00351912345678`) e número vazio. Teste na Task 1 e testes JS na Task 3.

---

### Task 1: Pedidos por número (SQL)

**Files:**
- Create: `supabase/migrations/20261023000000_phone_requests.sql`, `supabase/tests/phone_requests.sql`

**Interfaces:**
- Consumes: Fase 3a (`friend_requests`, `friends`, `profiles`, `respond_friend_request`, `list_incoming_requests`, `cancel_friend_request`).
- Produces: `normalize_phone(text) returns text`; `profiles.phone`; colunas e estado novos em `friend_requests`; `send_friend_request_phone(p_friend_id uuid) returns void`; `respond_friend_request(p_id uuid, p_accept boolean)` (por número: aceitar → `awaiting_confirmation`, recusar → esconde); `confirm_friend_request(p_id uuid, p_confirm boolean) returns void`; `get_request_accepter(p_id uuid) returns table(name text, email_hint text)`; `list_incoming_requests() returns table(id uuid, from_name text, created_at timestamptz, via text, awaiting boolean)`; helper `_link_friends(p_req uuid, p_recipient uuid)`.

- [ ] **Step 1: testes primeiro** (`phone_requests.sql`, utilizadores A/B/C/D com emails confirmados e `profiles.phone`): `normalize_phone` com os formatos reais e lixo; pedido por número a um contacto com `phone`; o pedido a número sem conta e a número com conta não se distinguem para o remetente; D (mesmo número que B, pessoa errada) aceita primeiro → `awaiting_confirmation`, sem ligação; A vê o nome de D em `get_request_accepter`, recusa → volta a `pending`, D deixa de o ver, B vê e aceita, A confirma → ligados; só o remetente confirma; recusar por número esconde só a quem recusa; cancelar em `awaiting_confirmation`; um pedido ativo por contacto; o fluxo por email da 3a continua a ligar logo.
- [ ] **Step 2:** FALHA. **Step 3:** migration. **Step 4:** passa (mais todos os testes SQL anteriores); commit `feat(db): pedidos de amizade por telemóvel`.

### Task 2: Notificações push (SQL + função)

**Files:**
- Create: `supabase/migrations/20261023010000_push_events.sql`, `supabase/tests/push_events.sql`, `supabase/functions/notify-user/index.ts`

**Interfaces:**
- Produces: `public._push(p_user uuid, p_title text, p_body text, p_url text) returns void` (chama `net.http_post` para `/functions/v1/notify-user` com os headers do vault, como nos cron existentes; engole erros); triggers `friend_requests_push` e `ledger_entries_push`; Edge Function `notify-user` (body `{user_id,title,body,url}`, protegida por `x-cron-secret`, envia às `push_subscriptions` do utilizador e remove 404/410).
- Eventos: pedido novo → quem o pode ver (email confirmado igual, ou perfil com o número); `awaiting_confirmation` → remetente; ligação feita → a outra parte; movimento `pending` criado → destinatário; `confirmed`/`declined` → criador; `cancel_requested` → o outro; anulação aceite/recusada → quem pediu. Urls: `/dividas` ou `/dividas/<friend_id>`. Corpos sem valores.

- [ ] **Step 1: testes** com stub `net.http_post` (tabela de log) e vault stub: cada evento gera exatamente a chamada esperada (destinatário, texto, url, sem números); eventos sem destinatário não geram chamadas; `net.http_post` a lançar erro não faz falhar `create_shared_entry`/`send_friend_request`.
- [ ] **Step 2-4:** FALHA → implementar → passa → commit `feat(db): notificações push de amigos`. Escrever `notify-user/index.ts` seguindo `send-overdue-debts/index.ts`.

### Task 3: Lógica e dados do cliente

**Files:**
- Modify: `src/lib/linkedDb.js`, `src/lib/friendsDb.js`, `src/lib/friendsLogic.js` (+ testes em `src/lib/`)

**Interfaces:**
- Produces: `getMyPhone()/saveMyPhone(raw)` (coluna `profiles.phone`, normalizada: 9 dígitos locais, sem indicativo 351); `sendFriendRequestByPhone(friendId)`; `confirmFriendRequest(id, confirm)`; `getRequestAccepter(id)` -> `{name, emailHint}`; `listIncomingRequests()` passa a devolver `via` e `awaiting`; `createFriend` aceita `{name, phone, requestLink}` e, se `requestLink` e telefone válido, envia o pedido logo (sem revelar se o número tem conta); `phoneForProfile(raw)` testado com os formatos reais.

- [ ] **Step 1:** testes JS primeiro (normalização igual à do SQL: `912 345 678`, `+351 912345678`, `00351912345678`, vazio, lixo). **Step 2-4:** implementar; `npm test`, `npx oxlint`, `npm run build`; commit `feat: dados do cliente para amigos por telemóvel`.

### Task 4: Ecrãs

**Files:**
- Create: `src/components/MyPhoneSection.jsx`
- Modify: `src/pages/Manage.jsx`, `src/pages/Friends.jsx` (formulário "+ Adicionar amigo" com a opção de pedir ligação), `src/components/FriendRequestPanel.jsx` (pedido por número, confirmação "É mesmo ele?", "ligar por email"), `src/components/IncomingRequests.jsx` (pedidos por número e "À espera que <nome> confirme"), `src/sw.js` (ao tocar numa notificação, focar uma janela aberta e navegar; senão abrir)

- [ ] **Step 1-3:** implementar conforme "Ecrãs" da spec, mesmos padrões e regras de UI da Fase 3a (sem actualizações em componentes desmontados, botões desativados enquanto gravam, mensagens do servidor mostradas tal e qual). `npm test`, `npx oxlint`, `npm run build`; commit `feat: amigos por telemóvel no ecrã`.

### Task 5: Revisão final e entrega

- [ ] **Step 1:** revisão de ramo inteiro (modelo mais capaz) focada no contrato cliente/SQL, segurança do pedido por número e dos triggers de push, UX; corrigir o que for Crítico/Importante.
- [ ] **Step 2:** README (secções "Número no perfil" e "Notificações"), registo na memória; **parar** e pedir autorização para aplicar as migrations, publicar `notify-user` (e confirmar que os segredos `anon_key`/`cron_secret` do vault e `VAPID_*` existem) e fundir.
