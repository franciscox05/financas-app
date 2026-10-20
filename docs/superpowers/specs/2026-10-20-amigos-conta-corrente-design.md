# Amigos e conta-corrente (evolução do módulo Dívidas)

Data: 2026-10-20. Estado: rascunho para aprovação.

## Intenção e porquê

Hoje a app regista dívidas como cartões isolados: `debts` (um por empréstimo) com `counterparty_name` em texto livre. Isto falha nos casos reais do dia a dia:

- **Inversão de saldo.** Devo 10 € a um amigo (creatina), no dia seguinte pago-lhe um bilhete de 11,50 €. Agora ele deve-me 1,50 €. A app não consegue representar isto: o pagamento está limitado ao que falta e o "Fechar por acerto" fecha a dívida sem registar o bilhete.
- **Acertos pequenos e frequentes** (cafés, almoços, futebol), muitas vezes em dinheiro vivo ou "desconta ao que te devo".
- **Cobrar sem fricção.** Quem deve pode não ter a app, nem querer instalar nada.
- **Utilizadores pouco à vontade com tecnologia.** A linguagem atual ("Fechar por acerto", "Registar recebimento") é jargão e duas ações parecem a mesma coisa.

A ideia central: em vez de "dívidas soltas", cada amigo tem uma **conta-corrente**: uma lista de movimentos, com um **saldo líquido** calculado no topo ("Deve-te 1,50 €", "Deves-lhe 5,00 €", "Quites").

## Objetivos

1. Lista de **amigos/contactos** com saldo líquido por pessoa e total geral.
2. Ecrã de **conta-corrente por amigo**: saldo líquido no topo, movimentos por baixo, ações em linguagem simples.
3. Registar em poucos toques: **"+ Novo gasto"** (Paguei por ele / Ele pagou por mim) e **devolução** (botão contextual com o valor pré-preenchido).
4. A devolução pode **ultrapassar** o que se devia: o saldo inverte-se, sem dois cartões a contradizerem-se.
5. Perguntar **"Como foi pago?"**: MB Way / banco (escolher conta), Dinheiro na mão (não mexe em nenhuma conta), Descontado noutra coisa.
6. **Lembrar por WhatsApp/SMS**: abre mensagem pré-preenchida (valor, motivo, MB Way de quem cobra) para contactos sem app.
7. **Três estados de contacto:** contacto simples (sem app), convite pendente, amigo ligado (ambos com conta). Amigos ligados veem o movimento no seu ecrã e **só conta depois de aceitar**.
8. **Dividir uma despesa** por várias pessoas (partes iguais ou valores personalizados), criando um movimento por pessoa.
9. Notificações push (infraestrutura já existente) para amigos ligados: novo movimento por confirmar, aceite/contestado, lembrete.
10. **Migrar** as dívidas existentes para o novo modelo sem perder histórico nem transações já criadas.

## Não-objetivos

- Processar pagamentos reais (MB Way/banco). A app só regista o que aconteceu.
- Dívidas triangulares entre 3 pessoas (A deve a B, B deve a C) e simplificação de grupos tipo Splitwise. Um acerto "pelo Henrique" regista-se com dois movimentos e uma nota.
- Importar contactos do telemóvel, pesquisar utilizadores da app por nome, perfis sociais.
- Várias moedas.
- Mudar o resto da app (Balanço, Dashboard, transações, orçamentos).

## Anti-objetivos (falha mesmo que "funcione")

- Um utilizador poder alterar o saldo de outra pessoa sem ela aceitar.
- Obrigar o outro a instalar a app ou criar conta para ser cobrado.
- Dinheiro "na mão" mexer nos saldos das contas.
- Termos que um utilizador pouco técnico não perceba ("acerto", "liquidar", "contraparte").
- Ficar com dois sítios para o mesmo dinheiro (a página Dívidas antiga e a nova a divergir).

## Decisões já tomadas pelo utilizador

- Modelo de **conta-corrente por amigo** com saldo líquido, em vez de dívidas soltas.
- Os três estados de contacto (simples, convite, ligado).
- Com amigo ligado, o movimento fica **pendente e não conta no saldo até ele aceitar**; pode contestar.
- **Sem conta "Carteira" por defeito:** "Dinheiro na mão" nunca toca nos saldos. Quem quiser controlar dinheiro físico cria uma conta ("Carteira") em Gerir e escolhe-a em "MB Way / banco" (a opção chama-se assim, mas lista todas as contas).
- Ações separadas: **"+ Novo gasto"** (Paguei por ele / Ele pagou por mim) e **devolução** contextual no topo.
- Textos de movimentos: "paguei por ele" / "ele pagou por mim" (nunca "ele pagou-me" para compras). Botão WhatsApp em verde.
- Migração das dívidas atuais como movimentos agrupados por nome, sem perder histórico.
- "Fechar por acerto" e "Registar recebimento" deixam de existir; acertar é só registar uma devolução.
- Mockups validados: `conta-corrente-v2` (lista de amigos, conta-corrente, novo gasto, registar devolução).

## Modelo de dados (proposta, decisão minha salvo indicação)

Base existente: `auth.users`, `profiles`, `accounts`, `transactions`, `debts`, `debt_payments`, `push_subscriptions`; RLS por `user_id = auth.uid()`; amounts `numeric(12,2) > 0`.

**`friends`** (os contactos de cada utilizador)
- `id`, `owner_id` → auth.users, `name`, `phone` (opcional, para WhatsApp/SMS), `linked_user_id` → auth.users (nulo se sem app), `status`: `local | invited | connected`, `created_at`.
- RLS: o dono vê e altera os seus. Único por (`owner_id`, `linked_user_id`) quando não nulo.

**`friend_invites`**
- `token` (aleatório), `from_user_id`, `friend_id`, `email` (opcional), `expires_at`, `accepted_by`. Aceitar corre numa função segura (`accept_invite`) que liga os dois lados (cria/atualiza o `friends` do outro utilizador) e passa o estado para `connected`.

**`ledger_entries`** (substitui `debts` + `debt_payments`)
- `id`, `user_id` (dono desta linha), `friend_id`, `kind`: `paid_for_them | paid_for_me | repaid_to_me | repaid_to_them`, `amount` (> 0), `note`, `occurred_on`.
- `settlement`: `bank | cash | offset` (só em devoluções): `bank` cria uma `transaction` ligada em `transaction_id`; `cash` e `offset` não criam nada.
- `transaction_id` (opcional): em devolução por banco é a transação criada; em "paguei por ele" é opcionalmente um gasto já registado (ver Deixado ao construtor).
- `status`: `confirmed | pending | declined | cancelled`. Sem amigo ligado, é sempre `confirmed`.
- `mirror_id` → a linha espelho do outro utilizador (amigos ligados); `split_group_id` para despesas divididas.
- RLS: o dono só vê/altera as suas linhas. Espelhos e respostas passam por funções seguras (`share_entry`, `respond_entry`), nunca por escrita direta na linha do outro.

**Saldo** (view `friend_balances`, `security_invoker = true`): por `friend_id`, soma das linhas `confirmed` com o sinal definido abaixo. Positivo = ele deve-me, negativo = devo-lhe, zero = quites. Só se calcula, nunca se guarda.

Sinal: `paid_for_them` = +amount (ele fica a dever-me), `paid_for_me` = −amount, `repaid_to_me` = −amount (ele devolveu: reduz o que me deve), `repaid_to_them` = +amount (eu devolvi: reduz o que lhe devo).

## Comportamento

- **Sem tecto na devolução.** Pode ser maior que o saldo; o resultado muda de sinal. A UI pré-preenche o valor do saldo mas é editável.
- **Contacto simples:** movimentos `confirmed` logo; "Lembrar por WhatsApp" abre `https://wa.me/<telefone>?text=...` (ou `sms:`), com o MB Way do utilizador em `profiles` (novo campo `mbway_phone`, opcional; sem ele a mensagem omite essa linha).
- **Amigo ligado:** criar movimento cria a linha própria com `status = pending` e, por `share_entry`, uma linha espelho no outro (também `pending`, com o `kind` invertido). O outro vê "Pendente de confirmação" e pode **Aceitar** ou **Contestar** (recusa, com nota opcional). Ao aceitar, as duas linhas passam a `confirmed` e contam. Se contestar, o criador vê `declined` com a nota e pode corrigir e reenviar (nova linha; a antiga fica em histórico).
- **Editar/anular um movimento já confirmado com amigo ligado** (decisão minha): qualquer dos lados pode anulá-lo; passa a `cancelled` nos dois lados, fica no histórico e o outro é notificado. Editar valor = anular e criar de novo.
- **Dividir despesa:** o utilizador paga X, escolhe participantes e a divisão (iguais ou personalizada); cria um `paid_for_them` por participante com o mesmo `split_group_id`. A parte do próprio não gera movimento.
- **Dinheiro e contas:** `cash` e `offset` não tocam em `transactions`. `bank` cria a transação como hoje (`income` quando recebes, `expense` quando pagas), com a conta escolhida.
- **Notificações:** reaproveitar `push_subscriptions` e web-push. Eventos: novo movimento a confirmar, aceite, contestado, anulado. Mensagens curtas em português simples.

## Migração (decisão minha)

Uma migration que, por utilizador:
1. Cria um `friends` (`local`) por `lower(trim(counterparty_name))` distinto das `debts`.
2. Cada `debts` → um `ledger_entries` (`owed_to_me` → `paid_for_them`, `i_owe` → `paid_for_me`), mantendo `amount`, `note`, `created_at` como `occurred_on`.
3. Cada `debt_payments` → `repaid_*` com `settlement = bank`, mantendo `transaction_id` (as transações já criadas continuam válidas).
4. Dívidas fechadas "por acerto" → uma devolução `settlement = offset` pelo remanescente, com a `settled_note` como nota.
5. A tabela `debts` e a página Dívidas antigas ficam só de leitura/escondidas durante uma versão e depois são apagadas.

## Fases

1. **Local:** `friends` (só `local`), `ledger_entries`, view de saldo, ecrãs (lista, conta-corrente, novo gasto, devolução), WhatsApp/SMS, migração, substituir a página Dívidas.
2. **Divisão de despesas.**
3. **Ligação entre utilizadores:** convites, `share_entry`/`respond_entry`, estados `pending/declined/cancelled`, push.

Cada fase deve deixar a app funcional e a migração testável com dados reais.

## Deixado ao construtor

- Nomes exatos de colunas/índices e mensagens de erro.
- Detalhe visual dos ecrãs (seguir `conta-corrente-v2` e o estilo Tailwind atual da app; mobile first).
- Como o botão "+ Novo gasto" em `paid_for_them` oferece ligar a um gasto já registado (decisão minha: por defeito não cria nem liga nada, porque o gasto no cartão normalmente já está registado como transação).
- Como a função de push é chamada (cron, trigger ou chamada da app com o JWT do utilizador).
- Lembretes de atraso: **decidido pelo utilizador.** "+ Novo gasto" tem um campo opcional "Data limite / Para quando?" (`due_on` em `ledger_entries`, migrado de `debts.due_on`). A função `send-overdue-debts` passa a ler o novo modelo: envia o push diário só se a data já passou **e** o saldo com esse amigo continua pendente **a favor do utilizador**. (Os avisos de "eu devo" da função antiga deixam de existir; se se quiserem manter, é uma alteração pequena a pedir à parte.)

## Decisões adicionais do construtor (minhas, a confirmar na leitura)

**Migração**
- Dívida fechada com `settled_transaction_id` mas sem `debt_payments` (anterior aos pagamentos parciais): gera uma devolução `bank` pelo valor em falta (`amount` menos soma dos pagamentos), mantendo o `transaction_id`. Fechada sem transação nem nota: devolução `offset` pelo remanescente.
- Pagamentos de `debt_payments` e restantes campos como no passo 3. A migração deve correr com um teste sobre dados reais antes de apagar `debts`.

**Apagar e editar**
- Contacto simples: movimentos editáveis e apagáveis à vontade. Apagar uma devolução `bank` apaga também a transação que criou (com aviso, como hoje em `deleteDebt`/`undoDebtPayment`).
- Amigo ligado: anular passa a `cancelled` nos dois lados; cada lado remove só a sua própria transação, se existir.

**Contacto que passa a amigo ligado**
- Enquanto o convite está pendente (ou se for ignorado/recusado) o contacto comporta-se como `local`: tudo `confirmed`, só do próprio.
- Ao ligar, o histórico antigo fica privado. Em vez de o espelhar, cria-se **um único movimento "saldo anterior"** `pending`, que o amigo aceita ou contesta, para os saldos das duas pessoas começarem iguais.

**Segurança das funções entre utilizadores**
- `accept_invite` exige sessão iniciada; o token chega, não tem de coincidir com nenhum email.
- Quem recebe só pode **aceitar ou contestar**; `amount`, `kind` e `occurred_on` do espelho não são editáveis por ele, e a função verifica-o no servidor.
- Se um utilizador for apagado: `friends.linked_user_id` e `ledger_entries.mirror_id` passam a nulo (`on delete set null`) e o contacto volta a `local`.

**Convite**
- É só um **link** (`/convite/:token`) que o utilizador partilha por WhatsApp/cópia. Sem envio de email, sem campo `email` em `friend_invites`.

**Devolução por banco entre amigos ligados**
- O espelho nasce com `settlement` por definir. Quem aceita responde ao mesmo "Como foi pago?" (conta, dinheiro na mão ou descontado) e só aí se cria, se for o caso, a sua transação.

**Âmbito da fase 1**
- A nova página substitui **a mesma rota** `/dividas` (Debts.jsx, `listDebts`, `debtMath` e referências no menu, Dashboard e Balanço que o construtor encontrar com pesquisa). A página antiga fica só de leitura durante uma versão.

**Dividir despesa**
- O pagador entra na divisão só se for incluído; o cêntimo que sobra de uma divisão igual fica com o pagador. Nenhuma transação nova é criada pela divisão.

**Identidade dos amigos**
- Migração agrupa por nome normalizado (minúsculas, sem espaços nas pontas). Fase 1 permite **renomear** e apagar (só com saldo zero); **unir** dois contactos fica fora da fase 1.

**Telefone**
- Guardar só dígitos; número de 9 dígitos assume-se português (+351). `mbway_phone` com a mesma regra.
