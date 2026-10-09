import { useEffect, useMemo, useRef, useState } from 'react'
import { suggestCategoryId } from '../lib/categorySuggest'
import { createTransaction } from '../lib/db'
import { today } from '../lib/dates'

export default function QuickEntryForm({ accounts, categories, transactions, onCreated }) {
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState('')
  const [occurredOn, setOccurredOn] = useState(today())
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [suggested, setSuggested] = useState(false)
  const categoryTouchedRef = useRef(false)

  const categoriesForType = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type],
  )

  const effectiveCategoryId = categoriesForType.some((c) => c.id === categoryId)
    ? categoryId
    : categoriesForType[0]?.id ?? ''

  // Sugere categoria a partir do histórico quando o utilizador escreve uma nota,
  // desde que não tenha escolhido a categoria manualmente para esta transação.
  useEffect(() => {
    if (categoryTouchedRef.current) return
    const id = suggestCategoryId(note, type, transactions ?? [])
    if (id && categoriesForType.some((c) => c.id === id)) {
      setCategoryId(id)
      setSuggested(true)
    } else {
      setSuggested(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note, type])

  async function handleSubmit(e) {
    e.preventDefault()
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) {
      setError('Indica um valor válido.')
      return
    }
    if (!accountId || !effectiveCategoryId) {
      setError('Escolhe conta e categoria.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const created = await createTransaction({
        amount: numericAmount,
        type,
        accountId,
        categoryId: effectiveCategoryId,
        occurredOn,
        note,
      })
      setAmount('')
      setNote('')
      setOccurredOn(today())
      setCategoryId('')
      setSuggested(false)
      categoryTouchedRef.current = false
      onCreated(created)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setType('expense')}
          className={`rounded-lg py-2 text-sm font-medium ${
            type === 'expense'
              ? 'bg-red-600 text-white'
              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
          }`}
        >
          Gasto
        </button>
        <button
          type="button"
          onClick={() => setType('income')}
          className={`rounded-lg py-2 text-sm font-medium ${
            type === 'income'
              ? 'bg-green-600 text-white'
              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
          }`}
        >
          Ganho
        </button>
      </div>

      <input
        id="quick-entry-amount"
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        required
        placeholder="0.00 €"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-2xl font-semibold dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <select
            value={effectiveCategoryId}
            onChange={(e) => {
              categoryTouchedRef.current = true
              setSuggested(false)
              setCategoryId(e.target.value)
            }}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {categoriesForType.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {suggested && (
            <p className="mt-0.5 text-xs text-neutral-400">sugerido a partir do histórico</p>
          )}
        </div>

        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
        <input
          type="text"
          placeholder="Nota (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-neutral-900 py-3 font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {submitting ? 'A guardar...' : 'Registar'}
      </button>
    </form>
  )
}
