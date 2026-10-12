import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { EmptyState, ErrorNotice, PageSkeleton, Pager } from '../components/Feedback'
import { useToast } from '../context/toastContext'
import { createDebt, deleteDebt, listAccounts, listCategories, listDebts, settleDebt } from '../lib/db'

const HISTORY_PAGE_SIZE = 10

function eur(value) {
  return `${Number(value).toFixed(2)} €`
}

export default function Debts() {
  const toast = useToast()
  const [debts, setDebts] = useState([])
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showHistory, setShowHistory] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [settlingId, setSettlingId] = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)

  const [direction, setDirection] = useState('owed_to_me')
  const [counterpartyName, setCounterpartyName] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const [settleAccountId, setSettleAccountId] = useState('')
  const [settleCategoryId, setSettleCategoryId] = useState('')
  const [settleError, setSettleError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [d, a, c] = await Promise.all([listDebts(), listAccounts(), listCategories()])
      setDebts(d)
      setAccounts(a)
      setCategories(c)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const pending = debts.filter((d) => d.status === 'pending')
  const settled = debts.filter((d) => d.status === 'settled')
  const owedToMe = pending.filter((d) => d.direction === 'owed_to_me')
  const iOwe = pending.filter((d) => d.direction === 'i_owe')

  const totalOwedToMe = owedToMe.reduce((sum, d) => sum + Number(d.amount), 0)
  const totalIOwe = iOwe.reduce((sum, d) => sum + Number(d.amount), 0)

  const settlingDebt = useMemo(() => debts.find((d) => d.id === settlingId), [debts, settlingId])
  const categoriesForSettle = useMemo(
    () =>
      settlingDebt
        ? categories.filter((c) => c.type === (settlingDebt.direction === 'owed_to_me' ? 'income' : 'expense'))
        : [],
    [categories, settlingDebt],
  )

  function openSettle(debt) {
    setSettlingId(debt.id)
    setSettleError('')
    setSettleAccountId(accounts[0]?.id ?? '')
    const defaultCategoryName = debt.direction === 'owed_to_me' ? 'Outros Ganhos' : 'Outros Gastos'
    const type = debt.direction === 'owed_to_me' ? 'income' : 'expense'
    const defaultCategory = categories.find((c) => c.type === type && c.name === defaultCategoryName)
    setSettleCategoryId(defaultCategory?.id ?? categories.find((c) => c.type === type)?.id ?? '')
  }

  async function handleSettle(debt) {
    if (!settleAccountId || !settleCategoryId) {
      setSettleError('Escolhe conta e categoria.')
      return
    }
    setSettleError('')
    try {
      await settleDebt({
        id: debt.id,
        direction: debt.direction,
        amount: Number(debt.amount),
        counterpartyName: debt.counterparty_name,
        accountId: settleAccountId,
        categoryId: settleCategoryId,
      })
      setSettlingId(null)
      await load()
      toast.success(
        debt.direction === 'owed_to_me' ? 'Dívida marcada como recebida.' : 'Dívida marcada como paga.',
      )
    } catch (err) {
      setSettleError(err.message)
      toast.error(`Não foi possível acertar a dívida: ${err.message}`)
    }
  }

  async function handleDelete(debt) {
    try {
      await deleteDebt(debt.id)
      setConfirmingDeleteId(null)
      await load()
      toast.success('Dívida apagada.', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            try {
              await createDebt({
                direction: debt.direction,
                counterpartyName: debt.counterparty_name,
                amount: Number(debt.amount),
                note: debt.note,
              })
              await load()
              toast.success('Dívida restaurada.')
            } catch (err) {
              toast.error(`Não foi possível desfazer: ${err.message}`)
            }
          },
        },
      })
    } catch (err) {
      toast.error(`Não foi possível apagar: ${err.message}`)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    const numericAmount = Number(amount)
    if (!counterpartyName.trim()) {
      setFormError('Indica o nome da pessoa.')
      return
    }
    if (!numericAmount || numericAmount <= 0) {
      setFormError('Indica um valor válido.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      await createDebt({
        direction,
        counterpartyName: counterpartyName.trim(),
        amount: numericAmount,
        note,
      })
      setCounterpartyName('')
      setAmount('')
      setNote('')
      setShowForm(false)
      await load()
      toast.success('Dívida criada.')
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <PageSkeleton />
  }

  if (error && debts.length === 0 && accounts.length === 0) {
    return <ErrorNotice message={error} onRetry={load} />
  }

  function renderDebtRow(debt) {
    const isOwedToMe = debt.direction === 'owed_to_me'
    return (
      <li key={debt.id} className="space-y-2 py-2 text-sm">
        <div className="flex items-center justify-between">
          <span>
            <span className="font-medium text-neutral-800 dark:text-neutral-200">
              {debt.counterparty_name}
            </span>
            <span className={`ml-2 font-semibold ${isOwedToMe ? 'text-green-600' : 'text-red-600'}`}>
              {eur(debt.amount)}
            </span>
            {debt.note && (
              <span className="ml-2 text-neutral-400">· {debt.note}</span>
            )}
          </span>
          <span className="flex items-center gap-1">
            {confirmingDeleteId === debt.id ? (
              <>
                <button
                  onClick={() => handleDelete(debt)}
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
              </>
            ) : (
              <>
                <button
                  onClick={() => openSettle(debt)}
                  className="rounded bg-neutral-900 px-2 py-1 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                >
                  {isOwedToMe ? 'Marcar recebido' : 'Marcar pago'}
                </button>
                <button
                  onClick={() => setConfirmingDeleteId(debt.id)}
                  aria-label="Apagar dívida"
                  className="rounded p-1 text-neutral-400 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </span>
        </div>

        {settlingId === debt.id && (
          <div className="space-y-2 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={settleAccountId}
                onChange={(e) => setSettleAccountId(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <select
                value={settleCategoryId}
                onChange={(e) => setSettleCategoryId(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              >
                {categoriesForSettle.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {settleError && <p className="text-xs text-red-600">{settleError}</p>}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSettle(debt)}
                className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white"
              >
                Confirmar e registar transação
              </button>
              <button
                onClick={() => setSettlingId(null)}
                className="rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="space-y-6">
      {error && <ErrorNotice message={error} onRetry={load} />}

      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">A receber</p>
          <p className="text-lg font-semibold text-green-600">{eur(totalOwedToMe)}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">A pagar</p>
          <p className="text-lg font-semibold text-red-600">{eur(totalIOwe)}</p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-500">Dívidas pendentes</h3>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-0.5 text-xs text-neutral-500 underline-offset-2 hover:underline"
          >
            {showForm ? 'Fechar' : (
              <>
                <Plus size={13} /> Nova dívida
              </>
            )}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection('owed_to_me')}
                className={`rounded-lg py-2 text-sm font-medium ${
                  direction === 'owed_to_me'
                    ? 'bg-green-600 text-white'
                    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                Devem-me
              </button>
              <button
                type="button"
                onClick={() => setDirection('i_owe')}
                className={`rounded-lg py-2 text-sm font-medium ${
                  direction === 'i_owe'
                    ? 'bg-red-600 text-white'
                    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                Devo
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">Nome da pessoa</label>
              <input
                type="text"
                placeholder="Ex: João"
                value={counterpartyName}
                onChange={(e) => setCounterpartyName(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">Valor</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00 €"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">Nota (opcional)</label>
              <input
                type="text"
                placeholder="Ex: jantar de sábado"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-neutral-900 py-2.5 font-medium text-white transition-colors disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {submitting ? 'A guardar...' : 'Guardar dívida'}
            </button>
          </form>
        )}

        {pending.length === 0 ? (
          <EmptyState
            title="Sem dívidas pendentes"
            description="Quando pagares algo que alguém te deva, ou alguém te pagar algo, regista aqui para não perderes a conta."
            actionLabel={showForm ? undefined : '+ Nova dívida'}
            onAction={showForm ? undefined : () => setShowForm(true)}
          />
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {pending.map(renderDebtRow)}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <button
          onClick={() => {
            setShowHistory((v) => !v)
            setHistoryPage(1)
          }}
          className="text-xs text-neutral-500 underline-offset-2 hover:underline"
        >
          {showHistory ? 'Esconder histórico' : `Ver histórico (${settled.length})`}
        </button>

        {showHistory && (
          settled.length === 0 ? (
            <p className="py-2 text-center text-sm text-neutral-500">Ainda sem dívidas acertadas.</p>
          ) : (
            <>
              <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {settled
                  .slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE)
                  .map((debt) => (
                    <li key={debt.id} className="flex items-center justify-between py-2 text-sm text-neutral-500">
                      <span>
                        {debt.counterparty_name} · {eur(debt.amount)}
                      </span>
                      <span className="text-xs">
                        {debt.direction === 'owed_to_me' ? 'Recebido' : 'Pago'}
                      </span>
                    </li>
                  ))}
              </ul>
              <Pager
                page={historyPage}
                totalPages={Math.ceil(settled.length / HISTORY_PAGE_SIZE)}
                onChange={setHistoryPage}
              />
            </>
          )
        )}
      </section>
    </div>
  )
}
