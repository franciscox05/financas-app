// Registo rápido associado a um amigo da lista (em vez de escrever o nome).
// Gasto: o amigo fica a dever-me (paid_for_them). Ganho: o amigo devolveu-me (repaid_to_me).
export function friendEntryKind(type) {
  return type === 'income' ? 'repaid_to_me' : 'paid_for_them'
}

// 'local'            -> cria a transação e liga-lhe o movimento do conta-corrente.
// 'shared-expense'   -> cria a transação e envia o movimento ao amigo para confirmar.
// 'shared-repayment' -> não cria transação: o servidor cria-a quando o amigo confirmar
//                       (como na devolução do conta-corrente), senão ficava duplicada.
export function friendEntryMode(type, friendStatus) {
  if (friendStatus !== 'connected') return 'local'
  return type === 'income' ? 'shared-repayment' : 'shared-expense'
}
