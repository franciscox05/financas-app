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

// Neutros em género: o amigo tanto pode ser "ele" como "ela".
const LABELS = {
  paid_for_them: 'paguei eu',
  paid_for_me: 'pagou por mim',
  repaid_to_me: 'devolveu-me',
  repaid_to_them: 'devolvi-lhe',
}

export const KINDS = Object.freeze(Object.keys(SIGNS))

export function signedCents(kind, amount) {
  if (!Object.hasOwn(SIGNS, kind)) throw new Error(`Tipo de movimento desconhecido: ${kind}`)
  return SIGNS[kind] * cents(amount)
}

// Conta para o saldo: confirmado/anulação pedida (movimentos sem estado, antigos/locais,
// contam como confirmados) — ou ainda pendente/contestado mas criado por quem está a ver
// as suas próprias linhas. Quem cria um movimento partilhado já o vê contar do seu lado,
// mesmo que o amigo recuse ("declined" é só um aviso, nunca reverte sozinho); só o saldo
// da OUTRA pessoa é que espera pela confirmação dela.
export function entryCounts(entry) {
  const status = entry.status ?? 'confirmed'
  if (COUNTING_STATUSES.includes(status)) return true
  if (status === 'pending' || status === 'declined') return entry.created_by === entry.user_id
  return false
}

export function balanceOf(entries) {
  return entries.filter(entryCounts).reduce((sum, e) => sum + signedCents(e.kind, e.amount), 0) / 100
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

// Movimento que perdoa a diferença depois de uma devolução por um valor diferente
// do que faltava (ex.: pagou 12€ de um bilhete quando só faltavam 9,99€, mas
// combinaram ficar quites na mesma) — zera o saldo que ficou depois dessa
// devolução, sem mexer no valor real já registado. null se não sobra diferença.
export function forgivenessEntry(kind, balanceBefore, amount) {
  const balanceAfter = balanceBefore + signedCents(kind, amount) / 100
  return suggestedRepayment(balanceAfter)
}

export function entryLabel(kind) {
  return LABELS[kind]
}

// Totais históricos (desde sempre), por direção — ao contrário do saldo, uma devolução
// não reduz o que já foi emprestado: só diz quanto falta. Útil para "quanto já lhe
// emprestei no total", independente de já estar tudo pago ou não.
export function lifetimeTotals(entries) {
  const counting = entries.filter(entryCounts)
  const sumKind = (kind) =>
    counting.filter((e) => e.kind === kind).reduce((total, e) => total + cents(e.amount), 0) / 100
  return {
    lent: sumKind('paid_for_them'),
    borrowed: sumKind('paid_for_me'),
    repaidToMe: sumKind('repaid_to_me'),
    repaidToThem: sumKind('repaid_to_them'),
  }
}
