import { ArrowRightLeft, Link2, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { listMovementsPage } from '../lib/db'
import { getLedgerEntriesForTransactions } from '../lib/friendsDb'
import { addMonths, monthLabel, monthStart, toIsoDate } from '../lib/dates'
import { entryLabel } from '../lib/ledgerMath'
import { parseSmartQuery } from '../lib/smartSearch'
import { EmptyState, ErrorNotice, ListSkeleton, Pager } from './Feedback'
import Money from './Money'
import MonthPicker from './MonthPicker'
import TransactionDetailModal from './TransactionDetailModal'
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

const rowButtonClass =
  'flex w-full min-h-14 items-center justify-between gap-3 rounded-lg py-2 text-left transition-colors duration-150 ease-out hover:bg-neutral-50 active:bg-neutral-100 dark:hover:bg-neutral-800/60 dark:active:bg-neutral-800'

// Todas as linhas são só de leitura e clicáveis: abrem o modal de detalhe, que
// trata de edição/apagar com as regras certas para cada tipo de movimento.
function TransferRow({ tx, onOpen }) {
  return (
    <li>
      <button type="button" onClick={() => onOpen(tx)} className={rowButtonClass}>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
            <ArrowRightLeft size={13} className="shrink-0 text-blue-500" />
            {tx.note || 'Transferência'}
          </p>
          <p className="truncate text-xs text-neutral-500">
            {formatDate(tx.occurred_on)} · {tx.account_name ?? 'Conta'} → {tx.counter_account_name ?? 'Conta'}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-blue-500">
          <Money>{eur(tx.amount)}</Money>
        </span>
      </button>
    </li>
  )
}

function LedgerMovementRow({ tx, onOpen }) {
  return (
    <li>
      <button type="button" onClick={() => onOpen(tx)} className={rowButtonClass}>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {tx.note || entryLabel(tx.ledger_kind)}
          </p>
          <p className="flex items-center gap-1 text-xs text-neutral-500">
            {formatDate(tx.occurred_on)}
            <Link2 size={11} aria-hidden="true" className="shrink-0" />
            {tx.friend_name}
            {LINKED_BADGE_TEXT[tx.ledger_status] ? ` · ${LINKED_BADGE_TEXT[tx.ledger_status]}` : ''}
          </p>
        </div>
        <span className={`shrink-0 text-sm font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
          <Money>{formatAmount(tx.amount, tx.type)}</Money>
        </span>
      </button>
    </li>
  )
}

function TransactionRow({ tx, linkedEntry, onOpen }) {
  return (
    <li>
      <button type="button" onClick={() => onOpen(tx)} className={rowButtonClass}>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {tx.note || tx.category_name || 'Sem nota'}
          </p>
          <p className="truncate text-xs text-neutral-500">
            {formatDate(tx.occurred_on)}
            {tx.note && ` · ${tx.category_name ?? 'Sem categoria'}`} · {tx.account_name ?? 'Sem conta'}
          </p>
          {linkedEntry && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
              <Link2 size={11} aria-hidden="true" />
              {linkedEntry.friendName}
              {LINKED_BADGE_TEXT[linkedEntry.status] ? ` · ${LINKED_BADGE_TEXT[linkedEntry.status]}` : ''}
            </p>
          )}
        </div>
        <span className={`shrink-0 text-sm font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
          <Money>{formatAmount(tx.amount, tx.type)}</Money>
        </span>
      </button>
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

  // O texto só vira pesquisa ao carregar Enter (ou ao limpar) — pesquisar a cada
  // pausa recarregava a lista e fazia a página saltar enquanto se escrevia.
  const [draft, setDraft] = useState(filters.query)
  useEffect(() => {
    setDraft(filters.query)
  }, [filters.query])

  function submitSearch(e) {
    e.preventDefault()
    onChange({ ...filters, query: draft })
  }

  return (
    <div className="space-y-2.5">
      <form onSubmit={submitSearch} className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          type="search"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            // Apagar tudo (inclui o "x" nativo do type=search) repõe a lista de imediato.
            if (e.target.value === '' && filters.query !== '') onChange({ ...filters, query: '' })
          }}
          enterKeyHint="search"
          placeholder="Pesquisar transações..."
          aria-label="Pesquisar transações"
          className={`${fieldClass} pl-8 ${draft ? 'pr-9' : ''}`}
        />
        {draft && (
          <button
            type="button"
            onClick={() => {
              setDraft('')
              onChange({ ...filters, query: '' })
            }}
            aria-label="Limpar pesquisa"
            className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </form>

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
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Um só modal de cada vez: abrir outro fecha o anterior (é só trocar o tx).
  const [modalTx, setModalTx] = useState(null)
  // {transactionId: entry} para a página atual — um só pedido por página, não um por linha.
  const [linkedEntries, setLinkedEntries] = useState(new Map())

  const parsedSmart = useMemo(() => parseSmartQuery(filters.query), [filters.query])

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

  // Ligações a amigos da página atual, visíveis sempre (não só ao editar/apagar) — só
  // para transações reais ligadas (os próprios movimentos "ledger" já se mostram a si
  // mesmos, não precisam de ir buscar mais nada).
  useEffect(() => {
    const ids = rows.filter((r) => r.source === 'transaction').map((r) => r.id)
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

  // Mudar filtros, mês ou pesquisa volta sempre à primeira página e fecha o modal aberto.
  useEffect(() => {
    setPage(1)
    setModalTx(null)
  }, [filters.type, filters.accountId, filters.categoryId, filters.query, selectedMonth, refreshToken])

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
  }, [filters.type, filters.accountId, filters.categoryId, filters.query, selectedMonth, refreshToken, page])

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

      {/* Skeleton só no primeiro carregamento: a trocar a lista por 5 linhas a cada
          recarga a página encolhia e o scroll saltava. */}
      {loading && rows.length === 0 ? (
        <ListSkeleton rows={5} />
      ) : error ? (
        <ErrorNotice message={error} />
      ) : rows.length === 0 ? (
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
          <ul
            className={`divide-y divide-neutral-200 transition-opacity duration-150 dark:divide-neutral-800 ${
              loading ? 'opacity-60' : ''
            }`}
          >
            {rows.map((tx) =>
              tx.source === 'transfer' ? (
                <TransferRow key={tx.id} tx={tx} onOpen={setModalTx} />
              ) : tx.source === 'ledger' ? (
                <LedgerMovementRow key={tx.id} tx={tx} onOpen={setModalTx} />
              ) : (
                <TransactionRow key={tx.id} tx={tx} linkedEntry={linkedEntries.get(tx.id)} onOpen={setModalTx} />
              ),
            )}
          </ul>
          <Pager page={page} totalPages={Math.ceil(totalCount / PAGE_SIZE)} onChange={setPage} />
        </>
      )}

      <TransactionDetailModal
        tx={modalTx}
        categories={categories}
        accounts={accounts}
        linkedEntry={modalTx ? linkedEntries.get(modalTx.id) : undefined}
        onClose={() => setModalTx(null)}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
        onRestored={handleRestored}
        onRowChanged={onRowChanged}
      />
    </div>
  )
}
