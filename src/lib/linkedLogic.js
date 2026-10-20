// Lógica pura dos amigos ligados (pedidos, movimentos partilhados), separada
// da camada de dados para se poder testar sem Supabase.

// Estados que entram no saldo; os restantes (pending, declined, cancelled,
// archived) não contam.
export const COUNTING_STATUSES = ['confirmed', 'cancel_requested']

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
      return { text: 'Anulado', tone: 'muted' }
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
