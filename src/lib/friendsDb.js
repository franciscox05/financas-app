import { supabase } from './supabase'
import { createTransaction, getCurrentUserId } from './db'
import { validateName } from './names'
import { listFriendAvatars, sendFriendRequestByPhone } from './linkedDb'
import {
  phoneForStorage,
  mbwayForStorage,
  repaymentTransactionType,
  checkRepaymentInput,
  hasOpenBalance,
  repaymentNote,
  friendNameError,
  phoneForProfile,
  requestLinkFailure,
} from './friendsLogic'

// Amigos + saldo. A view `friend_balances` não tem linha para amigos sem
// movimentos, por isso o saldo assume 0 quando falta (em vez de um join que
// os esconderia). A foto só existe para quem está "connected" — falha
// silenciosamente (sem foto) se o pedido da foto falhar, para não bloquear a
// lista por causa de um extra.
export async function listFriendsWithBalance() {
  const [friendsRes, balancesRes, avatars] = await Promise.all([
    supabase.from('friends').select('*').order('name'),
    supabase.from('friend_balances').select('friend_id, balance'),
    listFriendAvatars().catch(() => new Map()),
  ])
  if (friendsRes.error) throw friendsRes.error
  if (balancesRes.error) throw balancesRes.error

  // friends.* inclui status e linked_user_id.
  const balances = new Map(balancesRes.data.map((b) => [b.friend_id, Number(b.balance)]))
  return friendsRes.data.map((f) => ({
    ...f,
    balance: balances.get(f.id) ?? 0,
    avatarPath: avatars.get(f.id) ?? null,
  }))
}

// Os nomes são únicos por utilizador (sem acentos nem maiúsculas); a
// validação é feita aqui contra a lista atual, como nas contas/categorias.
async function validateFriendName(rawName, selfId = null) {
  const { data, error } = await supabase.from('friends').select('id, name')
  if (error) throw error
  const { name, error: nameError } = validateName(rawName, data, selfId)
  if (nameError) throw new Error(friendNameError(nameError))
  return name
}

// Com `requestLink` e telefone guardado, envia logo o pedido de ligação. Se o
// pedido falhar o amigo mantém-se e o erro começa por 'Amigo criado, mas '.
export async function createFriend({ name, phone, requestLink = false }) {
  const ownerId = await getCurrentUserId()
  const validName = await validateFriendName(name)

  const { data, error } = await supabase
    .from('friends')
    .insert({ owner_id: ownerId, name: validName, phone: phoneForStorage(phone) })
    .select()
    .single()
  if (error) throw error
  if (requestLink && data.phone) {
    try {
      await sendFriendRequestByPhone(data.id)
    } catch (err) {
      throw requestLinkFailure(err)
    }
  }
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
    throw new Error('Só podes apagar quando estiverem quites.')
  }

  const { error } = await supabase.from('friends').delete().eq('id', id)
  if (error) throw error
}

// select('*') inclui status, mirror_id, created_by, decline_note,
// cancel_requested_by e is_opening dos movimentos ligados.
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

// Um movimento + o amigo a que pertence, para o modal de detalhe em Registo
// mostrar as mesmas ações (aceitar/contestar/cancelar/apagar) que já existem
// na página do amigo, sem duplicar essa lógica.
export async function getLedgerEntry(id) {
  const { data: entry, error } = await supabase.from('ledger_entries').select('*').eq('id', id).single()
  if (error) throw error
  const { data: friend, error: friendError } = await supabase
    .from('friends')
    .select('*')
    .eq('id', entry.friend_id)
    .single()
  if (friendError) throw friendError
  return { entry, friend }
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

export async function createExpense({ friendId, kind, amount, note, occurredOn, dueOn, transactionId }) {
  return insertEntry({
    friend_id: friendId,
    kind,
    amount,
    note: note || null,
    occurred_on: occurredOn,
    due_on: dueOn || null,
    transaction_id: transactionId || null,
  })
}

// Movimento ligado a uma transação já criada (registo rápido com amigo).
export async function createLinkedEntry({ friendId, kind, amount, note, occurredOn, settlement, transactionId }) {
  return insertEntry({
    friend_id: friendId,
    kind,
    amount,
    note: note || null,
    occurred_on: occurredOn,
    settlement: settlement || null,
    transaction_id: transactionId,
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
  friendName,
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
      note: repaymentNote(note, friendName),
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
    if (transaction) {
      const { error: cleanupError } = await supabase.from('transactions').delete().eq('id', transaction.id)
      if (cleanupError) {
        throw new Error(
          `${err.message} (e a transação ${transaction.id} ficou órfã: ${cleanupError.message})`,
        )
      }
    }
    throw err
  }
}

// Apaga primeiro a transação (se existir) e só depois o movimento, para que uma falha a meio
// nunca deixe o movimento desaparecido com a transação ainda na conta (o inverso do que fazia
// antes: apagar o movimento primeiro arriscava perder a única referência à transação a apagar
// se o segundo delete falhasse). A FK é on delete set null, não em cascata, por isso é explícito.
export async function deleteEntry(entry) {
  if (entry.settlement === 'bank' && entry.transaction_id) {
    const { error: txError } = await supabase.from('transactions').delete().eq('id', entry.transaction_id)
    if (txError) throw txError
  }

  const { error } = await supabase.from('ledger_entries').delete().eq('id', entry.id)
  if (error) throw error
}

// Rollback de uma entrada local (amigo não ligado) criada a meio de um gasto
// dividido por várias pessoas que falhou a meio — delete direto pelo id, sem
// mexer em nenhuma transação (essa é apagada à parte, é partilhada por todos).
export async function deleteLocalEntryById(id) {
  const { error } = await supabase.from('ledger_entries').delete().eq('id', id)
  if (error) throw error
}

// Movimento (de um amigo) ligado a uma transação, se existir — para avisar antes de
// editar/apagar a transação em Registo que isso também mexe no conta-corrente.
export async function getLedgerEntryForTransaction(transactionId) {
  const map = await getLedgerEntriesForTransactions([transactionId])
  return map.get(transactionId) ?? null
}

// Versão em lote, para uma página inteira de Registo de uma vez (1 pedido, não 1 por linha).
export async function getLedgerEntriesForTransactions(transactionIds) {
  const ids = transactionIds.filter(Boolean)
  if (ids.length === 0) return new Map()

  const { data, error } = await supabase
    .from('ledger_entries')
    .select('transaction_id, friend_id, status, mirror_id, kind')
    .in('transaction_id', ids)
  if (error) throw error
  if (data.length === 0) return new Map()

  const friendIds = [...new Set(data.map((d) => d.friend_id))]
  const { data: friends, error: friendsError } = await supabase.from('friends').select('id, name').in('id', friendIds)
  if (friendsError) throw friendsError
  const names = new Map(friends.map((f) => [f.id, f.name]))

  return new Map(data.map((d) => [d.transaction_id, { ...d, friendName: names.get(d.friend_id) ?? 'um amigo' }]))
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

export async function getMyPhone() {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.phone ?? null
}

export async function saveMyPhone(raw) {
  const userId = await getCurrentUserId()
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, phone: phoneForProfile(raw) })
  if (error) throw error
}

