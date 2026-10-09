import { today } from './dates'
import { supabase } from './supabase'

export async function listAccounts() {
  const { data, error } = await supabase.from('accounts').select('*').order('name')
  if (error) throw error
  return data
}

export async function listCategories() {
  const { data, error } = await supabase.from('categories').select('*').order('name')
  if (error) throw error
  return data
}

export async function listTransactions({ limit = 50 } = {}) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, accounts(name), categories(name)')
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function listTransactionsInRange({ from, to }) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, accounts(name), categories(name)')
    .gte('occurred_on', from)
    .lt('occurred_on', to)
    .order('occurred_on', { ascending: true })
  if (error) throw error
  return data
}

export async function createTransaction({ amount, type, accountId, categoryId, occurredOn, note }) {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userData.user.id,
      amount,
      type,
      account_id: accountId,
      category_id: categoryId,
      occurred_on: occurredOn,
      note: note || null,
    })
    .select('*, accounts(name), categories(name)')
    .single()
  if (error) throw error
  return data
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

export async function updateTransaction(id, fields) {
  const { data, error } = await supabase.from('transactions').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function upsertPushSubscription({ endpoint, p256dh, auth }) {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: userData.user.id, endpoint, p256dh, auth },
      { onConflict: 'user_id,endpoint' },
    )
  if (error) throw error
}

export async function deletePushSubscription(endpoint) {
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw error
}

export async function listRecurringTransactions() {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select('*, accounts(name), categories(name)')
    .eq('active', true)
    .order('day_of_month')
  if (error) throw error
  return data
}

export async function createRecurringTransaction({ accountId, categoryId, amount, type, note, dayOfMonth }) {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const { data, error } = await supabase
    .from('recurring_transactions')
    .insert({
      user_id: userData.user.id,
      account_id: accountId,
      category_id: categoryId,
      amount,
      type,
      note: note || null,
      day_of_month: dayOfMonth,
    })
    .select('*, accounts(name), categories(name)')
    .single()
  if (error) throw error
  return data
}

export async function deleteRecurringTransaction(id) {
  const { error } = await supabase.from('recurring_transactions').delete().eq('id', id)
  if (error) throw error
}

export async function markRecurringGenerated(id, monthIsoDate) {
  const { error } = await supabase
    .from('recurring_transactions')
    .update({ last_generated_month: monthIsoDate })
    .eq('id', id)
  if (error) throw error
}

export async function listBudgets(monthIsoDate) {
  const { data, error } = await supabase.from('budgets').select('*').eq('month', monthIsoDate)
  if (error) throw error
  return data
}

export async function upsertBudget({ categoryId, month, amount }) {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const { data, error } = await supabase
    .from('budgets')
    .upsert(
      { user_id: userData.user.id, category_id: categoryId, month, amount },
      { onConflict: 'user_id,category_id,month' },
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listAllTransactionsForExport() {
  const { data, error } = await supabase
    .from('transactions')
    .select('occurred_on, type, amount, note, accounts(name), categories(name)')
    .order('occurred_on', { ascending: false })
    .limit(10000)
  if (error) throw error
  return data
}

export async function listAllTransactionsForBalance() {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount, type, occurred_on, account_id')
  if (error) throw error
  return data
}

export async function listNetWorthSnapshots() {
  const { data, error } = await supabase
    .from('net_worth_snapshots')
    .select('*, accounts(name)')
    .order('snapshot_date', { ascending: false })
  if (error) throw error
  return data
}

export async function createSnapshot({ accountId, value, snapshotDate }) {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const { data, error } = await supabase
    .from('net_worth_snapshots')
    .insert({
      user_id: userData.user.id,
      account_id: accountId,
      value,
      snapshot_date: snapshotDate,
    })
    .select('*, accounts(name)')
    .single()
  if (error) throw error
  return data
}

export async function deleteSnapshot(id) {
  const { error } = await supabase.from('net_worth_snapshots').delete().eq('id', id)
  if (error) throw error
}

export async function listDebts() {
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createDebt({ direction, counterpartyName, amount, note, transactionId }) {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const { data, error } = await supabase
    .from('debts')
    .insert({
      user_id: userData.user.id,
      direction,
      counterparty_name: counterpartyName,
      amount,
      note: note || null,
      transaction_id: transactionId || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function settleDebt({ id, direction, amount, counterpartyName, accountId, categoryId }) {
  const settledTransaction = await createTransaction({
    amount,
    type: direction === 'owed_to_me' ? 'income' : 'expense',
    accountId,
    categoryId,
    occurredOn: today(),
    note: `Dívida: ${counterpartyName}`,
  })

  const { data, error } = await supabase
    .from('debts')
    .update({
      status: 'settled',
      settled_at: new Date().toISOString(),
      settled_transaction_id: settledTransaction.id,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDebt(id) {
  const { error } = await supabase.from('debts').delete().eq('id', id)
  if (error) throw error
}

export async function listSavingsGoals() {
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*, accounts(name, type)')
    .order('created_at')
  if (error) throw error
  return data
}

export async function createSavingsGoal({ name, accountId, targetAmount, targetDate }) {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const { data, error } = await supabase
    .from('savings_goals')
    .insert({
      user_id: userData.user.id,
      name,
      account_id: accountId,
      target_amount: targetAmount,
      target_date: targetDate || null,
    })
    .select('*, accounts(name, type)')
    .single()
  if (error) throw error
  return data
}

export async function deleteSavingsGoal(id) {
  const { error } = await supabase.from('savings_goals').delete().eq('id', id)
  if (error) throw error
}

// --- Gestão de contas e categorias ---------------------------------------
// accounts/categories usam `on delete restrict` nas transações, recorrências e
// snapshots: apagar um item em uso falha com o código 23503 (foreign_key_violation).
const FK_VIOLATION = '23503'

export async function createAccount({ name, type }) {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const { data, error } = await supabase
    .from('accounts')
    .insert({ user_id: userData.user.id, name, type })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function renameAccount(id, name) {
  const { data, error } = await supabase.from('accounts').update({ name }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteAccount(id) {
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error?.code === FK_VIOLATION) {
    throw new Error('Esta conta ainda tem transações, recorrências ou registos de património associados.')
  }
  if (error) throw error
}

export async function createCategory({ name, type }) {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const { data, error } = await supabase
    .from('categories')
    .insert({ user_id: userData.user.id, name, type })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function renameCategory(id, name) {
  const { data, error } = await supabase.from('categories').update({ name }).eq('id', id).select().single()
  if (error) throw error
  return data
}

// Atenção: os orçamentos (budgets) da categoria são apagados em cascata.
export async function deleteCategory(id) {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error?.code === FK_VIOLATION) {
    throw new Error('Esta categoria ainda tem transações ou recorrências associadas.')
  }
  if (error) throw error
}
