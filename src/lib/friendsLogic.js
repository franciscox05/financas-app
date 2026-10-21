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

// Número do perfil (profiles.phone): portugueses guardam-se com os 9 dígitos
// locais, os outros internacionais só com dígitos (9 a 15).
export function phoneForProfile(raw) {
  if (raw == null || String(raw).trim() === '') return null
  const phone = normalizePhone(raw)
  if (!phone) throw new Error('Número de telefone inválido.')
  if (phone.length === 12 && phone.startsWith('351')) return phone.slice(3)
  return phone
}

// O amigo ficou criado mas o pedido de ligação falhou: o erro leva a mensagem
// do servidor para a UI mostrar tal e qual.
export function requestLinkFailure(err) {
  return new Error(`Amigo criado, mas ${err?.message ?? 'não foi possível enviar o pedido.'}`)
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

// Nota da transação bancária de uma devolução: a que o utilizador escreveu ou,
// em falta dela, o nome do amigo.
export function repaymentNote(note, friendName) {
  const written = String(note ?? '').trim()
  if (written) return written
  const name = String(friendName ?? '').trim()
  return name ? `Conta-corrente: ${name}` : 'Conta-corrente com amigo'
}

// names.js é partilhado com contas/categorias e fala em "item"; para amigos
// a mensagem de nome repetido é mais clara.
export function friendNameError(message) {
  return message === 'Já existe um item com este nome.' ? 'Já tens um amigo com este nome.' : message
}

// Saldo ≠ 0 em cêntimos (evita falsos positivos de vírgula flutuante).
export function hasOpenBalance(balance) {
  return Math.round(Number(balance ?? 0) * 100) !== 0
}
