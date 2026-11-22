const toCents = (v) => Math.round(Number(v) * 100)

// Categoria onde mais se gastou no mês (só despesas; empréstimos/devoluções
// ficam de fora porque não são gasto do dia a dia). Devolve { name, amount } ou null.
export function topExpenseCategory(txs, categories = []) {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const totals = new Map()
  for (const tx of txs ?? []) {
    if (tx.type !== 'expense') continue
    const category = byId.get(tx.category_id)
    if (category?.is_lending) continue
    const name = category?.name ?? tx.categories?.name ?? null
    if (!name) continue
    totals.set(name, (totals.get(name) ?? 0) + toCents(tx.amount))
  }
  let best = null
  for (const [name, cents] of totals) {
    if (!best || cents > best.cents) best = { name, cents }
  }
  return best ? { name: best.name, amount: best.cents / 100 } : null
}

// O resumo do mês passado só aparece nos primeiros dias do mês e se houve
// movimento nesse mês. `day` = dia do mês de hoje (1 a 31).
export const RECAP_DAYS = 10

export function shouldShowRecap({ day, income, expense }) {
  return day <= RECAP_DAYS && (income > 0 || expense > 0)
}
