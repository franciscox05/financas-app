// Bloqueio da app com Face ID / Touch ID / impressão digital / código do
// telemóvel, via WebAuthn (o autenticador do próprio aparelho). Sem servidor:
// a credencial fica só neste aparelho e serve apenas para confirmar que quem
// abre a app é o dono do telemóvel.
//
// O que isto é e o que não é: é um cadeado no ecrã (como o das apps dos
// bancos), não cifra os dados guardados no aparelho. Quem não passar o
// cadeado só pode terminar sessão e entrar com a password.
//
// Quando pede: sempre que a app é aberta de novo (carregamento novo da página
// ou depois de fechar o separador/a app). Voltar de outra app sem fechar não
// pede. A marca de "desbloqueado" vive em sessionStorage, que o browser apaga
// ao fechar o separador.

const ENABLED_KEY = (userId) => `stingy.appLock.${userId}`
const UNLOCKED_KEY = 'stingy.appLock.unlocked'

function safeGet(storage, key) {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(storage, key, value) {
  try {
    if (value === null) storage.removeItem(key)
    else storage.setItem(key, value)
  } catch {
    // modo privado sem armazenamento: o bloqueio simplesmente não fica ligado
  }
}

const toBase64Url = (buffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const fromBase64Url = (text) => {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

const randomChallenge = () => crypto.getRandomValues(new Uint8Array(32))

export async function isAppLockSupported() {
  try {
    return (
      typeof window !== 'undefined' &&
      Boolean(window.PublicKeyCredential) &&
      (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    )
  } catch {
    return false
  }
}

export function isAppLockEnabled(userId) {
  return Boolean(userId && safeGet(localStorage, ENABLED_KEY(userId)))
}

export function isUnlockedThisSession(userId) {
  return safeGet(sessionStorage, UNLOCKED_KEY) === userId
}

export function markUnlocked(userId) {
  safeSet(sessionStorage, UNLOCKED_KEY, userId)
}

// Liga o bloqueio: cria uma credencial no autenticador do aparelho (pede o
// Face ID/impressão digital uma vez) e guarda só o id dela.
export async function enableAppLock(user) {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: 'Stingy' },
      user: {
        id: new TextEncoder().encode(user.id),
        name: user.email ?? 'Stingy',
        displayName: user.user_metadata?.full_name || user.email || 'Stingy',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'discouraged',
      },
      timeout: 60000,
      attestation: 'none',
    },
  })
  if (!credential) throw new Error('cancelled')
  safeSet(localStorage, ENABLED_KEY(user.id), toBase64Url(credential.rawId))
  markUnlocked(user.id)
}

export function disableAppLock(userId) {
  safeSet(localStorage, ENABLED_KEY(userId), null)
}

// Pede o Face ID/impressão digital. Resolve true se a pessoa passou.
export async function unlockApp(userId) {
  const id = safeGet(localStorage, ENABLED_KEY(userId))
  if (!id) return true
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials: [{ type: 'public-key', id: fromBase64Url(id) }],
      userVerification: 'required',
      timeout: 60000,
    },
  })
  if (!assertion) return false
  markUnlocked(userId)
  return true
}
