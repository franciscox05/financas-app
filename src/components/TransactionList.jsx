import { ArrowRightLeft, Link2, Pencil, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../context/toastContext'
import {
  createTransaction,
  createTransfer,
  deleteTransaction,
  deleteTransfer,
  listMovementsPage,
  updateTransaction,
} from '../lib/db'
import { getLedgerEntriesForTransactions, listUnlinkedLedgerEntriesInRange } from '../lib/friendsDb'
import { addMonths, monthLabel, monthStart, toIsoDate } from '../lib/dates'
import { entryLabel, signedCents } from '../lib/ledgerMath'
import { blocksTransactionEdit, transactionLinkedMessage } from '../lib/linkedLogic'
import { parseSmartQuery } from '../lib/smartSearch'
import { EmptyState, ErrorNotice, ListSkeleton, Pager } from './Feedback'
import Money from './Money'
import MonthPicker from './MonthPicker'
import { eur } from '../lib/format'

const PAGE_SIZE = 25

function formatAmount(amount, type) {
  const sign = type === 'income' ? '+' : '-'
  return `${sign}${eur(amount)}`
}

function formatDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Texto extra junto ao nome do amigo na ligação — só para estados que valem a pena
// destacar; confirmado/cancelado não precisam de aviso (fica só o nome).
const LINKED_BADGE_TEXT = {
  pending: 'pendente',
  declined: 'contestado',
  cancel_requested: 'anulação pedida',
}

function TransferRow({ tx, onDeleted, onRestored }) {
  const toast = useToast()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    setBusy(true)
    try {
      await deleteTransfer(tx.id)
      onDeleted(tx.id)
      toast.success('Transferência apagada.', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            try {
              await createTransfer({
                fromAccountId: tx.account_id,
                toAccountId: tx.counter_account_id,
                amount: Number(tx.amount),
                occurredOn: tx.occurred_on,
                note: tx.note,
              })
              onRestored()
              toast.success('Transferência restaurada.')
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

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
          <ArrowRightLeft size={13} className="shrink-0 text-blue-500" />
          {tx.note || 'Transferência'}
        </p>
        <p className="truncate text-xs text-neutral-500">
          {formatDate(tx.occurred_on)} · {tx.account_name ?? 'Conta'} → {tx.counter_account_name ?? 'Conta'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold text-blue-500">
          <Money>{eur(tx.amount)}</Money>
        </span>
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

function TransactionRow({
  tx,
  categories,
  accounts,
  editing,
  onEditStart,
  onEditEnd,
  linkedEntry,
  onUpdated,
  onDeleted,
  onRestored,
}) {
  const toast = useToast()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [amount, setAmount] = useState(tx.amount)
  const [categoryId, setCategoryId] = useState(tx.category_id)
  const [accountId, setAccountId] = useState(tx.account_id)
  const [note, setNote] = useState(tx.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const categoriesForType = categories.filter((c) => c.type === tx.type)

  async function handleDelete() {
    if (linkedEntry && blocksTransactionEdit(linkedEntry)) {
      toast.error(transactionLinkedMessage(linkedEntry))
      setConfirmingDelete(false)
      return
    }
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
        category_name: categories.find((c) => c.id === updated.category_id)?.name,
        account_name: accounts.find((a) => a.id === updated.account_id)?.name,
      })
      onEditEnd()
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
    onEditEnd()
  }

  if (editing) {
    return (
      <li className="space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
        {linkedEntry && (
          <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <Link2 size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Ligado a um movimento com{' '}
              <Link to={`/dividas/${linkedEntry.friend_id}`} className="underline underline-offset-2">
                {linkedEntry.friendName}
              </Link>
              . Mudar o valor aqui não atualiza esse movimento.
            </span>
          </p>
        )}
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
          {tx.note || tx.category_name || 'Sem nota'}
        </p>
        <p className="truncate text-xs text-neutral-500">
          {formatDate(tx.occurred_on)}
          {tx.note && ` · ${tx.category_name ?? 'Sem categoria'}`} · {tx.account_name ?? 'Sem conta'}
        </p>
        {linkedEntry && (
          <Link
            to={`/dividas/${linkedEntry.friend_id}`}
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-neutral-500 underline-offset-2 hover:underline"
          >
            <Link2 size={11} aria-hidden="true" />
            {linkedEntry.friendName}
            {LINKED_BADGE_TEXT[linkedEntry.status] ? ` · ${LINKED_BADGE_TEXT[linkedEntry.status]}` : ''}
          </Link>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`text-sm font-semibold ${
            tx.type === 'income' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          <Money>{formatAmount(tx.amount, tx.type)}</Money>
        </span>
        <button
          onClick={onEditStart}
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
  const [selectedMonth, setSelectedMonth] = useState(() => monthStart(new Date()))
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Só uma transação de cada vez em edição: abrir outra fecha a anterior.
  const [editingId, setEditingId] = useState(null)
  // {transactionId: entry} para a página atual — um só pedido por página, não um por linha.
  const [linkedEntries, setLinkedEntries] = useState(new Map())
  // Movimentos de amigos do mês sem transação ligada (ex. "Descontado noutra coisa") —
  // não contam para nenhuma conta, mas ficam visíveis aqui à parte, a pedido do Francisco.
  const [offsetEntries, setOffsetEntries] = useState([])

  // Debounce do texto de pesquisa, para não disparar um pedido a cada tecla.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(filters.query), 300)
    return () => clearTimeout(id)
  }, [filters.query])

  const parsedSmart = useMemo(() => parseSmartQuery(debouncedQuery), [debouncedQuery])

  // Por omissão a lista fica presa ao mês selecionado (como o resto da app),
  // em vez de mostrar tudo desde sempre. Uma pesquisa com data explícita (ex.
  // "maio 2025") é mais específica, por isso tem prioridade sobre o mês.
  const smart = useMemo(() => {
    if (parsedSmart.dateFrom || parsedSmart.dateTo) return parsedSmart
    return {
      ...parsedSmart,
      dateFrom: toIsoDate(selectedMonth),
      dateTo: toIsoDate(addMonths(selectedMonth, 1)),
    }
  }, [parsedSmart, selectedMonth])

  // Ligações a amigos da página atual, visíveis sempre (não só ao editar/apagar).
  useEffect(() => {
    const ids = rows.filter((r) => r.source !== 'transfer').map((r) => r.id)
    if (ids.length === 0) {
      setLinkedEntries(new Map())
      return
    }
    let cancelled = false
    getLedgerEntriesForTransactions(ids)
      .then((map) => {
        if (!cancelled) setLinkedEntries(map)
      })
      .catch(() => {
        if (!cancelled) setLinkedEntries(new Map())
      })
    return () => {
      cancelled = true
    }
  }, [rows])

  // Carrega ao mesmo tempo que a lista real, preso ao mesmo mês (não à pesquisa/filtros,
  // que são só para transações).
  useEffect(() => {
    let cancelled = false
    listUnlinkedLedgerEntriesInRange({
      from: toIsoDate(selectedMonth),
      to: toIsoDate(addMonths(selectedMonth, 1)),
    })
      .then((entries) => {
        if (!cancelled) setOffsetEntries(entries)
      })
      .catch(() => {
        if (!cancelled) setOffsetEntries([])
      })
    return () => {
      cancelled = true
    }
  }, [selectedMonth, refreshToken])

  async function loadPage(offset) {
    const { rows: pageRows, totalCount: count } = await listMovementsPage({
      limit: PAGE_SIZE,
      offset,
      type: filters.type,
      accountId: filters.accountId,
      categoryId: filters.categoryId,
      smart,
    })
    return { pageRows, count }
  }

  // Mudar filtros, mês ou pesquisa volta sempre à primeira página e fecha a edição aberta.
  useEffect(() => {
    setPage(1)
    setEditingId(null)
  }, [filters.type, filters.accountId, filters.categoryId, debouncedQuery, selectedMonth, refreshToken])

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
        setEditingId(null)
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
  }, [filters.type, filters.accountId, filters.categoryId, debouncedQuery, selectedMonth, refreshToken, page])

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
      <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />

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
          title={hasActiveFilters ? 'Nenhuma transação corresponde à pesquisa' : `Sem transações em ${monthLabel(selectedMonth)}`}
          description={
            hasActiveFilters
              ? 'Pesquisa por texto, valor (">20") ou mês ("maio 2025").'
              : 'Regista um gasto ou ganho, ou navega para outro mês acima.'
          }
          actionLabel={hasActiveFilters ? 'Limpar filtros' : 'Registar primeira transação'}
          onAction={hasActiveFilters ? () => setFilters(EMPTY_FILTERS) : onAddFirst}
        />
      ) : (
        <>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {rows.map((tx) =>
              tx.source === 'transfer' ? (
                <TransferRow key={tx.id} tx={tx} onDeleted={handleDeleted} onRestored={handleRestored} />
              ) : (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  categories={categories}
                  accounts={accounts}
                  editing={editingId === tx.id}
                  onEditStart={() => setEditingId(tx.id)}
                  onEditEnd={() => setEditingId(null)}
                  linkedEntry={linkedEntries.get(tx.id)}
                  onUpdated={handleUpdated}
                  onDeleted={handleDeleted}
                  onRestored={handleRestored}
                />
              ),
            )}
          </ul>
          <Pager page={page} totalPages={Math.ceil(totalCount / PAGE_SIZE)} onChange={setPage} />
        </>
      )}

      {offsetEntries.length > 0 && (
        <section className="space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <div>
            <h3 className="text-sm font-semibold text-neutral-500">Conta-corrente (sem transação)</h3>
            <p className="text-xs text-neutral-400">
              Acertos com amigos que não mexeram em nenhuma conta tua — não contam para o Balanço.
            </p>
          </div>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {offsetEntries.map((entry) => {
              const cents = signedCents(entry.kind, entry.amount)
              const positive = cents > 0
              return (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {entry.note || entryLabel(entry.kind)}
                    </p>
                    <Link
                      to={`/dividas/${entry.friend_id}`}
                      className="flex items-center gap-1 text-xs text-neutral-500 underline-offset-2 hover:underline"
                    >
                      {formatDate(entry.occurred_on)} ·{' '}
                      <Link2 size={11} aria-hidden="true" className="shrink-0" />
                      {entry.friendName}
                      {LINKED_BADGE_TEXT[entry.status] ? ` · ${LINKED_BADGE_TEXT[entry.status]}` : ''}
                    </Link>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold ${
                      positive ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    <Money>{`${positive ? '+' : '−'}${eur(Math.abs(cents) / 100)}`}</Money>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
