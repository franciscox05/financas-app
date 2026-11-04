import { invalidateAccountsCache } from './db'
import { notifyPendingChanged } from './pendingEvents'
import { supabase } from './supabase'

// Uma ação do amigo mexe em várias linhas de uma vez (o movimento dele, o espelho do nosso lado,
// o pedido…), e a base de dados envia um broadcast por linha. Junta-se a rajada num único
// recarregamento em vez de as páginas de Amigos pedirem tudo 3 ou 4 vezes seguidas.
const BURST_MS = 250
let timer = null

// Recarrega o que pode ter mudado fora desta aba: saldos das contas (cache em memória) e as
// páginas que ouvem `onPendingChanged` (Amigos, conta-corrente, pedidos, emblema da navegação).
export function refreshLiveData() {
  clearTimeout(timer)
  timer = null
  invalidateAccountsCache()
  notifyPendingChanged()
}

function scheduleRefresh() {
  clearTimeout(timer)
  timer = setTimeout(refreshLiveData, BURST_MS)
}

// Canal privado do utilizador: a base de dados envia um broadcast sempre que muda um amigo, um
// pedido ou um movimento que lhe diz respeito. Devolve a função para cancelar a subscrição.
export function subscribeLiveUpdates(userId) {
  const channel = supabase
    .channel(`user:${userId}`, { config: { private: true } })
    .on('broadcast', { event: 'changed' }, scheduleRefresh)
    .subscribe()
  return () => {
    clearTimeout(timer)
    timer = null
    supabase.removeChannel(channel)
  }
}
