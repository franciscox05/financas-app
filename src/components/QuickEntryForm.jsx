import { Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { suggestCategoryId } from '../lib/categorySuggest'
import { useToast } from '../context/toastContext'
import { today } from '../lib/dates'
import { createDebt, createTransaction } from '../lib/db'

export default function QuickEntryForm({ accounts, categories, transactions, onCreated }) {
  const toast = useToast()
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

  const [showDebt, setShowDebt] = useState(false)
  const [debtCounterparty, setDebtCounterparty] = useState('')
  const [debtAmount, setDebtAmount] = useState('')

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

  useEffect(() => {
    if (type !== 'expense') {
      setShowDebt(false)
      setDebtCounterparty('')
      setDebtAmount('')
    }
  }, [type])

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

    const numericDebtAmount = Number(debtAmount)
    if (showDebt && (!debtCounterparty.trim() || !numericDebtAmount || numericDebtAmount <= 0)) {
      setError('Indica quem te deve e um valor válido, ou fecha essa secção.')
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
      if (showDebt) {
        await createDebt({
          direction: 'owed_to_me',
          counterpartyName: debtCounterparty.trim(),
          amount: numericDebtAmount,
          transactionId: created.id,
        })
      }
      setAmount('')
      setNote('')
      setOccurredOn(today())
      setCategoryId('')
      setSuggested(false)
      categoryTouchedRef.current = false
      setShowDebt(false)
      setDebtCounterparty('')
      setDebtAmount('')
      onCreated(created)
      toast.success(
        `${type === 'income' ? 'Ganho' : 'Gasto'} de ${numericAmount.toFixed(2)} € registado.`,
      )
    } catch (err) {
      toast.error(`Não foi possível registar: ${err.message}`)
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

      {type === 'expense' && (
        <div>
          <button
            type="button"
            onClick={() => {
              if (!showDebt && !debtAmount && amount) setDebtAmount(amount)
              setShowDebt((v) => !v)
            }}
            className="flex items-center gap-0.5 text-xs text-neutral-500 underline-offset-2 hover:underline"
          >
            {showDebt ? 'Fechar' : (
              <>
                <Plus size={13} /> Alguém te deve por isto?
              </>
            )}
          </button>

          {showDebt && (
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
              <input
                type="text"
                placeholder="Nome de quem te deve"
                value={debtCounterparty}
                onChange={(e) => setDebtCounterparty(e.target.value)}
                className="col-span-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="Quanto te deve (€)"
                value={debtAmount}
                onChange={(e) => setDebtAmount(e.target.value)}
                className="col-span-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>
          )}
        </div>
      )}

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
