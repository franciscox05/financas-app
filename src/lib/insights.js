// Insights do Balanço: categorias com gasto este mês >= 20 % acima da média
// dos meses anteriores (até 3).
//
// S2-8 (auditoria de 15/11): a média divide só pelos meses anteriores em que
// HÁ movimentos. Antes dividia sempre por 3, contando como 0 os meses em que a
// app ainda não era usada, e a percentagem saía inflacionada nos primeiros meses.
export function categoryInsights(currentBreakdown, priorBuckets, lendingCategoryIds = new Set()) {
  const withData = priorBuckets.filter((b) => b.txs.length > 0)
  if (withData.length === 0) return []

  const priorByCategory = new Map()
  for (const bucket of withData) {
    for (const tx of bucket.txs) {
      if (tx.type !== 'expense' || lendingCategoryIds.has(tx.category_id)) continue
      const name = tx.categories?.name ?? 'Sem categoria'
      priorByCategory.set(name, (priorByCategory.get(name) ?? 0) + Number(tx.amount))
    }
  }

  const results = []
  for (const c of currentBreakdown) {
    const priorAvg = (priorByCategory.get(c.name) ?? 0) / withData.length
    if (priorAvg < 1) continue // evita percentagens absurdas sobre base ~0
    const diffPct = ((c.amount - priorAvg) / priorAvg) * 100
    if (diffPct >= 20) results.push({ name: c.name, diffPct: Math.round(diffPct) })
  }
  return results.sort((a, b) => b.diffPct - a.diffPct).slice(0, 3)
}
