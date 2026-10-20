import { supabase } from './supabase'
import { createTransaction, getCurrentUserId } from './db'
import { validateName } from './names'
import {
  phoneForStorage,
  mbwayForStorage,
  repaymentTransactionType,
  checkRepaymentInput,
  hasOpenBalance,
} from './friendsLogic'

// Amigos + saldo. A view `friend_balances` não tem linha para amigos sem
// movimentos, por isso o saldo assume 0 quando falta (em vez de um join que
// os esconderia).
export async function listFriendsWithBalance() {
  const [friendsRes, balancesRes] = await Promise.all([
    supabase.from('friends').select('*').order('name'),
    supabase.from('friend_balances').select('friend_id, balance'),
  ])
  if (friendsRes.error) throw friendsRes.error
  if (balancesRes.error) throw balancesRes.error

  const balances = new Map(balancesRes.data.map((b) => [b.friend_id, Number(b.balance)]))
  return friendsRes.data.map((f) => ({ ...f, balance: balances.get(f.id) ?? 0 }))
}

// Os nomes são únicos por utilizador (sem acentos nem maiúsculas); a
// validação é feita aqui contra a lista atual, como nas contas/categorias.
async function validateFriendName(rawName, selfId = null) {
  const { data, error } = await supabase.from('friends').select('id, name')
  if (error) throw error
  const { name, error: nameError } = validateName(rawName, data, selfId)
  if (nameError) throw new Error(nameError)
  return name
}

export async function createFriend({ name, phone }) {
  const ownerId = await getCurrentUserId()
  const validName = await validateFriendName(name)

  const { data, error } = await supabase
    .from('friends')
    .insert({ owner_id: ownerId, name: validName, phone: phoneForStorage(phone) })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateFriend({ id, name, phone }) {
  const validName = await validateFriendName(name, id)

  const { data, error } = await supabase
    .from('friends')
    .update({ name: validName, phone: phoneForStorage(phone) })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Só se apaga quem não deve nada nem tem nada a receber: apagar com saldo
// faria desaparecer (em cascata) o histórico de uma dívida ainda em aberto.
export async function deleteFriend(id) {
  const { data, error: balanceError } = await supabase
    .from('friend_balances')
    .select('balance')
    .eq('friend_id', id)
    .maybeSingle()
  if (balanceError) throw balanceError
  if (hasOpenBalance(data?.balance)) {
    throw new Error('Ainda há saldo por acertar com esta pessoa.')
  }

  const { error } = await supabase.from('friends').delete().eq('id', id)
  if (error) throw error
}

export async function listEntries(friendId) {
  const { data, error } = await supabase
    .from('ledger_entries')
    .select('*')
    .eq('friend_id', friendId)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

async function insertEntry(fields) {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('ledger_entries')
    .insert({ user_id: userId, ...fields })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createExpense({ friendId, kind, amount, note, occurredOn, dueOn }) {
  return insertEntry({
    friend_id: friendId,
    kind,
    amount,
    note: note || null,
    occurred_on: occurredOn,
    due_on: dueOn || null,
  })
}

// Devolução via banco: cria primeiro a transação na conta e só depois o
// movimento que a referencia; se o movimento falhar apaga a transação, para
// não ficar dinheiro "movido" na conta sem registo no conta-corrente
// (mesmo padrão de addDebtPayment). Com dinheiro vivo ou compensação não há
// movimento bancário, por isso conta e categoria são ignoradas.
export async function createRepayment({
  friendId,
  kind,
  amount,
  note,
  occurredOn,
  settlement,
  accountId,
  categoryId,
}) {
  checkRepaymentInput({ settlement, accountId, categoryId })

  let transaction = null
  if (settlement === 'bank') {
    transaction = await createTransaction({
      amount,
      type: repaymentTransactionType(kind),
      accountId,
      categoryId,
      occurredOn,
      note: note || 'Conta-corrente com amigo',
    })
  }

  try {
    return await insertEntry({
      friend_id: friendId,
      kind,
      amount,
      note: note || null,
      occurred_on: occurredOn,
      settlement,
      transaction_id: transaction?.id ?? null,
    })
  } catch (err) {
    if (transaction) await supabase.from('transactions').delete().eq('id', transaction.id)
    throw err
  }
}

// Apaga o movimento e depois, se era uma devolução via banco, a transação que
// criou (a FK é on delete set null, não em cascata, por isso é explícito).
export async function deleteEntry(entry) {
  const { error } = await supabase.from('ledger_entries').delete().eq('id', entry.id)
  if (error) throw error

  if (entry.settlement === 'bank' && entry.transaction_id) {
    const { error: txError } = await supabase.from('transactions').delete().eq('id', entry.transaction_id)
    if (txError) throw txError
  }
}

export async function getMyMbwayPhone() {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('profiles')
    .select('mbway_phone')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.mbway_phone ?? null
}

// Upsert: garante que funciona mesmo que a linha de perfil ainda não exista.
export async function saveMbwayPhone(phone) {
  const userId = await getCurrentUserId()
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, mbway_phone: mbwayForStorage(phone) })
  if (error) throw error
}
