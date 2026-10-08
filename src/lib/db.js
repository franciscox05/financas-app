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
