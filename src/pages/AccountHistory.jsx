import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, ErrorNotice, ListSkeleton, Pager } from '../components/Feedback'
import Money from '../components/Money'
import { listAccounts, listNetWorthSnapshots, listTransactionsPage } from '../lib/db'

const PAGE_SIZE = 20

function formatDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Histórico de uma conta (só leitura): transações paginadas e, nas contas de
// investimento, as atualizações de saldo registadas.
export default function AccountHistory() {
  const { accountId } = useParams()
  const [account, setAccount] = useState(null)
  const [snapshots, setSnapshots] = useState([])
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([listAccounts(), listNetWorthSnapshots()])
      .then(([accounts, snaps]) => {
        if (cancelled) return
        setAccount(accounts.find((a) => a.id === accountId) ?? null)
        setSnapshots(snaps.filter((s) => s.account_id === accountId))
      })
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [accountId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listTransactionsPage({ accountId, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
      .then(({ rows: pageRows, totalCount: total }) => {
        if (cancelled) return
        setRows(pageRows)
        setTotalCount(total ?? pageRows.length)
        setError('')
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [accountId, page])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          to="/patrimonio"
          aria-label="Voltar ao património"
          className="-ml-2 flex size-10 items-center justify-center rounded-lg text-neutral-500 active:scale-95"
        >
          <ChevronLeft size={22} />
        </Link>
        <h2 className="min-w-0 truncate text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          {account?.name ?? 'Conta'}
        </h2>
      </div>

      {error && <ErrorNotice message={error} />}

      {snapshots.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-sm font-semibold text-neutral-500">Atualizações de saldo</h3>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {snapshots.slice(0, 10).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-neutral-500">{formatDate(s.snapshot_date)}</span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  <Money value={Number(s.value)} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-1">
        <h3 className="text-sm font-semibold text-neutral-500">
          Transações{totalCount ? ` (${totalCount})` : ''}
        </h3>
        {loading ? (
          <ListSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState title="Sem transações" description="Ainda não há registos nesta conta." />
        ) : (
          <>
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {rows.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {tx.categories?.name ?? 'Sem categoria'}
                      {tx.note ? <span className="text-neutral-400"> · {tx.note}</span> : null}
                    </p>
                    <p className="text-xs text-neutral-500">{formatDate(tx.occurred_on)}</p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold ${
                      tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    <Money>{`${tx.type === 'income' ? '+' : '-'}${Number(tx.amount).toFixed(2)} €`}</Money>
                  </span>
                </li>
              ))}
            </ul>
            <Pager page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </section>
    </div>
  )
}
