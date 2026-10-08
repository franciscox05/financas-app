import { useEffect, useState } from 'react'
import { listBudgets, upsertBudget } from '../lib/db'
import { toIsoDate } from '../lib/dates'

const GOOD = '#0ca30c'
const WARNING = '#fab219'
const CRITICAL = '#d03b3b'

function eur(value) {
  return `${value.toFixed(2)} €`
}

function BudgetRow({ category, spent, budget, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(budget?.amount ?? '')
  const [saving, setSaving] = useState(false)

  const amount = budget ? Number(budget.amount) : null
  const pct = amount ? Math.round((spent / amount) * 100) : null
  const color = pct === null ? null : pct >= 100 ? CRITICAL : pct >= 80 ? WARNING : GOOD

  async function handleSave(e) {
    e.preventDefault()
    const numeric = Number(value)
    if (Number.isNaN(numeric) || numeric < 0) return
    setSaving(true)
    try {
      await onSave(numeric)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="py-2">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-neutral-700 dark:text-neutral-300">{category.name}</span>
        {editing ? (
          <form onSubmit={handleSave} className="flex items-center gap-1">
            <input
              type="number"
              step="0.01"
              min="0"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-20 rounded border border-neutral-300 px-1.5 py-0.5 text-right text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-neutral-900 px-2 py-0.5 text-xs text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              OK
            </button>
          </form>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-neutral-500 underline-offset-2 hover:underline"
          >
            {amount ? `${eur(spent)} / ${eur(amount)}` : `${eur(spent)} · definir orçamento`}
          </button>
        )}
      </div>
      {amount !== null && (
        <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800">
          <div
            className="h-2 rounded-full transition-[width]"
            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
          />
        </div>
      )}
    </li>
  )
}

export default function BudgetSection({ month, categories, spentByCategoryId }) {
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)

  const monthIso = toIsoDate(month)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listBudgets(monthIso)
      .then((data) => {
        if (!cancelled) setBudgets(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [monthIso])

  async function handleSave(categoryId, amount) {
    const saved = await upsertBudget({ categoryId, month: monthIso, amount })
    setBudgets((prev) => [...prev.filter((b) => b.category_id !== categoryId), saved])
  }

  if (loading) return null
  if (categories.length === 0) return null

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-neutral-500">Orçamentos</h3>
      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {categories.map((c) => (
          <BudgetRow
            key={c.id}
            category={c}
            spent={spentByCategoryId.get(c.id) ?? 0}
            budget={budgets.find((b) => b.category_id === c.id)}
            onSave={(amount) => handleSave(c.id, amount)}
          />
        ))}
      </ul>
    </section>
  )
}
