# Amigos ligados: pedido de amizade e movimentos partilhados (Fase 3a)

Data: 2026-10-21. Estado: rascunho para aprovação. Continua o desenho `2026-10-20-amigos-conta-corrente-design.md` (Fase 1 já no ar). Esta fase **substitui o convite por link** desse desenho por um **pedido de amizade dentro da app**, como numa rede social. Notificações push ficam para a Fase 3b (logo a seguir).

## Intenção

Hoje cada pessoa tem o seu livro isolado. O utilizador quer adicionar o Francisco (que também usa a app) e que ele receba o pedido na app dele, só com **Aceitar** ou **Recusar**. Depois de ligados, os movimentos entre os dois aparecem nos dois lados e só contam quando o outro aceita.

## Objetivos

1. Enviar pedido de amizade a um contacto existente, indicando o **email com que a pessoa faz login**.
2. A pessoa vê "Pedidos de amizade" na app dela e escolhe Aceitar ou Recusar.
3. Ao aceitar, os dois contactos passam a `connected` (`linked_user_id` preenchido nos dois lados).
4. Entre ligados, um movimento novo fica **pendente** do outro lado até ele **aceitar ou contestar**. Só movimentos confirmados contam no saldo.
5. Anular um movimento já confirmado (qualquer dos lados), com registo nos dois.
6. Ao ligar, o histórico antigo fica privado; propõe-se um único movimento "saldo anterior" para aceitar ou contestar, se o saldo não for zero.
7. Pedidos pendentes e movimentos por confirmar visíveis na app (separador Amigos com contador).

## Não-objetivos

- Notificações push (Fase 3b). Dividir despesas (Fase 2). Pesquisa de utilizadores, lista de sugestões, importar contactos, @username, ligação por número de telemóvel.
- Editar o valor de um movimento já partilhado (anula-se e cria-se de novo).
- Unir dois contactos duplicados.

## Anti-objetivos

- Alguém conseguir alterar o saldo de outra pessoa sem ela aceitar.
- Descobrir quem tem conta na app (enumeração de emails): enviar um pedido a um email sem conta tem de ter a mesma resposta que a um email com conta.
- Ver dados do outro além do que ele próprio partilhou (movimentos desse par).
- Termos técnicos no ecrã ("espelho", "contraparte", "liquidar").

## Decisões do utilizador

- Estilo rede social: pedido dentro da app, sem links nem passar por WhatsApp.
- Entregar primeiro convite e confirmação dentro da app; push depois.
- Movimento com amigo ligado fica pendente e não conta até o outro aceitar; pode contestar. Anulação mútua. Saldo anterior como um único movimento pendente.

## Decisões minhas (a confirmar na leitura)

- **Identificador = email de login, correspondência exata.** Não existe @username e o telemóvel não está verificado em lado nenhum. O pedido guarda o email em minúsculas; quem tem esse email na sessão vê o pedido. Se a pessoa ainda não tem conta, o pedido espera e aparece-lhe quando criar conta com esse email (não se revela se a conta existe). O remetente vê apenas "Pedido enviado" e pode cancelar.
- Um contacto só pode ter um pedido pendente de cada vez. Recusado: o remetente vê "Recusado" e pode reenviar.
- Nome do contacto novo no lado de quem aceita: o `full_name` do remetente (ou o email, se não tiver nome).
- Se quem aceita já tem um contacto ligado ao remetente, não se cria outro. Se tem um contacto local com o mesmo nome, cria-se um novo e a união fica manual (fora de âmbito).

## Modelo de dados

**`friend_requests`**: `id`, `from_user_id`, `friend_id` (o contacto do remetente), `to_email` (minúsculas, sem espaços), `status` (`pending | accepted | declined | cancelled`), `created_at`, `responded_at`. Único pedido `pending` por `friend_id`. RLS: o remetente lê os seus; o destinatário lê os que têm `to_email = lower(auth.jwt() ->> 'email')`. **Sem escrita direta**: tudo por funções `security definer`.

**Funções:** `send_friend_request(friend_id, email)`, `cancel_friend_request(id)`, `respond_friend_request(id, accept)`. Aceitar, numa só transação: cria o contacto do destinatário (`connected`, `linked_user_id` = remetente), liga o do remetente (`connected`, `linked_user_id` = destinatário) e marca o pedido `accepted`. Nunca se deve poder ligar a si próprio (email do próprio recusado).

**`ledger_entries` ganha:** `status` (`confirmed | pending | declined | cancelled`, por omissão `confirmed`), `mirror_id` (linha do outro lado, `on delete set null`), `decline_note`. A view `friend_balances` passa a somar **só** `status = 'confirmed'`.

**Funções:** `share_entry(entry_id)` cria a linha espelho no outro lado (`kind` invertido, mesmo valor, data e nota, `status = pending`) e põe a própria linha `pending`; `respond_entry(entry_id, accept, note)` (quem recebe só pode aceitar ou contestar; valor, tipo e data não se alteram, verificado no servidor); `cancel_entry(entry_id)`. Aceitar põe as duas linhas `confirmed`. Contestar: a do remetente fica `declined` com a nota.

**Devolução por banco entre ligados:** o espelho nasce sem `settlement`; quem aceita responde ao "Como foi pago?" (conta, dinheiro, descontado) e só aí se cria, se for o caso, a sua transação. Quem criou usa a sua escolha como hoje.

## Comportamento no ecrã

- **Página do amigo (local):** botão "Pedir amizade" → pede o email → "Pedido enviado a <email>". Estado visível: Enviado (com Cancelar), Recusado (com Reenviar).
- **Separador Amigos:** faixa "Pedidos de amizade (N)" no topo com Aceitar/Recusar, e "A confirmar (N)" com os movimentos pendentes.
- **Amigo ligado:** "+ Novo gasto" e devolução criam movimento pendente do outro lado ("À espera que <nome> confirme"). Os movimentos pendentes aparecem com selo e não entram no saldo.
- **Quem recebe:** "<nome> diz que pagou por ti 10 € — Está certo? [Aceitar] [Contestar]".
- **Ao ligar:** se o saldo do remetente com o contacto não é zero, oferece-se criar "Saldo anterior"; o destinatário aceita ou contesta.

## Segurança

- Todas as escritas entre utilizadores só por funções `security definer` com `search_path` fixo e verificação de `auth.uid()` em cada uma.
- Resposta idêntica ao enviar pedido a email existente ou inexistente.
- Os campos de um movimento espelho (valor, tipo, data) não são editáveis por quem recebe.
- Utilizador apagado: `linked_user_id` e `mirror_id` passam a nulo e o contacto volta a `local`.

## Fases

- **3a (este desenho):** pedidos de amizade, movimentos partilhados com confirmação, anulação, saldo anterior, ecrãs.
- **3b:** notificações push (pedido recebido, movimento por confirmar, aceite, contestado, anulado).

## Decisões do construtor após a leitura crítica (minhas, a confirmar)

- **Saldo anterior.** Só se oferece ao remetente depois de ligar, e só se o saldo não for zero. Ao enviar, as entradas antigas confirmadas desse contacto passam a `archived` (continuam no histórico, saem do saldo) e cria-se **uma** entrada "Saldo anterior" (`paid_for_them` se o saldo era positivo, `paid_for_me` se negativo) pelo valor absoluto, pendente do outro lado. Se ele contestar, as antigas voltam a `confirmed`. Os `transaction_id` das antigas não mudam. Novo estado `archived` em `ledger_entries.status`.
- **Anulação (decidida pelo utilizador): um pede, o outro aceita.** Num movimento `confirmed` entre ligados, qualquer lado pode "Pedir anulação" (estado `cancel_requested`, com quem pediu registado). O outro vê "<nome> quer anular este movimento" com Aceitar ou Recusar. Aceitar: `cancelled` nos dois lados, cada um remove só a sua transação. Recusar: volta a `confirmed`. Enquanto pendente, o movimento continua a contar no saldo. Um movimento ainda `pending` pode ser cancelado de imediato por quem o criou.
- **Transações bancárias.** Entre ligados a transação de cada lado só é criada quando o movimento fica `confirmed` (nunca com o movimento pendente), para que pendentes não apareçam nas contas nem nos relatórios. A conta e a categoria escolhidas guardam-se na entrada e a função cria a transação ao confirmar. Contestar ou anular remove só a transação própria de cada lado.
- **Contestação.** A linha de quem criou fica `declined` com a nota visível; a espelho fica `cancelled` e escondida de quem contestou. Corrigir é criar uma entrada nova ("Corrigir e reenviar" pré-preenche). A antiga fica no histórico.
- **Pedidos e email.** Só se listam e aceitam pedidos com o email **confirmado** (`email_confirmed_at` não nulo). Se o email de login mudar, o pedido deixa de aparecer. Se o contacto do remetente já foi ligado entretanto, aceitar devolve "Já estão ligados." e não altera nada.
- **Partilha automática.** Com amigo ligado, todo movimento novo é partilhado (a criação chama `share_entry`); não há movimentos privados com um amigo ligado. Os movimentos locais antigos só passam ao outro lado pelo "Saldo anterior".

## Deixado ao construtor

Nomes exatos de colunas, funções e mensagens; detalhe visual; estratégia de testes SQL com dois utilizadores (como `ledger_schema.sql`); como o contador de pendentes é obtido.
