import { t } from '../i18n'
import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../context/toastContext'
import { today } from '../lib/dates'
import { listAccounts, listCategories } from '../lib/db'
import { parseExpenseAmount } from '../lib/expenseInput'
import { createRepayment } from '../lib/friendsDb'
import { createSharedEntry, retireDeclinedEntry } from '../lib/linkedDb'
import { isSharedGuardError } from '../lib/linkedLogic'
import { notifyPendingChanged } from '../lib/pendingEvents'
import { forgivenessEntry, suggestedRepayment } from '../lib/ledgerMath'
import { defaultCategoryId, overshootNote } from '../lib/repaymentInput'
import { currencySymbol, eur } from '../lib/format'
import { focusRing, inputClass, labelClass } from './ui/styles'

const OPTIONS = [
  {
    value: 'bank',
    titleKey: 'sheet.intoYourAccount',
    hintKey: 'sheet.intoYourAccountHint',
  },
  { value: 'offset', titleKey: 'sheet.offset', hintKey: 'sheet.offsetHint' },
]

// `prefill` (opcional) repete os valores de uma devolução contestada.
export default function RepaymentSheet({ friend, balance, prefill, onDone, onCancel, onStale }) {
  const toast = useToast()
  const suggestion = suggestedRepayment(balance)
  const kind = prefill?.kind ?? suggestion?.kind
  const [amount, setAmount] = useState(
    prefill
      ? String(prefill.amount).replace('.', ',')
      : suggestion
        ? String(suggestion.amount).replace('.', ',')
        : '',
  )
  const [settlement, setSettlement] = useState(prefill?.settlement ?? 'bank')
  const [note, setNote] = useState(prefill?.note ?? '')
  const [occurredOn, setOccurredOn] = useState(prefill?.occurredOn || today())
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [loadingLists, setLoadingLists] = useState(true)
  const [listsFailed, setListsFailed] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [forgiveDifference, setForgiveDifference] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([listAccounts(), listCategories()])
      .then(([accs, cats]) => {
        if (cancelled) return
        setAccounts(accs)
        setCategories(cats)
        setAccountId(accs.find((a) => a.id === prefill?.accountId)?.id ?? accs[0]?.id ?? '')
        setCategoryId(
          cats.find((c) => c.id === prefill?.categoryId)?.id ?? (kind ? defaultCategoryId(cats, kind) : ''),
        )
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
  }, [kind, prefill])

  const type = kind === 'repaid_to_me' ? 'income' : 'expense'
  const categoryOptions = useMemo(() => categories.filter((c) => c.type === type), [categories, type])

  if (!kind) return null

  const shared = friend.status === 'connected'
  const parsed = parseExpenseAmount(amount)
  const overshoot = parsed === null ? null : overshootNote(kind, balance, parsed)

  let bankProblem = ''
  if (!loadingLists) {
    if (listsFailed) bankProblem = t('sheet.accountsFailed')
    else if (accounts.length === 0) bankProblem = t('sheet.noAccounts')
    else if (categoryOptions.length === 0) {
      bankProblem = t(type === 'income' ? 'sheet.noIncomeCategory' : 'sheet.noExpenseCategory')
    }
  }
  const bankBlocked = settlement === 'bank' && (loadingLists || bankProblem !== '')

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    if (parsed === null) {
      setError(t('qe.err.amount'))
      return
    }
    if (!note.trim()) {
      setError(t('sheet.noteRequired'))
      return
    }
    if (bankBlocked) {
      setError(bankProblem || t('sheet.loadingAccounts'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const fields = {
        friendId: friend.id,
        kind,
        amount: parsed,
        note: note.trim(),
        occurredOn: occurredOn || today(),
        settlement,
        accountId: settlement === 'bank' ? accountId : null,
        categoryId: settlement === 'bank' ? categoryId : null,
      }
      let successMessage
      if (shared) {
        await createSharedEntry(fields)
        notifyPendingChanged()
        if (prefill?.id) {
          await retireDeclinedEntry(prefill.id).catch((err) => {
            toast.error(
              t('sheet.resentButOld', { msg: err.message }),
            )
          })
        }
        successMessage = t('sheet.sentToConfirm', { name: friend.name })
      } else {
        await createRepayment(fields)
        successMessage = t('sheet.repaymentSaved')
      }

      if (forgiveDifference) {
        const forgive = forgivenessEntry(kind, balance, parsed)
        if (forgive) {
          const forgiveFields = {
            friendId: friend.id,
            kind: forgive.kind,
            amount: forgive.amount,
            note: t('sheet.forgiveNote', { note: note.trim() }),
            occurredOn: occurredOn || today(),
            settlement: 'offset',
            accountId: null,
            categoryId: null,
          }
          try {
            if (shared) await createSharedEntry(forgiveFields)
            else await createRepayment(forgiveFields)
            successMessage += t('sheet.forgiven', { value: eur(forgive.amount) })
          } catch {
            toast.error(t('sheet.forgiveFailed'))
          }
        }
      }
      toast.success(successMessage)
      onDone()
    } catch (err) {
      // Os erros do servidor já vêm em português e prontos para mostrar.
      if (isSharedGuardError(err)) onStale?.()
      setError(
        shared || isSharedGuardError(err) || err.message === 'Escolhe a conta e a categoria.'
          ? err.message
          : t('sheet.saveRetry'),
      )
      setSaving(false)
    }
  }

  const title = kind === 'repaid_to_me' ? t('sheet.theyRepaid', { name: friend.name }) : t('sheet.iRepaid', { name: friend.name })

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={title}
      // Sem caixa própria: abre dentro de uma folha (Modal) na página do amigo.
      className="space-y-4"
    >
      <h3 className="pr-10 text-[1.375rem] leading-tight font-bold tracking-tight text-label">{title}</h3>

      <div>
        <label htmlFor="repayment-amount" className={labelClass}>
          Valor ({currencySymbol()})
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
          <div id="repayment-overshoot" className="mt-1.5 space-y-1.5">
            <p className="text-sm text-label-2">{overshoot}</p>
            <label className="flex min-h-9 items-center gap-2 text-sm text-label">
              <input
                type="checkbox"
                checked={forgiveDifference}
                onChange={(e) => setForgiveDifference(e.target.checked)}
                className="size-4 accent-accent"
              />
              {t('sheet.forgive')}
            </label>
          </div>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className={labelClass}>{t('sheet.howPaid')}</legend>
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="flex min-h-14 cursor-pointer items-start gap-3 rounded-control border border-separator px-3 py-2.5 transition-colors duration-150 ease-out has-[:checked]:border-accent has-[:checked]:bg-accent/10 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent motion-reduce:transition-none"
          >
            <input
              type="radio"
              name="repayment-settlement"
              value={opt.value}
              checked={settlement === opt.value}
              onChange={() => setSettlement(opt.value)}
              className="mt-1 size-4 accent-accent"
            />
            <span>
              <span className="block font-medium text-label">{t(opt.titleKey)}</span>
              <span className="block text-sm text-label-2">{t(opt.hintKey)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {settlement === 'bank' && bankProblem && (
        <p role="alert" className="text-sm text-negative">
          {bankProblem}
        </p>
      )}

      {settlement === 'bank' && !loadingLists && !bankProblem && (
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor="repayment-account" className={labelClass}>
              {t('common.account')}
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
              {t('common.category')}
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
          {t('common.note')}
        </label>
        <input
          id="repayment-note"
          type="text"
          autoComplete="off"
          required
          placeholder={t('sheet.repaymentPlaceholder')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="repayment-date" className={labelClass}>
          {t('common.date')}
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
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={`min-h-11 flex-1 rounded-control border border-separator font-medium text-label transition duration-150 ease-out hover:bg-fill active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing}`}
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={saving || bankBlocked || !note.trim()}
          className={`min-h-11 flex-1 rounded-control bg-accent-fill font-medium text-white transition duration-150 ease-out active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing}`}
        >
          {saving ? t('common.saving') : shared ? t('sheet.sendToConfirm') : t('common.save')}
        </button>
      </div>
    </form>
  )
}
