import { useState } from 'react'
import { deleteTransaction, updateTransaction } from '../lib/db'

function formatAmount(amount, type) {
  const sign = type === 'income' ? '+' : '-'
  return `${sign}${Number(amount).toFixed(2)} €`
}

function formatDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
  })
}

function TransactionRow({ tx, categories, accounts, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [amount, setAmount] = useState(tx.amount)
  const [categoryId, setCategoryId] = useState(tx.category_id)
  const [accountId, setAccountId] = useState(tx.account_id)
  const [note, setNote] = useState(tx.note ?? '')
  const [busy, setBusy] = useState(false)

  const categoriesForType = categories.filter((c) => c.type === tx.type)

  async function handleDelete() {
    setBusy(true)
    try {
      await deleteTransaction(tx.id)
      onChanged()
    } finally {
      setBusy(false)
      setConfirmingDelete(false)
    }
  }

  async function handleSave() {
    setBusy(true)
    try {
      await updateTransaction(tx.id, {
        amount: Number(amount),
        category_id: categoryId,
        account_id: accountId,
        note: note || null,
      })
      setEditing(false)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <li className="space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
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
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex-1 rounded-lg bg-neutral-900 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            Guardar
          </button>
          <button
            onClick={() => setEditing(false)}
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
          {tx.categories?.name ?? 'Sem categoria'}
          {tx.note ? <span className="text-neutral-400"> · {tx.note}</span> : null}
        </p>
        <p className="text-xs text-neutral-500">
          {formatDate(tx.occurred_on)} · {tx.accounts?.name ?? 'Sem conta'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`text-sm font-semibold ${
            tx.type === 'income' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {formatAmount(tx.amount, tx.type)}
        </span>
        <button
          onClick={() => setEditing(true)}
          aria-label="Editar"
          className="rounded p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          ✎
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
            ✕
          </button>
        )}
      </div>
    </li>
  )
}

export default function TransactionList({ transactions, categories, accounts, onChanged }) {
  if (transactions.length === 0) {
    return <p className="py-6 text-center text-sm text-neutral-500">Ainda sem transações.</p>
  }

  return (
    <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
      {transactions.map((tx) => (
        <TransactionRow
          key={tx.id}
          tx={tx}
          categories={categories}
          accounts={accounts}
          onChanged={onChanged}
        />
      ))}
    </ul>
  )
}
