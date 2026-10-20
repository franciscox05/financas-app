# Amigos e conta-corrente, Fase 1 (contactos locais) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a página Dívidas por uma lista de amigos com conta-corrente e saldo líquido, só com contactos locais (sem ligação entre utilizadores), mantendo o histórico e as transações atuais.

**Architecture:** Duas tabelas novas (`friends`, `ledger_entries`) e uma view `friend_balances` calculam o saldo; a lógica de saldo/textos/telefone vive em módulos puros testados com `node --test`; a camada de dados é um ficheiro novo (`friendsDb.js`) ao lado de `db.js`; duas páginas novas substituem `/dividas`. As dívidas antigas migram por SQL e a função diária de atraso passa a ler o modelo novo.

**Tech Stack:** React 19 + react-router 7, Tailwind 4, Supabase (Postgres + RLS + Edge Functions), `node:test` para a lógica pura (sem dependências novas), oxlint.

**Spec:** `docs/superpowers/specs/2026-10-20-amigos-conta-corrente-design.md`. Esta fase cobre os objetivos 1-7 e 10 da spec, menos o estado `connected`/`invited`, divisão de despesas (fase 2) e push entre utilizadores (fase 3). Mockups: `conta-corrente-v2`.

## Global Constraints

- Copy em português europeu, sem jargão: "Paguei por ele", "Ele pagou por mim", "Ele devolveu-me X €", "Devolvi-lhe X €", "Como foi pago?", "MB Way / banco", "Dinheiro na mão", "Descontado noutra coisa", "Lembrar por WhatsApp", "Deve-te X €", "Deves-lhe X €", "Quites", "+ Novo gasto". Nunca "acerto", "liquidar", "contraparte". Para compras nunca "ele pagou-me".
- `kind` ∈ `paid_for_them | paid_for_me | repaid_to_me | repaid_to_them`; sinais: `paid_for_them` +, `paid_for_me` −, `repaid_to_me` −, `repaid_to_them` +. Positivo = ele deve-me.
- `amount numeric(12,2) check (amount > 0)`; cálculos em cêntimos inteiros (como `debtMath.js`).
- Devolução sem tecto: pode ultrapassar o saldo e inverter o sinal.
- `settlement` ∈ `bank | cash | offset`. Só `bank` cria uma `transaction` (`income` se `repaid_to_me`, `expense` se `repaid_to_them`); `cash` e `offset` nunca tocam em contas.
- RLS `user_id = auth.uid()` (em `friends`: `owner_id`); `security_invoker = true` nas views.
- Apagar amigo só com saldo zero; apagar devolução `bank` apaga também a sua transação.
- Mobile first, Tailwind como no resto da app, valores monetários com `<Money>` (modo privacidade) e `eur()`; transições 120-250 ms e `motion-reduce` respeitado.
- `.env` nunca vai para o git. Migrations só se aplicam ao projeto real depois de confirmação explícita do utilizador (precedente: `20261009010000_push_cron_schedule.sql`); testar antes num branch Supabase.

## Review Focus

1. Soma em cêntimos: devo 10,00, pago 11,50 → "Deve-te 1,50 €" (nunca 1,4999…). Teste em Task 1.
2. Telefone em formatos reais (`912 345 678`, `+351 912345678`, `00351912345678`, vazio, lixo) nunca gera um link partido. Teste em Task 2.
3. Devolução `bank` quando falha a inserção do movimento: a transação criada não fica órfã. Verificação em Task 5.
4. Dívida antiga fechada por transação mas sem `debt_payments`, e dívida fechada por acerto: o saldo migrado fica a zero. Teste em Task 4.
5. Dois amigos com o mesmo nome ou com espaços a mais ("Pedro", " pedro ") não geram duplicados na migração (Task 4) nem na criação manual (Task 6).

---

### Task 1: Ramo, ferramenta de testes e matemática do saldo

**Files:**
- Modify: `package.json` (script `"test": "node --test src/lib/"`)
- Create: `src/lib/ledgerMath.js`
- Test: `src/lib/ledgerMath.test.js`

**Interfaces:**
- Produces:
  - `KINDS: readonly string[]`
  - `signedCents(kind: string, amount: number|string): number` (inteiro, com sinal)
  - `balanceOf(entries: {kind, amount}[]): number` (euros, 2 casas; positivo = ele deve-me)
  - `describeBalance(balance: number): { state: 'owes_me'|'i_owe'|'even', amount: number }` (`amount` sempre ≥ 0)
  - `suggestedRepayment(balance: number): { kind: 'repaid_to_me'|'repaid_to_them', amount: number } | null`
  - `entryLabel(kind: string): string`

- [ ] **Step 1:** `git checkout -b feat/amigos-conta-corrente`; commit da spec e deste plano (`git add docs && git commit -m "docs: spec e plano fase 1 de amigos/conta-corrente"`).
- [ ] **Step 2: testes que falham** em `ledgerMath.test.js` (`node:test` + `node:assert/strict`): `balanceOf` de `[paid_for_me 10, paid_for_them 11.5]` é `1.5`; `[paid_for_them 0.1, paid_for_them 0.2]` é `0.3`; lista vazia é `0`; `describeBalance(1.5)` → `{state:'owes_me', amount:1.5}`, `(-5)` → `{state:'i_owe', amount:5}`, `(0)` → `{state:'even', amount:0}`; `suggestedRepayment(1.5)` → `{kind:'repaid_to_me', amount:1.5}`, `(-8.8)` → `{kind:'repaid_to_them', amount:8.8}`, `(0)` → `null`; `entryLabel` devolve exatamente `'paguei por ele'`, `'ele pagou por mim'`, `'ele devolveu-me'`, `'devolvi-lhe'`; `signedCents` lança erro para um `kind` desconhecido.
- [ ] **Step 3:** `npm test` → falha por `ledgerMath.js` não existir.
- [ ] **Step 4:** implementar `ledgerMath.js` com as assinaturas acima (tabela `kind → sinal`, soma em cêntimos).
- [ ] **Step 5:** `npm test` → passa. Commit `feat: matemática do saldo por amigo`.

### Task 2: Mensagem de lembrete e telefone

**Files:**
- Create: `src/lib/contactMessage.js`
- Test: `src/lib/contactMessage.test.js`

**Interfaces:**
- Consumes: `eur(value: number): string` de `src/lib/format.js`.
- Produces:
  - `normalizePhone(raw: string|null|undefined): string | null` (só dígitos com indicativo; 9 dígitos assumem +351)
  - `reminderText({ friendName, amount, note, mbwayPhone }): string`
  - `whatsappUrl(phone: string|null, text: string): string`
  - `smsUrl(phone: string|null, text: string): string`

- [ ] **Step 1: testes que falham.** `normalizePhone`: `'912 345 678'`, `'+351 912345678'`, `'00351912345678'`, `'351912345678'` → `'351912345678'`; `''`, `null`, `'abc'`, `'123'` → `null`; `'+44 7700 900123'` → `'447700900123'`. `reminderText({friendName:'Miguel', amount:8.8, note:'Almoço de ontem', mbwayPhone:'912345678'})` é `` `Olá Miguel! Ficou pendente ${eur(8.8)} (Almoço de ontem). Podes enviar por MB Way para 912 345 678 quando puderes? Obrigado!` ``; sem `note` omite o parêntesis; sem `mbwayPhone` troca a frase por "Podes enviar quando puderes? Obrigado!". `whatsappUrl('351912345678','Olá')` é `https://wa.me/351912345678?text=Ol%C3%A1`; com `null` é `https://wa.me/?text=Ol%C3%A1`. `smsUrl('351912345678','Olá')` é `sms:+351912345678?&body=Ol%C3%A1`; com `null` é `sms:?&body=Ol%C3%A1`.
- [ ] **Step 2:** `npm test` → falha.
- [ ] **Step 3:** implementar. `mbwayPhone` formata-se em grupos `912 345 678` quando tem 9 dígitos.
- [ ] **Step 4:** `npm test` → passa. Commit `feat: texto e ligações de lembrete por WhatsApp/SMS`.

### Task 3: Schema (amigos, movimentos, saldo)

**Files:**
- Create: `supabase/migrations/20261021000000_friends_ledger.sql`
- Create: `supabase/tests/ledger_schema.sql` (asserções com `do $$ … raise exception … $$`, tudo dentro de `begin; … rollback;`)

**Interfaces:**
- Produces (SQL): `public.friends(id, owner_id, name, phone, linked_user_id, status, created_at)` com `status in ('local','invited','connected') default 'local'`; `public.ledger_entries(id, user_id, friend_id, kind, amount, note, occurred_on, due_on, settlement, transaction_id, created_at)`; `public.friend_balances(friend_id, user_id, balance)` view; `profiles.mbway_phone text`.

- [ ] **Step 1:** escrever a migration: tabelas, checks (`kind`, `settlement` só em devoluções via check cruzado, `amount > 0`), `ledger_entries.friend_id references friends on delete cascade`, `transaction_id references transactions on delete set null`, índices `(user_id, friend_id)`, RLS `*_self` como em `20261009040000_debts.sql`, view `friend_balances` com `security_invoker = true` e soma com sinal das regras em Global Constraints, `alter table profiles add column mbway_phone text`.
- [ ] **Step 2:** escrever `ledger_schema.sql`: como dois utilizadores de teste (via `set local role authenticated` + `set_config('request.jwt.claims', …)`), verificar que (a) `amount = 0` falha, (b) `settlement` preenchido num `paid_for_them` falha, (c) o utilizador B não vê nem altera linhas do A, (d) `friend_balances` dá `1.50` para `[paid_for_me 10, paid_for_them 11.50]`.
- [ ] **Step 3:** criar um branch Supabase de teste, aplicar a migration e correr `ledger_schema.sql`. Esperado: termina sem exceção.
- [ ] **Step 4:** commit `feat: tabelas friends e ledger_entries com saldo líquido`. **Não aplicar ao projeto real.**

### Task 4: Migração das dívidas antigas

**Files:**
- Create: `supabase/migrations/20261021010000_migrate_debts_to_ledger.sql`
- Create: `supabase/tests/migrate_debts.sql`

**Interfaces:**
- Consumes: tabelas da Task 3 e `debts`, `debt_payments` existentes.

- [ ] **Step 1: teste primeiro.** `migrate_debts.sql` semeia (em transação com rollback) para um utilizador: (i) dívida `owed_to_me` 20 € com pagamentos 5 € e 5 €; (ii) dívida `i_owe` 12 € paga por `settled_transaction_id` sem `debt_payments`; (iii) dívida fechada com `settled_note` e sem transação; (iv) dívidas de "Pedro" e " pedro " (mesmo amigo); (v) dívida com `due_on`. Depois corre o corpo da migration e afirma: um só amigo "Pedro"; `balance` de cada amigo igual ao saldo restante antigo (10 €, 0, 0 e o saldo de Pedro somado); `transaction_id` dos pagamentos preservado; `due_on` copiado; nenhuma entrada `cash`.
- [ ] **Step 2:** correr no branch Supabase → falha (migration ainda não existe).
- [ ] **Step 3:** implementar a migration conforme "Migração" e "Decisões adicionais" da spec: um `friends` por `lower(trim(counterparty_name))`, `debts` → `paid_for_them`/`paid_for_me` (`occurred_on = created_at::date`), `debt_payments` → `repaid_*` `bank` com o mesmo `transaction_id`, dívida `settled` com `settled_transaction_id` e sem pagamentos → devolução `bank` pelo valor em falta, dívida `settled` sem transação → `offset` pelo remanescente com `settled_note`. Não apaga `debts`.
- [ ] **Step 4:** correr `migrate_debts.sql` → sem exceção. Commit `feat: migrar dívidas antigas para o novo modelo`.

### Task 5: Camada de dados

**Files:**
- Create: `src/lib/friendsDb.js`
- Modify: `src/lib/db.js` (exportar helper `getCurrentUserId(): Promise<string>` se ainda não existir; reutilizar `createTransaction` como está)

**Interfaces:**
- Consumes: `createTransaction({amount,type,accountId,categoryId,occurredOn,note})` de `db.js`; `validateName(raw, siblings, selfId)` de `names.js`.
- Produces:
  - `listFriendsWithBalance(): Promise<(Friend & {balance:number})[]>`
  - `createFriend({ name, phone }): Promise<Friend>`; `updateFriend({ id, name, phone }): Promise<Friend>`
  - `deleteFriend(id): Promise<void>` (lança `Error('Ainda há saldo por acertar com esta pessoa.')` se o saldo ≠ 0)
  - `listEntries(friendId): Promise<Entry[]>` (mais recentes primeiro)
  - `createExpense({ friendId, kind: 'paid_for_them'|'paid_for_me', amount, note, occurredOn, dueOn }): Promise<Entry>`
  - `createRepayment({ friendId, kind: 'repaid_to_me'|'repaid_to_them', amount, note, occurredOn, settlement, accountId, categoryId }): Promise<Entry>`
  - `deleteEntry(entry): Promise<void>`
  - `getMyMbwayPhone(): Promise<string|null>`; `saveMbwayPhone(phone: string|null): Promise<void>`

- [ ] **Step 1:** implementar as funções, seguindo o padrão de `db.js` (`supabase.auth.getUser()`, `.select().single()`, `throw error`). `createFriend`/`updateFriend` rejeitam nomes duplicados sem acentos nem maiúsculas via `validateName`; `phone` é guardado já com `normalizePhone`.
- [ ] **Step 2:** `createRepayment` com `settlement = 'bank'` cria primeiro a transação e depois o movimento; se o movimento falhar, apaga a transação criada e relança o erro (padrão de `addDebtPayment`). Sem `accountId`/`categoryId` com `bank` lança `Error('Escolhe a conta e a categoria.')`. Com `cash`/`offset` ignora ambos e não cria transação.
- [ ] **Step 3:** `deleteEntry` apaga o movimento e depois, se for devolução `bank` com `transaction_id`, a transação.
- [ ] **Step 4:** `npm run lint` sem erros. Commit `feat: camada de dados de amigos e conta-corrente`. (Verificação funcional: Task 6 em diante, contra o branch Supabase com `.env` local apontado para ele. Para a Review Focus 3, na Task 8 forçar uma falha na inserção do movimento, por exemplo com um `friendId` inexistente, e confirmar que a transação criada desaparece.)

### Task 6: Lista de amigos e navegação

**Files:**
- Create: `src/pages/Friends.jsx`
- Modify: `src/App.jsx` (`/dividas` → `Friends`; deixar de importar `Debts`; a rota `/dividas/:friendId` é acrescentada na Task 9)
- Modify: `src/components/BottomNav.jsx` (label `Amigos`, ícone `Users`, `to="/dividas"` mantém-se)

**Interfaces:**
- Consumes: `listFriendsWithBalance`, `createFriend`, `describeBalance`.
- Produces: rota `/dividas` com a lista.

- [ ] **Step 1:** implementar `Friends.jsx` como o ecrã 1 do mockup: cartão "No total" (soma dos saldos, `Devem-te` / `Deves` / `Quites`), lista de amigos ordenada por saldo absoluto desc com cor verde (deve-te), vermelha (deves-lhe) e cinzenta (quites), botão "+ Adicionar amigo" com campos nome e telemóvel (opcional), estados de carregamento/erro/vazio com `PageSkeleton`, `ErrorNotice`, `EmptyState`.
- [ ] **Step 2:** ligar a rota e o menu. `npm run build` passa.
- [ ] **Step 3:** verificação manual (`npm run dev`, branch Supabase): criar "Pedro" e "pedro" → a segunda é recusada com a mensagem de nome duplicado; a lista dos amigos migrados mostra os saldos antigos certos. Commit `feat: lista de amigos com saldo`.

### Task 7: "+ Novo gasto"

**Files:**
- Create: `src/components/NewExpenseSheet.jsx`

**Interfaces:**
- Consumes: `createExpense`. Props: `{ friend, onDone(): void, onCancel(): void }`.

- [ ] **Step 1:** painel com duas opções "Paguei por ele" (`paid_for_them`, "Ele fica a dever-me") e "Ele pagou por mim" (`paid_for_me`, "Fico a dever-lhe"), valor (> 0), "Para quê?" opcional, data (hoje por defeito) e "Data limite / Para quando?" opcional. Erros em português simples, botão "Guardar" desativado enquanto grava.
- [ ] **Step 2:** verificação manual: guardar "Paguei por ele 11,50 €" cria o movimento e o saldo muda; valor 0 ou vazio mostra "Indica um valor válido.". Commit `feat: novo gasto com um amigo`.

### Task 8: Devolução e "Como foi pago?"

**Files:**
- Create: `src/components/RepaymentSheet.jsx`

**Interfaces:**
- Consumes: `createRepayment`, `listAccounts`, `listCategories` (de `db.js`), `suggestedRepayment`. Props: `{ friend, balance, onDone(): void, onCancel(): void }`.

- [ ] **Step 1:** painel com valor pré-preenchido com `suggestedRepayment(balance).amount` e editável **sem máximo**; se o valor ultrapassar o saldo mostra aviso informativo "Passa a ficar ele a dever-te X" (ou o inverso) e não bloqueia. Escolha "Como foi pago?": "MB Way / banco" (mostra seletor de conta e categoria, com categoria por defeito `Outros Ganhos`/`Outros Gastos` como em `Debts.jsx`), "Dinheiro na mão" (texto "Não mexe em nenhuma conta"), "Descontado noutra coisa" (texto "Abate noutra coisa que fizeste por ele"). Sem contas ou categorias disponíveis, "MB Way / banco" mostra o erro e as outras duas continuam a funcionar.
- [ ] **Step 2:** verificação manual (branch Supabase): "Ele devolveu-me 1,50 €" por MB Way cria um movimento e uma transação `income` na conta escolhida; por "Dinheiro na mão" não cria transação; devolução de 11,50 € sobre 10,00 € inverte o saldo para 1,50 € a favor do outro lado. Commit `feat: registar devolução com forma de pagamento`.

### Task 9: Conta-corrente do amigo

**Files:**
- Create: `src/pages/FriendLedger.jsx`
- Modify: `src/App.jsx` (acrescentar `<Route path="/dividas/:friendId" element={<FriendLedger />} />`; a lista da Task 6 passa a ligar cada amigo a `/dividas/${friend.id}`)

**Interfaces:**
- Consumes: `listEntries`, `deleteEntry`, `deleteFriend`, `updateFriend`, `balanceOf`, `describeBalance`, `entryLabel`, `suggestedRepayment`; `<NewExpenseSheet friend onDone/>` e `<RepaymentSheet friend balance onDone/>` (Tasks 7 e 8).

- [ ] **Step 1:** ecrã 2 do mockup: cabeçalho com nome (editável) e telefone, cartão do saldo ("Deve-te 1,50 €" / "Deves-lhe 5,00 €" / "Estão quites"), botões "+ Novo gasto" e a devolução contextual ("Ele devolveu-me 1,50 €" / "Devolvi-lhe 5,00 €"; escondida quando quites), lista de movimentos com data, texto `entryLabel`, nota, valor com sinal e cor, e "Apagar" com `ConfirmDialog` (aviso extra se for devolução `bank`: "Também apaga a transação criada na conta.").
- [ ] **Step 2:** apagar amigo: só disponível com saldo zero; com saldo ≠ 0 mostra o motivo.
- [ ] **Step 3:** verificação manual: o Pedro do exemplo (creatina 10 + bilhete 11,50) mostra "Deve-te 1,50 €"; apagar uma devolução `bank` apaga a transação na página Registo. Commit `feat: conta-corrente por amigo`.

### Task 10: Lembrar por WhatsApp e o meu MB Way

**Files:**
- Modify: `src/pages/FriendLedger.jsx` (botão verde "Lembrar por WhatsApp" + "SMS" secundário, só quando `balance > 0`)
- Modify: `src/pages/Manage.jsx` (campo "O meu número MB Way (opcional)" que guarda com `saveMbwayPhone`)

**Interfaces:**
- Consumes: `reminderText`, `whatsappUrl`, `smsUrl`, `normalizePhone`, `getMyMbwayPhone`, `saveMbwayPhone`.

- [ ] **Step 1:** o botão abre `whatsappUrl(normalizePhone(friend.phone), reminderText({...}))` num novo separador com `rel="noopener"`; a nota usada é a do movimento mais recente de `paid_for_them`. Estilo: fundo `#dcf8c6`, borda `#25d366`, texto `#075e54` (mockup), com variante escura legível.
- [ ] **Step 2:** `Manage.jsx` mostra e guarda o MB Way; vazio guarda `null`.
- [ ] **Step 3:** verificação manual: com telefone válido abre a conversa com o texto; sem telefone abre o seletor de contactos do WhatsApp. Commit `feat: lembrar por WhatsApp/SMS`.

### Task 11: Lembretes de atraso no novo modelo

**Files:**
- Modify: `supabase/functions/send-overdue-debts/index.ts`

**Interfaces:**
- Consumes: `ledger_entries.due_on`, `friend_balances`, `push_subscriptions` (já usadas).

- [ ] **Step 1:** substituir a consulta a `debts` por: movimentos `paid_for_them` com `due_on < today` (data de Lisboa, como já está) cujo amigo tem `balance > 0` em `friend_balances`; agrupar por `user_id` contando amigos distintos. Mensagem: `Tens {N} {amigo|amigos} com valores por receber em atraso. Toca para ver.`; `url` `/dividas`. O resto (CRON_SECRET, remoção de subscrições 404/410) mantém-se.
- [ ] **Step 2:** testar a função no branch Supabase com `curl` e o `x-cron-secret`: um utilizador com um `paid_for_them` vencido e saldo positivo recebe `notified: 1`; com saldo a zero ou sem vencimento, `notified: 0`.
- [ ] **Step 3:** commit `feat: lembretes de atraso lêem a conta-corrente`.

### Task 12: Verificação final e entrega

**Files:**
- Modify: `README.md` (secção curta "Amigos e conta-corrente" e como correr `npm test`)

- [ ] **Step 1:** `npm test`, `npm run lint`, `npm run build` sem erros.
- [ ] **Step 2:** percurso completo à mão, num telemóvel ou no modo responsivo do browser, contra o branch Supabase: criar amigo → novo gasto → devolução por MB Way → devolução em dinheiro → inversão de saldo (caso creatina/bilhete) → lembrar por WhatsApp → apagar movimento → apagar amigo (bloqueado com saldo, permitido a zero).
- [ ] **Step 3:** commit `docs: readme de amigos e conta-corrente`; parar e pedir ao utilizador autorização para (a) aplicar as duas migrations ao projeto real, (b) publicar a função `send-overdue-debts`, (c) fundir o ramo. A página `Debts.jsx` e a tabela `debts` ficam no repositório, sem rota, até a Fase 3 as remover.
