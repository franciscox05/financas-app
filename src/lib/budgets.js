// Orçamentos: um limite MENSAL por categoria de despesa (tabela `budgets`),
// que vale para todos os meses. Aqui só se calcula o progresso de um mês.
//
// - Gasto = soma das despesas do mês nessa categoria (os mesmos movimentos que
//   o Balanço usa, incluindo transferências "conta como gasto" com categoria).
// - Categorias de empréstimo/devolução (`is_lending`) nunca têm orçamento: não
//   são consumo (mesma regra de `monthTotals`).
// - Estado: 'ok' abaixo de 80 %, 'warn' a partir de 80 %, 'over' a partir de 100 %.
// Somas em cêntimos.
export const WARN_AT = 0.8

const toCents = (v) => Math.round(Number(v) * 100)

export function budgetStatus(spent, limit) {
  if (!(limit > 0)) return 'ok'
  const ratio = spent / limit
  if (ratio >= 1) return 'over'
  if (ratio >= WARN_AT) return 'warn'
  return 'ok'
}

export function budgetProgress(budgets, monthTxs, categories) {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const spentByCategory = new Map()
  for (const tx of monthTxs ?? []) {
    if (tx.type !== 'expense' || !tx.category_id) continue
    spentByCategory.set(tx.category_id, (spentByCategory.get(tx.category_id) ?? 0) + toCents(tx.amount))
  }
  const rows = []
  for (const b of budgets ?? []) {
    const category = byId.get(b.category_id)
    if (!category || category.is_lending || category.type !== 'expense') continue
    const limitC = toCents(b.amount)
    const spentC = spentByCategory.get(b.category_id) ?? 0
    rows.push({
      budgetId: b.id,
      categoryId: b.category_id,
      name: category.name,
      limit: limitC / 100,
      spent: spentC / 100,
      remaining: (limitC - spentC) / 100,
      ratio: limitC > 0 ? spentC / limitC : 0,
      status: budgetStatus(spentC, limitC),
    })
  }
  // Mais perto de rebentar primeiro.
  return rows.sort((a, b) => b.ratio - a.ratio || a.name.localeCompare(b.name))
}

// Totais de todos os orçamentos do mês (para o resumo no topo do cartão).
export function budgetTotals(rows) {
  const limitC = rows.reduce((s, r) => s + toCents(r.limit), 0)
  const spentC = rows.reduce((s, r) => s + toCents(r.spent), 0)
  return { limit: limitC / 100, spent: spentC / 100, remaining: (limitC - spentC) / 100 }
}
