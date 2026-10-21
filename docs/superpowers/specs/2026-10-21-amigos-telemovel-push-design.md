# Amigos por telemóvel e notificações push (Fase 3b)

Data: 2026-10-21. Estado: aprovado pelo utilizador (opção A). Continua `2026-10-21-amigos-ligados-design.md` (Fase 3a, já no ar).

## Intenção

O utilizador quer adicionar um amigo só com **nome e número de telemóvel**, como na lista de contactos, e que a pessoa receba o pedido na app dela, com **notificação no telemóvel** (app aberta ou fechada) para pedidos e movimentos.

## Decisões do utilizador

- Opção A: cada pessoa guarda o **seu número no perfil** ("O teu número, para os amigos te encontrarem"). O pedido é dirigido a um número; quem tiver esse número no perfil vê o pedido.
- Como o número não está verificado, quando o destinatário aceita, **quem pediu confirma** o nome da conta que aceitou ("É mesmo o Francisco Gomes?") e só então as contas ficam ligadas.
- Push automático para: pedido de amizade recebido, pedido aceite, movimento novo por confirmar, movimento aceite/contestado, anulação pedida/aceite/recusada. O toque abre o ecrã certo.
- Branch `feat/amigos-telemovel-push`; testes SQL no Postgres de Docker; nada vai ao Supabase real nem à `main` sem autorização explícita.

## Decisões minhas (a confirmar)

- **Nunca se revela se um número tem conta.** Adicionar um amigo com número cria sempre um pedido (fica "Pedido enviado"); se ninguém tiver esse número, fica à espera. Por isso o formulário tem uma opção "Pedir para ligar contas (só funciona se a pessoa tiver a app e este número no perfil)", ligada quando há número, que o utilizador pode desligar para contactos sem app.
- O pedido por **email continua disponível** no painel do amigo ("ligar por email"): é o único método verificado.
- **Sem unicidade do número no perfil.** Se duas contas tiverem o mesmo número, ambas veem o pedido. Quem aceitar primeiro fica "à espera de confirmação"; o remetente vê o nome (e um email parcial, `f***@gmail.com`) e confirma ou recusa. Recusar devolve o pedido a `pending` e essa conta deixa de o ver; a pessoa certa ainda o pode aceitar. Recusar um pedido por número só esconde o pedido a quem recusa (não o mata para os outros).
- Pedidos por email mantêm o fluxo da Fase 3a (liga logo ao aceitar, o email já é verificado).
- **O texto das notificações não leva valores** (privacidade no ecrã de bloqueio): "Tiago registou um movimento contigo. Toca para confirmar."
- O envio é feito por triggers que chamam uma Edge Function `notify-user` (pg_net + os segredos já existentes no vault); uma falha de envio nunca bloqueia a operação.

## Modelo de dados

- `profiles.phone` (só dígitos, 9 a 15, nulo permitido). Função `normalize_phone(text)`: remove tudo o que não é dígito e um `00` inicial; 12 dígitos com `351` à frente passam a 9; devolve nulo se não tiver 9–15 dígitos.
- `friend_requests`: `to_email` passa a opcional; novos `to_phone`, `accepted_by uuid`, `rejected_by uuid[] default '{}'`; exatamente um de `to_email`/`to_phone`; novo estado `awaiting_confirmation`; um pedido ativo (`pending` ou `awaiting_confirmation`) por contacto.
- Funções: `send_friend_request_phone(friend_id)` (lê o `phone` do contacto), `respond_friend_request` (por número: aceitar → `awaiting_confirmation`; recusar → só esconde), `confirm_friend_request(id, confirm)` (só o remetente), `get_request_accepter(id)` (nome e email parcial, só o remetente), `list_incoming_requests()` (passa a devolver `via` e `awaiting`), `cancel_friend_request` também em `awaiting_confirmation`.
- Notificações: `_push(user, título, corpo, url)` e triggers em `friend_requests` e `ledger_entries`; Edge Function `notify-user`.

## Ecrãs

- **Gerir:** secção "O teu número" (editar/guardar).
- **+ Adicionar amigo:** nome, telemóvel (opcional) e a opção de pedir ligação; se marcada e com número, cria o contacto e envia o pedido.
- **Painel do amigo:** "Pedido enviado ao número ...", "<nome da conta> aceitou. É mesmo ele? [Sim, ligar] [Não]", "ligar por email" como alternativa.
- **Pedidos recebidos:** os de número mostram "<nome> quer ligar contas"; depois de aceitar mostram "À espera que <nome> confirme".
- **Notificações:** o toque abre `/dividas` ou `/dividas/<amigo>`; se a app já estiver aberta, foca-a.

## Não-objetivos

Verificar o número por SMS; partilhar a lista de contactos do telemóvel; push para quem não instalou a PWA; divisão de despesas.

## Segurança

Todas as funções `security definer` com `search_path` fixo e `auth.uid()`; resposta igual quer o número tenha conta quer não; o remetente só vê o nome/email parcial de quem aceitou, nunca de quem não aceitou; os triggers de push nunca fazem falhar a transação; o corpo das notificações não revela valores nem dados de quem não é o destinatário.
