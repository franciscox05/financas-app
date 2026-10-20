import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../context/toastContext'
import { today } from '../lib/dates'
import { listAccounts, listCategories } from '../lib/db'
import { parseExpenseAmount } from '../lib/expenseInput'
import { createRepayment } from '../lib/friendsDb'
import { suggestedRepayment } from '../lib/ledgerMath'
import { defaultCategoryId, overshootNote } from '../lib/repaymentInput'

const inputClass =
  'min-h-11 w-full rounded-lg border border-neutral-300 px-3 py-2 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 motion-reduce:transition-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus-visible:outline-neutral-100'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'

const labelClass = 'mb-1 block text-xs font-medium text-neutral-500'

const OPTIONS = [
  { value: 'bank', title: 'MB Way / banco', hint: 'Escolhe a conta onde entrou ou saiu' },
  { value: 'cash', title: 'Dinheiro na mão', hint: 'Não mexe em nenhuma conta' },
  { value: 'offset', title: 'Descontado noutra coisa', hint: 'Abate noutra coisa que fizeste por ele' },
]

export default function RepaymentSheet({ friend, balance, onDone, onCancel }) {
  const toast = useToast()
  const suggestion = suggestedRepayment(balance)
  const kind = suggestion?.kind
  const [amount, setAmount] = useState(suggestion ? String(suggestion.amount).replace('.', ',') : '')
  const [settlement, setSettlement] = useState('bank')
  const [note, setNote] = useState('')
  const [occurredOn, setOccurredOn] = useState(today())
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [loadingLists, setLoadingLists] = useState(true)
  const [listsFailed, setListsFailed] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([listAccounts(), listCategories()])
      .then(([accs, cats]) => {
        if (cancelled) return
        setAccounts(accs)
        setCategories(cats)
        setAccountId(accs[0]?.id ?? '')
        setCategoryId(kind ? defaultCategoryId(cats, kind) : '')
      })
      .catch(() => {
        if (!cancelled) setListsFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoadingLists(false)
      })
    return () => {
      cancelled = true
    }
  }, [kind])

  const type = kind === 'repaid_to_me' ? 'income' : 'expense'
  const categoryOptions = useMemo(() => categories.filter((c) => c.type === type), [categories, type])

  if (!suggestion) return null

  const parsed = parseExpenseAmount(amount)
  const overshoot = parsed === null ? null : overshootNote(kind, balance, parsed)

  let bankProblem = ''
  if (!loadingLists) {
    if (listsFailed) bankProblem = 'Não foi possível carregar as contas. Tenta outra vez.'
    else if (accounts.length === 0) bankProblem = 'Ainda não tens nenhuma conta. Cria uma primeiro ou escolhe outra forma.'
    else if (categoryOptions.length === 0) {
      bankProblem = `Não tens nenhuma categoria de ${type === 'income' ? 'ganhos' : 'gastos'}. Cria uma primeiro ou escolhe outra forma.`
    }
  }
  const bankBlocked = settlement === 'bank' && (loadingLists || bankProblem !== '')

  async function handleSubmit(e) {
    e.preventDefault()
    if (parsed === null) {
      setError('Indica um valor válido.')
      return
    }
    if (bankBlocked) {
      setError(bankProblem || 'A carregar as contas...')
      return
    }
    setSaving(true)
    setError('')
    try {
      await createRepayment({
        friendId: friend.id,
        kind,
        amount: parsed,
        note: note.trim(),
        occurredOn: occurredOn || today(),
        settlement,
        accountId: settlement === 'bank' ? accountId : null,
        categoryId: settlement === 'bank' ? categoryId : null,
      })
      toast.success('Devolução guardada.')
      onDone()
    } catch (err) {
      setError(
        err.message === 'Escolhe a conta e a categoria.' ? err.message : 'Não foi possível guardar. Tenta outra vez.',
      )
      setSaving(false)
    }
  }

  const title = kind === 'repaid_to_me' ? `${friend.name} devolveu-me` : `Devolvi a ${friend.name}`

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={title}
      className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h3 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">{title}</h3>

      <div>
        <label htmlFor="repayment-amount" className={labelClass}>
          Valor (€)
        </label>
        <input
          id="repayment-amount"
          type="text"
          inputMode="decimal"
          placeholder="Ex: 11,50"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-describedby={overshoot ? 'repayment-overshoot' : undefined}
          className={inputClass}
        />
        {overshoot && (
          <p id="repayment-overshoot" className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">
            {overshoot}
          </p>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className={labelClass}>Como foi pago?</legend>
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border border-neutral-300 px-3 py-2.5 transition-colors duration-150 ease-out has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-100 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-neutral-900 motion-reduce:transition-none dark:border-neutral-700 dark:has-[:checked]:border-neutral-100 dark:has-[:checked]:bg-neutral-800 dark:has-[:focus-visible]:outline-neutral-100"
          >
            <input
              type="radio"
              name="repayment-settlement"
              value={opt.value}
              checked={settlement === opt.value}
              onChange={() => setSettlement(opt.value)}
              className="mt-1 size-4 accent-neutral-900 dark:accent-neutral-100"
            />
            <span>
              <span className="block font-medium text-neutral-900 dark:text-neutral-100">{opt.title}</span>
              <span className="block text-sm text-neutral-500 dark:text-neutral-400">{opt.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {settlement === 'bank' && bankProblem && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {bankProblem}
        </p>
      )}

      {settlement === 'bank' && !loadingLists && !bankProblem && (
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor="repayment-account" className={labelClass}>
              Conta
            </label>
            <select
              id="repayment-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={inputClass}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="repayment-category" className={labelClass}>
              Categoria
            </label>
            <select
              id="repayment-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputClass}
            >
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="repayment-note" className={labelClass}>
          Nota (opcional)
        </label>
        <input
          id="repayment-note"
          type="text"
          autoComplete="off"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="repayment-date" className={labelClass}>
          Data
        </label>
        <input
          id="repayment-date"
          type="date"
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value)}
          className={inputClass}
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
          className={`min-h-11 flex-1 rounded-lg border border-neutral-300 font-medium text-neutral-700 transition duration-150 ease-out hover:bg-neutral-100 active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800 ${focusRing}`}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || bankBlocked}
          className={`min-h-11 flex-1 rounded-lg bg-neutral-900 font-medium text-white transition duration-150 ease-out hover:bg-neutral-700 active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 ${focusRing}`}
        >
          {saving ? 'A guardar...' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
