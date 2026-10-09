import { normalize } from './categorySuggest'
import { monthKey } from './dates'

/**
 * Deteta despesas/ganhos que se repetem mês a mês mas ainda não têm uma
 * recorrência configurada — agrupa transações por nota normalizada (mesma
 * lógica de comparação do categorySuggest.js) e tipo, e sugere as que
 * aparecem em pelo menos 2 meses distintos. Não usa nenhum serviço externo,
 * só o histórico do próprio utilizador.
 */
export function detectRecurringCandidates(transactions, recurringTransactions) {
  const existingNotes = new Set(
    recurringTransactions.filter((r) => r.note).map((r) => normalize(r.note)),
  )

  const groups = new Map()
  for (const tx of transactions) {
    const noteKey = normalize(tx.note || '')
    if (!noteKey) continue
    const key = `${tx.type}|${noteKey}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(tx)
  }

  const candidates = []
  for (const [key, txs] of groups) {
    const noteKey = key.slice(key.indexOf('|') + 1)
    if (existingNotes.has(noteKey)) continue

    const months = new Set(txs.map((tx) => monthKey(new Date(`${tx.occurred_on}T00:00:00`))))
    if (months.size < 2) continue

    const latest = [...txs].sort((a, b) => (a.occurred_on < b.occurred_on ? 1 : -1))[0]
    candidates.push({
      key,
      note: latest.note,
      type: latest.type,
      accountId: latest.account_id,
      accountName: latest.accounts?.name,
      categoryId: latest.category_id,
      categoryName: latest.categories?.name,
      amount: Number(latest.amount),
      dayOfMonth: Math.min(28, new Date(`${latest.occurred_on}T00:00:00`).getDate()),
      occurrences: months.size,
    })
  }

  return candidates.sort((a, b) => b.occurrences - a.occurrences)
}
