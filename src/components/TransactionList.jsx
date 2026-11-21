import { ArrowRightLeft, Link2, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { statementKey } from '../lib/accountBalance'
import { listMovementsPage } from '../lib/db'
import { getLedgerEntriesForTransactions } from '../lib/friendsDb'
import { addMonths, monthLabel, monthStart, toIsoDate, today } from '../lib/dates'
import { entryLabel } from '../lib/ledgerMath'
import { parseSmartQuery } from '../lib/smartSearch'
import { dayHeading, groupByDay } from '../lib/dayGroups'
import { useAccountStatement } from '../lib/useAccountStatement'
import { t } from '../i18n'
import { EmptyState, ErrorNotice, ListSkeleton, Pager } from './Feedback'
import Money from './Money'
import MonthPicker from './MonthPicker'
import TransactionDetailModal from './TransactionDetailModal'
import Segmented from './ui/Segmented'
import { eur, getFormat } from '../lib/format'

const PAGE_SIZE = 25

function formatAmount(amount, type) {
  const sign = type === 'income' ? '+' : '-'
  return `${sign}${eur(amount)}`
}

// Texto extra junto ao nome do amigo na ligação — só para estados que valem a pena
// destacar; confirmado/cancelado não precisam de aviso (fica só o nome).
const LINKED_BADGE_TEXT = {
  pending: 'pendente',
  declined: 'contestado',
  cancel_requested: 'anulação pedida',
}

// "saldo antes X" por baixo do valor, só quando a lista está filtrada por uma conta
// (aí o saldo de cada linha é o dessa conta, como num extrato do banco).
function BalanceBefore({ value }) {
  if (value === undefined) return null
  return (
    <span className="amount block text-right text-xs font-normal text-label-3">
      <Money>{t('stmt.before', { value: eur(value) })}</Money>
    </span>
  )
}

const rowButtonClass =
  'flex w-full min-h-14 items-center justify-between gap-3 rounded-control py-2 text-left transition-colors duration-150 ease-out hover:bg-fill active:bg-fill'

// Todas as linhas são só de leitura e clicáveis: abrem o modal de detalhe, que
// trata de edição/apagar com as regras certas para cada tipo de movimento.
function TransferRow({ tx, onOpen, balanceBefore }) {
  // "Conta como gasto" (ex. investimentos): mesma transferência, mas lê-se como
  // um gasto normal — vermelho, categoria em vez da seta de conta a conta.
  if (tx.counts_as_expense) {
    return (
      <li>
        <button type="button" onClick={() => onOpen(tx)} className={rowButtonClass}>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-label">
              {tx.note || tx.category_name || 'Investimento'}
            </p>
            <p className="flex items-center gap-1 truncate text-xs text-label-2">
              {tx.note ? `${tx.category_name ?? 'Sem categoria'} · ` : ''}{tx.account_name ?? 'Conta'}
              <ArrowRightLeft size={11} aria-hidden="true" className="shrink-0" />
              {tx.counter_account_name ?? 'Conta'}
            </p>
          </div>
          <span className="shrink-0 text-right text-sm font-semibold text-negative">
            <Money>{formatAmount(tx.amount, 'expense')}</Money>
            <BalanceBefore value={balanceBefore} />
          </span>
        </button>
      </li>
    )
  }

  return (
    <li>
      <button type="button" onClick={() => onOpen(tx)} className={rowButtonClass}>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-label">
            <ArrowRightLeft size={13} className="shrink-0 text-accent" />
            {tx.note || 'Transferência'}
          </p>
          <p className="truncate text-xs text-label-2">
            {tx.account_name ?? 'Conta'} → {tx.counter_account_name ?? 'Conta'}
          </p>
        </div>
        <span className="shrink-0 text-right text-sm font-semibold text-accent">
          <Money>{eur(tx.amount)}</Money>
          <BalanceBefore value={balanceBefore} />
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
          <p className="truncate text-sm font-medium text-label">
            {tx.note || entryLabel(tx.ledger_kind)}
          </p>
          <p className="flex items-center gap-1 text-xs text-label-2">
            <Link2 size={11} aria-hidden="true" className="shrink-0" />
            {tx.friend_name}
            {LINKED_BADGE_TEXT[tx.ledger_status] ? ` · ${LINKED_BADGE_TEXT[tx.ledger_status]}` : ''}
          </p>
        </div>
        <span className={`shrink-0 text-right text-sm font-semibold ${tx.type === 'income' ? 'text-positive' : 'text-negative'}`}>
          <Money>{formatAmount(tx.amount, tx.type)}</Money>
        </span>
      </button>
    </li>
  )
}

function TransactionRow({ tx, linkedEntry, onOpen, balanceBefore }) {
  return (
    <li>
      <button type="button" onClick={() => onOpen(tx)} className={rowButtonClass}>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-label">
            {tx.note || tx.category_name || 'Sem nota'}
          </p>
          <p className="truncate text-xs text-label-2">
            {tx.note ? `${tx.category_name ?? 'Sem categoria'} · ` : ''}{tx.account_name ?? 'Sem conta'}
          </p>
          {linkedEntry && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-label-2">
              <Link2 size={11} aria-hidden="true" />
              {linkedEntry.friendName}
              {LINKED_BADGE_TEXT[linkedEntry.status] ? ` · ${LINKED_BADGE_TEXT[linkedEntry.status]}` : ''}
            </p>
          )}
        </div>
        <span className={`shrink-0 text-right text-sm font-semibold ${tx.type === 'income' ? 'text-positive' : 'text-negative'}`}>
          <Money>{formatAmount(tx.amount, tx.type)}</Money>
          <BalanceBefore value={balanceBefore} />
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
  'w-full rounded-control border-0 bg-fill px-3 text-label focus:ring-2 focus:ring-accent text-sm'

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
          size={17}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-label-2"
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
          className={`w-full rounded-control border-0 bg-fill py-2 pl-9 text-label placeholder:text-label-2 focus:ring-2 focus:ring-accent ${draft ? 'pr-11' : 'pr-3'}`}
        />
        {draft && (
          <button
            type="button"
            onClick={() => {
              setDraft('')
              onChange({ ...filters, query: '' })
            }}
            aria-label="Limpar pesquisa"
            className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-label-2"
          >
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </form>

      <Segmented label="Filtrar por tipo" options={TYPE_OPTIONS} value={filters.type} onChange={setType} />

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
  // Filtrada por uma conta: extrato dessa conta para mostrar o saldo antes de cada
  // linha. `statementReload` volta a calculá-lo depois de editar/apagar/desfazer.
  const [statementReload, setStatementReload] = useState(0)
  const { lines: statementLines } = useAccountStatement(filters.accountId || null, `${refreshToken}:${statementReload}`)
  const balanceBeforeByKey = useMemo(() => {
    const map = new Map()
    for (const line of statementLines ?? []) map.set(statementKey(line.kind, line.item.id), line.balanceBefore)
    return map
  }, [statementLines])

  const parsedSmart = useMemo(() => parseSmartQuery(filters.query), [filters.query])
  const todayIso = today()
  const dayLabels = { today: t('day.today'), yesterday: t('day.yesterday') }

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
    setStatementReload((n) => n + 1)
    onRowChanged?.()
  }

  function handleDeleted(id) {
    setRows((prev) => prev.filter((r) => r.id !== id))
    setTotalCount((prev) => Math.max(0, prev - 1))
    setStatementReload((n) => n + 1)
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
    setStatementReload((n) => n + 1)
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

      <div className="flex min-h-6 items-center justify-between text-[0.8125rem] text-label-2" aria-live="polite">
        <span className="amount">{totalCount} {totalCount === 1 ? 'transação' : 'transações'}</span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="-my-2 min-h-11 px-1 font-medium text-accent"
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
          {/* Agrupado por dia, como nas apps dos bancos: o dia vai no título do grupo e
              sai do subtítulo de cada linha. */}
          <div className={`space-y-3 transition-opacity duration-150 ${loading ? 'opacity-60' : ''}`}>
            {groupByDay(rows).map((group) => (
              <section key={group.date} aria-label={dayHeading(group.date, todayIso, dayLabels, getFormat().locale)}>
                <h3 className="sticky top-[calc(max(1rem,env(safe-area-inset-top))+3.85rem)] z-[1] -mx-1 bg-surface px-1 py-1 text-[0.8125rem] font-semibold text-label-2">
                  {dayHeading(group.date, todayIso, dayLabels, getFormat().locale)}
                </h3>
                <ul className="divide-y divide-separator">
            {group.rows.map((tx) =>
              tx.source === 'transfer' ? (
                <TransferRow
                  key={tx.id}
                  tx={tx}
                  onOpen={setModalTx}
                  balanceBefore={balanceBeforeByKey.get(statementKey('transfer', tx.id))}
                />
              ) : tx.source === 'ledger' ? (
                <LedgerMovementRow key={tx.id} tx={tx} onOpen={setModalTx} />
              ) : (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  linkedEntry={linkedEntries.get(tx.id)}
                  onOpen={setModalTx}
                  balanceBefore={balanceBeforeByKey.get(statementKey('transaction', tx.id))}
                />
              ),
            )}
                </ul>
              </section>
            ))}
          </div>
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
