import { useMemo, useState } from 'react'
import { eurCompact, eurSigned } from '../lib/format'
import Money from './Money'

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

// Resumo do dia aberto: num dia só de gastos (ou só de ganhos) basta o total;
// num dia misto discrimina Ganhos / Gastos / Saldo, porque o número da célula
// do calendário é só o saldo líquido e não diz de onde vem.
function DaySummary({ entry }) {
  const net = entry.income - entry.expense
  const mixed = entry.income > 0 && entry.expense > 0
  return (
    <dl className="space-y-0.5 border-t border-neutral-200 pt-1.5 text-sm dark:border-neutral-800">
      {mixed ? (
        <>
          <SummaryRow label="Ganhos" tone="text-green-600">
            {eurSigned(entry.income)}
          </SummaryRow>
          <SummaryRow label="Gastos" tone="text-red-600">
            {eurSigned(-entry.expense)}
          </SummaryRow>
          <SummaryRow label="Saldo do dia" tone={net >= 0 ? 'text-green-600' : 'text-red-600'} bold>
            {eurSigned(net)}
          </SummaryRow>
        </>
      ) : (
        <SummaryRow label="Total do dia" tone={net >= 0 ? 'text-green-600' : 'text-red-600'} bold>
          {eurSigned(net)}
        </SummaryRow>
      )}
    </dl>
  )
}

function SummaryRow({ label, tone, bold = false, children }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className={`text-neutral-500 ${bold ? 'font-semibold' : ''}`}>{label}</dt>
      <dd className={`${tone} ${bold ? 'font-semibold' : 'font-medium'}`}>
        <Money>{children}</Money>
      </dd>
    </div>
  )
}

// Calendário do mês selecionado: o dia de hoje leva um anel azul à volta da
// célula (e o número a negrito), em vez de um ponto no canto — visível mesmo
// num dia sem transações, e sem depender só da cor. Cada dia mostra o saldo líquido desse dia
// (ganhos - gastos; verde se ≥0, vermelho se negativo), e clicar num dia
// revela as transações desse dia ao detalhe. occurred_on já vem em
// "YYYY-MM-DD", por isso o dia é lido diretamente da string — sem criar Date
// e sem risco do bug de fuso horário que já apanhámos noutro sítio (ver
// lib/dates.js).
export default function MonthCalendar({ monthDate, transactions }) {
  const [selectedDay, setSelectedDay] = useState(null)

  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
  const firstWeekday = (new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay() + 6) % 7

  const now = new Date()
  const isCurrentMonth = monthDate.getFullYear() === now.getFullYear() && monthDate.getMonth() === now.getMonth()
  const todayDay = now.getDate()

  const byDay = useMemo(() => {
    const map = new Map()
    for (const tx of transactions) {
      const day = Number(tx.occurred_on.slice(8, 10))
      const entry = map.get(day) ?? { income: 0, expense: 0, txs: [] }
      if (tx.type === 'income') entry.income += Number(tx.amount)
      else entry.expense += Number(tx.amount)
      entry.txs.push(tx)
      map.set(day, entry)
    }
    return map
  }, [transactions])

  const cells = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const selectedEntry = selectedDay ? byDay.get(selectedDay) : null

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-neutral-500">Calendário do mês</h3>

      <div className="space-y-3">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-neutral-400">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={`blank-${i}`} />
            const entry = byDay.get(day)
            const isSelected = selectedDay === day
            const isToday = isCurrentMonth && day === todayDay
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                aria-current={isToday ? 'date' : undefined}
                className={`relative flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-xs transition-colors ${
                  isToday ? 'ring-2 ring-blue-500 ring-inset' : ''
                } ${
                  isSelected
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : entry
                      ? 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700'
                      : 'text-neutral-400'
                }`}
              >
                <span
                  className={
                    isToday ? (isSelected ? 'font-bold' : 'font-bold text-blue-600 dark:text-blue-400') : undefined
                  }
                >
                  {day}
                </span>
                {entry && (
                  <span
                    className={`text-[9px] ${
                      isSelected ? '' : entry.income - entry.expense >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    <Money mask="••">{eurCompact(entry.income - entry.expense, { signed: true })}</Money>
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {selectedDay && (
          <div className="space-y-1.5 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
            <h4 className="text-xs font-semibold text-neutral-500">Dia {selectedDay}</h4>
            {!selectedEntry || selectedEntry.txs.length === 0 ? (
              <p className="py-1 text-center text-xs text-neutral-400">Sem transações.</p>
            ) : (
              <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {selectedEntry.txs.map((tx) => (
                  <li key={tx.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span className="min-w-0 truncate text-neutral-700 dark:text-neutral-300">
                      {tx.note || tx.categories?.name || 'Sem nota'}
                      {tx.note && ` · ${tx.categories?.name ?? 'Sem categoria'}`}
                    </span>
                    <span
                      className={`shrink-0 font-medium ${
                        tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      <Money value={tx.amount} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {selectedEntry && selectedEntry.txs.length > 1 && <DaySummary entry={selectedEntry} />}
          </div>
        )}
      </div>
    </section>
  )
}
