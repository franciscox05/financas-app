# Sessão 2026-10-22/23 — arquitetura de Amigos reescrita + módulo Perfil

Continuação de `2026-10-22-revisao-amigos-e-perfil.md` (revisão inicial). Esta
sessão foi muito mais longa — mudanças de arquitetura pedidas explicitamente
pelo Francisco depois de testar ao vivo com o Tiago.

## Mudança de arquitetura: "nada depende da ação da outra pessoa"

O modelo original (Tiago) era simétrico: um movimento partilhado só contava
para o saldo de qualquer um dos dois lados depois do outro confirmar.
Francisco pediu para isto parar — quem cria um movimento vê-o contar do seu
lado de imediato; só o saldo do amigo continua a depender da confirmação
dele. Nunca o contrário (ninguém força o saldo de outra pessoa).

- `friend_balances` (view) e `balanceOf`/`lifetimeTotals`/`entryCounts`
  (`ledgerMath.js`) contam `pending`/`declined` quando `created_by = dono da
  linha`. O `status` em si **não mudou de semântica** — continua `pending`
  até à confirmação, só o cálculo do saldo é que passou a ser assimétrico.
- Devolução por banco: `create_shared_entry` cria a transação do lado de
  quem cria na hora (antes só com `respond_entry` ao aceitar).
- "Contestar" deixou de reverter automaticamente o lado de quem criou —
  `respond_entry`'s branch de recusa já não apaga a transação nem muda o
  status para algo que pare de contar. `declined` passa a contar
  (`entryCounts`) se foi criado por quem vê, com a nota do decline como
  aviso visual apenas. "Corrigir e reenviar" (`retire_declined_entry`)
  aposenta o movimento antigo depois de criar o substituto, para não contar
  a dobrar.
- "Ficamos quites" (`forgivenessEntry` em `ledgerMath.js`): regista o valor
  real da devolução (pode ser diferente do que faltava) + uma segunda
  entrada explícita "Perdão da diferença" que zera o saldo — nunca se força
  a escrever um valor fictício.
- `get_mirror_settlement` (security definer): pré-seleciona no ecrã de
  aceitar a forma de pagamento que o remetente já escolheu.

## Interligação Registo ↔ Amigos

- "Paguei por ele" exige sempre conta+categoria (igual ao Registo rápido) —
  sem checkbox opcional. Devoluções perderam "Dinheiro, sem conta" (fica só
  "Entrou numa conta tua" — que pode ser uma conta "Dinheiro" física — e
  "Descontado noutra coisa", mantido por ser um caso genuinamente diferente
  sem movimento de dinheiro).
- A `view` `movements` ganhou uma terceira origem (`source = 'ledger'`):
  movimentos de amigo sem `transaction_id` aparecem misturados na lista
  principal de Registo, por ordem cronológica, com paginação/filtros/
  pesquisa a funcionar em cima — não uma secção à parte (tentativa
  rejeitada pelo Francisco). **Atenção**: `create or replace view` não
  deixa mudar o tipo de uma coluna calculada (`amount` via `abs()` infere
  `numeric` genérico) — usar `drop view` + `create view`.
- Ligação ao amigo sempre visível nas linhas de Registo (não só ao editar).
- "Voltar" na página do amigo usa `navigate(-1)` — volta à posição exata em
  Registo em vez de ir sempre para a lista de Amigos.

## Dividir gasto por várias pessoas

Registo rápido: "Dividir com amigos?" aceita agora várias linhas (amigo +
valor cada), "Dividir por igual" ou valores específicos. Uma transação no
valor total + uma entrada de conta-corrente por pessoa (só a parte dela),
todas ligadas à mesma transação; tudo ou nada no submit (rollback via
`cancelPendingEntry`/`deleteLocalEntryById` + `deleteTransaction` se algo
falhar a meio).

## Modal de detalhe em Registo

Clicar numa linha abre um modal (editar/apagar transação, apagar
transferência, ou as mesmas ações da página do amigo — reaproveita
`LedgerEntryRow`/`PendingEntryActions`, sem duplicar lógica). Substitui a
edição em linha, que tinha lápis/lixo só nalgumas linhas sem explicação.

**Bug descoberto ao testar no iPhone real**: `<dialog>` + `showModal()` não
se comportava como modal — renderizava encaixado no fluxo normal da página,
sem backdrop. Afetava **todos** os popups da app (não só o novo). Corrigido
com `Modal.jsx` próprio (overlay fixo + bottom sheet), usado também pelo
`ConfirmDialog` existente. As regras CSS antigas (`.confirm-dialog[open]`,
`html:has(dialog[open])`) foram substituídas por `.modal-overlay`/`.modal-sheet`.

## Módulo Perfil (novo)

`/perfil`, ícone no cabeçalho (fora da bottom nav): dados pessoais (nome
editável, avatar com upload — bucket `avatars`, `list_friend_avatars()`
expõe só o caminho a amigos ligados), telefone/MB Way (movidos de Gestão),
Objetivos e Notas (texto livre, paginados, sem ligação a dinheiro). "Sair"
saiu do cabeçalho de todas as páginas, só existe aqui.

## Migrations desta sessão (ordem)

```
20261025010000_fix_ledger_guard_and_opening_race
20261026000000_loan_categories
20261027000000_personal_module
20261028000000_avatars
20261029000000_link_shared_expense_transaction
20261030000000_mirror_settlement_hint
20261031000000_unilateral_counting
20261101000000_no_auto_reversal
20261102000000_movements_include_offset_entries
```

Todas confirmadas aplicadas em produção. A `20261031000000` falhou da
primeira vez por um `|` colado ao comando (PowerShell); a `20261102000000`
falhou por erro de tipo na view (ver acima) — ambas corrigidas e reaplicadas.

## Por fazer

- **Testar tudo ao vivo** — grande parte do fim da sessão (split por várias
  pessoas, modal novo, correção do popup) nunca foi visto em uso real.
- Verificação de telefone nos pedidos de amizade (OTP/SMS) — continua sem
  nada, qualquer pessoa pode reivindicar um número que não é dela.
- Ambição de "SaaS" na vertente de Amigos — só conversa, nada construído.
