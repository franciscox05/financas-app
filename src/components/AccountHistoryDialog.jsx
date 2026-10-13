import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { listTransactionsPage } from '../lib/db'
import { EmptyState, ErrorNotice, ListSkeleton } from './Feedback'
import Money from './Money'

const PAGE_SIZE = 20

function formatDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Histórico de uma conta: transações (mais recentes primeiro) e, nas contas de
// investimento, as atualizações de saldo registadas. Só leitura.
export default function AccountHistoryDialog({ account, snapshots, onClose }) {
  const ref = useRef(null)
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = ref.current
    if (account && dialog && !dialog.open) dialog.showModal()
  }, [account])

  useEffect(() => {
    if (!account) return undefined
    let cancelled = false
    setLoading(true)
    setError('')
    setRows([])
    listTransactionsPage({ accountId: account.id, limit: PAGE_SIZE, offset: 0 })
      .then(({ rows: page, totalCount: total }) => {
        if (cancelled) return
        setRows(page)
        setTotalCount(total ?? page.length)
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [account])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const { rows: page } = await listTransactionsPage({
        accountId: account.id,
        limit: PAGE_SIZE,
        offset: rows.length,
      })
      setRows((prev) => [...prev, ...page])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }

  const accountSnapshots = account ? snapshots.filter((s) => s.account_id === account.id) : []

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current.close()
      }}
      aria-labelledby="account-history-title"
      className="confirm-dialog m-auto max-h-[80dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl bg-white p-5 text-neutral-900 shadow-xl backdrop:bg-black/50 dark:bg-neutral-800 dark:text-neutral-100"
    >
      {account && (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="account-history-title" className="text-base font-semibold tracking-tight">
              {account.name}
            </h2>
            <button
              type="button"
              onClick={() => ref.current.close()}
              aria-label="Fechar"
              className="flex size-9 items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-200"
            >
              <X size={18} />
            </button>
          </div>

          {accountSnapshots.length > 0 && (
            <section className="mb-4">
              <h3 className="mb-1 text-xs font-semibold text-neutral-500">Atualizações de saldo</h3>
              <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {accountSnapshots.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-neutral-500">{formatDate(s.snapshot_date)}</span>
                    <span className="font-semibold">
                      <Money value={Number(s.value)} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-1 text-xs font-semibold text-neutral-500">
              Transações{totalCount ? ` (${totalCount})` : ''}
            </h3>
            {error ? (
              <ErrorNotice message={error} />
            ) : loading ? (
              <ListSkeleton />
            ) : rows.length === 0 ? (
              <EmptyState
                title="Sem transações"
                description="Ainda não há registos nesta conta."
              />
            ) : (
              <>
                <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {rows.map((tx) => (
                    <li key={tx.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
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
                {rows.length < totalCount && (
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="mt-2 min-h-11 w-full rounded-lg border border-neutral-300 text-sm font-medium disabled:opacity-50 dark:border-neutral-600"
                  >
                    {loadingMore ? 'A carregar...' : 'Ver mais'}
                  </button>
                )}
              </>
            )}
          </section>
        </>
      )}
    </dialog>
  )
}
