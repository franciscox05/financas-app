import { Plus, Repeat, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  createRecurringTransaction,
  createTransaction,
  deleteRecurringTransaction,
  listRecurringTransactions,
  listTransactionsInRange,
  markRecurringGenerated,
} from '../lib/db'
import { addMonths, monthStart, toIsoDate, today } from '../lib/dates'
import { detectRecurringCandidates } from '../lib/recurringSuggest'
import { useToast } from '../context/toastContext'
import { EmptyState, Skeleton } from './Feedback'

function eur(value) {
  return `${Number(value).toFixed(2)} €`
}

const DISMISSED_KEY = 'financasapp:dismissed-recurring-suggestions'

function loadDismissed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function saveDismissed(set) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]))
  } catch {
    // conveniência local; se falhar (ex. modo privado) não é crítico
  }
}

export default function RecurringSection({ accounts, categories, onLaunched }) {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [launchingId, setLaunchingId] = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const [suggestions, setSuggestions] = useState([])
  const [dismissed, setDismissed] = useState(loadDismissed)
  const [creatingSuggestionKey, setCreatingSuggestionKey] = useState(null)

  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const currentMonthIso = toIsoDate(monthStart(new Date()))

  const categoriesForType = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type],
  )

  async function load() {
    setLoading(true)
    try {
      const recurring = await listRecurringTransactions()
      setItems(recurring)
      // Histórico de 3 meses só para detetar padrões — não é exibido nem bloqueia o ecrã.
      const rangeStart = addMonths(monthStart(new Date()), -2)
      const rangeEnd = addMonths(monthStart(new Date()), 1)
      const history = await listTransactionsInRange({
        from: toIsoDate(rangeStart),
        to: toIsoDate(rangeEnd),
      })
      setSuggestions(detectRecurringCandidates(history, recurring))
    } catch (err) {
      toast.error(`Não foi possível carregar as recorrências: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibleSuggestions = suggestions.filter((s) => !dismissed.has(s.key))

  function dismissSuggestion(key) {
    setDismissed((prev) => {
      const next = new Set(prev).add(key)
      saveDismissed(next)
      return next
    })
  }

  async function createFromSuggestion(suggestion) {
    setCreatingSuggestionKey(suggestion.key)
    try {
      await createRecurringTransaction({
        accountId: suggestion.accountId,
        categoryId: suggestion.categoryId,
        amount: suggestion.amount,
        type: suggestion.type,
        note: suggestion.note,
        dayOfMonth: suggestion.dayOfMonth,
      })
      dismissSuggestion(suggestion.key)
      await load()
      toast.success('Recorrência criada a partir do histórico.')
    } catch (err) {
      toast.error(`Não foi possível criar a recorrência: ${err.message}`)
    } finally {
      setCreatingSuggestionKey(null)
    }
  }

  const pending = items.filter((r) => r.last_generated_month !== currentMonthIso)

  async function handleLaunch(item) {
    setLaunchingId(item.id)
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
      toast.success(`Recorrência lançada: ${eur(item.amount)}.`)
    } catch (err) {
      toast.error(`Não foi possível lançar a recorrência: ${err.message}`)
    } finally {
      setLaunchingId(null)
    }
  }

  async function handleDelete(id) {
    try {
      await deleteRecurringTransaction(id)
      setConfirmingDeleteId(null)
      await load()
      toast.success('Recorrência apagada.')
    } catch (err) {
      toast.error(`Não foi possível apagar a recorrência: ${err.message}`)
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
      toast.success('Recorrência criada.')
    } catch (err) {
      toast.error(`Não foi possível criar a recorrência: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  // Só mostra skeleton no primeiro carregamento; nos refrescos mantém a lista.
  if (loading && items.length === 0) {
    return (
      <div role="status" aria-label="A carregar recorrências" className="space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-10" />
      </div>
    )
  }

  return (
    <section className="space-y-3">
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

      {visibleSuggestions.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <Repeat size={15} /> Isto parece acontecer todos os meses
          </h3>
          <ul className="space-y-2">
            {visibleSuggestions.map((s) => (
              <li key={s.key} className="space-y-1.5 text-sm">
                <p className="text-amber-900 dark:text-amber-200">
                  "{s.note}" · ~{eur(s.amount)}
                  {s.categoryName ? ` · ${s.categoryName}` : ''}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => createFromSuggestion(s)}
                    disabled={creatingSuggestionKey === s.key}
                    className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {creatingSuggestionKey === s.key ? 'A criar...' : 'Criar recorrência'}
                  </button>
                  <button
                    onClick={() => dismissSuggestion(s.key)}
                    className="rounded border border-amber-300 px-2 py-1 text-xs text-amber-800 dark:border-amber-800 dark:text-amber-300"
                  >
                    Não, obrigado
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-500">Recorrências configuradas</h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-0.5 text-xs text-neutral-500 underline-offset-2 hover:underline"
        >
          {showForm ? 'Fechar' : (
            <>
              <Plus size={13} /> Nova
            </>
          )}
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
                  <Trash2 size={16} />
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
