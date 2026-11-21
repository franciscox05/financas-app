import { Pause, Pencil, Play, Plus, Repeat } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { useToast } from '../context/toastContext'
import { useT } from '../i18n'
import { today } from '../lib/dates'
import { createRecurring, deleteRecurring, listRecurring, updateRecurring } from '../lib/db'
import { parseExpenseAmount } from '../lib/expenseInput'
import { eur } from '../lib/format'
import { monthlyRecurringTotals, recurringState } from '../lib/recurring'
import { ErrorNotice, ListSkeleton } from './Feedback'
import Modal from './Modal'
import Money from './Money'
import Segmented from './ui/Segmented'
import { dangerButton, focusRing, inputClass, labelClass, primaryButton, secondaryButton } from './ui/styles'

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1)

function emptyForm(accounts, categories) {
  return {
    type: 'expense',
    amount: '',
    accountId: accounts[0]?.id ?? '',
    categoryId: categories.find((c) => c.type === 'expense')?.id ?? '',
    dayOfMonth: Number(today().slice(8, 10)) > 28 ? 28 : Number(today().slice(8, 10)),
    note: '',
  }
}

function formFrom(rec) {
  return {
    type: rec.type,
    amount: String(Number(rec.amount)).replace('.', ','),
    accountId: rec.account_id,
    categoryId: rec.category_id,
    dayOfMonth: rec.day_of_month,
    note: rec.note ?? '',
  }
}

// Folha para criar ou editar um recorrente. `editing` = recorrente a editar ou
// null para um novo. Apagar pede uma segunda confirmação no próprio botão.
function RecurringSheet({ open, editing, accounts, categories, onClose, onSaved, onDeleted }) {
  const t = useT()
  const toast = useToast()
  const titleId = useId()
  const [form, setForm] = useState(() => emptyForm(accounts, categories))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(editing ? formFrom(editing) : emptyForm(accounts, categories))
    setConfirmDelete(false)
  }, [open, editing, accounts, categories])

  const typeOptions = [
    { value: 'expense', label: t('rec.field.expense') },
    { value: 'income', label: t('rec.field.income') },
  ]
  const categoryOptions = categories.filter((c) => c.type === form.type)

  function setType(type) {
    const keep = categories.find((c) => c.id === form.categoryId)?.type === type
    setForm((f) => ({ ...f, type, categoryId: keep ? f.categoryId : (categories.find((c) => c.type === type)?.id ?? '') }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const amount = parseExpenseAmount(form.amount)
    if (amount === null) {
      toast.error(t('rec.invalidAmount'))
      return
    }
    setSaving(true)
    try {
      const values = {
        type: form.type,
        amount,
        accountId: form.accountId,
        categoryId: form.categoryId,
        dayOfMonth: Number(form.dayOfMonth),
        note: form.note.trim(),
      }
      const saved = editing ? await updateRecurring(editing.id, values) : await createRecurring(values)
      toast.success(t('rec.saved'))
      onSaved(saved)
    } catch (err) {
      toast.error(t('rec.error', { message: err.message }))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setSaving(true)
    try {
      await deleteRecurring(editing.id)
      toast.success(t('rec.deleted'))
      onDeleted(editing.id)
    } catch (err) {
      toast.error(t('rec.error', { message: err.message }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 id={titleId} className="text-[1.25rem] font-bold tracking-tight text-label">
          {editing ? t('rec.edit') : t('rec.add')}
        </h2>

        <Segmented label={t('rec.field.type')} options={typeOptions} value={form.type} onChange={setType} />

        <div>
          <label htmlFor="rec-amount" className={labelClass}>
            {t('rec.field.amount')}
          </label>
          <div>
            <input
              id="rec-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              required
              value={form.amount}
              placeholder={eur(0)}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className={`${inputClass} amount`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rec-category" className={labelClass}>
              {t('rec.field.category')}
            </label>
            <select
              id="rec-category"
              required
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className={inputClass}
            >
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rec-account" className={labelClass}>
              {t('rec.field.account')}
            </label>
            <select
              id="rec-account"
              required
              value={form.accountId}
              onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
              className={inputClass}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rec-day" className={labelClass}>
              {t('rec.field.day')}
            </label>
            <select
              id="rec-day"
              value={form.dayOfMonth}
              onChange={(e) => setForm((f) => ({ ...f, dayOfMonth: Number(e.target.value) }))}
              aria-describedby="rec-day-hint"
              className={inputClass}
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rec-note" className={labelClass}>
              {t('rec.field.note')}
            </label>
            <input
              id="rec-note"
              type="text"
              value={form.note}
              maxLength={120}
              placeholder={t('rec.field.notePlaceholder')}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>
        <p id="rec-day-hint" className="-mt-2 text-xs text-label-3">
          {t('rec.field.dayHint')}
        </p>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className={`${secondaryButton} flex-1`}>
            {t('rec.cancel')}
          </button>
          <button type="submit" disabled={saving} className={`${primaryButton} flex-1`}>
            {t('rec.save')}
          </button>
        </div>
        {editing && (
          <button type="button" onClick={handleDelete} disabled={saving} className={`${dangerButton} w-full`}>
            {confirmDelete ? t('rec.deleteConfirm') : t('rec.delete')}
          </button>
        )}
      </form>
    </Modal>
  )
}

// Gestão → Recorrentes: lista com pausa/retomar e edição numa folha.
export default function RecurringSection({ accounts, categories, cardClass }) {
  const t = useT()
  const toast = useToast()
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState({ open: false, editing: null })

  useEffect(() => {
    let cancelled = false
    listRecurring()
      .then((rows) => !cancelled && setList(rows))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [])

  const totals = useMemo(() => monthlyRecurringTotals(list ?? []), [list])
  const now = today()

  async function toggleActive(rec) {
    try {
      const updated = await updateRecurring(rec.id, { active: !rec.active })
      setList((prev) => prev.map((r) => (r.id === rec.id ? updated : r)))
    } catch (err) {
      toast.error(t('rec.error', { message: err.message }))
    }
  }

  const iconButton = `flex size-11 shrink-0 items-center justify-center rounded-full text-label-2 hover:bg-fill ${focusRing}`

  return (
    <div id="recorrentes" className={`${cardClass} scroll-mt-20`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[1.25rem] font-bold tracking-tight text-label">
          <Repeat size={20} strokeWidth={2.1} aria-hidden="true" className="text-accent" />
          {t('rec.title')}
        </h2>
        <button
          type="button"
          onClick={() => setSheet({ open: true, editing: null })}
          aria-label={t('rec.add')}
          className={`${iconButton} -mr-2 text-accent`}
        >
          <Plus size={22} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
      <p className="mt-1 text-[0.8125rem] leading-snug text-label-2">{t('rec.subtitle')}</p>

      {error ? (
        <div className="mt-3">
          <ErrorNotice message={error} />
        </div>
      ) : list === null ? (
        <div className="mt-3">
          <ListSkeleton rows={2} />
        </div>
      ) : list.length === 0 ? (
        <button
          type="button"
          onClick={() => setSheet({ open: true, editing: null })}
          className={`mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-fill text-[0.9375rem] font-medium text-accent ${focusRing}`}
        >
          <Plus size={18} aria-hidden="true" />
          {t('rec.add')}
        </button>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-separator">
            {list.map((r) => {
              const state = recurringState(r, now)
              const name = r.note || r.categories?.name || t('rec.title')
              const meta = [t('rec.dayOf', { day: r.day_of_month }), r.accounts?.name]
              if (state === 'paused') meta.push(t('rec.paused'))
              if (state === 'done') meta.push(t('rec.doneThisMonth'))
              return (
                <li key={r.id} className={`flex items-center gap-2 py-2 ${state === 'paused' ? 'opacity-60' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-medium text-label">{name}</p>
                    <p className="truncate text-xs text-label-2">{meta.filter(Boolean).join(' · ')}</p>
                  </div>
                  <span
                    className={`amount shrink-0 text-sm font-semibold ${r.type === 'income' ? 'text-positive' : 'text-negative'}`}
                  >
                    <Money>{`${r.type === 'income' ? '+' : '-'}${eur(r.amount)}`}</Money>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleActive(r)}
                    aria-label={`${r.active ? t('rec.pause') : t('rec.resume')}: ${name}`}
                    className={iconButton}
                  >
                    {r.active ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheet({ open: true, editing: r })}
                    aria-label={`${t('rec.edit')}: ${name}`}
                    className={`${iconButton} -mr-2`}
                  >
                    <Pencil size={17} aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-xs text-label-3">
            <Money>{t('rec.totals', { expense: eur(totals.expense), income: eur(totals.income) })}</Money>
          </p>
        </>
      )}

      <RecurringSheet
        open={sheet.open}
        editing={sheet.editing}
        accounts={accounts}
        categories={categories}
        onClose={() => setSheet({ open: false, editing: null })}
        onSaved={(saved) => {
          setList((prev) => {
            const rest = (prev ?? []).filter((r) => r.id !== saved.id)
            return [...rest, saved].sort((a, b) => a.day_of_month - b.day_of_month)
          })
          setSheet({ open: false, editing: null })
        }}
        onDeleted={(id) => {
          setList((prev) => prev.filter((r) => r.id !== id))
          setSheet({ open: false, editing: null })
        }}
      />
    </div>
  )
}
