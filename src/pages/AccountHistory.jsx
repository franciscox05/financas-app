import { t } from '../i18n'
import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, ErrorNotice, ListSkeleton, Pager } from '../components/Feedback'
import Money from '../components/Money'
import { listAccounts, listNetWorthSnapshots, listTransactionsPage, listTransfers } from '../lib/db'
import { eur, ptDate } from '../lib/format'
import Card from '../components/Card'

const PAGE_SIZE = 20

// Histórico de uma conta (só leitura): transações paginadas e, nas contas de
// investimento, as atualizações de saldo registadas.
export default function AccountHistory() {
  const { accountId } = useParams()
  const [account, setAccount] = useState(null)
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
    Promise.all([listAccounts(), listNetWorthSnapshots(), listTransfers()])
      .then(([accounts, snaps, trs]) => {
        if (cancelled) return
        setAccount(accounts.find((a) => a.id === accountId) ?? null)
        setSnapshots(snaps.filter((s) => s.account_id === accountId))
        setTransfers(trs.filter((t) => t.from_account_id === accountId || t.to_account_id === accountId))
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
          aria-label={t('ah.back')}
          className="-ml-2 flex size-10 items-center justify-center rounded-control text-label-2 active:scale-95"
        >
          <ChevronLeft size={22} />
        </Link>
        <h2 className="min-w-0 truncate text-lg font-semibold tracking-tight text-label">
          {account?.name ?? t('common.account')}
        </h2>
      </div>

      {error && <ErrorNotice message={error} />}

      {snapshots.length > 0 && (
        <Card as="section" className="space-y-1">
          <h3 className="text-sm font-semibold text-label-2">{t('ah.snapshots')}</h3>
          <ul className="divide-y divide-separator">
            {snapshots.slice((snapPage - 1) * PAGE_SIZE, snapPage * PAGE_SIZE).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-label-2">{ptDate(s.snapshot_date)}</span>
                <span className="font-semibold text-label">
                  <Money value={Number(s.value)} />
                </span>
              </li>
            ))}
          </ul>
          <Pager page={snapPage} totalPages={Math.ceil(snapshots.length / PAGE_SIZE)} onChange={setSnapPage} />
        </Card>
      )}

      {transfers.length > 0 && (
        <Card as="section" className="space-y-1">
          <h3 className="text-sm font-semibold text-label-2">{t('ah.transfers')}</h3>
          <ul className="divide-y divide-separator">
            {transfers.slice((transferPage - 1) * PAGE_SIZE, transferPage * PAGE_SIZE).map((tr) => {
              const isOutgoing = tr.from_account_id === accountId
              return (
                <li key={tr.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="min-w-0 truncate text-label-2">
                    {ptDate(tr.occurred_on)} ·{' '}
                    {isOutgoing ? t('ah.to', { name: tr.to_account?.name ?? t('ah.accountLower') }) : t('ah.from', { name: tr.from_account?.name ?? t('ah.accountLower') })}
                  </span>
                  <span className={`shrink-0 font-semibold ${isOutgoing ? 'text-negative' : 'text-positive'}`}>
                    <Money>{`${isOutgoing ? '-' : '+'}${eur(tr.amount)}`}</Money>
                  </span>
                </li>
              )
            })}
          </ul>
          <Pager page={transferPage} totalPages={Math.ceil(transfers.length / PAGE_SIZE)} onChange={setTransferPage} />
        </Card>
      )}

      <Card as="section" className="space-y-1">
        <h3 className="text-sm font-semibold text-label-2">
          Transações{totalCount ? ` (${totalCount})` : ''}
        </h3>
        {loading ? (
          <ListSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState title={t('ah.empty')} description={t('ah.emptyBody')} />
        ) : (
          <>
            <ul className="divide-y divide-separator">
              {rows.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-label">
                      {tx.note || tx.categories?.name || t('common.noNote')}
                    </p>
                    <p className="truncate text-xs text-label-2">
                      {ptDate(tx.occurred_on)}
                      {tx.note && ` · ${tx.categories?.name ?? t('common.noCategory')}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold ${
                      tx.type === 'income' ? 'text-positive' : 'text-negative'
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
      </Card>
    </div>
  )
}
