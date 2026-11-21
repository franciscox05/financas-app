import { t } from '../i18n'
import { ArrowRightLeft, Link2, Receipt, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../context/toastContext'
import { createTransaction, createTransfer, deleteTransaction, deleteTransfer, getCurrentUserId, updateTransaction } from '../lib/db'
import { deleteEntry, getLedgerEntry } from '../lib/friendsDb'
import { blocksTransactionEdit, transactionLinkedMessage } from '../lib/linkedLogic'
import { currencySymbol, eur } from '../lib/format'
import ConfirmDialog from './ConfirmDialog'
import LedgerEntryRow from './LedgerEntryRow'
import Modal from './Modal'
import { buttonBase, focusRing, inputClass } from './ui/styles'

// Os botões deste modal dividem a linha a meio (flex-1) por cima do estilo comum.
const primaryButton = `${buttonBase} flex-1 bg-accent-fill text-white`
const secondaryButton = `${buttonBase} flex-1 bg-fill text-label`
const dangerButton = `${buttonBase} flex-1 bg-negative/12 text-negative`

const TYPE_ICON = { transaction: Receipt, transfer: ArrowRightLeft, ledger: Link2 }

// Cabeçalho uniforme dos 3 tipos: ícone, título, "x" para fechar.
function ModalHeader({ titleId, icon: Icon, children, onClose }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <h2 id={titleId} className="flex min-w-0 items-center gap-2 pt-1.5 text-[1.25rem] leading-tight font-bold tracking-tight text-label">
        <Icon size={20} className="shrink-0 text-label-2" aria-hidden="true" />
        {children}
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('common.close')}
        className={`pressable -mt-1.5 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full bg-fill text-label-2 ${focusRing}`}
      >
        <X size={20} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  )
}

// Detalhe de uma linha de Registo, num só sítio para os 3 tipos de movimento —
// em vez de edição em linha (inconsistente: nem todas as linhas tinham lápis/
// lixo, o que confundia). `tx` null fecha o modal.
export default function TransactionDetailModal({
  tx,
  categories,
  accounts,
  linkedEntry,
  onClose,
  onUpdated,
  onDeleted,
  onRestored,
  onRowChanged,
}) {
  const titleId = useId()

  return (
    <Modal open={tx !== null} onClose={onClose} labelledBy={titleId}>
      {tx?.source === 'transaction' && (
        <TransactionBody
          tx={tx}
          categories={categories}
          accounts={accounts}
          linkedEntry={linkedEntry}
          titleId={titleId}
          onClose={onClose}
          onUpdated={onUpdated}
          onDeleted={onDeleted}
          onRestored={onRestored}
        />
      )}
      {tx?.source === 'transfer' && (
        <TransferBody tx={tx} titleId={titleId} onClose={onClose} onDeleted={onDeleted} onRestored={onRestored} />
      )}
      {tx?.source === 'ledger' && (
        <LedgerBody tx={tx} titleId={titleId} onClose={onClose} onRowChanged={onRowChanged} />
      )}
    </Modal>
  )
}

function TransactionBody({ tx, categories, accounts, linkedEntry, titleId, onClose, onUpdated, onDeleted, onRestored }) {
  const toast = useToast()
  const [amount, setAmount] = useState(tx.amount)
  const [categoryId, setCategoryId] = useState(tx.category_id)
  const [accountId, setAccountId] = useState(tx.account_id)
  const [note, setNote] = useState(tx.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const categoriesForType = categories.filter((c) => c.type === tx.type)
  const blocked = linkedEntry && blocksTransactionEdit(linkedEntry)

  async function handleSave(e) {
    e.preventDefault()
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError(t('tx.err.amount'))
      return
    }
    if (!categoryId || !accountId) {
      setError(t('tx.err.accountCategory'))
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
      toast.success(t('tx.updated'))
      onClose()
    } catch (err) {
      toast.error(t('common.saveFailed', { msg: err.message }))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setConfirmingDelete(false)
    setBusy(true)
    setError('')
    try {
      await deleteTransaction(tx.id)
      onDeleted(tx.id)
      onClose()
      toast.success(t('tx.deleted'), {
        action: {
          label: t('common.undo'),
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
              toast.success(t('tx.restored'))
            } catch (err) {
              toast.error(t('common.undoFailed', { msg: err.message }))
            }
          },
        },
      })
    } catch (err) {
      toast.error(t('common.deleteFailed', { msg: err.message }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <ModalHeader titleId={titleId} icon={TYPE_ICON.transaction} onClose={onClose}>
        {t('tx.edit')}
      </ModalHeader>

      {linkedEntry && (
        <p className="rounded-control bg-warning/10 p-2 text-xs text-warning">
          {t('tx.linkedPre')}{' '}
          <Link to={`/dividas/${linkedEntry.friend_id}`} className="underline underline-offset-2" onClick={onClose}>
            {linkedEntry.friendName}
          </Link>
          {t('tx.linkedPost')}
        </p>
      )}

      <div>
        <label htmlFor="modal-amount" className="mb-1 block text-xs font-medium text-label-2">
          Valor ({currencySymbol()})
        </label>
        <input
          id="modal-amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="modal-category" className="mb-1 block text-xs font-medium text-label-2">
            {t('common.category')}
          </label>
          <select id="modal-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
            {categoriesForType.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="modal-account" className="mb-1 block text-xs font-medium text-label-2">
            {t('common.account')}
          </label>
          <select id="modal-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="modal-note" className="mb-1 block text-xs font-medium text-label-2">
          {t('common.note')}
        </label>
        <input id="modal-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? t('common.saving') : t('common.save')}
        </button>
        <button type="button" onClick={onClose} disabled={busy} className={secondaryButton}>
          {t('common.close')}
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          if (blocked) {
            toast.error(transactionLinkedMessage(linkedEntry))
            return
          }
          setConfirmingDelete(true)
        }}
        disabled={busy}
        className={`${dangerButton} w-full`}
      >
        {t('tx.delete')}
      </button>

      <ConfirmDialog
        open={confirmingDelete}
        title={t('tx.deleteQ')}
        message={t('tx.deleteMsg', { what: tx.note || tx.category_name || t('tx.thisOne'), value: eur(tx.amount) })}
        confirmLabel={t('common.delete')}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
      />
    </form>
  )
}

function TransferBody({ tx, titleId, onClose, onDeleted, onRestored }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  async function handleDelete() {
    setConfirmingDelete(false)
    setBusy(true)
    try {
      await deleteTransfer(tx.id)
      onDeleted(tx.id)
      onClose()
      toast.success(t('tr.deleted'), {
        action: {
          label: t('common.undo'),
          onClick: async () => {
            try {
              await createTransfer({
                fromAccountId: tx.account_id,
                toAccountId: tx.counter_account_id,
                amount: Number(tx.amount),
                occurredOn: tx.occurred_on,
                note: tx.note,
                categoryId: tx.category_id,
                countsAsExpense: tx.counts_as_expense,
              })
              onRestored()
              toast.success(t('tr.restored'))
            } catch (err) {
              toast.error(t('common.undoFailed', { msg: err.message }))
            }
          },
        },
      })
    } catch (err) {
      toast.error(t('common.deleteFailed', { msg: err.message }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <ModalHeader titleId={titleId} icon={TYPE_ICON.transfer} onClose={onClose}>
        {tx.note || tx.category_name || t('kind.transfer')}
      </ModalHeader>
      <div className="rounded-control bg-fill p-3">
        <p className="text-sm text-label-2">
          {tx.account_name ?? t('common.account')} → {tx.counter_account_name ?? t('common.account')}
        </p>
        <p className={`mt-1 text-xl font-semibold ${tx.counts_as_expense ? 'text-negative' : 'text-accent'}`}>
          {eur(tx.amount)}
        </p>
        {tx.counts_as_expense && (
          <p className="mt-1 text-xs text-label-2">
            {tx.category_name ?? t('common.noCategory')} · {t('tr.countsAsExpense')}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setConfirmingDelete(true)} disabled={busy} className={dangerButton}>
          {t('common.delete')}
        </button>
        <button type="button" onClick={onClose} disabled={busy} className={secondaryButton}>
          {t('common.close')}
        </button>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title={t('tr.deleteQ')}
        message={t('tr.undoHint')}
        confirmLabel={t('common.delete')}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
      />
    </div>
  )
}

// Reaproveita o LedgerEntryRow/PendingEntryActions já usados na página do amigo —
// mesmas ações (aceitar/contestar/cancelar/apagar), mesmas regras, sem duplicar nada.
function LedgerBody({ tx, titleId, onClose, onRowChanged }) {
  const toast = useToast()
  const [data, setData] = useState(null) // {entry, friend}
  const [viewerId, setViewerId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  async function load() {
    setError('')
    try {
      const [fresh, me] = await Promise.all([getLedgerEntry(tx.id), getCurrentUserId()])
      setData(fresh)
      setViewerId(me)
    } catch (err) {
      setError(err.message || t('mv.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.id])

  async function handleDelete() {
    const entry = deleteTarget
    setDeleteTarget(null)
    try {
      await deleteEntry(entry)
      toast.success(t('mv.deleted'))
      onRowChanged?.()
      onClose()
    } catch (err) {
      toast.error(err.message || t('common.deleteRetry'))
    }
  }

  return (
    <div className="space-y-3">
      <ModalHeader titleId={titleId} icon={TYPE_ICON.ledger} onClose={onClose}>
        {t('mv.with', { name: tx.friend_name })}
      </ModalHeader>

      {loading && <p className="text-sm text-label-2">{t('common.loadingDots')}</p>}
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      {data && (
        <ul>
          <LedgerEntryRow
            entry={data.entry}
            friend={data.friend}
            viewerId={viewerId}
            onDelete={setDeleteTarget}
            onChanged={async () => {
              await load()
              onRowChanged?.()
            }}
          />
        </ul>
      )}

      <div className="flex gap-2">
        <Link to={`/dividas/${tx.friend_id}`} onClick={onClose} className={secondaryButton}>
          <span className="flex items-center justify-center">{t('mv.seeFriend')}</span>
        </Link>
        <button type="button" onClick={onClose} className={secondaryButton}>
          {t('common.close')}
        </button>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('mv.deleteQ')}
        message={t('mv.deleteMsg')}
        confirmLabel={t('mv.delete')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
