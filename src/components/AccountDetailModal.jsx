import { X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { EmptyState, ErrorNotice, ListSkeleton, Pager } from './Feedback'
import Modal from './Modal'
import Money from './Money'
import { listNetWorthSnapshots, listTransactionsPage, listTransfers } from '../lib/db'
import { eur, ptDate } from '../lib/format'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'

// Menor que a página cheia (20, em AccountHistory.jsx): isto é um modal
// compacto sobreposto ao Património, não uma página dedicada só à conta.
const PAGE_SIZE = 10

// Detalhe de uma conta em modal, por cima do Património — antes era uma
// navegação para uma página nova (AccountHistory.jsx, que se mantém como
// rota própria, só deixou de ser o caminho usado a partir do Património).
// Fechar (X ou tocar fora, ambos já tratados pelo Modal partilhado) volta
// imediatamente ao ecrã por trás, sem recarregar a rota.
export default function AccountDetailModal({ account, balance, onClose }) {
  const titleId = useId()
  return (
    <Modal open={account !== null} onClose={onClose} labelledBy={titleId}>
      {account && (
        <AccountDetailBody key={account.id} account={account} balance={balance} titleId={titleId} onClose={onClose} />
      )}
    </Modal>
  )
}

// Só monta quando há conta escolhida — os efeitos abaixo podem assumir
// sempre `account.id` definido, sem precisar de guardas de "ainda fechado".
function AccountDetailBody({ account, balance, titleId, onClose }) {
  const [snapshots, setSnapshots] = useState([])
  const [transfers, setTransfers] = useState([])
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [snapPage, setSnapPage] = useState(1)
  const [transferPage, setTransferPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([listNetWorthSnapshots(), listTransfers()])
      .then(([snaps, trs]) => {
        if (cancelled) return
        setSnapshots(snaps.filter((s) => s.account_id === account.id))
        setTransfers(trs.filter((t) => t.from_account_id === account.id || t.to_account_id === account.id))
      })
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [account.id])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listTransactionsPage({ accountId: account.id, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
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
  }, [account.id, page])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={titleId}
            className="truncate text-sm font-semibold text-neutral-500"
          >
            {account.name}
          </h2>
          <p className="mt-0.5 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            <Money value={balance} />
          </p>
          <p className="text-xs text-neutral-400">saldo atual</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100 ${focusRing}`}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {error && <ErrorNotice message={error} />}

      {snapshots.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Atualizações de saldo</h3>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {snapshots.slice((snapPage - 1) * PAGE_SIZE, snapPage * PAGE_SIZE).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-neutral-500">{ptDate(s.snapshot_date)}</span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  <Money value={Number(s.value)} />
                </span>
              </li>
            ))}
          </ul>
          <Pager page={snapPage} totalPages={Math.ceil(snapshots.length / PAGE_SIZE)} onChange={setSnapPage} />
        </div>
      )}

      {transfers.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Transferências</h3>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {transfers.slice((transferPage - 1) * PAGE_SIZE, transferPage * PAGE_SIZE).map((t) => {
              const isOutgoing = t.from_account_id === account.id
              return (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="min-w-0 truncate text-neutral-500">
                    {ptDate(t.occurred_on)} ·{' '}
                    {isOutgoing ? `para ${t.to_account?.name ?? 'conta'}` : `de ${t.from_account?.name ?? 'conta'}`}
                  </span>
                  <span className={`shrink-0 font-semibold ${isOutgoing ? 'text-red-600' : 'text-green-600'}`}>
                    <Money>{`${isOutgoing ? '-' : '+'}${eur(t.amount)}`}</Money>
                  </span>
                </li>
              )
            })}
          </ul>
          <Pager page={transferPage} totalPages={Math.ceil(transfers.length / PAGE_SIZE)} onChange={setTransferPage} />
        </div>
      )}

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
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
                      {tx.note || tx.categories?.name || 'Sem nota'}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {ptDate(tx.occurred_on)}
                      {tx.note && ` · ${tx.categories?.name ?? 'Sem categoria'}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold ${
                      tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    <Money>{`${tx.type === 'income' ? '+' : '-'}${eur(tx.amount)}`}</Money>
                  </span>
                </li>
              ))}
            </ul>
            <Pager page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
