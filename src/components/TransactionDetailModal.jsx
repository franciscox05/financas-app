import { ArrowRightLeft, Link2, Receipt, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../context/toastContext'
import { createTransaction, createTransfer, deleteTransaction, deleteTransfer, getCurrentUserId, updateTransaction } from '../lib/db'
import { deleteEntry, getLedgerEntry } from '../lib/friendsDb'
import { blocksTransactionEdit, transactionLinkedMessage } from '../lib/linkedLogic'
import { eur } from '../lib/format'
import ConfirmDialog from './ConfirmDialog'
import LedgerEntryRow from './LedgerEntryRow'
import Modal from './Modal'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'
const inputClass =
  'min-h-11 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-colors duration-150 ease-out dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100'
const primaryButton = `min-h-11 flex-1 rounded-lg bg-neutral-900 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 ${focusRing}`
const secondaryButton = `min-h-11 flex-1 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-900 dark:border-neutral-700 dark:text-neutral-100 ${focusRing}`
const dangerButton = `min-h-11 flex-1 rounded-lg bg-red-600 text-sm font-medium text-white disabled:opacity-50 ${focusRing}`

const TYPE_ICON = { transaction: Receipt, transfer: ArrowRightLeft, ledger: Link2 }

// Cabeçalho uniforme dos 3 tipos: ícone, título, "x" para fechar.
function ModalHeader({ titleId, icon: Icon, children, onClose }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <h2 id={titleId} className="flex items-center gap-2 text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
        <Icon size={17} className="shrink-0 text-neutral-400" aria-hidden="true" />
        {children}
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100 ${focusRing}`}
      >
        <X size={18} aria-hidden="true" />
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
      toast.success('Transação atualizada.')
      onClose()
    } catch (err) {
      toast.error(`Não foi possível guardar: ${err.message}`)
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
      toast.error(`Não foi possível apagar: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <ModalHeader titleId={titleId} icon={TYPE_ICON.transaction} onClose={onClose}>
        Editar transação
      </ModalHeader>

      {linkedEntry && (
        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Ligado a um movimento com{' '}
          <Link to={`/dividas/${linkedEntry.friend_id}`} className="underline underline-offset-2" onClick={onClose}>
            {linkedEntry.friendName}
          </Link>
          . Mudar o valor aqui não atualiza esse movimento.
        </p>
      )}

      <div>
        <label htmlFor="modal-amount" className="mb-1 block text-xs font-medium text-neutral-500">
          Valor (€)
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
          <label htmlFor="modal-category" className="mb-1 block text-xs font-medium text-neutral-500">
            Categoria
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
          <label htmlFor="modal-account" className="mb-1 block text-xs font-medium text-neutral-500">
            Conta
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
        <label htmlFor="modal-note" className="mb-1 block text-xs font-medium text-neutral-500">
          Nota
        </label>
        <input id="modal-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? 'A guardar...' : 'Guardar'}
        </button>
        <button type="button" onClick={onClose} disabled={busy} className={secondaryButton}>
          Fechar
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
        Apagar transação
      </button>

      <ConfirmDialog
        open={confirmingDelete}
        title="Apagar transação?"
        message={`${tx.note || tx.category_name || 'Esta transação'} · ${eur(tx.amount)}. Podes desfazer logo a seguir, enquanto o aviso estiver visível.`}
        confirmLabel="Apagar"
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
                categoryId: tx.category_id,
                countsAsExpense: tx.counts_as_expense,
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
      toast.error(`Não foi possível apagar: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <ModalHeader titleId={titleId} icon={TYPE_ICON.transfer} onClose={onClose}>
        {tx.note || tx.category_name || 'Transferência'}
      </ModalHeader>
      <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/60">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {tx.account_name ?? 'Conta'} → {tx.counter_account_name ?? 'Conta'}
        </p>
        <p className={`mt-1 text-xl font-semibold ${tx.counts_as_expense ? 'text-red-600' : 'text-blue-500'}`}>
          {eur(tx.amount)}
        </p>
        {tx.counts_as_expense && (
          <p className="mt-1 text-xs text-neutral-500">
            {tx.category_name ?? 'Sem categoria'} · conta como gasto do mês
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setConfirmingDelete(true)} disabled={busy} className={dangerButton}>
          Apagar
        </button>
        <button type="button" onClick={onClose} disabled={busy} className={secondaryButton}>
          Fechar
        </button>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Apagar transferência?"
        message="Podes desfazer logo a seguir, enquanto o aviso estiver visível."
        confirmLabel="Apagar"
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
      setError(err.message || 'Não foi possível carregar este movimento.')
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
      toast.success('Movimento apagado.')
      onRowChanged?.()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Não foi possível apagar. Tenta outra vez.')
    }
  }

  return (
    <div className="space-y-3">
      <ModalHeader titleId={titleId} icon={TYPE_ICON.ledger} onClose={onClose}>
        Movimento com {tx.friend_name}
      </ModalHeader>

      {loading && <p className="text-sm text-neutral-500">A carregar...</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
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
          <span className="flex items-center justify-center">Ver amigo</span>
        </Link>
        <button type="button" onClick={onClose} className={secondaryButton}>
          Fechar
        </button>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Apagar movimento?"
        message="Este movimento deixa de contar no saldo."
        confirmLabel="Apagar movimento"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
