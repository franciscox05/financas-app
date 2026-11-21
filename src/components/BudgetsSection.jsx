import { Target } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../context/toastContext'
import { useT } from '../i18n'
import { deleteBudget, listBudgets, setBudget } from '../lib/db'
import { parseExpenseAmount } from '../lib/expenseInput'
import { currencySymbol } from '../lib/format'
import { ErrorNotice, ListSkeleton } from './Feedback'
import { inputClass } from './ui/styles'

// Valor guardado → texto do campo ("150" ou "12,5"), no formato com vírgula.
function toFieldText(amount) {
  if (amount === undefined || amount === null) return ''
  return String(Number(amount)).replace('.', ',')
}

// Gestão → Orçamentos: um campo por categoria de gasto. Grava ao sair do campo
// (ou Enter); apagar o valor remove o orçamento. Categorias de empréstimo ficam
// de fora (não são consumo — mesma regra de monthTotals e budgets.js).
export default function BudgetsSection({ categories, cardClass }) {
  const t = useT()
  const toast = useToast()
  const [budgets, setBudgets] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    listBudgets()
      .then((rows) => {
        if (cancelled) return
        setBudgets(rows)
        setDrafts(Object.fromEntries(rows.map((b) => [b.category_id, toFieldText(b.amount)])))
      })
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [])

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense' && !c.is_lending),
    [categories],
  )
  const hasLending = categories.some((c) => c.type === 'expense' && c.is_lending)

  async function commit(category) {
    const current = budgets.find((b) => b.category_id === category.id)
    const text = (drafts[category.id] ?? '').trim()
    if (text === toFieldText(current?.amount)) return
    try {
      if (text === '') {
        if (!current) return
        await deleteBudget(category.id)
        setBudgets((prev) => prev.filter((b) => b.category_id !== category.id))
        toast.success(t('bud.manage.removed', { name: category.name }))
        return
      }
      const amount = parseExpenseAmount(text)
      if (amount === null) {
        toast.error(t('bud.manage.invalid'))
        setDrafts((d) => ({ ...d, [category.id]: toFieldText(current?.amount) }))
        return
      }
      const saved = await setBudget(category.id, amount)
      setBudgets((prev) => [...prev.filter((b) => b.category_id !== category.id), saved])
      setDrafts((d) => ({ ...d, [category.id]: toFieldText(saved.amount) }))
      toast.success(t('bud.manage.saved', { name: category.name }))
    } catch (err) {
      toast.error(t('bud.manage.error', { message: err.message }))
    }
  }

  return (
    <div id="orcamentos" className={`${cardClass} scroll-mt-20`}>
      <h2 className="flex items-center gap-2 text-[1.25rem] font-bold tracking-tight text-label">
        <Target size={20} strokeWidth={2.1} aria-hidden="true" className="text-accent" />
        {t('bud.title')}
      </h2>
      <p className="mt-1 text-[0.8125rem] leading-snug text-label-2">{t('bud.manage.subtitle')}</p>

      {error ? (
        <div className="mt-3">
          <ErrorNotice message={error} />
        </div>
      ) : budgets === null ? (
        <div className="mt-3">
          <ListSkeleton rows={3} />
        </div>
      ) : expenseCategories.length === 0 ? (
        <p className="mt-3 text-sm text-label-2">{t('bud.manage.none')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-separator">
          {expenseCategories.map((c) => {
            const fieldId = `budget-${c.id}`
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                <label htmlFor={fieldId} className="min-w-0 flex-1 truncate text-[0.9375rem] text-label">
                  {c.name}
                </label>
                <div className="relative w-36 shrink-0">
                  <input
                    id={fieldId}
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="done"
                    autoComplete="off"
                    value={drafts[c.id] ?? ''}
                    placeholder={t('bud.manage.placeholder')}
                    onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                    onBlur={() => commit(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
                    className={`${inputClass} amount pr-8 text-right`}
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-label-3"
                  >
                    {currencySymbol()}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {hasLending && <p className="mt-2 text-xs text-label-3">{t('bud.manage.lendingNote')}</p>}
    </div>
  )
}
