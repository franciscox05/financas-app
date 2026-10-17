import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { EmptyState, ErrorNotice, PageSkeleton, Pager } from '../components/Feedback'
import { useToast } from '../context/toastContext'
import { today } from '../lib/dates'
import ConfirmDialog from '../components/ConfirmDialog'
import { daysUntil, remainingOf } from '../lib/debtMath'
import {
  addDebtPayment,
  closeDebtByAgreement,
  createDebt,
  deleteDebt,
  listAccounts,
  listCategories,
  listDebtPayments,
  listDebts,
  reopenDebt,
  undoDebtPayment,
  updateDebt,
} from '../lib/db'
import Money from '../components/Money'

const HISTORY_PAGE_SIZE = 10

function eur(value) {
  return `${Number(value).toFixed(2)} €`
}

export default function Debts() {
  const toast = useToast()
  const [debts, setDebts] = useState([])
  const [payments, setPayments] = useState([])
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showHistory, setShowHistory] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [settlingId, setSettlingId] = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)

  const [direction, setDirection] = useState('owed_to_me')
  const [counterpartyName, setCounterpartyName] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [dueOn, setDueOn] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const [settleAccountId, setSettleAccountId] = useState('')
  const [settleCategoryId, setSettleCategoryId] = useState('')
  const [settleError, setSettleError] = useState('')
  const [settleAmount, setSettleAmount] = useState('')
  const [settleDate, setSettleDate] = useState(today())
  const [settleNote, setSettleNote] = useState('')
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editError, setEditError] = useState('')
  const [editDue, setEditDue] = useState('')
  const [undoTarget, setUndoTarget] = useState(null)
  const [expandedHistoryId, setExpandedHistoryId] = useState(null)

  const [closingId, setClosingId] = useState(null)
  const [closeNote, setCloseNote] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [d, a, c, p] = await Promise.all([
        listDebts(),
        listAccounts(),
        listCategories(),
        listDebtPayments(),
      ])
      setDebts(d)
      setPayments(p)
      setAccounts(a)
      setCategories(c)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const pending = debts.filter((d) => d.status === 'pending')
  const settled = debts.filter((d) => d.status === 'settled')
  const owedToMe = pending.filter((d) => d.direction === 'owed_to_me')
  const iOwe = pending.filter((d) => d.direction === 'i_owe')

  const paymentsByDebt = useMemo(() => {
    const map = new Map()
    for (const p of payments) {
      if (!map.has(p.debt_id)) map.set(p.debt_id, [])
      map.get(p.debt_id).push(p)
    }
    return map
  }, [payments])
  const remaining = (debt) => remainingOf(debt, paymentsByDebt.get(debt.id) ?? [])

  const totalOwedToMe = owedToMe.reduce((sum, d) => sum + remaining(d), 0)
  const totalIOwe = iOwe.reduce((sum, d) => sum + remaining(d), 0)

  const settlingDebt = useMemo(() => debts.find((d) => d.id === settlingId), [debts, settlingId])
  const categoriesForSettle = useMemo(
    () =>
      settlingDebt
        ? categories.filter((c) => c.type === (settlingDebt.direction === 'owed_to_me' ? 'income' : 'expense'))
        : [],
    [categories, settlingDebt],
  )

  function closePanels() {
    setSettlingId(null)
    setEditingId(null)
    setClosingId(null)
  }

  function openSettle(debt) {
    closePanels()
    setSettlingId(debt.id)
    setSettleError('')
    setSettleAmount(String(remaining(debt)))
    setSettleDate(today())
    setSettleNote('')
    setSettleAccountId(accounts[0]?.id ?? '')
    const defaultCategoryName = debt.direction === 'owed_to_me' ? 'Outros Ganhos' : 'Outros Gastos'
    const type = debt.direction === 'owed_to_me' ? 'income' : 'expense'
    const defaultCategory = categories.find((c) => c.type === type && c.name === defaultCategoryName)
    setSettleCategoryId(defaultCategory?.id ?? categories.find((c) => c.type === type)?.id ?? '')
  }

  async function handleSettle(debt) {
    const left = remaining(debt)
    const numericAmount = Number(settleAmount)
    if (!settleAccountId || !settleCategoryId) {
      setSettleError('Escolhe conta e categoria.')
      return
    }
    if (!numericAmount || numericAmount <= 0) {
      setSettleError('Indica um valor válido.')
      return
    }
    if (Math.round(numericAmount * 100) > Math.round(left * 100)) {
      setSettleError(`O valor não pode ser superior ao que falta (${eur(left)}).`)
      return
    }
    setSettleError('')
    setSaving(true)
    try {
      await addDebtPayment({
        debt,
        amount: numericAmount,
        remaining: left,
        accountId: settleAccountId,
        categoryId: settleCategoryId,
        paidOn: settleDate,
        note: settleNote.trim(),
      })
      setSettlingId(null)
      await load()
      const closed = Math.round(numericAmount * 100) >= Math.round(left * 100)
      const isOwedToMe = debt.direction === 'owed_to_me'
      toast.success(
        closed
          ? isOwedToMe
            ? 'Dívida recebida na totalidade.'
            : 'Dívida paga na totalidade.'
          : `${isOwedToMe ? 'Recebido' : 'Pago'} ${eur(numericAmount)}. Faltam ${eur(left - numericAmount)}.`,
      )
    } catch (err) {
      setSettleError(err.message)
      toast.error(`Não foi possível registar o pagamento: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  function openEdit(debt) {
    closePanels()
    setEditingId(debt.id)
    setEditName(debt.counterparty_name)
    setEditAmount(String(debt.amount))
    setEditNote(debt.status === 'settled' ? debt.settled_note ?? '' : debt.note ?? '')
    setEditDue(debt.due_on ?? '')
    setEditError('')
  }

  async function handleEdit(debt) {
    const isSettled = debt.status === 'settled'
    if (!editName.trim()) {
      setEditError('Indica o nome da pessoa.')
      return
    }

    let numericAmount = Number(debt.amount)
    if (!isSettled) {
      numericAmount = Number(editAmount)
      const paid = Number(debt.amount) - remaining(debt)
      if (!numericAmount || numericAmount <= 0) {
        setEditError('Indica um valor válido.')
        return
      }
      if (paid > 0 && Math.round(numericAmount * 100) <= Math.round(paid * 100)) {
        setEditError(`Já foram pagos ${eur(paid)}; o valor tem de ser superior.`)
        return
      }
    }

    setSaving(true)
    try {
      await updateDebt({
        id: debt.id,
        counterpartyName: editName.trim(),
        amount: numericAmount,
        note: isSettled ? debt.note : editNote.trim(),
        settledNote: isSettled ? editNote.trim() : undefined,
        dueOn: editDue,
      })
      setEditingId(null)
      await load()
      toast.success('Dívida atualizada.')
    } catch (err) {
      setEditError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function openClose(debt) {
    closePanels()
    setClosingId(debt.id)
    setCloseNote('')
  }

  async function handleCloseByAgreement(debt) {
    setSaving(true)
    try {
      await closeDebtByAgreement({ id: debt.id, note: closeNote.trim() })
      setClosingId(null)
      await load()
      toast.success('Dívida fechada por acerto.')
    } catch (err) {
      toast.error(`Não foi possível fechar a dívida: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(debt) {
    // Quando há pagamentos, deleteDebt também apaga as transações que eles
    // criaram — "Desfazer" só recriaria a dívida (sem pagamentos nem
    // transações), o que seria enganador, por isso não se oferece nesse caso.
    const hadPayments = (paymentsByDebt.get(debt.id) ?? []).length > 0
    try {
      await deleteDebt(debt.id)
      setConfirmingDeleteId(null)
      await load()
      toast.success(
        'Dívida apagada.',
        hadPayments
          ? undefined
          : {
              action: {
                label: 'Desfazer',
                onClick: async () => {
                  try {
                    await createDebt({
                      direction: debt.direction,
                      counterpartyName: debt.counterparty_name,
                      amount: Number(debt.amount),
                      note: debt.note,
                    })
                    await load()
                    toast.success('Dívida restaurada.')
                  } catch (err) {
                    toast.error(`Não foi possível desfazer: ${err.message}`)
                  }
                },
              },
            },
      )
    } catch (err) {
      toast.error(`Não foi possível apagar: ${err.message}`)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    const numericAmount = Number(amount)
    if (!counterpartyName.trim()) {
      setFormError('Indica o nome da pessoa.')
      return
    }
    if (!numericAmount || numericAmount <= 0) {
      setFormError('Indica um valor válido.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      await createDebt({
        direction,
        counterpartyName: counterpartyName.trim(),
        amount: numericAmount,
        note,
        dueOn,
      })
      setDueOn('')
      setCounterpartyName('')
      setAmount('')
      setNote('')
      setShowForm(false)
      await load()
      toast.success('Dívida criada.')
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUndo() {
    const { payment, debt } = undoTarget
    setUndoTarget(null)
    try {
      await undoDebtPayment({ payment, debt })
      await load()
      toast.success('Pagamento anulado.')
    } catch (err) {
      toast.error(`Não foi possível anular o pagamento: ${err.message}`)
      await load()
    }
  }

  async function handleReopen(debt) {
    try {
      await reopenDebt(debt.id)
      await load()
      toast.success('Dívida reaberta.')
    } catch (err) {
      toast.error(`Não foi possível reabrir: ${err.message}`)
    }
  }

  const todayIso = today()
  const overdue = pending.filter((d) => {
    const days = daysUntil(d.due_on, todayIso)
    return days !== null && days < 0
  })

  if (loading) {
    return <PageSkeleton />
  }

  if (error && debts.length === 0 && accounts.length === 0) {
    return <ErrorNotice message={error} onRetry={load} />
  }

  function renderDebtRow(debt) {
    const isOwedToMe = debt.direction === 'owed_to_me'
    const isSettled = debt.status === 'settled'
    const debtPayments = paymentsByDebt.get(debt.id) ?? []
    const left = remaining(debt)
    const partial = debtPayments.length > 0
    const inputClass =
      'w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100'
    const smallButton =
      'min-h-9 rounded-lg border border-neutral-300 px-3 text-xs font-medium dark:border-neutral-700'

    return (
      <li key={debt.id} className="space-y-2 py-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-800 dark:text-neutral-200">
              {debt.counterparty_name}
            </p>
            {debt.note && <p className="truncate text-xs text-neutral-400">{debt.note}</p>}
            {dueLabel(debt.due_on, todayIso)}
          </div>
          <div className="shrink-0 text-right">
            <p className={`font-semibold ${isOwedToMe ? 'text-green-600' : 'text-red-600'}`}><Money value={left} /></p>
            {partial && !isSettled && <p className="text-xs text-neutral-400">de <Money value={debt.amount} /></p>}
          </div>
        </div>

        {isSettled && debt.settled_note && !partial && (
          <p className="text-xs text-neutral-400">
            Acertado em {debt.settled_at ? new Date(debt.settled_at).toLocaleDateString('pt-PT') : '—'} ·{' '}
            {debt.settled_note}
          </p>
        )}

        {partial && (
          <ul className="space-y-0.5 text-xs text-neutral-400">
            {debtPayments.map((p) => (
              <li key={p.id}>
                {isOwedToMe ? 'Recebido' : 'Pago'} <Money value={p.amount} /> em{' '}
                {new Date(`${p.paid_on}T00:00:00`).toLocaleDateString('pt-PT')}
                {p.transactions && (
                  <> · {p.transactions.accounts?.name ?? 'conta'} · {p.transactions.categories?.name ?? 'sem categoria'}</>
                )}
                {p.note ? ` · ${p.note}` : ''}
                <button
                  type="button"
                  onClick={() => setUndoTarget({ payment: p, debt })}
                  className="ml-2 inline-flex min-h-8 items-center text-xs text-neutral-500 underline underline-offset-2"
                >
                  Anular
                </button>
              </li>
            ))}
          </ul>
        )}

        {confirmingDeleteId === debt.id && partial && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Também apaga {debtPayments.length === 1 ? 'a transação' : `as ${debtPayments.length} transações`} criada
            {debtPayments.length === 1 ? '' : 's'} pelos pagamentos desta dívida.
          </p>
        )}

        <div className="flex items-center gap-2">
          {confirmingDeleteId === debt.id ? (
            <>
              <button
                onClick={() => handleDelete(debt)}
                className="min-h-9 rounded-lg bg-red-600 px-3 text-xs font-medium text-white"
              >
                Confirmar
              </button>
              <button onClick={() => setConfirmingDeleteId(null)} className={smallButton}>
                Cancelar
              </button>
            </>
          ) : (
            <>
              {!isSettled && (
                <>
                  <button
                    onClick={() => openSettle(debt)}
                    className="min-h-9 rounded-lg bg-neutral-900 px-3 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                  >
                    {isOwedToMe ? 'Registar recebimento' : 'Registar pagamento'}
                  </button>
                  <button onClick={() => openClose(debt)} className={`${smallButton} text-neutral-600 dark:text-neutral-300`}>
                    Fechar por acerto
                  </button>
                </>
              )}
              <span className="ml-auto flex items-center">
                <button
                  onClick={() => openEdit(debt)}
                  aria-label="Editar dívida"
                  className="flex size-9 items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-200"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => setConfirmingDeleteId(debt.id)}
                  aria-label="Apagar dívida"
                  className="flex size-9 items-center justify-center rounded-lg text-neutral-400 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </span>
            </>
          )}
        </div>

        {settlingId === debt.id && (
          <div className="space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label className="mb-1 block text-xs text-neutral-500">Valor (€)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  max={left}
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-xs text-neutral-500">Data</label>
                <input
                  type="date"
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-xs text-neutral-500">Conta</label>
                <select
                  value={settleAccountId}
                  onChange={(e) => setSettleAccountId(e.target.value)}
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
                <label className="mb-1 block text-xs text-neutral-500">Categoria</label>
                <select
                  value={settleCategoryId}
                  onChange={(e) => setSettleCategoryId(e.target.value)}
                  className={inputClass}
                >
                  {categoriesForSettle.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <input
              type="text"
              placeholder="Nota (opcional)"
              value={settleNote}
              onChange={(e) => setSettleNote(e.target.value)}
              className={inputClass}
            />
            <p className="text-xs text-neutral-400">
              Podes registar só uma parte; o resto fica pendente. Faltam <Money value={left} />.
            </p>
            {settleError && <p className="text-xs text-red-600">{settleError}</p>}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSettle(debt)}
                disabled={saving}
                className="min-h-9 rounded-lg bg-green-600 px-3 text-xs font-medium text-white disabled:opacity-50"
              >
                Confirmar e registar transação
              </button>
              <button onClick={() => setSettlingId(null)} className={smallButton}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {editingId === debt.id && (
          <div className="space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <input
              type="text"
              aria-label="Nome da pessoa"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className={inputClass}
            />
            {debt.status !== 'settled' && (
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                aria-label="Valor original"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className={inputClass}
              />
            )}
            <input
              type="text"
              placeholder="Nota (opcional)"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              className={inputClass}
            />
            {debt.status !== 'settled' && (
              <div className="min-w-0">
                <label className="mb-1 block text-xs text-neutral-500">Data limite (opcional)</label>
                <input
                  type="date"
                  value={editDue}
                  onChange={(e) => setEditDue(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}
            {partial && debt.status !== 'settled' && (
              <p className="text-xs text-neutral-400">
                O valor é o original da dívida; os pagamentos já registados mantêm-se.
              </p>
            )}
            {editError && <p className="text-xs text-red-600">{editError}</p>}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEdit(debt)}
                disabled={saving}
                className="min-h-9 rounded-lg bg-neutral-900 px-3 text-xs font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
              >
                Guardar alterações
              </button>
              <button onClick={() => setEditingId(null)} className={smallButton}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {closingId === debt.id && (
          <div className="space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <p className="text-xs text-neutral-500">
              Fecha os <Money value={left} /> em falta sem criar nenhuma transação nas contas (ex.: acertaram contas
              entre vocês).
            </p>
            <input
              type="text"
              placeholder="Nota (ex.: acertado com o café de ontem)"
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              className={inputClass}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCloseByAgreement(debt)}
                disabled={saving}
                className="min-h-9 rounded-lg bg-neutral-900 px-3 text-xs font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
              >
                Fechar dívida
              </button>
              <button onClick={() => setClosingId(null)} className={smallButton}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </li>
    )
  }

  function dueLabel(dueOn, todayIso) {
    const days = daysUntil(dueOn, todayIso)
    if (days === null) return null
    const late = days < 0
    const text = late
      ? `Atrasada há ${-days} ${-days === 1 ? 'dia' : 'dias'}`
      : days === 0
        ? 'Vence hoje'
        : `Vence em ${days} ${days === 1 ? 'dia' : 'dias'}`
    return (
      <p className={`text-xs ${late || days === 0 ? 'font-medium text-red-500' : 'text-neutral-400'}`}>
        {text}
      </p>
    )
  }

  function renderHistoryRow(debt) {
    const debtPayments = paymentsByDebt.get(debt.id) ?? []
    const expanded = expandedHistoryId === debt.id
    const canExpand = debtPayments.length > 0 || Boolean(debt.settled_note)
    return (
      <li key={debt.id} className="space-y-1 py-2 text-sm text-neutral-500">
        <div className="flex items-center justify-between">
          <span className="min-w-0">
            <span className="block truncate font-medium text-neutral-700 dark:text-neutral-300">
              {debt.counterparty_name} · <Money value={debt.amount} />
            </span>
            {debt.note && <span className="block truncate text-xs text-neutral-400">{debt.note}</span>}
            <span className="block text-xs text-neutral-400">
              Criada em {new Date(debt.created_at).toLocaleDateString('pt-PT')}
              {debt.settled_at && ` · Acertada em ${new Date(debt.settled_at).toLocaleDateString('pt-PT')}`}
            </span>
            {debtPayments.length === 1 && debtPayments[0].transactions && (
              <span className="block text-xs text-neutral-400">
                {debt.direction === 'owed_to_me' ? 'Recebido em' : 'Pago de'}{' '}
                {debtPayments[0].transactions.accounts?.name ?? 'conta'} ·{' '}
                {debtPayments[0].transactions.categories?.name ?? 'sem categoria'}
              </span>
            )}
            {debt.settled_note && (
              <span className="block truncate text-xs text-neutral-400">{debt.settled_note}</span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1 pl-3 text-xs">
            {debt.settled_note ? 'Acertado' : debt.direction === 'owed_to_me' ? 'Recebido' : 'Pago'}
            {confirmingDeleteId !== debt.id && (
              <button
                onClick={() => setConfirmingDeleteId(debt.id)}
                aria-label="Apagar dívida"
                className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            )}
          </span>
        </div>

        {confirmingDeleteId === debt.id && (
          <div className="space-y-1.5">
            {debtPayments.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Também apaga {debtPayments.length === 1 ? 'a transação' : `as ${debtPayments.length} transações`}{' '}
                criada{debtPayments.length === 1 ? '' : 's'} pelos pagamentos desta dívida.
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDelete(debt)}
                className="min-h-8 rounded-lg bg-red-600 px-3 text-xs font-medium text-white"
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmingDeleteId(null)}
                className="min-h-8 rounded-lg border border-neutral-300 px-3 text-xs font-medium dark:border-neutral-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {canExpand && (
          <button
            type="button"
            onClick={() => setExpandedHistoryId(expanded ? null : debt.id)}
            className="min-h-8 text-xs underline underline-offset-2"
          >
            {expanded ? 'Esconder detalhes' : 'Detalhes'}
          </button>
        )}
        {expanded && (
          <div className="space-y-1 text-xs text-neutral-400">
            {debtPayments.map((p) => (
              <p key={p.id}>
                {debt.direction === 'owed_to_me' ? 'Recebido' : 'Pago'} <Money value={p.amount} /> em{' '}
                {new Date(`${p.paid_on}T00:00:00`).toLocaleDateString('pt-PT')}
                {p.transactions && (
                  <> · {p.transactions.accounts?.name ?? 'conta'} · {p.transactions.categories?.name ?? 'sem categoria'}</>
                )}
                {p.note ? ` · ${p.note}` : ''}
                <button
                  type="button"
                  onClick={() => setUndoTarget({ payment: p, debt })}
                  className="ml-2 inline-flex min-h-8 items-center underline underline-offset-2"
                >
                  Anular
                </button>
              </p>
            ))}
            {debt.settled_note && (
              <button
                type="button"
                onClick={() => handleReopen(debt)}
                className="min-h-8 underline underline-offset-2"
              >
                Reabrir dívida
              </button>
            )}
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="space-y-6">
      {error && <ErrorNotice message={error} onRetry={load} />}

      {overdue.length > 0 && (
        <div
          role="status"
          className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          {overdue.length === 1
            ? 'Tens 1 dívida atrasada: '
            : `Tens ${overdue.length} dívidas atrasadas: `}
          {overdue.map((d) => d.counterparty_name).join(', ')}.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">A receber</p>
          <p className="text-lg font-semibold text-green-600"><Money value={totalOwedToMe} /></p>
        </div>
        <div className="min-w-0 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">A pagar</p>
          <p className="text-lg font-semibold text-red-600"><Money value={totalIOwe} /></p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-500">Dívidas pendentes</h3>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-0.5 text-xs text-neutral-500 underline-offset-2 hover:underline"
          >
            {showForm ? 'Fechar' : (
              <>
                <Plus size={13} /> Nova dívida
              </>
            )}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection('owed_to_me')}
                className={`rounded-lg py-2 text-sm font-medium ${
                  direction === 'owed_to_me'
                    ? 'bg-green-600 text-white'
                    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                Devem-me
              </button>
              <button
                type="button"
                onClick={() => setDirection('i_owe')}
                className={`rounded-lg py-2 text-sm font-medium ${
                  direction === 'i_owe'
                    ? 'bg-red-600 text-white'
                    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                Devo
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">Nome da pessoa</label>
              <input
                type="text"
                placeholder="Ex: João"
                value={counterpartyName}
                onChange={(e) => setCounterpartyName(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">Valor</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00 €"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">Nota (opcional)</label>
              <input
                type="text"
                placeholder="Ex: jantar de sábado"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-neutral-500">
                Data limite (opcional) — para receberes um lembrete
              </label>
              <input
                type="date"
                value={dueOn}
                onChange={(e) => setDueOn(e.target.value)}
                className="w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-neutral-900 py-2.5 font-medium text-white transition-colors disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {submitting ? 'A guardar...' : 'Guardar dívida'}
            </button>
          </form>
        )}

        {pending.length === 0 ? (
          <EmptyState
            title="Sem dívidas pendentes"
            description="Quando pagares algo que alguém te deva, ou alguém te pagar algo, regista aqui para não perderes a conta."
            actionLabel={showForm ? undefined : '+ Nova dívida'}
            onAction={showForm ? undefined : () => setShowForm(true)}
          />
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {pending.map(renderDebtRow)}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <button
          onClick={() => {
            setShowHistory((v) => !v)
            setHistoryPage(1)
          }}
          className="text-xs text-neutral-500 underline-offset-2 hover:underline"
        >
          {showHistory ? 'Esconder histórico' : `Ver histórico (${settled.length})`}
        </button>

        {showHistory && (
          settled.length === 0 ? (
            <p className="py-2 text-center text-sm text-neutral-500">Ainda sem dívidas acertadas.</p>
          ) : (
            <>
              <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {settled
                  .slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE)
                  .map((debt) => renderHistoryRow(debt))}
              </ul>
              <Pager
                page={historyPage}
                totalPages={Math.ceil(settled.length / HISTORY_PAGE_SIZE)}
                onChange={setHistoryPage}
              />
            </>
          )
        )}
      </section>

      <ConfirmDialog
        open={undoTarget !== null}
        title="Anular pagamento?"
        message="O pagamento e a transação que criou na conta serão apagados."
        confirmLabel="Anular pagamento"
        onCancel={() => setUndoTarget(null)}
        onConfirm={handleUndo}
      />
    </div>
  )
}
