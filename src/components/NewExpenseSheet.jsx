import { useState } from 'react'
import { useToast } from '../context/toastContext'
import { today } from '../lib/dates'
import { parseExpenseAmount } from '../lib/expenseInput'
import { createExpense } from '../lib/friendsDb'
import { createSharedEntry } from '../lib/linkedDb'
import { isSharedGuardError } from '../lib/linkedLogic'
import { notifyPendingChanged } from '../lib/pendingEvents'
import OptionalDateField from './OptionalDateField'

const inputClass =
  'min-h-11 w-full rounded-lg border border-neutral-300 px-3 py-2 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 motion-reduce:transition-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus-visible:outline-neutral-100'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'

const labelClass = 'mb-1 block text-xs font-medium text-neutral-500'

const OPTIONS = [
  { kind: 'paid_for_them', title: 'Paguei por ele', hint: 'Ele fica a dever-me (ex.: bilhete, almoço)' },
  { kind: 'paid_for_me', title: 'Ele pagou por mim', hint: 'Fico a dever-lhe (ex.: creatina)' },
]

// `prefill` (opcional) repete os valores de um movimento contestado.
export default function NewExpenseSheet({ friend, prefill, onDone, onCancel, onStale }) {
  const toast = useToast()
  const [kind, setKind] = useState(prefill?.kind ?? 'paid_for_them')
  const [amount, setAmount] = useState(prefill ? String(prefill.amount).replace('.', ',') : '')
  const [note, setNote] = useState(prefill?.note ?? '')
  const [occurredOn, setOccurredOn] = useState(prefill?.occurredOn || today())
  const [dueOn, setDueOn] = useState(prefill?.dueOn ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    const value = parseExpenseAmount(amount)
    if (value === null) {
      setError('Indica um valor válido.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const fields = {
        friendId: friend.id,
        kind,
        amount: value,
        note: note.trim(),
        occurredOn: occurredOn || today(),
        dueOn,
      }
      if (friend.status === 'connected') {
        await createSharedEntry(fields)
        notifyPendingChanged()
        toast.success(`Enviado a ${friend.name} para confirmar.`)
      } else {
        await createExpense(fields)
        toast.success('Gasto guardado.')
      }
      onDone()
    } catch (err) {
      if (isSharedGuardError(err)) onStale?.()
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={`Novo gasto com ${friend.name}`}
      className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div>
        <h3 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Novo gasto com {friend.name}
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Só fica registado aqui no conta-corrente — não mexe em nenhuma das tuas contas nem aparece no
          Registo. Se o dinheiro passou mesmo por uma conta tua agora, usa antes o Registo rápido e marca "
          {friend.name}" lá.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="sr-only">Quem pagou</legend>
        {OPTIONS.map((opt) => (
          <label
            key={opt.kind}
            className="flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border border-neutral-300 px-3 py-2.5 transition-colors duration-150 ease-out has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-100 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-neutral-900 motion-reduce:transition-none dark:border-neutral-700 dark:has-[:checked]:border-neutral-100 dark:has-[:checked]:bg-neutral-800 dark:has-[:focus-visible]:outline-neutral-100"
          >
            <input
              type="radio"
              name="expense-kind"
              value={opt.kind}
              checked={kind === opt.kind}
              onChange={() => setKind(opt.kind)}
              className="mt-1 size-4 accent-neutral-900 dark:accent-neutral-100"
            />
            <span>
              <span className="block font-medium text-neutral-900 dark:text-neutral-100">{opt.title}</span>
              <span className="block text-sm text-neutral-500 dark:text-neutral-400">{opt.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div>
        <label htmlFor="expense-amount" className={labelClass}>
          Valor (€)
        </label>
        <input
          id="expense-amount"
          type="text"
          inputMode="decimal"
          placeholder="Ex: 11,50"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="expense-note" className={labelClass}>
          Para quê? (opcional)
        </label>
        <input
          id="expense-note"
          type="text"
          placeholder="Ex: Bilhete do cinema"
          autoComplete="off"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="space-y-4">
        <div className="min-w-0">
          <label htmlFor="expense-date" className={labelClass}>
            Data
          </label>
          <input
            id="expense-date"
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className={inputClass}
          />
        </div>
        <OptionalDateField
          id="expense-due"
          label="Para quando? (opcional)"
          addLabel="Definir prazo"
          value={dueOn}
          onChange={setDueOn}
          inputClass={inputClass}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={`min-h-11 flex-1 rounded-lg border border-neutral-300 px-3 font-medium text-neutral-700 transition duration-150 ease-out hover:bg-neutral-100 active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800 ${focusRing}`}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className={`min-h-11 flex-[2] rounded-lg bg-neutral-900 px-3 font-medium text-white transition duration-150 ease-out hover:bg-neutral-700 active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 ${focusRing}`}
        >
          {saving ? 'A guardar...' : friend.status === 'connected' ? 'Enviar para confirmar' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
