import { COUNTING_STATUSES } from './linkedLogic.js'

// Valores em cêntimos para evitar erros de vírgula flutuante (0.1 + 0.2 = 0.3).
// Saldo positivo = o amigo deve-me; negativo = eu devo-lhe.
const cents = (value) => Math.round(Number(value) * 100)

// Sinal de cada tipo de movimento no saldo.
const SIGNS = {
  paid_for_them: 1, // paguei por ele
  paid_for_me: -1, // ele pagou por mim
  repaid_to_me: -1, // ele devolveu-me
  repaid_to_them: 1, // devolvi-lhe
}

const LABELS = {
  paid_for_them: 'paguei por ele',
  paid_for_me: 'ele pagou por mim',
  repaid_to_me: 'ele devolveu-me',
  repaid_to_them: 'devolvi-lhe',
}

export const KINDS = Object.freeze(Object.keys(SIGNS))

export function signedCents(kind, amount) {
  if (!Object.hasOwn(SIGNS, kind)) throw new Error(`Tipo de movimento desconhecido: ${kind}`)
  return SIGNS[kind] * cents(amount)
}

export function balanceOf(entries) {
  // Movimentos sem estado (antigos/locais) contam como confirmados.
  return (
    entries
      .filter((e) => COUNTING_STATUSES.includes(e.status ?? 'confirmed'))
      .reduce((sum, e) => sum + signedCents(e.kind, e.amount), 0) / 100
  )
}

export function describeBalance(balance) {
  const c = cents(balance)
  if (c > 0) return { state: 'owes_me', amount: c / 100 }
  if (c < 0) return { state: 'i_owe', amount: -c / 100 }
  return { state: 'even', amount: 0 }
}

// Movimento que zera o saldo; null se já estiverem quites.
export function suggestedRepayment(balance) {
  const { state, amount } = describeBalance(balance)
  if (state === 'owes_me') return { kind: 'repaid_to_me', amount }
  if (state === 'i_owe') return { kind: 'repaid_to_them', amount }
  return null
}

export function entryLabel(kind) {
  return LABELS[kind]
}
