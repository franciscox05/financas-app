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
  createSnapshot,
  deleteSnapshot,
  listAccounts,
  listAllTransactionsForBalance,
  listNetWorthSnapshots,
} from '../lib/db'
import { ErrorNotice, Skeleton } from '../components/Feedback'
import { addMonths, endOfMonth, monthStart, shortMonthLabel, toIsoDate, today } from '../lib/dates'

const LINE_COLOR = '#2a78d6'

function eur(value) {
  return `${value.toFixed(2)} €`
}

function cashBalanceAt(transactions, cashAccountIds, asOfDate) {
  let total = 0
  for (const tx of transactions) {
    if (!cashAccountIds.has(tx.account_id)) continue
    if (tx.occurred_on > asOfDate) continue
    total += tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount)
  }
  return total
}

function investmentValueAt(snapshots, investmentAccountIds, asOfDate) {
  let total = 0
  for (const accountId of investmentAccountIds) {
    const latest = snapshots
      .filter((s) => s.account_id === accountId && s.snapshot_date <= asOfDate)
      .sort((a, b) => (a.snapshot_date < b.snapshot_date ? 1 : -1))[0]
    if (latest) total += Number(latest.value)
  }
  return total
}

export default function NetWorth() {
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [snapAccountId, setSnapAccountId] = useState('')
  const [snapValue, setSnapValue] = useState('')
  const [snapDate, setSnapDate] = useState(today())
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmingSnapshotId, setConfirmingSnapshotId] = useState(null)

  const loadAll = useCallback(async () => {
    setError('')
    try {
      const [accs, txs, snaps] = await Promise.all([
        listAccounts(),
        listAllTransactionsForBalance(),
        listNetWorthSnapshots(),
      ])
      setAccounts(accs)
      setTransactions(txs)
      setSnapshots(snaps)
      setSnapAccountId((prev) => prev || accs.find((a) => a.type === 'investment')?.id || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const cashAccountIds = useMemo(
    () => new Set(accounts.filter((a) => a.type === 'cash').map((a) => a.id)),
    [accounts],
  )
  const investmentAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'investment'),
    [accounts],
  )
  const investmentAccountIds = useMemo(
    () => investmentAccounts.map((a) => a.id),
    [investmentAccounts],
  )

  const cashBalance = useMemo(
    () => cashBalanceAt(transactions, cashAccountIds, today()),
    [transactions, cashAccountIds],
  )

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
    () => [...latestByAccount.values()].reduce((sum, s) => sum + Number(s.value), 0),
    [latestByAccount],
  )

  const totalNetWorth = cashBalance + investmentTotal

  const chartData = useMemo(() => {
    const points = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = addMonths(monthStart(new Date()), -i)
      const isCurrentMonth = i === 0
      const asOfDate = isCurrentMonth ? today() : toIsoDate(endOfMonth(monthDate))
      const total =
        cashBalanceAt(transactions, cashAccountIds, asOfDate) +
        investmentValueAt(snapshots, investmentAccountIds, asOfDate)
      points.push({ month: shortMonthLabel(monthDate), Património: Number(total.toFixed(2)) })
    }
    return points
  }, [transactions, snapshots, cashAccountIds, investmentAccountIds])

  async function handleAddSnapshot(e) {
    e.preventDefault()
    const numericValue = Number(snapValue)
    if (!snapAccountId) {
      setFormError('Escolhe uma conta de investimento.')
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
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteSnapshot(id) {
    await deleteSnapshot(id)
    setConfirmingSnapshotId(null)
    await loadAll()
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
          <span className="text-sm text-neutral-700 dark:text-neutral-300">Conta à Ordem</span>
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
                {latest ? eur(Number(latest.value)) : 'Sem dados'}
              </span>
            </div>
          )
        })}
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
        <h3 className="mb-2 text-sm font-semibold text-neutral-500">
          Adicionar snapshot de investimento
        </h3>
        <form
          onSubmit={handleAddSnapshot}
          className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="grid grid-cols-2 gap-2">
            <select
              value={snapAccountId}
              onChange={(e) => setSnapAccountId(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            >
              {investmentAccounts.map((a) => (
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
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            placeholder="Valor total na plataforma (€)"
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
                      ✕
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
