import { supabase } from './supabase'
import { notifyPendingChanged } from './pendingEvents'

// Canal privado do utilizador: a base de dados envia um broadcast quando chega um pedido ou
// movimento. Devolve a função para cancelar a subscrição.
export function subscribeLiveUpdates(userId) {
  const channel = supabase
    .channel(`user:${userId}`, { config: { private: true } })
    .on('broadcast', { event: 'changed' }, () => notifyPendingChanged())
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
