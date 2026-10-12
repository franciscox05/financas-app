import { useMemo, useState } from 'react'

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function eur(value) {
  return `${Number(value).toFixed(2)} €`
}

// Calendário do mês selecionado: cada dia mostra o saldo líquido desse dia
// (ganhos - gastos; verde se ≥0, vermelho se negativo), e clicar num dia
// revela as transações desse dia ao detalhe. occurred_on já vem em
// "YYYY-MM-DD", por isso o dia é lido diretamente da string — sem criar Date
// e sem risco do bug de fuso horário que já apanhámos noutro sítio (ver
// lib/dates.js).
export default function MonthCalendar({ monthDate, transactions }) {
  const [selectedDay, setSelectedDay] = useState(null)

  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
  const firstWeekday = (new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay() + 6) % 7

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
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-xs transition-colors ${
                  isSelected
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : entry
                      ? 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700'
                      : 'text-neutral-400'
                }`}
              >
                <span>{day}</span>
                {entry && (
                  <span
                    className={`text-[9px] ${
                      isSelected ? '' : entry.income - entry.expense >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {entry.income - entry.expense >= 0 ? '+' : ''}
                    {(entry.income - entry.expense).toFixed(0)}€
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
                      {tx.categories?.name ?? 'Sem categoria'}
                      {tx.note ? ` · ${tx.note}` : ''}
                    </span>
                    <span
                      className={`shrink-0 font-medium ${
                        tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {eur(tx.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
