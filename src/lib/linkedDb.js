import { supabase } from './supabase'
import { getCurrentUserId } from './db'

// As funções RPC levantam mensagens em português; mostram-se tal e qual.
async function rpc(name, params) {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw new Error(error.message)
  return data
}

export async function sendFriendRequest({ friendId, email }) {
  await rpc('send_friend_request', { p_friend_id: friendId, p_email: email })
}

export async function cancelFriendRequest(id) {
  await rpc('cancel_friend_request', { p_id: id })
}

export async function respondFriendRequest(id, accept) {
  await rpc('respond_friend_request', { p_id: id, p_accept: accept })
}

export async function listIncomingRequests() {
  return (await rpc('list_incoming_requests')) ?? []
}

// A tabela só é legível por quem enviou o pedido (RLS); devolve o mais recente.
export async function getOutgoingRequest(friendId) {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id, status, to_email, created_at')
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

// Número para o emblema da navegação: pedidos de amizade + movimentos por responder.
export async function countPendingForMe() {
  const [requests, entries] = await Promise.all([listIncomingRequests(), listPendingForMe()])
  return requests.length + entries.length
}

export async function shareOpeningBalance(friendId) {
  return rpc('share_opening_balance', { p_friend_id: friendId })
}
