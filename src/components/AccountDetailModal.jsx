import { ArrowRightLeft, RefreshCcw, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useT } from '../i18n'
import { eur, eurSigned, ptDate } from '../lib/format'
import { useAccountStatement } from '../lib/useAccountStatement'
import { EmptyState, ErrorNotice, ListSkeleton, Pager } from './Feedback'
import Modal from './Modal'
import Money from './Money'
import { focusRing } from './ui/styles'

// Linhas por página do extrato (paginado no cliente: o extrato precisa de todos
// os movimentos da conta para saber o saldo em cada um).
const PAGE_SIZE = 20

// Detalhe de uma conta em modal, por cima do Património. Mostra o extrato como
// nos bancos: transações, transferências e acertos de saldo numa só lista, do
// mais recente para o mais antigo, cada um com o saldo da conta antes dele
// (cálculo em `accountStatement`, com a mesma regra de `balanceAt()`).
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

function lineTitle(line, account, t) {
  if (line.kind === 'snapshot') return t('stmt.snapshot')
  const item = line.item
  if (line.kind === 'transfer') {
    if (item.note) return item.note
    const outgoing = item.from_account_id === account.id
    return outgoing
      ? t('stmt.transferTo', { name: item.to_account?.name ?? t('stmt.account') })
      : t('stmt.transferFrom', { name: item.from_account?.name ?? t('stmt.account') })
  }
  return item.note || item.categories?.name || t('stmt.noNote')
}

function lineSubtitle(line, t) {
  const parts = [ptDate(line.date)]
  if (line.kind === 'transaction' && line.item.note && line.item.categories?.name) parts.push(line.item.categories.name)
  if (line.kind === 'transfer' && line.item.categories?.name) parts.push(line.item.categories.name)
  if (line.future) parts.push(t('stmt.scheduled'))
  return parts.join(' · ')
}

function StatementRow({ line, account, t }) {
  const isSnapshot = line.kind === 'snapshot'
  const tone = isSnapshot ? 'text-label' : line.delta >= 0 ? 'text-positive' : 'text-negative'
  return (
    <li className={`flex items-start justify-between gap-3 py-2.5 ${line.future ? 'opacity-60' : ''}`}>
      <div className="flex min-w-0 items-start gap-2">
        {isSnapshot && <RefreshCcw size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />}
        {line.kind === 'transfer' && <ArrowRightLeft size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-label">{lineTitle(line, account, t)}</p>
          <p className="truncate text-xs text-label-2">
            {lineSubtitle(line, t)}
            {isSnapshot && (
              <>
                {' · '}
                <Money>{t('stmt.snapshotDiff', { value: eurSigned(line.delta) })}</Money>
              </>
            )}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className={`amount text-sm font-semibold ${tone}`}>
          {isSnapshot ? <Money value={line.balanceAfter} /> : <Money>{eurSigned(line.delta)}</Money>}
        </p>
        <p className="amount text-xs text-label-3">
          <Money>{t('stmt.before', { value: eur(line.balanceBefore) })}</Money>
        </p>
      </div>
    </li>
  )
}

// Só monta quando há conta escolhida — o extrato pode assumir `account.id`.
function AccountDetailBody({ account, balance, titleId, onClose }) {
  const t = useT()
  const { lines, error } = useAccountStatement(account.id)
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil((lines?.length ?? 0) / PAGE_SIZE))
  const pageLines = lines?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="truncate pt-1 text-[0.9375rem] font-semibold text-label-2">
            {account.name}
          </h2>
          <p className="amount display mt-0.5 text-[2.125rem] leading-tight font-bold tracking-tight text-label">
            <Money value={balance} />
          </p>
          <p className="text-xs text-label-3">{t('stmt.currentBalance')}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('stmt.close')}
          className={`pressable -mt-1.5 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full bg-fill text-label-2 ${focusRing}`}
        >
          <X size={20} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>

      {error && <ErrorNotice message={error} />}

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-label-3">
          {t('stmt.title')}
          {lines?.length ? ` (${lines.length})` : ''}
        </h3>
        {lines === null && !error ? (
          <ListSkeleton />
        ) : lines && lines.length === 0 ? (
          <EmptyState title={t('stmt.empty.title')} description={t('stmt.empty.body')} />
        ) : (
          <>
            <ul className="divide-y divide-separator">
              {pageLines.map((line) => (
                <StatementRow key={`${line.kind}:${line.item.id}`} line={line} account={account} t={t} />
              ))}
            </ul>
            <Pager page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
