import { ArrowDownLeft, ArrowUpRight, TrendingUp } from 'lucide-react'
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
import MonthCalendar from '../components/MonthCalendar'
import CategoryDrilldownModal from '../components/CategoryDrilldownModal'
import MonthPicker from '../components/MonthPicker'
import MonthlyReportButtons from '../components/MonthlyReportButtons'
import Group from '../components/ui/Group'
import PageHeader from '../components/ui/PageHeader'
import Segmented from '../components/ui/Segmented'
import { EmptyState, ErrorNotice, ListSkeleton, Skeleton } from '../components/Feedback'
import { listCategories, listTransactionsInRange } from '../lib/db'
import { addMonths, monthKey, monthLabel, monthStart, shortMonthLabel, toIsoDate } from '../lib/dates'
import Money from '../components/Money'
import { usePrivacy } from '../context/privacyContext'
import HiddenChartNotice from '../components/HiddenChartNotice'
import { eur, eurSigned } from '../lib/format'

// Cores pelos tokens de index.css (com par claro/escuro).
const INCOME_COLOR = 'var(--positive)'
const EXPENSE_COLOR = 'var(--negative)'
const BAR_COLOR = 'var(--accent)' // magnitude das barras de gasto, não identidade
const AXIS_COLOR = 'var(--label-2)'
const GRID_COLOR = 'var(--separator)'

const BREAKDOWN_TABS = [
  { value: 'expense', label: 'Gastos' },
  { value: 'income', label: 'Ganhos' },
]

// Total por categoria dos movimentos de um tipo, do maior para o menor — cada
// categoria guarda também as suas transações, para o drill-down ao clicar.
function breakdownByCategory(bucket, type) {
  if (!bucket) return []
  const groups = new Map()
  for (const tx of bucket.txs) {
    if (tx.type !== type) continue
    const name = tx.categories?.name ?? 'Sem categoria'
    if (!groups.has(name)) groups.set(name, { name, amount: 0, txs: [] })
    const g = groups.get(name)
    g.amount += Number(tx.amount)
    g.txs.push(tx)
  }
  return [...groups.values()].sort((a, b) => b.amount - a.amount)
}

// Lista de barras por categoria com o total no fim (partilhada por gastos e
// ganhos) — cada categoria é clicável e abre o detalhe das transações.
function CategoryBars({ items, color, onSelectCategory }) {
  const max = items[0]?.amount ?? 0
  return (
    <ul className="grouped overflow-hidden rounded-group bg-surface">
      {items.map((c) => (
        <li key={c.name}>
          <button
            type="button"
            onClick={() => onSelectCategory(c)}
            className="pressable block min-h-11 w-full px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[1.0625rem] text-label">{c.name}</span>
              <span className="amount shrink-0 text-[1.0625rem] font-medium text-label">
                <Money value={c.amount} />
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-fill">
              <div
                className="h-full rounded-full"
                style={{ width: `${(c.amount / max) * 100}%`, backgroundColor: color }}
              />
            </div>
          </button>
        </li>
      ))}
      <li className="flex min-h-11 items-center justify-between gap-3 px-4 py-2.5 text-[1.0625rem] font-semibold text-label">
        <span>Total</span>
        <span className="amount">
          <Money value={items.reduce((sum, c) => sum + c.amount, 0)} />
        </span>
      </li>
    </ul>
  )
}

export default function Balance() {
  const { hidden } = usePrivacy()
  const navigate = useNavigate()
  const [selectedMonth, setSelectedMonth] = useState(() => monthStart(new Date()))
  const [sixMonthData, setSixMonthData] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [breakdownTab, setBreakdownTab] = useState('expense')
  const [drilldownCategory, setDrilldownCategory] = useState(null)

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

  const categoryBreakdown = useMemo(() => breakdownByCategory(selectedBucket, 'expense'), [selectedBucket])
  const incomeBreakdown = useMemo(() => breakdownByCategory(selectedBucket, 'income'), [selectedBucket])

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

  // Tudo o que o relatório precisa já está calculado para o ecrã — exportar não
  // faz pedidos novos nem recalcula nada por outro caminho (um relatório que
  // discordasse do que está no ecrã seria pior do que não existir).
  const report = useMemo(
    () => ({
      monthLabel: monthLabel(selectedMonth),
      monthKey: monthKey(selectedMonth),
      income: selectedBucket?.income ?? 0,
      expense: selectedBucket?.expense ?? 0,
      savingsAmount,
      expenseByCategory: categoryBreakdown,
      incomeByCategory: incomeBreakdown,
      transactions: selectedBucket?.txs ?? [],
      evolution: sixMonthData.map((b) => ({
        label: shortMonthLabel(b.date),
        income: b.income,
        expense: b.expense,
      })),
    }),
    [selectedMonth, selectedBucket, savingsAmount, categoryBreakdown, incomeBreakdown, sixMonthData],
  )

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader title="Balanço" />
        <Skeleton className="h-11" />
        <Skeleton className="h-44" />
        <Skeleton className="h-56" />
        <ListSkeleton rows={4} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader title="Balanço" />
        <ErrorNotice message={error} />
      </div>
    )
  }

  const income = selectedBucket?.income ?? 0
  const expense = selectedBucket?.expense ?? 0
  const saldo = income - expense
  // Abaixo de meio cêntimo é zero: a soma em vírgula flutuante pode dar
  // -0,0000…1 e pintar de vermelho um mês que ficou exatamente a zeros.
  const saldoTone = Math.abs(saldo) < 0.005 ? 'text-label' : saldo > 0 ? 'text-positive' : 'text-negative'

  return (
    <div className="space-y-8">
      <PageHeader title="Balanço" />

      <MonthPicker value={selectedMonth} onChange={setSelectedMonth} disableFuture />

      {/* Um só bloco para o mês: o saldo é o número principal, ganhos e gastos
          vêm por baixo como apoio, e as duas frases de contexto ficam dentro do
          mesmo bloco — antes eram três mini-cartões com valores a 14 px e
          frases soltas por cima, sem ligação visível aos números. */}
      <section aria-label="Resumo do mês" className="rounded-group bg-surface p-5">
        <p className="text-[0.8125rem] font-medium text-label-2">Saldo do mês</p>
        <p className={`amount display mt-1 truncate text-[2.5rem] leading-none font-bold tracking-tight ${saldoTone}`}>
          <Money>{eurSigned(saldo)}</Money>
        </p>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t-[0.5px] border-separator pt-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[0.8125rem] text-label-2">
              <ArrowDownLeft size={15} strokeWidth={2.4} aria-hidden="true" className="text-positive" />
              Ganhos
            </p>
            <p className="amount mt-0.5 truncate text-[1.25rem] font-semibold tracking-tight text-label">
              <Money value={income} />
            </p>
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[0.8125rem] text-label-2">
              <ArrowUpRight size={15} strokeWidth={2.4} aria-hidden="true" className="text-negative" />
              Gastos
            </p>
            <p className="amount mt-0.5 truncate text-[1.25rem] font-semibold tracking-tight text-label">
              <Money value={expense} />
            </p>
          </div>
        </div>

        {(monthSummary || savingsAmount > 0) && (
          <div className="mt-4 space-y-1 text-[0.8125rem] leading-snug text-label-2">
            {monthSummary && <p>{monthSummary}</p>}
            {savingsAmount > 0 && (
              <p>
                Dessas, <Money value={savingsAmount} /> foram para poupança/investimento — não contam como
                gasto do dia a dia.
              </p>
            )}
          </div>
        )}
      </section>

      <MonthCalendar monthDate={selectedMonth} transactions={selectedBucket?.txs ?? []} />

      {insights.length > 0 && (
        <Group header="Insights" list inset="3rem">
          {insights.map((i) => (
            <li key={i.name} className="flex items-start gap-3 px-4 py-3">
              <TrendingUp size={20} strokeWidth={2.1} aria-hidden="true" className="mt-0.5 shrink-0 text-warning" />
              <p className="text-[0.9375rem] leading-snug text-label">
                Gastaste {i.diffPct}% mais em <strong className="font-semibold">{i.name}</strong> este mês do que a
                média dos 3 meses anteriores.
              </p>
            </li>
          ))}
        </Group>
      )}

      <section aria-label="Por categoria" className="space-y-3">
        <div className="px-4">
          <h2 className="text-[0.8125rem] font-semibold tracking-wide text-label-2 uppercase">Por categoria</h2>
        </div>
        <Segmented label="Tipo de movimento" options={BREAKDOWN_TABS} value={breakdownTab} onChange={setBreakdownTab} />

        {breakdownTab === 'expense' ? (
          categoryBreakdown.length === 0 ? (
            <EmptyState
              title="Sem gastos neste mês"
              description="Quando registares gastos, vês aqui para onde vai o dinheiro."
              actionLabel="Registar um gasto"
              onAction={() => navigate('/')}
            />
          ) : (
            <CategoryBars items={categoryBreakdown} color={BAR_COLOR} onSelectCategory={setDrilldownCategory} />
          )
        ) : incomeBreakdown.length === 0 ? (
          <EmptyState title="Sem ganhos neste mês" />
        ) : (
          <CategoryBars items={incomeBreakdown} color={INCOME_COLOR} onSelectCategory={setDrilldownCategory} />
        )}
      </section>

      <CategoryDrilldownModal
        category={drilldownCategory}
        color={breakdownTab === 'expense' ? BAR_COLOR : INCOME_COLOR}
        onClose={() => setDrilldownCategory(null)}
      />

      <Group header="Evolução" footer="Seis meses, a terminar no mês selecionado.">
        <div className="h-56 w-full">
          {hidden ? (
            <HiddenChartNotice />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: AXIS_COLOR }}
                  axisLine={{ stroke: GRID_COLOR }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: AXIS_COLOR }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  formatter={(value) => eur(Number(value))}
                  cursor={{ fill: 'var(--fill)' }}
                  contentStyle={{
                    fontSize: 13,
                    borderRadius: 12,
                    border: '0.5px solid var(--separator)',
                    backgroundColor: 'var(--surface-raised)',
                    boxShadow: 'var(--shadow-raised)',
                  }}
                  labelStyle={{ color: 'var(--label-2)', fontWeight: 600, marginBottom: 2 }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--label-2)' }} />
                <Bar dataKey="Ganhos" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gastos" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Group>

      <MonthlyReportButtons report={report} monthKey={monthKey(selectedMonth)} />
    </div>
  )
}
