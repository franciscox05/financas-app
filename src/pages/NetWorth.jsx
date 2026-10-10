import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  createSavingsGoal,
  createSnapshot,
  deleteSavingsGoal,
  deleteSnapshot,
  listAccounts,
  listAllTransactionsForBalance,
  listNetWorthSnapshots,
  listSavingsGoals,
} from '../lib/db'
import { Plus, Trash2 } from 'lucide-react'
import { EmptyState, ErrorNotice, Skeleton } from '../components/Feedback'
import { useToast } from '../context/toastContext'
import { balanceAt } from '../lib/accountBalance'
import { addMonths, endOfMonth, monthStart, shortMonthLabel, toIsoDate, today } from '../lib/dates'

const LINE_COLOR = '#2a78d6'

function eur(value) {
  return `${value.toFixed(2)} €`
}

// Soma o saldo (snapshot mais recente + transações desde esse snapshot) de
// cada conta do grupo, na mesma data — serve tanto para contas à ordem como
// de investimento.
function groupBalanceAt(transactions, snapshots, accountIds, asOfDate) {
  return accountIds.reduce(
    (sum, accountId) => sum + balanceAt(accountId, transactions, snapshots, asOfDate),
    0,
  )
}

export default function NetWorth() {
  const toast = useToast()
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [snapAccountId, setSnapAccountId] = useState('')
  const [snapValue, setSnapValue] = useState('')
  const [snapDate, setSnapDate] = useState(today())
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmingSnapshotId, setConfirmingSnapshotId] = useState(null)

  const [showGoalForm, setShowGoalForm] = useState(false)
  const [goalName, setGoalName] = useState('')
  const [goalAccountId, setGoalAccountId] = useState('')
  const [goalTargetAmount, setGoalTargetAmount] = useState('')
  const [goalTargetDate, setGoalTargetDate] = useState('')
  const [goalSubmitting, setGoalSubmitting] = useState(false)
  const [goalFormError, setGoalFormError] = useState('')
  const [confirmingGoalId, setConfirmingGoalId] = useState(null)

  const loadAll = useCallback(async () => {
    setError('')
    try {
      const [accs, txs, snaps, gls] = await Promise.all([
        listAccounts(),
        listAllTransactionsForBalance(),
        listNetWorthSnapshots(),
        listSavingsGoals(),
      ])
      setAccounts(accs)
      setTransactions(txs)
      setSnapshots(snaps)
      setGoals(gls)
      setSnapAccountId((prev) => prev || accs[0]?.id || '')
      setGoalAccountId((prev) => prev || accs[0]?.id || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const cashAccounts = useMemo(() => accounts.filter((a) => a.type === 'cash'), [accounts])
  // O saldo de todas as contas à ordem soma-se numa só linha: com uma conta usa o
  // nome dela, com várias um rótulo genérico (já não é sempre "Conta à Ordem").
  const cashLabel = useMemo(() => {
    const cash = accounts.filter((a) => a.type === 'cash')
    return cash.length === 1 ? cash[0].name : `Contas à ordem (${cash.length})`
  }, [accounts])
  const investmentAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'investment'),
    [accounts],
  )
  const investmentAccountIds = useMemo(
    () => investmentAccounts.map((a) => a.id),
    [investmentAccounts],
  )
  const cashAccountIds = useMemo(() => cashAccounts.map((a) => a.id), [cashAccounts])

  const cashBalance = useMemo(
    () => groupBalanceAt(transactions, snapshots, cashAccountIds, today()),
    [transactions, snapshots, cashAccountIds],
  )

  const balanceByAccountId = useMemo(() => {
    const now = today()
    const map = new Map()
    for (const acc of accounts) {
      map.set(acc.id, balanceAt(acc.id, transactions, snapshots, now))
    }
    return map
  }, [accounts, transactions, snapshots])

  const latestByAccount = useMemo(() => {
    const map = new Map()
    for (const accountId of investmentAccountIds) {
      const latest = snapshots
        .filter((s) => s.account_id === accountId)
        .sort((a, b) => (a.snapshot_date < b.snapshot_date ? 1 : -1))[0]
      if (latest) map.set(accountId, latest)
    }
    return map
  }, [snapshots, investmentAccountIds])

  const investmentTotal = useMemo(
    () => groupBalanceAt(transactions, snapshots, investmentAccountIds, today()),
    [transactions, snapshots, investmentAccountIds],
  )

  const totalNetWorth = cashBalance + investmentTotal

  const chartData = useMemo(() => {
    const allAccountIds = accounts.map((a) => a.id)
    const points = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = addMonths(monthStart(new Date()), -i)
      const isCurrentMonth = i === 0
      const asOfDate = isCurrentMonth ? today() : toIsoDate(endOfMonth(monthDate))
      const total = groupBalanceAt(transactions, snapshots, allAccountIds, asOfDate)
      points.push({ month: shortMonthLabel(monthDate), Património: Number(total.toFixed(2)) })
    }
    return points
  }, [transactions, snapshots, accounts])

  async function handleAddSnapshot(e) {
    e.preventDefault()
    const numericValue = Number(snapValue)
    if (!snapAccountId) {
      setFormError('Escolhe uma conta.')
      return
    }
    if (Number.isNaN(numericValue) || numericValue < 0) {
      setFormError('Indica um valor válido.')
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      await createSnapshot({ accountId: snapAccountId, value: numericValue, snapshotDate: snapDate })
      setSnapValue('')
      setSnapDate(today())
      await loadAll()
      toast.success('Snapshot guardado.')
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteSnapshot(id) {
    try {
      await deleteSnapshot(id)
      setConfirmingSnapshotId(null)
      await loadAll()
      toast.success('Snapshot apagado.')
    } catch (err) {
      toast.error(`Não foi possível apagar: ${err.message}`)
    }
  }

  async function handleCreateGoal(e) {
    e.preventDefault()
    const numericAmount = Number(goalTargetAmount)
    if (!goalName.trim()) {
      setGoalFormError('Dá um nome à meta.')
      return
    }
    if (!goalAccountId) {
      setGoalFormError('Escolhe uma conta.')
      return
    }
    if (!numericAmount || numericAmount <= 0) {
      setGoalFormError('Indica um valor-alvo válido.')
      return
    }

    setGoalSubmitting(true)
    setGoalFormError('')
    try {
      await createSavingsGoal({
        name: goalName.trim(),
        accountId: goalAccountId,
        targetAmount: numericAmount,
        targetDate: goalTargetDate,
      })
      setGoalName('')
      setGoalTargetAmount('')
      setGoalTargetDate('')
      setShowGoalForm(false)
      await loadAll()
      toast.success('Meta criada.')
    } catch (err) {
      setGoalFormError(err.message)
    } finally {
      setGoalSubmitting(false)
    }
  }

  async function handleDeleteGoal(id) {
    try {
      await deleteSavingsGoal(id)
      setConfirmingGoalId(null)
      await loadAll()
      toast.success('Meta apagada.')
    } catch (err) {
      toast.error(`Não foi possível apagar: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-56" />
      </div>
    )
  }

  if (error) {
    return <ErrorNotice message={error} />
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-neutral-200 p-4 text-center dark:border-neutral-800">
        <p className="text-xs text-neutral-500">Património total</p>
        <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          {eur(totalNetWorth)}
        </p>
      </div>

      <section className="grid grid-cols-1 gap-2">
        <div className="flex items-center justify-between rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <span className="text-sm text-neutral-700 dark:text-neutral-300">{cashLabel}</span>
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
            {eur(cashBalance)}
          </span>
        </div>
        {investmentAccounts.map((acc) => {
          const latest = latestByAccount.get(acc.id)
          return (
            <div
              key={acc.id}
              className="flex items-center justify-between rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
            >
              <div>
                <p className="text-sm text-neutral-700 dark:text-neutral-300">{acc.name}</p>
                {latest && (
                  <p className="text-xs text-neutral-400">
                    atualizado {latest.snapshot_date}
                  </p>
                )}
              </div>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {eur(balanceByAccountId.get(acc.id) ?? 0)}
              </span>
            </div>
          )
        })}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-500">Metas de poupança</h3>
          <button
            onClick={() => setShowGoalForm((v) => !v)}
            className="flex items-center gap-0.5 text-xs text-neutral-500 underline-offset-2 hover:underline"
          >
            {showGoalForm ? 'Fechar' : (
              <>
                <Plus size={13} /> Nova meta
              </>
            )}
          </button>
        </div>

        {showGoalForm && (
          <form
            onSubmit={handleCreateGoal}
            className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <input
              type="text"
              placeholder="Nome da meta (ex: Fundo de emergência)"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={goalAccountId}
                onChange={(e) => setGoalAccountId(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="Valor-alvo (€)"
                value={goalTargetAmount}
                onChange={(e) => setGoalTargetAmount(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>
            <div>
              <input
                type="date"
                value={goalTargetDate}
                onChange={(e) => setGoalTargetDate(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
              <p className="mt-0.5 text-xs text-neutral-400">Data-limite opcional</p>
            </div>

            {goalFormError && <p className="text-sm text-red-600">{goalFormError}</p>}

            <button
              type="submit"
              disabled={goalSubmitting}
              className="w-full rounded-lg bg-neutral-900 py-2.5 font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {goalSubmitting ? 'A guardar...' : 'Guardar meta'}
            </button>
          </form>
        )}

        {goals.length === 0 ? (
          <EmptyState
            title="Ainda sem metas definidas"
            description="Define um valor-alvo sobre uma das tuas contas e acompanha o progresso automaticamente."
            actionLabel={showGoalForm ? undefined : '+ Nova meta'}
            onAction={showGoalForm ? undefined : () => setShowGoalForm(true)}
          />
        ) : (
          <ul className="space-y-3">
            {goals.map((goal) => {
              const current = balanceByAccountId.get(goal.account_id) ?? 0
              const target = Number(goal.target_amount)
              const pct = Math.max(0, Math.min(100, (current / target) * 100))
              const reached = current >= target
              const daysLeft = goal.target_date
                ? Math.ceil((new Date(`${goal.target_date}T00:00:00`) - new Date()) / 86400000)
                : null

              return (
                <li
                  key={goal.id}
                  className="space-y-1.5 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                      {goal.name}
                    </span>
                    {confirmingGoalId === goal.id ? (
                      <span className="flex items-center gap-1">
                        <button
                          onClick={() => handleDeleteGoal(goal.id)}
                          className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmingGoalId(null)}
                          className="rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
                        >
                          Cancelar
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmingGoalId(goal.id)}
                        aria-label="Apagar meta"
                        className="rounded p-1 text-neutral-400 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <div
                      className={`h-full rounded-full ${reached ? 'bg-green-600' : 'bg-blue-600'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>
                      {eur(current)} de {eur(target)} ({pct.toFixed(0)}%) · {goal.accounts?.name}
                    </span>
                    {goal.target_date && !reached && (
                      <span>
                        {daysLeft >= 0 ? `faltam ${daysLeft} dias` : 'prazo passado'}
                      </span>
                    )}
                    {reached && <span className="text-green-600">Meta atingida</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-neutral-500">Evolução (últimos 6 meses)</h3>
        <div className="h-56 w-full rounded-xl border border-neutral-200 p-2 dark:border-neutral-800">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid vertical={false} stroke="#e1e0d9" strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: '#898781' }}
                axisLine={{ stroke: '#c3c2b7' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#898781' }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip
                formatter={(value) => eur(Number(value))}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Line
                type="monotone"
                dataKey="Património"
                stroke={LINE_COLOR}
                strokeWidth={2}
                dot={{ r: 4, fill: LINE_COLOR }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-neutral-500">Atualizar saldo de uma conta</h3>
        <p className="mb-2 text-xs text-neutral-400">
          Regista quanto tens numa conta numa data — só afeta o património a partir desse dia,
          nunca os meses anteriores.
        </p>
        <form
          onSubmit={handleAddSnapshot}
          className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <select
            value={snapAccountId}
            onChange={(e) => setSnapAccountId(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={snapDate}
            onChange={(e) => setSnapDate(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            placeholder="Valor total nessa data (€)"
            value={snapValue}
            onChange={(e) => setSnapValue(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-neutral-900 py-2.5 font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {submitting ? 'A guardar...' : 'Guardar snapshot'}
          </button>
        </form>
      </section>

      {snapshots.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-neutral-500">Histórico de snapshots</h3>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {snapshots.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">
                  {s.snapshot_date} · {s.accounts?.name ?? 'Conta'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {eur(Number(s.value))}
                  </span>
                  {confirmingSnapshotId === s.id ? (
                    <span className="flex items-center gap-1">
                      <button
                        onClick={() => handleDeleteSnapshot(s.id)}
                        className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setConfirmingSnapshotId(null)}
                        className="rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
                      >
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmingSnapshotId(s.id)}
                      aria-label="Apagar snapshot"
                      className="rounded p-1 text-neutral-400 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
