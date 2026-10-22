// Lógica pura dos amigos ligados (pedidos, movimentos partilhados), separada
// da camada de dados para se poder testar sem Supabase.

// Estados que entram no saldo; os restantes (pending, declined, cancelled,
// archived) não contam.
export const COUNTING_STATUSES = ['confirmed', 'cancel_requested']

// Mensagem do servidor quando o amigo já está ligado e o movimento tem de ser partilhado.
export function isSharedGuardError(err) {
  return String(err?.message ?? '').startsWith('Com um amigo ligado')
}

// Texto e tom do estado de um movimento, do ponto de vista de quem vê.
// Movimentos confirmados não precisam de rótulo.
export function entryStatusLabel(entry, viewerId) {
  switch (entry.status) {
    case 'pending':
      return entry.created_by === viewerId
        ? { text: 'À espera que ele confirme', tone: 'waiting' }
        : { text: 'Pendente de confirmação', tone: 'action' }
    case 'declined': {
      const note = String(entry.decline_note ?? '').trim()
      return { text: note ? `Contestado: ${note}` : 'Contestado', tone: 'danger' }
    }
    case 'cancel_requested':
      return { text: 'Anulação pedida', tone: 'waiting' }
    case 'cancelled':
      // Anulação mútua de um movimento confirmado: cancel_requested_by fica preenchido.
      if (entry.cancel_requested_by) return { text: 'Anulado', tone: 'muted' }
      return { text: entry.created_by === viewerId ? 'Cancelado por ti' : 'Cancelado', tone: 'muted' }
    case 'archived':
      return { text: 'Arquivado', tone: 'muted' }
    default:
      return { text: '', tone: 'none' }
  }
}

// Só o destinatário (quem não criou) pode confirmar/contestar um pendente.
export function canRespond(entry, viewerId) {
  return entry.status === 'pending' && Boolean(entry.mirror_id) && entry.created_by !== viewerId
}

export function canRequestCancel(entry) {
  return entry.status === 'confirmed' && Boolean(entry.mirror_id)
}

// `request` é o último pedido que enviei a este amigo (ou null).
export function friendStateLabel(friend, request) {
  if (friend.status === 'connected') return 'Ligado'
  if (request?.status === 'pending') return 'Pedido enviado'
  if (request?.status === 'awaiting_confirmation') return 'À espera de confirmação'
  if (request?.status === 'declined') return 'Recusado'
  if (friend.status === 'invited') return 'Pedido enviado'
  return 'Local'
}

// E-mail em minúsculas e sem espaços; null se o formato não for válido.
export function normalizeEmail(raw) {
  const email = String(raw ?? '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

// Como entryStatusLabel, mas com o nome do amigo no lugar de "ele".
export function entryStatusText(entry, viewerId, friendName) {
  const label = entryStatusLabel(entry, viewerId)
  const name = friendName || 'ele'
  if (entry.status === 'pending' && entry.created_by === viewerId) {
    return { ...label, text: `À espera que ${name} confirme` }
  }
  if (entry.status === 'cancel_requested') {
    return entry.cancel_requested_by === viewerId
      ? { ...label, text: `Anulação pedida. À espera de ${name}.` }
      : { text: `${name} quer anular este movimento`, tone: 'action' }
  }
  return label
}

// Movimentos privados (sem espelho) ainda confirmados: base do "saldo anterior".
export function privateConfirmedEntries(entries) {
  return entries.filter((e) => !e.mirror_id && (e.status ?? 'confirmed') === 'confirmed' && !e.is_opening)
}

// Já há um saldo anterior à espera de resposta?
export function hasPendingOpening(entries) {
  return entries.some((e) => e.is_opening && e.status === 'pending')
}

// Quem pediu a anulação foi o outro? (a resposta é minha)
export function isCancelRequestForMe(entry, viewerId) {
  return entry.status === 'cancel_requested' && Boolean(entry.mirror_id) && entry.cancel_requested_by !== viewerId
}

// Pedidos recebidos que exigem ação minha: os que já aceitei e aguardam a
// confirmação do remetente (awaiting) não contam.
export function countActionableRequests(requests) {
  return requests.filter((r) => !r.awaiting).length
}

// Apagar/editar a transação de um movimento declined/cancelled/archived não faz mal
// (já não conta para nada); pending/confirmed/cancel_requested ainda são "reais" e têm
// de ser geridos a partir da página do amigo, nunca apagando a transação por baixo.
export function blocksTransactionEdit(entry) {
  return ['pending', 'confirmed', 'cancel_requested'].includes(entry?.status)
}

// Mensagem a mostrar quando blocksTransactionEdit(entry) é true.
export function transactionLinkedMessage(entry) {
  if (entry.status === 'pending') {
    return `Este gasto tem um pedido pendente com ${entry.friendName}. Cancela o pedido na página dele antes de editar ou apagar esta transação.`
  }
  return `Este gasto está ligado a um movimento com ${entry.friendName}. Gere isso na página dele — apagar esse movimento também apaga esta transação.`
}
