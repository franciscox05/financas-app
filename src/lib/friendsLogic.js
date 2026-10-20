// Lógica pura da camada de dados de amigos, separada de friendsDb.js para se
// poder testar sem Supabase.
import { normalizePhone } from './contactMessage.js'

// O telefone do amigo guarda-se normalizado (só dígitos com indicativo).
// Vazio -> null; preenchido mas inválido -> erro, para não guardar lixo.
export function phoneForStorage(raw) {
  if (raw == null || String(raw).trim() === '') return null
  const phone = normalizePhone(raw)
  if (!phone) throw new Error('Número de telefone inválido.')
  return phone
}

// O MB Way guarda-se só com os 9 dígitos locais: o texto do lembrete
// (formatMbway) só formata bem números de 9 dígitos. Se o normalizePhone
// devolver um 351 + 9 dígitos, tira-se o indicativo.
export function mbwayForStorage(raw) {
  if (raw == null || String(raw).trim() === '') return null
  const phone = normalizePhone(raw)
  if (!phone) throw new Error('Número de telefone inválido.')
  if (phone.length === 12 && phone.startsWith('351')) return phone.slice(3)
  return phone
}

// Uma devolução em dinheiro que me entra é um ganho; uma que eu faço é um gasto.
export function repaymentTransactionType(kind) {
  return kind === 'repaid_to_me' ? 'income' : 'expense'
}

// Devolução via banco precisa de conta e categoria para criar a transação;
// com dinheiro vivo ou compensação ignoram-se (não há movimento bancário).
export function checkRepaymentInput({ settlement, accountId, categoryId }) {
  if (settlement === 'bank' && (!accountId || !categoryId)) {
    throw new Error('Escolhe a conta e a categoria.')
  }
}

// Saldo ≠ 0 em cêntimos (evita falsos positivos de vírgula flutuante).
export function hasOpenBalance(balance) {
  return Math.round(Number(balance ?? 0) * 100) !== 0
}
