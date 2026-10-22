import { supabase } from './supabase'
import { getCurrentUserId } from './db'
import { countActionableRequests } from './linkedLogic'

// As funções RPC levantam mensagens em português; mostram-se tal e qual.
async function rpc(name, params) {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw new Error(error.message)
  return data
}

export async function sendFriendRequest({ friendId, email }) {
  await rpc('send_friend_request', { p_friend_id: friendId, p_email: email })
}

export async function sendFriendRequestByPhone(friendId) {
  await rpc('send_friend_request_phone', { p_friend_id: friendId })
}

export async function confirmFriendRequest(id, confirm, accepterId) {
  await rpc('confirm_friend_request', { p_id: id, p_confirm: confirm, p_accepter: accepterId })
}

// Quem aceitou o pedido por número: nome e dica do email, para o remetente confirmar.
export async function getRequestAccepter(id) {
  const rows = (await rpc('get_request_accepter', { p_id: id })) ?? []
  const row = rows[0]
  return row ? { accepterId: row.accepter_id, name: row.name, emailHint: row.email_hint } : null
}

export async function cancelFriendRequest(id) {
  await rpc('cancel_friend_request', { p_id: id })
}

export async function respondFriendRequest(id, accept) {
  await rpc('respond_friend_request', { p_id: id, p_accept: accept })
}

// Linhas {id, from_name, created_at, via: 'email'|'phone', awaiting}.
export async function listIncomingRequests() {
  return (await rpc('list_incoming_requests')) ?? []
}

// A tabela só é legível por quem enviou o pedido (RLS); devolve o mais recente.
export async function getOutgoingRequest(friendId) {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id, status, to_email, to_phone, created_at')
    .eq('friend_id', friendId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

// Para movimentos "repaid_*" o settlement é bank|cash|offset; nos "paid_*"
// tem de ser null.
export async function createSharedEntry({
  friendId,
  kind,
  amount,
  note,
  occurredOn,
  dueOn,
  settlement,
  accountId,
  categoryId,
  transactionId,
}) {
  return rpc('create_shared_entry', {
    p_friend_id: friendId,
    p_kind: kind,
    p_amount: amount,
    p_note: note || null,
    p_occurred_on: occurredOn,
    p_due_on: dueOn || null,
    p_settlement: settlement || null,
    p_account_id: accountId || null,
    p_category_id: categoryId || null,
    p_transaction_id: transactionId || null,
  })
}

export async function respondEntry({ id, accept, note, settlement, accountId, categoryId }) {
  await rpc('respond_entry', {
    p_id: id,
    p_accept: accept,
    p_note: note || null,
    p_settlement: settlement || null,
    p_account_id: accountId || null,
    p_category_id: categoryId || null,
  })
}

export async function cancelPendingEntry(id) {
  await rpc('cancel_pending_entry', { p_id: id })
}

export async function requestCancel(id) {
  await rpc('request_cancel', { p_id: id })
}

export async function respondCancel(id, accept) {
  await rpc('respond_cancel', { p_id: id, p_accept: accept })
}

// Movimentos que esperam uma resposta minha: pendentes criados pelo outro ou
// anulações pedidas pelo outro.
export async function listPendingForMe() {
  const me = await getCurrentUserId()
  const { data, error } = await supabase
    .from('ledger_entries')
    .select('*')
    .eq('user_id', me)
    .or(
      `and(status.eq.pending,created_by.neq.${me}),and(status.eq.cancel_requested,cancel_requested_by.neq.${me})`,
    )
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

// Número para o emblema da navegação: pedidos de amizade por responder
// (sem os que aguardam o remetente) + movimentos por responder.
export async function countPendingForMe() {
  const [requests, entries] = await Promise.all([listIncomingRequests(), listPendingForMe()])
  return countActionableRequests(requests) + entries.length
}

export async function shareOpeningBalance(friendId) {
  return rpc('share_opening_balance', { p_friend_id: friendId })
}

// Forma de pagamento que o remetente já escolheu para um movimento pendente — para
// pré-selecionar no ecrã de aceitar (continua editável). null se ainda não escolheu.
export async function getMirrorSettlement(id) {
  return rpc('get_mirror_settlement', { p_id: id })
}

// Caminho da foto de cada amigo ligado que já tem uma — {friend_id: avatar_path}.
export async function listFriendAvatars() {
  const rows = (await rpc('list_friend_avatars')) ?? []
  return new Map(rows.map((r) => [r.friend_id, r.avatar_path]))
}
