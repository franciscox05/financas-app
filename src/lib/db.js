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
    .select('amount, type, occurred_on, account_id, created_at')
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

export async function createDebt({ direction, counterpartyName, amount, note, transactionId, dueOn }) {
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
      due_on: dueOn || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDebt(id) {
  const { error } = await supabase.from('debts').delete().eq('id', id)
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

// Atenção: os orçamentos (budgets) da categoria são apagados em cascata.
export async function deleteCategory(id) {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error?.code === FK_VIOLATION) {
    throw new Error('Esta categoria ainda tem transações ou recorrências associadas.')
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

// --- Pagamentos parciais de dívidas ----------------------------------------

export async function listDebtPayments() {
  const { data, error } = await supabase
    .from('debt_payments')
    .select('*, transactions(occurred_on, note, accounts(name), categories(name))')
    .order('paid_on', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

// Regista um pagamento (total ou parcial): cria a transação na conta, guarda o
// pagamento e fecha a dívida quando o remanescente chega a zero.
export async function addDebtPayment({ debt, amount, remaining, accountId, categoryId, paidOn, note }) {
  const transaction = await createTransaction({
    amount,
    type: debt.direction === 'owed_to_me' ? 'income' : 'expense',
    accountId,
    categoryId,
    occurredOn: paidOn,
    note: note || `Dívida: ${debt.counterparty_name}`,
  })

  let paymentId = null
  try {
    const { data: payment, error } = await supabase
      .from('debt_payments')
      .insert({
        user_id: transaction.user_id,
        debt_id: debt.id,
        amount,
        paid_on: paidOn,
        note: note || null,
        transaction_id: transaction.id,
      })
      .select('id')
      .single()
    if (error) throw error
    paymentId = payment.id

    if (Math.round(amount * 100) >= Math.round(remaining * 100)) {
      const { error: closeError } = await supabase
        .from('debts')
        .update({
          status: 'settled',
          settled_at: new Date().toISOString(),
          settled_transaction_id: transaction.id,
        })
        .eq('id', debt.id)
      if (closeError) throw closeError
    }
  } catch (err) {
    // Desfaz tudo se algum passo falhou, para não ficar uma transação ou pagamento órfãos.
    if (paymentId) await supabase.from('debt_payments').delete().eq('id', paymentId)
    await supabase.from('transactions').delete().eq('id', transaction.id)
    throw err
  }
}

export async function updateDebt({ id, counterpartyName, amount, note, settledNote, dueOn }) {
  const fields = { counterparty_name: counterpartyName, amount, note: note || null }
  if (settledNote !== undefined) fields.settled_note = settledNote || null
  if (dueOn !== undefined) fields.due_on = dueOn || null
  const { data, error } = await supabase.from('debts').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data
}

// Fecha o remanescente sem criar transação (ex.: acerto de contas entre as partes).
export async function closeDebtByAgreement({ id, note }) {
  const { data, error } = await supabase
    .from('debts')
    .update({ status: 'settled', settled_at: new Date().toISOString(), settled_note: note || null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Reabre uma dívida fechada (ex.: fechada por acerto por engano).
export async function reopenDebt(id) {
  const { error } = await supabase
    .from('debts')
    .update({ status: 'pending', settled_at: null, settled_transaction_id: null, settled_note: null })
    .eq('id', id)
  if (error) throw error
}

// Anula um pagamento: apaga o pagamento e a transação que gerou na conta; se a
// dívida tinha sido fechada por este pagamento, volta a ficar pendente.
export async function undoDebtPayment({ payment, debt }) {
  if (debt.status === 'settled') await reopenDebt(debt.id)
  const { error } = await supabase.from('debt_payments').delete().eq('id', payment.id)
  if (error) throw error
  if (payment.transaction_id) {
    const { error: txError } = await supabase.from('transactions').delete().eq('id', payment.transaction_id)
    if (txError) throw txError
  }
}

// --- Transferências entre contas próprias ----------------------------------
// Movimentar dinheiro entre contas (ex.: Conta Corrente -> XTB) não é um
// Gasto/Ganho real, por isso vive na sua própria tabela, fora de `transactions`
// — nunca entra nos totais de Balanço/Dashboard/calendário. `accountBalance.js`
// soma-a diretamente no saldo de cada conta envolvida.
export async function listTransfers() {
  const { data, error } = await supabase
    .from('transfers')
    .select('*, from_account:accounts!from_account_id(name), to_account:accounts!to_account_id(name)')
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createTransfer({ fromAccountId, toAccountId, amount, occurredOn, note }) {
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
    })
    .select('*, from_account:accounts!from_account_id(name), to_account:accounts!to_account_id(name)')
    .single()
  if (error) throw error
  return data
}

export async function deleteTransfer(id) {
  const { error } = await supabase.from('transfers').delete().eq('id', id)
  if (error) throw error
}
