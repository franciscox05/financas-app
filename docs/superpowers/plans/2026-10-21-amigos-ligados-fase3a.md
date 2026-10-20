# Amigos ligados, Fase 3a (pedido de amizade e movimentos partilhados) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir enviar um pedido de amizade (por email de login) a um contacto, aceitar/recusar na app do outro, e partilhar movimentos entre dois utilizadores ligados com confirmação, contestação e anulação mútua.

**Architecture:** Toda a escrita entre utilizadores passa por funções Postgres `security definer` (nunca por escrita direta do cliente); um trigger impede o cliente de editar/apagar/inserir movimentos de amigos ligados fora dessas funções. O saldo (`friend_balances`) passa a contar só movimentos que contam (`confirmed` e `cancel_requested`). O cliente ganha uma camada de dados (`linkedDb.js`), lógica pura testada em `src/lib/linkedLogic.js` e ecrãs novos dentro de `Friends.jsx`/`FriendLedger.jsx`.

**Tech Stack:** igual à Fase 1 (React 19, Tailwind 4, Supabase/Postgres com RLS, `node:test`, oxlint). Testes SQL em `supabase/tests/` contra o Postgres descartável em Docker.

**Spec:** `docs/superpowers/specs/2026-10-21-amigos-ligados-design.md` (inclui "Decisões do construtor"; a anulação mútua foi decidida pelo utilizador). Fase 1: `2026-10-20-amigos-conta-corrente-design.md`. Push é a Fase 3b (fora deste plano).

## Global Constraints

- Copy em português europeu simples; nunca "espelho", "contraparte", "liquidar", "acerto". Textos: "Pedir amizade", "Pedido enviado a <email>", "Pedidos de amizade", "Aceitar", "Recusar", "À espera que <nome> confirme", "Está certo?", "Contestar", "Pedir anulação", "Saldo anterior". Resposta ao enviar pedido: a mesma exista ou não conta com o email.
- Estados de `ledger_entries.status`: `confirmed | pending | declined | cancelled | archived | cancel_requested`. Contam no saldo só `confirmed` e `cancel_requested`. `friends.status`: `local | invited | connected` (`invited` = pedido pendente enviado).
- Funções `security definer` com `set search_path = public`, verificam `auth.uid() is not null` e que o chamador é parte do registo; nunca confiam em ids do cliente sem verificar a posse.
- Cliente nunca escreve diretamente em `friend_requests`; nem altera/apaga/insere `ledger_entries` com `mirror_id` ou de amigo `connected` (trigger). Quem recebe não altera valor, tipo nem data.
- Transação bancária de cada lado só é criada quando o movimento passa a `confirmed`; contestar/anular remove só a própria. Só `bank` cria transação (como na Fase 1).
- Pedidos só listados/aceites com `email_confirmed_at` não nulo; `to_email` em minúsculas sem espaços; não se pode enviar ao próprio email.
- Migrations só se aplicam ao Supabase real após confirmação explícita do utilizador, uma a uma com `apply_migration`; nunca `supabase db push` (a migration `20261017010000` não está registada no projeto real). Merge só após confirmação.
- **Tarefas SQL (1-3) são escritas pela sessão principal, não por subagente** (os subagentes herdam o bloqueio do modo automático sobre `supabase/`). Testar sempre com `bash <scratchpad>/localdb/reset-db.sh` + o ficheiro de teste em `docker exec financas-pg psql`.
- Mobile first, `<Money>`/`eur()`, transições 120-250 ms, `motion-reduce` respeitado.

## Review Focus

1. Utilizador B tenta alterar valor/tipo/data, apagar ou aceitar um movimento que não é seu: tudo falha. Teste em Task 2.
2. Pedido a email inexistente e a email existente dão exatamente a mesma resposta; pedido a si próprio recusado. Teste em Task 1.
3. Movimento pendente nunca entra no saldo nem gera transação; ao confirmar gera a transação de cada lado; ao anular remove-as. Teste em Task 2.
4. Saldo anterior: depois de aceite o saldo não duplica; contestado, o saldo antigo volta. Teste em Task 3.
5. Recusa de anulação deixa tudo como estava; duplo clique em Aceitar/Contestar não duplica efeitos. Testes em Tasks 1-2.

---

### Task 1: Pedidos de amizade (SQL)

**Files:**
- Create: `supabase/migrations/20261022000000_friend_requests.sql`
- Create: `supabase/tests/friend_requests.sql`

**Interfaces:**
- Consumes: `friends` (Fase 1: `unique (owner_id, linked_user_id)` parcial; `unique (id, owner_id)`), `profiles.full_name`, `auth.users.email/email_confirmed_at`.
- Produces: tabela `friend_requests(id, from_user_id, friend_id, to_email, status 'pending|accepted|declined|cancelled', created_at, responded_at)` com índice único parcial de um `pending` por `friend_id`; funções `send_friend_request(p_friend_id uuid, p_email text) returns void`, `cancel_friend_request(p_id uuid) returns void`, `respond_friend_request(p_id uuid, p_accept boolean) returns void`, `list_incoming_requests() returns table(id uuid, from_name text, created_at timestamptz)`; RLS: remetente lê os seus, sem escrita direta; `friends.status` passa a `invited` ao enviar e volta a `local` ao recusar/cancelar.

- [ ] **Step 1: testes primeiro** (`friend_requests.sql`, dois utilizadores com `set_config('request.jwt.claims', …)` incluindo `email`, mais `auth.users.email`/`email_confirmed_at`): (a) enviar a si próprio falha; (b) enviar para email com conta e para email sem conta devolvem sem erro e criam um `pending` cada; (c) segundo `pending` para o mesmo contacto falha com mensagem simples; (d) o destinatário com email confirmado vê o pedido em `list_incoming_requests()`, outro utilizador não; (e) destinatário com `email_confirmed_at null` não o vê nem aceita; (f) aceitar liga os dois contactos (`connected`, `linked_user_id` cruzados, nome do novo contacto = `full_name` do remetente ou o email) e é idempotente (segundo aceitar não duplica nem falha); (g) aceitar quando o contacto já está ligado devolve o erro `Já estão ligados.`; (h) recusar volta o contacto do remetente a `local`; cancelar só pelo remetente.
- [ ] **Step 2:** correr, esperado FALHA (migration inexistente).
- [ ] **Step 3: migration** conforme "Modelo de dados" da spec e Global Constraints; `list_incoming_requests` compara `to_email` com `lower(auth.jwt() ->> 'email')` e exige `email_confirmed_at is not null` em `auth.users`.
- [ ] **Step 4:** testes passam; commit `feat(db): pedidos de amizade`. **Não aplicar ao projeto real.**

### Task 2: Movimentos partilhados (SQL)

**Files:**
- Create: `supabase/migrations/20261022010000_shared_entries.sql`
- Create: `supabase/tests/shared_entries.sql`

**Interfaces:**
- Consumes: Task 1 (amigos `connected`), `ledger_entries`, `transactions`, `accounts`, `categories`.
- Produces: colunas `ledger_entries.status text not null default 'confirmed'` (check dos seis estados), `mirror_id uuid references ledger_entries(id) on delete set null`, `decline_note text`, `cancel_requested_by uuid`, `bank_account_id uuid`, `bank_category_id uuid` (escolha adiada para criar a transação ao confirmar); `friend_balances` recriada a somar só `confirmed`/`cancel_requested`; trigger `ledger_entries_guard` (antes de insert/update/delete: rejeita se o contacto é `connected` ou a linha tem `mirror_id`, exceto dentro das funções via `set_config('app.ledger_fn','on',true)`); funções `create_shared_entry(p_friend_id uuid, p_kind text, p_amount numeric, p_note text, p_occurred_on date, p_due_on date, p_settlement text, p_account_id uuid, p_category_id uuid) returns uuid`, `respond_entry(p_id uuid, p_accept boolean, p_note text, p_settlement text, p_account_id uuid, p_category_id uuid) returns void`, `cancel_pending_entry(p_id uuid) returns void`, `request_cancel(p_id uuid) returns void`, `respond_cancel(p_id uuid, p_accept boolean) returns void`, `list_pending_for_me() returns setof ledger_entries`.

- [ ] **Step 1: testes primeiro**: (a) `create_shared_entry` cria duas linhas `pending` com `kind` invertido, `mirror_id` cruzado e nenhuma transação; saldo dos dois inalterado; (b) B não consegue `update`/`delete` direto, nem insert direto num contacto `connected`; (c) `respond_entry(accept)` põe as duas `confirmed`, saldo muda nos dois e, para `bank`, cria a transação de cada lado (quem criou com a sua conta guardada; quem aceitou com a que indicou; `income`/`expense` corretos); (d) contestar: a do criador `declined` com a nota, a outra `cancelled`, saldo inalterado; (e) só o destinatário responde, só uma vez (segunda resposta falha ou é no-op sem efeitos duplicados); (f) `cancel_pending_entry` só pelo criador e só em `pending`; (g) `request_cancel` só em `confirmed`, marca `cancel_requested` nos dois; `respond_cancel(true)` põe `cancelled` e remove as transações próprias; `respond_cancel(false)` volta a `confirmed`; quem pediu não responde; (h) valor/tipo/data do espelho nunca mudam pela resposta.
- [ ] **Step 2:** FALHA. **Step 3:** migration (usar `for update` nas linhas para evitar corridas). **Step 4:** passa; commit `feat(db): movimentos partilhados com confirmação`.

### Task 3: Saldo anterior (SQL)

**Files:**
- Create: `supabase/migrations/20261022020000_opening_balance.sql`
- Create: `supabase/tests/opening_balance.sql`

**Interfaces:**
- Consumes: Task 2.
- Produces: `share_opening_balance(p_friend_id uuid) returns uuid` e extensão de `respond_entry` para entradas marcadas como saldo anterior (coluna `ledger_entries.is_opening boolean not null default false`).

- [ ] **Step 1: testes**: saldo local +10 → ao partilhar, as entradas antigas `confirmed` do contacto passam a `archived`, nasce uma entrada `is_opening` (`paid_for_them` 10, pendente nos dois lados) e o saldo do remetente fica 0 até aceitarem; aceite → +10 nos dois sentidos (−10 do lado dele), sem duplicar; contestado → as antigas voltam a `confirmed` (+10) e a entrada fica `declined`; saldo zero → função falha com mensagem simples; só com contacto `connected`; só uma vez pendente de cada vez.
- [ ] **Step 2:** FALHA. **Step 3:** migration. **Step 4:** passa; commit `feat(db): saldo anterior entre amigos ligados`.

### Task 4: Lógica pura do cliente

**Files:**
- Create: `src/lib/linkedLogic.js`, `src/lib/linkedLogic.test.js`
- Modify: `src/lib/ledgerMath.js` (`balanceOf` ignora estados que não contam)

**Interfaces:**
- Produces: `COUNTING_STATUSES = ['confirmed','cancel_requested']`; `entryStatusLabel(entry, viewerId): { text, tone }` (ex.: "À espera que ele confirme", "Pendente de confirmação", "Contestado: <nota>", "Anulação pedida", "Anulado", "Arquivado"); `canRespond(entry, viewerId): boolean`; `canRequestCancel(entry): boolean`; `friendStateLabel(friend, request): string` (Local, Pedido enviado, Recusado, Ligado); `normalizeEmail(raw): string|null` (minúsculas, sem espaços, valida formato simples).

- [ ] **Step 1:** testes (nomes e asserts): `balanceOf` com `[confirmed +10, pending +5, archived +3, cancel_requested -2]` → 800 cêntimos; `normalizeEmail(' Ana@Mail.COM ')` → `'ana@mail.com'`, `'sem-arroba'` → `null`; `canRespond` só para o destinatário de uma linha `pending` com `mirror_id`; `canRequestCancel` só em `confirmed` com `mirror_id`; rótulos exatos acima.
- [ ] **Step 2-4:** FALHA → implementar → `npm test` passa; commit `feat: lógica de amigos ligados`.

### Task 5: Camada de dados

**Files:**
- Create: `src/lib/linkedDb.js`
- Modify: `src/lib/friendsDb.js` (`listEntries` devolve `status`, `mirror_id`, `decline_note`, `cancel_requested_by`, `is_opening`; `listFriendsWithBalance` devolve `status`, `linked_user_id`)

**Interfaces:**
- Produces (todas via `supabase.rpc`, erros em português simples): `sendFriendRequest({ friendId, email })`, `cancelFriendRequest(id)`, `respondFriendRequest(id, accept)`, `listIncomingRequests()`, `getOutgoingRequest(friendId)`, `createSharedEntry({...})`, `respondEntry({ id, accept, note, settlement, accountId, categoryId })`, `cancelPendingEntry(id)`, `requestCancel(id)`, `respondCancel(id, accept)`, `listPendingForMe()`, `shareOpeningBalance(friendId)`.

- [ ] **Step 1:** implementar (sem testes de rede; verificação pelos ecrãs). Mapear mensagens do Postgres para as frases do Global Constraints. `npm run lint` e `npm test` sem erros. Commit `feat: camada de dados de amigos ligados`.

### Task 6: Pedir amizade e receber pedidos (UI)

**Files:**
- Modify: `src/pages/Friends.jsx`, `src/pages/FriendLedger.jsx`
- Create: `src/components/FriendRequestPanel.jsx`, `src/components/IncomingRequests.jsx`

**Interfaces:**
- Consumes: `linkedDb` (Task 5), `normalizeEmail`, `friendStateLabel`.
- Produces: em `FriendLedger` de um contacto `local`: botão "Pedir amizade" → campo de email → "Pedido enviado a <email>" (Cancelar); `invited`: estado + Cancelar; recusado: "Recusado" + Reenviar; `connected`: selo "Ligado". Em `Friends`: faixa "Pedidos de amizade (N)" com "<nome> quer ligar contas" e Aceitar/Recusar; contador no item Amigos do `BottomNav`.

- [ ] **Step 1:** implementar seguindo o estilo de `Friends.jsx`/`ReminderButtons.jsx`; estados de carregamento/erro/vazio; botões desativados enquanto gravam (evita duplo clique).
- [ ] **Step 2:** `npm run build` e `npm run lint` sem erros; verificação manual contra o Supabase de teste (ver Task 9). Commit `feat: pedido de amizade e pedidos recebidos`.

### Task 7: Movimentos partilhados no ecrã

**Files:**
- Modify: `src/components/NewExpenseSheet.jsx`, `src/components/RepaymentSheet.jsx`, `src/components/LedgerEntryRow.jsx`, `src/pages/FriendLedger.jsx`
- Create: `src/components/PendingEntryActions.jsx`

**Interfaces:**
- Consumes: Task 5 e 4.
- Produces: com contacto `connected`, "Novo gasto" e devolução chamam `createSharedEntry` (devolução `bank` guarda conta/categoria sem criar transação); linhas mostram `entryStatusLabel`; ações por linha: destinatário de `pending` → "Está certo? [Aceitar] [Contestar]" (Contestar pede nota opcional; Aceitar de uma devolução pergunta "Como foi pago?"); criador de `pending` → "Cancelar"; `confirmed` → "Pedir anulação"; `cancel_requested` pelo outro → "<nome> quer anular este movimento [Aceitar] [Recusar]". Apagar direto desaparece para contactos ligados.

- [ ] **Step 1:** implementar; `friend.status === 'local'` mantém exatamente o comportamento da Fase 1.
- [ ] **Step 2:** build/lint/test sem erros. Commit `feat: movimentos partilhados com confirmação no ecrã`.

### Task 8: Saldo anterior no ecrã

**Files:**
- Modify: `src/pages/FriendLedger.jsx`
- Create: `src/components/OpeningBalanceOffer.jsx`

**Interfaces:**
- Consumes: `shareOpeningBalance`, `hasOpenBalance`.
- Produces: num contacto `connected` com saldo não zero e sem "Saldo anterior" feito: cartão "Partilhar a conta que já tinham? Ele vai ter de aceitar." → botão "Partilhar saldo anterior" (confirmação com o valor); depois mostra "À espera que <nome> confirme".

- [ ] **Step 1-2:** implementar; build/lint sem erros; commit `feat: oferta de saldo anterior`.

### Task 9: Verificação final e entrega

**Files:**
- Modify: `README.md` (acrescentar "Amigos ligados": pedido por email, confirmação, anulação mútua, 3b = push)

- [ ] **Step 1:** `npm test`, `npm run lint`, `npm run build` sem erros; os três ficheiros SQL novos passam sobre `reset-db.sh` limpo.
- [ ] **Step 2:** parar e pedir ao utilizador autorização para (a) aplicar as três migrations ao projeto real, uma a uma, (b) fundir o ramo. Percurso real com duas contas (Tiago e Francisco): pedir amizade → aceitar → gasto → aceitar → devolução em dinheiro → pedir anulação → aceitar → saldo anterior. Aplicar as migrations **antes** do deploy do frontend.
- [ ] **Step 3:** commit `docs: readme de amigos ligados`.
