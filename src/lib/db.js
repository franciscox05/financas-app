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
