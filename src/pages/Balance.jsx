import { ChevronLeft, ChevronRight } from 'lucide-react'
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
import { useNavigate } from 'react-router-dom'
import BudgetSection from '../components/BudgetSection'
import MonthCalendar from '../components/MonthCalendar'
import { EmptyState, ErrorNotice, ListSkeleton, Skeleton } from '../components/Feedback'
import { listCategories, listTransactionsInRange } from '../lib/db'
import { addMonths, monthKey, monthLabel, monthStart, shortMonthLabel, toIsoDate } from '../lib/dates'

const INCOME_COLOR = '#16a34a' // tailwind green-600 — consistente com o resto da UI
const EXPENSE_COLOR = '#dc2626' // tailwind red-600
const BAR_COLOR = '#2a78d6' // categorical slot 1 (azul) — magnitude, não identidade

function eur(value) {
  return `${value.toFixed(2)} €`
}

export default function Balance() {
  const navigate = useNavigate()
  const [selectedMonth, setSelectedMonth] = useState(() => monthStart(new Date()))
  const [sixMonthData, setSixMonthData] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // A janela de 6 meses acompanha o mês selecionado (termina nele), em vez de
  // ficar fixa nos últimos 6 meses a partir de hoje — assim é possível navegar
  // para qualquer mês com histórico (ex. meses importados de anos anteriores),
  // sem o limite antigo de só recuar 5 meses a partir de "agora".
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const rangeStart = addMonths(selectedMonth, -5)
        const rangeEnd = addMonths(selectedMonth, 1)
        const [txs, cats] = await Promise.all([
          listTransactionsInRange({ from: toIsoDate(rangeStart), to: toIsoDate(rangeEnd) }),
          listCategories(),
        ])
        if (cancelled) return
        setCategories(cats)

        // Agrupa por mês para o gráfico de evolução (6 meses terminados no selecionado).
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
  }, [selectedMonth])

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

  const spentByCategoryId = useMemo(() => {
    const map = new Map()
    if (!selectedBucket) return map
    for (const tx of selectedBucket.txs) {
      if (tx.type !== 'expense') continue
      map.set(tx.category_id, (map.get(tx.category_id) ?? 0) + Number(tx.amount))
    }
    return map
  }, [selectedBucket])

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories],
  )

  const savingsCategoryIds = useMemo(
    () => new Set(categories.filter((c) => c.is_savings).map((c) => c.id)),
    [categories],
  )

  const savingsAmount = useMemo(() => {
    if (!selectedBucket) return 0
    return selectedBucket.txs
      .filter((tx) => tx.type === 'expense' && savingsCategoryIds.has(tx.category_id))
      .reduce((sum, tx) => sum + Number(tx.amount), 0)
  }, [selectedBucket, savingsCategoryIds])

  // Insight: categorias com gasto este mês >=20% acima da média dos 3 meses anteriores.
  const insights = useMemo(() => {
    const idx = sixMonthData.findIndex((b) => monthKey(b.date) === monthKey(selectedMonth))
    if (idx < 1) return []
    const priorBuckets = sixMonthData.slice(Math.max(0, idx - 3), idx)
    if (priorBuckets.length === 0) return []

    const priorByCategory = new Map()
    for (const bucket of priorBuckets) {
      for (const tx of bucket.txs) {
        if (tx.type !== 'expense') continue
        const name = tx.categories?.name ?? 'Sem categoria'
        priorByCategory.set(name, (priorByCategory.get(name) ?? 0) + Number(tx.amount))
      }
    }

    const results = []
    for (const c of categoryBreakdown) {
      const priorAvg = (priorByCategory.get(c.name) ?? 0) / priorBuckets.length
      if (priorAvg < 1) continue // evita percentagens absurdas sobre base ~0
      const diffPct = ((c.amount - priorAvg) / priorAvg) * 100
      if (diffPct >= 20) {
        results.push({ name: c.name, diffPct: Math.round(diffPct) })
      }
    }
    return results.sort((a, b) => b.diffPct - a.diffPct).slice(0, 3)
  }, [sixMonthData, selectedMonth, categoryBreakdown])

  const monthSummary = useMemo(() => {
    const idx = sixMonthData.findIndex((b) => monthKey(b.date) === monthKey(selectedMonth))
    if (idx < 1) return null
    const prev = sixMonthData[idx - 1]
    if (!prev || prev.expense < 1) return null
    const current = sixMonthData[idx]
    const diffPct = Math.round(((current.expense - prev.expense) / prev.expense) * 100)
    if (diffPct === 0) return 'Gastaste o mesmo que no mês anterior.'
    const direction = diffPct > 0 ? 'mais' : 'menos'
    return `Gastaste ${Math.abs(diffPct)}% ${direction} que no mês anterior.`
  }, [sixMonthData, selectedMonth])

  const chartData = sixMonthData.map((b) => ({
    month: shortMonthLabel(b.date),
    Ganhos: Number(b.income.toFixed(2)),
    Gastos: Number(b.expense.toFixed(2)),
  }))

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-56" />
        <ListSkeleton rows={4} />
      </div>
    )
  }

  if (error) {
    return <ErrorNotice message={error} />
  }

  const income = selectedBucket?.income ?? 0
  const expense = selectedBucket?.expense ?? 0
  const saldo = income - expense

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setSelectedMonth((m) => addMonths(m, -1))}
          className="rounded-lg border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700"
        >
          <ChevronLeft size={16} />
        </button>
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          {monthLabel(selectedMonth)}
        </h2>
        <button
          onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
          disabled={monthKey(selectedMonth) === monthKey(monthStart(new Date()))}
          className="rounded-lg border border-neutral-300 px-3 py-1 text-sm disabled:opacity-30 dark:border-neutral-700"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {monthSummary && (
        <p className="text-center text-sm text-neutral-500">{monthSummary}</p>
      )}

      {savingsAmount > 0 && (
        <p className="text-center text-xs text-neutral-400">
          Dessas, {eur(savingsAmount)} foram para poupança/investimento — não contam como gasto do
          dia a dia.
        </p>
      )}

      <div className="grid grid-cols-3 gap-1.5 text-center sm:gap-2">
        <div className="min-w-0 rounded-xl border border-neutral-200 p-2 dark:border-neutral-800 sm:p-3">
          <p className="text-xs text-neutral-500">Ganhos</p>
          <p className="break-words text-sm font-semibold text-green-600 sm:text-base">
            {eur(income)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-neutral-200 p-2 dark:border-neutral-800 sm:p-3">
          <p className="text-xs text-neutral-500">Gastos</p>
          <p className="break-words text-sm font-semibold text-red-600 sm:text-base">
            {eur(expense)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-neutral-200 p-2 dark:border-neutral-800 sm:p-3">
          <p className="text-xs text-neutral-500">Saldo</p>
          <p
            className={`break-words text-sm font-semibold sm:text-base ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {eur(saldo)}
          </p>
        </div>
      </div>

      <MonthCalendar monthDate={selectedMonth} transactions={selectedBucket?.txs ?? []} />

      {insights.length > 0 && (
        <section className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Insights
          </h3>
          <ul className="space-y-1 text-sm text-amber-900 dark:text-amber-200">
            {insights.map((i) => (
              <li key={i.name}>
                Gastaste {i.diffPct}% mais em <strong>{i.name}</strong> este mês do que a média
                dos 3 meses anteriores.
              </li>
            ))}
          </ul>
        </section>
      )}

      <BudgetSection
        month={selectedMonth}
        categories={expenseCategories}
        spentByCategoryId={spentByCategoryId}
      />

      <section>
        <h3 className="mb-2 text-sm font-semibold text-neutral-500">
          Gastos por categoria
        </h3>
        {categoryBreakdown.length === 0 ? (
          <EmptyState
            title="Sem gastos neste mês"
            description="Quando registares gastos, vês aqui para onde vai o dinheiro."
            actionLabel="Registar um gasto"
            onAction={() => navigate('/')}
          />
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
