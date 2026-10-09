import { useEffect, useMemo, useState } from 'react'
import {
  createRecurringTransaction,
  createTransaction,
  deleteRecurringTransaction,
  listRecurringTransactions,
  markRecurringGenerated,
} from '../lib/db'
import { monthStart, toIsoDate, today } from '../lib/dates'
import { EmptyState, ErrorNotice, Skeleton } from './Feedback'

function eur(value) {
  return `${Number(value).toFixed(2)} €`
}

export default function RecurringSection({ accounts, categories, onLaunched }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [launchingId, setLaunchingId] = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [actionError, setActionError] = useState('')

  const currentMonthIso = toIsoDate(monthStart(new Date()))

  const categoriesForType = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type],
  )

  async function load() {
    setLoading(true)
    try {
      setItems(await listRecurringTransactions())
    } catch (err) {
      setActionError(`Não foi possível carregar as recorrências: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pending = items.filter((r) => r.last_generated_month !== currentMonthIso)

  async function handleLaunch(item) {
    setLaunchingId(item.id)
    setActionError('')
    try {
      await createTransaction({
        amount: Number(item.amount),
        type: item.type,
        accountId: item.account_id,
        categoryId: item.category_id,
        occurredOn: today(),
        note: item.note,
      })
      await markRecurringGenerated(item.id, currentMonthIso)
      await load()
      onLaunched?.()
    } catch (err) {
      setActionError(`Não foi possível lançar a recorrência: ${err.message}`)
    } finally {
      setLaunchingId(null)
    }
  }

  async function handleDelete(id) {
    setActionError('')
    try {
      await deleteRecurringTransaction(id)
      setConfirmingDeleteId(null)
      await load()
    } catch (err) {
      setActionError(`Não foi possível apagar a recorrência: ${err.message}`)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    const numericAmount = Number(amount)
    const effectiveCategoryId = categoriesForType.some((c) => c.id === categoryId)
      ? categoryId
      : categoriesForType[0]?.id
    const numericDay = Number(dayOfMonth)
    if (!numericAmount || numericAmount <= 0) {
      setFormError('Indica um valor válido.')
      return
    }
    if (!accountId || !effectiveCategoryId) {
      setFormError('Escolhe conta e categoria.')
      return
    }
    if (!numericDay || numericDay < 1 || numericDay > 28) {
      setFormError('O dia do mês tem de ser entre 1 e 28.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      await createRecurringTransaction({
        accountId,
        categoryId: effectiveCategoryId,
        amount: numericAmount,
        type,
        note,
        dayOfMonth: numericDay,
      })
      setAmount('')
      setNote('')
      setShowForm(false)
      await load()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Só mostra skeleton no primeiro carregamento; nos refrescos mantém a lista.
  if (loading && items.length === 0 && !actionError) {
    return (
      <div role="status" aria-label="A carregar recorrências" className="space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-10" />
      </div>
    )
  }

  return (
    <section className="space-y-3">
      <ErrorNotice message={actionError} onDismiss={() => setActionError('')} />

      {pending.length > 0 && (
        <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/40">
          <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">
            Recorrências por lançar este mês
          </h3>
          <ul className="space-y-1.5">
            {pending.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-blue-900 dark:text-blue-200">
                  {item.categories?.name} · {eur(item.amount)}
                  {item.note ? ` · ${item.note}` : ''}
                </span>
                <button
                  onClick={() => handleLaunch(item)}
                  disabled={launchingId === item.id}
                  className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  {launchingId === item.id ? 'A lançar...' : 'Lançar agora'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-500">Recorrências configuradas</h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-xs text-neutral-500 underline-offset-2 hover:underline"
        >
          {showForm ? 'Fechar' : '+ Nova'}
        </button>
      </div>

      {items.length === 0 && !showForm && (
        <EmptyState
          title="Sem recorrências configuradas"
          description="Renda, subscrições ou salário: configura uma vez e lança com um toque todos os meses."
          actionLabel="Criar a primeira recorrência"
          onAction={() => setShowForm(true)}
        />
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">
                Dia {item.day_of_month} · {item.categories?.name} · {eur(item.amount)}
              </span>
              {confirmingDeleteId === item.id ? (
                <span className="flex items-center gap-1">
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setConfirmingDeleteId(null)}
                    className="rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
                  >
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmingDeleteId(item.id)}
                  aria-label="Apagar recorrência"
                  className="rounded p-1 text-neutral-400 hover:text-red-600"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
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
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="Valor (€)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            >
              {categoriesForType.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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
              type="number"
              min="1"
              max="28"
              required
              placeholder="Dia do mês (1-28)"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
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

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-neutral-900 py-2.5 font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {submitting ? 'A guardar...' : 'Guardar recorrência'}
          </button>
        </form>
      )}
    </section>
  )
}
