import { Pencil, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../context/toastContext'
import { createTransaction, deleteTransaction, listTransactionsPage, updateTransaction } from '../lib/db'
import { parseSmartQuery } from '../lib/smartSearch'
import { EmptyState, ErrorNotice, ListSkeleton, Pager } from './Feedback'

const PAGE_SIZE = 25

function formatAmount(amount, type) {
  const sign = type === 'income' ? '+' : '-'
  return `${sign}${Number(amount).toFixed(2)} €`
}

function formatDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function TransactionRow({ tx, categories, accounts, onUpdated, onDeleted, onRestored }) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [amount, setAmount] = useState(tx.amount)
  const [categoryId, setCategoryId] = useState(tx.category_id)
  const [accountId, setAccountId] = useState(tx.account_id)
  const [note, setNote] = useState(tx.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const categoriesForType = categories.filter((c) => c.type === tx.type)

  async function handleDelete() {
    setBusy(true)
    setError('')
    try {
      await deleteTransaction(tx.id)
      onDeleted(tx.id)
      toast.success('Transação apagada.', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            try {
              await createTransaction({
                amount: Number(tx.amount),
                type: tx.type,
                accountId: tx.account_id,
                categoryId: tx.category_id,
                occurredOn: tx.occurred_on,
                note: tx.note,
              })
              onRestored()
              toast.success('Transação restaurada.')
            } catch (err) {
              toast.error(`Não foi possível desfazer: ${err.message}`)
            }
          },
        },
      })
    } catch (err) {
      setConfirmingDelete(false)
      toast.error(`Não foi possível apagar: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleSave() {
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Indica um valor superior a 0.')
      return
    }
    if (!categoryId || !accountId) {
      setError('Escolhe conta e categoria.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const updated = await updateTransaction(tx.id, {
        amount: numericAmount,
        category_id: categoryId,
        account_id: accountId,
        note: note.trim() || null,
      })
      onUpdated({
        ...tx,
        ...updated,
        categories: categories.find((c) => c.id === updated.category_id),
        accounts: accounts.find((a) => a.id === updated.account_id),
      })
      setEditing(false)
      toast.success('Transação atualizada.')
    } catch (err) {
      toast.error(`Não foi possível guardar: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  function handleCancelEdit() {
    setAmount(tx.amount)
    setCategoryId(tx.category_id)
    setAccountId(tx.account_id)
    setNote(tx.note ?? '')
    setError('')
    setEditing(false)
  }

  if (editing) {
    return (
      <li className="space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
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
            className="w-full rounded-lg border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <input
          type="text"
          placeholder="Nota"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex-1 rounded-lg bg-neutral-900 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {busy ? 'A guardar...' : 'Guardar'}
          </button>
          <button
            onClick={handleCancelEdit}
            disabled={busy}
            className="flex-1 rounded-lg border border-neutral-300 py-1.5 text-sm dark:border-neutral-700"
          >
            Cancelar
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {tx.categories?.name ?? 'Sem categoria'}
          {tx.note ? <span className="text-neutral-400"> · {tx.note}</span> : null}
        </p>
        <p className="text-xs text-neutral-500">
          {formatDate(tx.occurred_on)} · {tx.accounts?.name ?? 'Sem conta'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`text-sm font-semibold ${
            tx.type === 'income' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {formatAmount(tx.amount, tx.type)}
        </span>
        <button
          onClick={() => setEditing(true)}
          aria-label="Editar"
          className="rounded p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          <Pencil size={16} />
        </button>
        {confirmingDelete ? (
          <span className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              disabled={busy}
              className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              Confirmar
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              disabled={busy}
              className="rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
            >
              Cancelar
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            aria-label="Apagar"
            className="rounded p-1 text-neutral-400 hover:text-red-600"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </li>
  )
}

const TYPE_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'expense', label: 'Gastos' },
  { value: 'income', label: 'Ganhos' },
]

const fieldClass =
  'w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100'

function TransactionFilters({ filters, onChange, categories, accounts }) {
  const categoryOptions =
    filters.type === 'all' ? categories : categories.filter((c) => c.type === filters.type)

  function setType(type) {
    const stillValid =
      type === 'all' ||
      !filters.categoryId ||
      categories.find((c) => c.id === filters.categoryId)?.type === type
    onChange({ ...filters, type, categoryId: stillValid ? filters.categoryId : '' })
  }

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          type="search"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder='Pesquisar: nota, ">20", "maio 2025"...'
          aria-label="Pesquisar transações"
          className={`${fieldClass} pl-8`}
        />
      </div>

      <div role="group" aria-label="Filtrar por tipo" className="grid grid-cols-3 gap-2">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={filters.type === opt.value}
            onClick={() => setType(opt.value)}
            className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
              filters.type === opt.value
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <select
          value={filters.accountId}
          onChange={(e) => onChange({ ...filters, accountId: e.target.value })}
          aria-label="Filtrar por conta"
          className={fieldClass}
        >
          <option value="">Todas as contas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={filters.categoryId}
          onChange={(e) => onChange({ ...filters, categoryId: e.target.value })}
          aria-label="Filtrar por categoria"
          className={fieldClass}
        >
          <option value="">Todas as categorias</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

const EMPTY_FILTERS = { query: '', type: 'all', accountId: '', categoryId: '' }

export default function TransactionList({ categories, accounts, refreshToken, onAddFirst, onRowChanged }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Debounce do texto de pesquisa, para não disparar um pedido a cada tecla.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(filters.query), 300)
    return () => clearTimeout(id)
  }, [filters.query])

  const smart = useMemo(() => parseSmartQuery(debouncedQuery), [debouncedQuery])

  async function loadPage(offset) {
    const { rows: pageRows, totalCount: count } = await listTransactionsPage({
      limit: PAGE_SIZE,
      offset,
      type: filters.type,
      accountId: filters.accountId,
      categoryId: filters.categoryId,
      smart,
    })
    return { pageRows, count }
  }

  // Mudar filtros ou pesquisa volta sempre à primeira página.
  useEffect(() => {
    setPage(1)
  }, [filters.type, filters.accountId, filters.categoryId, debouncedQuery, refreshToken])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError('')
      try {
        const { pageRows, count } = await loadPage((page - 1) * PAGE_SIZE)
        if (cancelled) return
        setRows(pageRows)
        setTotalCount(count)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.type, filters.accountId, filters.categoryId, debouncedQuery, refreshToken, page])

  function handleUpdated(updatedTx) {
    setRows((prev) => prev.map((r) => (r.id === updatedTx.id ? updatedTx : r)))
    onRowChanged?.()
  }

  function handleDeleted(id) {
    setRows((prev) => prev.filter((r) => r.id !== id))
    setTotalCount((prev) => Math.max(0, prev - 1))
    onRowChanged?.()
  }

  // Após "Desfazer" recriar a transação (com novo id), a forma mais simples e
  // correta de a voltar a mostrar é recarregar a primeira página — evita ter
  // de adivinhar a posição de ordenação certa entre as linhas já carregadas.
  async function handleRestored() {
    try {
      const { pageRows, count } = await loadPage(0)
      setPage(1)
      setRows(pageRows)
      setTotalCount(count)
    } catch (err) {
      setError(err.message)
    }
    onRowChanged?.()
  }

  const hasActiveFilters =
    filters.query.trim() !== '' || filters.type !== 'all' || filters.accountId !== '' || filters.categoryId !== ''

  if (loading) {
    return <ListSkeleton rows={5} />
  }

  if (error) {
    return <ErrorNotice message={error} />
  }

  return (
    <div className="space-y-3">
      <TransactionFilters
        filters={filters}
        onChange={setFilters}
        categories={categories}
        accounts={accounts}
      />

      <div className="flex items-center justify-between text-xs text-neutral-500" aria-live="polite">
        <span>{totalCount} transações</span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="underline-offset-2 hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={hasActiveFilters ? 'Nenhuma transação corresponde à pesquisa' : 'Ainda sem transações'}
          description={
            hasActiveFilters
              ? 'Pesquisa por texto, valor (">20") ou mês ("maio 2025").'
              : 'Regista o primeiro gasto ou ganho para começares a ver o teu balanço.'
          }
          actionLabel={hasActiveFilters ? 'Limpar filtros' : 'Registar primeira transação'}
          onAction={hasActiveFilters ? () => setFilters(EMPTY_FILTERS) : onAddFirst}
        />
      ) : (
        <>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {rows.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                categories={categories}
                accounts={accounts}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
                onRestored={handleRestored}
              />
            ))}
          </ul>
          <Pager page={page} totalPages={Math.ceil(totalCount / PAGE_SIZE)} onChange={setPage} />
        </>
      )}
    </div>
  )
}
