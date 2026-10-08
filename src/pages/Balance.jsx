import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { listTransactionsInRange } from '../lib/db'
import { addMonths, monthKey, monthLabel, monthStart, shortMonthLabel, toIsoDate } from '../lib/dates'

const INCOME_COLOR = '#16a34a' // tailwind green-600 — consistente com o resto da UI
const EXPENSE_COLOR = '#dc2626' // tailwind red-600
const BAR_COLOR = '#2a78d6' // categorical slot 1 (azul) — magnitude, não identidade

function eur(value) {
  return `${value.toFixed(2)} €`
}

export default function Balance() {
  const [selectedMonth, setSelectedMonth] = useState(() => monthStart(new Date()))
  const [sixMonthData, setSixMonthData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const rangeStart = addMonths(monthStart(new Date()), -5)
        const rangeEnd = addMonths(monthStart(new Date()), 1)
        const txs = await listTransactionsInRange({
          from: toIsoDate(rangeStart),
          to: toIsoDate(rangeEnd),
        })
        if (cancelled) return

        // Agrupa por mês para o gráfico de evolução dos últimos 6 meses.
        const byMonth = new Map()
        for (let i = 0; i < 6; i++) {
          const d = addMonths(rangeStart, i)
          byMonth.set(monthKey(d), { date: d, income: 0, expense: 0, txs: [] })
        }
        for (const tx of txs) {
          const d = new Date(`${tx.occurred_on}T00:00:00`)
          const bucket = byMonth.get(monthKey(d))
          if (!bucket) continue
          bucket.txs.push(tx)
          if (tx.type === 'income') bucket.income += Number(tx.amount)
          else bucket.expense += Number(tx.amount)
        }
        setSixMonthData([...byMonth.values()])
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedBucket = sixMonthData.find(
    (b) => monthKey(b.date) === monthKey(selectedMonth),
  )

  const categoryBreakdown = useMemo(() => {
    if (!selectedBucket) return []
    const totals = new Map()
    for (const tx of selectedBucket.txs) {
      if (tx.type !== 'expense') continue
      const name = tx.categories?.name ?? 'Sem categoria'
      totals.set(name, (totals.get(name) ?? 0) + Number(tx.amount))
    }
    return [...totals.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [selectedBucket])

  const maxCategoryAmount = categoryBreakdown[0]?.amount ?? 0

  const chartData = sixMonthData.map((b) => ({
    month: shortMonthLabel(b.date),
    Ganhos: Number(b.income.toFixed(2)),
    Gastos: Number(b.expense.toFixed(2)),
  }))

  if (loading) {
    return <p className="py-10 text-center text-sm text-neutral-500">A carregar...</p>
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>
  }

  const income = selectedBucket?.income ?? 0
  const expense = selectedBucket?.expense ?? 0
  const saldo = income - expense

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setSelectedMonth((m) => addMonths(m, -1))}
          disabled={monthKey(selectedMonth) === monthKey(addMonths(monthStart(new Date()), -5))}
          className="rounded-lg border border-neutral-300 px-3 py-1 text-sm disabled:opacity-30 dark:border-neutral-700"
        >
          ←
        </button>
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          {monthLabel(selectedMonth)}
        </h2>
        <button
          onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
          disabled={monthKey(selectedMonth) === monthKey(monthStart(new Date()))}
          className="rounded-lg border border-neutral-300 px-3 py-1 text-sm disabled:opacity-30 dark:border-neutral-700"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">Ganhos</p>
          <p className="font-semibold text-green-600">{eur(income)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">Gastos</p>
          <p className="font-semibold text-red-600">{eur(expense)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">Saldo</p>
          <p
            className={`font-semibold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {eur(saldo)}
          </p>
        </div>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-neutral-500">
          Gastos por categoria
        </h3>
        {categoryBreakdown.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-500">Sem gastos neste mês.</p>
        ) : (
          <ul className="space-y-2">
            {categoryBreakdown.map((c) => (
              <li key={c.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-neutral-700 dark:text-neutral-300">{c.name}</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {eur(c.amount)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${(c.amount / maxCategoryAmount) * 100}%`,
                      backgroundColor: BAR_COLOR,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-neutral-500">
          Evolução (últimos 6 meses)
        </h3>
        <div className="h-56 w-full rounded-xl border border-neutral-200 p-2 dark:border-neutral-800">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2}>
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
                width={40}
              />
              <Tooltip
                formatter={(value) => eur(Number(value))}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Ganhos" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Gastos" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}
