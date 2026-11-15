import { useEffect, useState } from 'react'
import { useToast } from '../context/toastContext'
import { today } from '../lib/dates'
import { createTransaction, deleteTransaction, listAccounts, listCategories } from '../lib/db'
import { parseExpenseAmount } from '../lib/expenseInput'
import { createExpense } from '../lib/friendsDb'
import { createSharedEntry, retireDeclinedEntry } from '../lib/linkedDb'
import { isSharedGuardError } from '../lib/linkedLogic'
import { notifyPendingChanged } from '../lib/pendingEvents'
import OptionalDateField from './OptionalDateField'
import { focusRing, inputClass, labelClass } from './ui/styles'

const OPTIONS = [
  { kind: 'paid_for_them', title: 'Paguei eu', hint: 'Fica a dever-me (ex.: bilhete, almoço)' },
  { kind: 'paid_for_me', title: 'Pagou por mim', hint: 'Fico a dever-lhe (ex.: creatina)' },
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

  // "Paguei por ele" sempre saiu de uma conta tua (banco ou "Dinheiro"), por isso exige
  // sempre conta+categoria, tal como o Registo rápido — "ele pagou por mim" não tem
  // conta nenhuma envolvida do teu lado, por isso nunca mostra estes campos.
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [loadingLists, setLoadingLists] = useState(true)
  const [listsFailed, setListsFailed] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([listAccounts(), listCategories()])
      .then(([accs, cats]) => {
        if (cancelled) return
        setAccounts(accs)
        setCategories(cats.filter((c) => c.type === 'expense'))
        setAccountId((prev) => prev || (accs[0]?.id ?? ''))
        setCategoryId((prev) => prev || cats.find((c) => c.type === 'expense')?.id || '')
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
  }, [])

  const wantsAccount = kind === 'paid_for_them'
  const accountBlocked = wantsAccount && (loadingLists || listsFailed || accounts.length === 0 || categories.length === 0)

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    const value = parseExpenseAmount(amount)
    if (value === null) {
      setError('Indica um valor válido.')
      return
    }
    if (wantsAccount && (accountBlocked || !accountId || !categoryId)) {
      setError(listsFailed ? 'Não foi possível carregar as contas. Tenta outra vez.' : 'Escolhe a conta e a categoria.')
      return
    }
    setSaving(true)
    setError('')

    let transactionId = null
    try {
      if (wantsAccount) {
        const created = await createTransaction({
          amount: value,
          type: 'expense',
          accountId,
          categoryId,
          occurredOn: occurredOn || today(),
          note: note.trim() || `Conta-corrente: ${friend.name}`,
        })
        transactionId = created.id
      }

      const fields = {
        friendId: friend.id,
        kind,
        amount: value,
        note: note.trim(),
        occurredOn: occurredOn || today(),
        dueOn,
        transactionId,
      }
      if (friend.status === 'connected') {
        await createSharedEntry(fields)
        notifyPendingChanged()
        if (prefill?.id) {
          // O antigo (contestado) deixa de contar — senão o corrigido contava a dobrar.
          await retireDeclinedEntry(prefill.id).catch((err) => {
            toast.error(
              `Corrigido e reenviado, mas o movimento antigo continua a contar: ${err.message} — cancela-o à mão na lista.`,
            )
          })
        }
        toast.success(`Já conta do teu lado. Enviado a ${friend.name} para confirmar também.`)
      } else {
        await createExpense(fields)
        toast.success('Gasto guardado.')
      }
      onDone()
    } catch (err) {
      if (transactionId) await deleteTransaction(transactionId).catch(() => {})
      if (isSharedGuardError(err)) onStale?.()
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={`Novo gasto com ${friend.name}`}
      // Sem caixa própria: passa a abrir dentro de uma folha (Modal) na página
      // do amigo, que já dá o fundo e o padding.
      className="space-y-4"
    >
      <h3 className="pr-10 text-[1.375rem] leading-tight font-bold tracking-tight text-label">
        Novo gasto com {friend.name}
      </h3>

      <fieldset className="space-y-2">
        <legend className="sr-only">Quem pagou</legend>
        {OPTIONS.map((opt) => (
          <label
            key={opt.kind}
            className="flex min-h-14 cursor-pointer items-start gap-3 rounded-control border border-separator px-3 py-2.5 transition-colors duration-150 ease-out has-[:checked]:border-accent has-[:checked]:bg-accent/10 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent motion-reduce:transition-none"
          >
            <input
              type="radio"
              name="expense-kind"
              value={opt.kind}
              checked={kind === opt.kind}
              onChange={() => setKind(opt.kind)}
              className="mt-1 size-4 accent-accent"
            />
            <span>
              <span className="block font-medium text-label">{opt.title}</span>
              <span className="block text-sm text-label-2">{opt.hint}</span>
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

      {wantsAccount && (
        <div>
          <p className={labelClass}>Saiu de que conta?</p>
          {listsFailed ? (
            <p className="text-sm text-negative">Não foi possível carregar as contas. Tenta outra vez.</p>
          ) : !loadingLists && (accounts.length === 0 || categories.length === 0) ? (
            <p className="text-sm text-negative">
              Precisas de ter pelo menos uma conta e uma categoria de gastos. Cria-as em Gestão primeiro.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <select
                value={accountId}
                disabled={loadingLists}
                onChange={(e) => setAccountId(e.target.value)}
                aria-label="Conta"
                className="w-full min-w-0 rounded-control border border-separator px-3 py-2 text-sm"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <select
                value={categoryId}
                disabled={loadingLists}
                onChange={(e) => setCategoryId(e.target.value)}
                aria-label="Categoria"
                className="w-full min-w-0 rounded-control border border-separator px-3 py-2 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

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
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={`min-h-11 flex-1 rounded-control border border-separator px-3 font-medium text-label transition duration-150 ease-out hover:bg-fill active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing}`}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className={`min-h-11 flex-[2] rounded-control bg-accent-fill px-3 font-medium text-white transition duration-150 ease-out active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing}`}
        >
          {saving ? 'A guardar...' : friend.status === 'connected' ? 'Enviar para confirmar' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
