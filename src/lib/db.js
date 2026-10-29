import { supabase } from './supabase'

// Id do utilizador autenticado, para as tabelas que guardam user_id/owner_id.
export async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user.id
}

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

// Paginação + filtros aplicados no servidor (não em memória), para a
// pesquisa/paginação funcionar sobre todo o histórico, não só sobre um
// bocado já carregado. `smart` vem de lib/smartSearch.js.
export async function listTransactionsPage({
  limit,
  offset,
  type,
  accountId,
  categoryId,
  smart,
}) {
  let q = supabase
    .from('transactions')
    .select('*, accounts(name), categories(name)', { count: 'exact' })

  if (type && type !== 'all') q = q.eq('type', type)
  if (accountId) q = q.eq('account_id', accountId)
  if (categoryId) q = q.eq('category_id', categoryId)

  if (smart?.dateFrom) q = q.gte('occurred_on', smart.dateFrom)
  if (smart?.dateTo) q = q.lt('occurred_on', smart.dateTo)

  if (smart?.amountOp === '>') q = q.gt('amount', smart.amountValue)
  else if (smart?.amountOp === '>=') q = q.gte('amount', smart.amountValue)
  else if (smart?.amountOp === '<') q = q.lt('amount', smart.amountValue)
  else if (smart?.amountOp === '<=') q = q.lte('amount', smart.amountValue)
  else if (smart?.amountOp === '=') q = q.eq('amount', smart.amountValue)

  for (const term of smart?.textTerms ?? []) {
    q = q.ilike('note', `%${term}%`)
  }

  q = q
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await q
  if (error) throw error
  return { rows: data, totalCount: count }
}

// Como listTransactionsPage, mas sobre a view `movements` (transações +
// transferências entre contas), para a lista de "Transações recentes" do
// Registo mostrar tudo o que mexeu nas contas num só sítio — a transferência
// continua a não contar como Gasto/Ganho (o Balanço/Dashboard lê sempre de
// `transactions` diretamente, nunca desta view).
export async function listMovementsPage({ limit, offset, type, accountId, categoryId, smart }) {
  let q = supabase.from('movements').select('*', { count: 'exact' })

  if (type && type !== 'all') q = q.eq('type', type)
  if (accountId) q = q.or(`account_id.eq.${accountId},counter_account_id.eq.${accountId}`)
  if (categoryId) q = q.eq('category_id', categoryId)

  if (smart?.dateFrom) q = q.gte('occurred_on', smart.dateFrom)
  if (smart?.dateTo) q = q.lt('occurred_on', smart.dateTo)

  if (smart?.amountOp === '>') q = q.gt('amount', smart.amountValue)
  else if (smart?.amountOp === '>=') q = q.gte('amount', smart.amountValue)
  else if (smart?.amountOp === '<') q = q.lt('amount', smart.amountValue)
  else if (smart?.amountOp === '<=') q = q.lte('amount', smart.amountValue)
  else if (smart?.amountOp === '=') q = q.eq('amount', smart.amountValue)

  for (const term of smart?.textTerms ?? []) {
    q = q.ilike('note', `%${term}%`)
  }

  q = q
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await q
  if (error) throw error
  return { rows: data, totalCount: count }
}

// Além de `transactions`, inclui transferências marcadas "conta como gasto"
// (ex. investimentos: Conta à Ordem -> XTB) como se fossem um gasto normal —
// só essas, as transferências neutras continuam de fora de propósito (ver
// migração 20261104000000_transfers_count_as_expense.sql).
export async function listTransactionsInRange({ from, to }) {
  const [{ data, error }, { data: trData, error: trError }] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, accounts(name), categories(name)')
      .gte('occurred_on', from)
      .lt('occurred_on', to),
    supabase
      .from('transfers')
      .select('*, accounts:accounts!from_account_id(name), categories(name)')
      .eq('counts_as_expense', true)
      .gte('occurred_on', from)
      .lt('occurred_on', to),
  ])
  if (error) throw error
  if (trError) throw trError

  const transfersAsExpense = trData.map((t) => ({
    id: t.id,
    type: 'expense',
    amount: t.amount,
    account_id: t.from_account_id,
    accounts: t.accounts,
    category_id: t.category_id,
    categories: t.categories,
    note: t.note,
    occurred_on: t.occurred_on,
    created_at: t.created_at,
    source: 'transfer',
  }))

  return [...data, ...transfersAsExpense].sort((a, b) => (a.occurred_on < b.occurred_on ? -1 : 1))
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

export async function createTransactionsBulk(rows) {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const { data, error } = await supabase
    .from('transactions')
    .insert(
      rows.map((r) => ({
        user_id: userData.user.id,
        amount: r.amount,
        type: r.type,
        account_id: r.accountId,
        category_id: r.categoryId,
        occurred_on: r.occurredOn,
        note: r.note || null,
      })),
    )
    .select()
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

export async function updateTransactionsBulk(ids, fields) {
  const { error } = await supabase.from('transactions').update(fields).in('id', ids)
  if (error) throw error
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

// Exporta de `movements` (transações + transferências) em vez de só
// `transactions`, para o CSV ser um livro-razão completo de tudo o que
// mexeu nas contas — antes as transferências ficavam de fora em silêncio.
export async function listAllTransactionsForExport() {
  return fetchAllPages(() =>
    supabase
      .from('movements')
      .select('occurred_on, source, type, amount, note, account_name, category_name, counter_account_name')
      .order('occurred_on', { ascending: false })
      .order('id'),
  )
}

export async function listAllTransactionsForBalance() {
  return fetchAllPages(() =>
    supabase.from('transactions').select('amount, type, occurred_on, account_id, created_at').order('id'),
  )
}

// O Supabase (PostgREST, `max_rows = 1000`) devolve no máximo 1000 linhas por
// pedido, em silêncio: o saldo e o CSV ficavam errados a partir das 1000
// transações (confirmado com 1100 numa base local: o saldo ignorava 100).
// Lê em páginas até vir uma incompleta. `build` tem de criar uma query nova a
// cada chamada e com ordem estável (ex.: .order('id')), senão as páginas
// podem repetir ou saltar linhas.
const PAGE_SIZE = 1000
async function fetchAllPages(build) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
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

// --- Gestão de contas e categorias ---------------------------------------
// accounts/categories usam `on delete restrict` nas transações e snapshots:
// apagar um item em uso falha com o código 23503 (foreign_key_violation).
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
    throw new Error(
      'Esta conta ainda tem transações, transferências, atualizações de saldo ou dívidas associadas.',
    )
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

export async function updateCategorySavingsFlag(id, isSavings) {
  const { data, error } = await supabase
    .from('categories')
    .update({ is_savings: isSavings })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCategory(id) {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error?.code === FK_VIOLATION) {
    throw new Error('Esta categoria ainda tem transações associadas.')
  }
  if (error) throw error
}

export async function listCategoryRules() {
  const { data, error } = await supabase
    .from('category_rules')
    .select('*, categories(name, type)')
    .order('created_at')
  if (error) throw error
  return data
}

export async function createCategoryRule({ keyword, categoryId }) {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const { data, error } = await supabase
    .from('category_rules')
    .insert({ user_id: userData.user.id, keyword, category_id: categoryId })
    .select('*, categories(name, type)')
    .single()
  if (error) throw error
  return data
}

export async function deleteCategoryRule(id) {
  const { error } = await supabase.from('category_rules').delete().eq('id', id)
  if (error) throw error
}

// --- Transferências entre contas próprias ----------------------------------
// Movimentar dinheiro entre contas (ex.: Conta Corrente -> XTB) não é um
// Gasto/Ganho real por omissão, por isso vive na sua própria tabela, fora de
// `transactions` — `accountBalance.js` soma-a diretamente no saldo de cada
// conta envolvida. `counts_as_expense` é a exceção explícita (ex.
// investimentos): continua a ser UMA transferência (as duas contas atualizam
// sozinhas, sem duas entradas a desalinhar), mas `listTransactionsInRange`
// inclui-a nos totais de Gasto como se fosse uma transação normal.
export async function listTransfers() {
  const { data, error } = await supabase
    .from('transfers')
    .select(
      '*, from_account:accounts!from_account_id(name), to_account:accounts!to_account_id(name), categories(name)',
    )
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createTransfer({
  fromAccountId,
  toAccountId,
  amount,
  occurredOn,
  note,
  categoryId,
  countsAsExpense,
}) {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const { data, error } = await supabase
    .from('transfers')
    .insert({
      user_id: userData.user.id,
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      amount,
      occurred_on: occurredOn,
      note: note || null,
      category_id: countsAsExpense ? categoryId : null,
      counts_as_expense: Boolean(countsAsExpense),
    })
    .select(
      '*, from_account:accounts!from_account_id(name), to_account:accounts!to_account_id(name), categories(name)',
    )
    .single()
  if (error) throw error
  return data
}

export async function deleteTransfer(id) {
  const { error } = await supabase.from('transfers').delete().eq('id', id)
  if (error) throw error
}
