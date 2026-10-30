// Pequeno canal para avisar o cabeçalho de que a foto de perfil mudou (mesmo
// padrão de pendingEvents.js) — o AppLayout só busca a foto uma vez ao
// montar, isto evita ficar com a antiga depois de um upload no Perfil.
const EVENT = 'avatar-changed'

export function notifyAvatarChanged() {
  window.dispatchEvent(new Event(EVENT))
}

export function onAvatarChanged(callback) {
  window.addEventListener(EVENT, callback)
  return () => window.removeEventListener(EVENT, callback)
}
