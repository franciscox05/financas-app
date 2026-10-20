// Pequeno canal para avisar o emblema da navegação de que os pedidos
// pendentes mudaram (sem dependências nem contexto global).
const EVENT = 'pending-changed'

export function notifyPendingChanged() {
  window.dispatchEvent(new Event(EVENT))
}

// Devolve a função para cancelar a subscrição.
export function onPendingChanged(callback) {
  window.addEventListener(EVENT, callback)
  return () => window.removeEventListener(EVENT, callback)
}
