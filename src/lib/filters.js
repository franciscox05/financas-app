export const EMPTY_FILTERS = { query: '', type: 'all', accountId: '', categoryId: '' }

// Minúsculas e sem acentos, para "cafe" encontrar "Café".
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export function hasActiveFilters(filters) {
  return (
    filters.query.trim() !== '' ||
    filters.type !== 'all' ||
    filters.accountId !== '' ||
    filters.categoryId !== ''
  )
}

// Todos os termos da pesquisa têm de aparecer na nota ou no nome da categoria.
export function filterTransactions(transactions, filters) {
  const terms = normalizeText(filters.query).split(/\s+/).filter(Boolean)

  return transactions.filter((tx) => {
    if (filters.type !== 'all' && tx.type !== filters.type) return false
    if (filters.accountId && tx.account_id !== filters.accountId) return false
    if (filters.categoryId && tx.category_id !== filters.categoryId) return false

    if (terms.length > 0) {
      const haystack = normalizeText(`${tx.note ?? ''} ${tx.categories?.name ?? ''}`)
      if (!terms.every((term) => haystack.includes(term))) return false
    }
    return true
  })
}

// Saldo líquido (ganhos - gastos) de um conjunto de transações.
export function netTotal(transactions) {
  return transactions.reduce(
    (sum, tx) => sum + (tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount)),
    0,
  )
}
