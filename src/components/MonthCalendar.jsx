import { languageInfo, t } from '../i18n'
import { useMemo, useState } from 'react'
import { eurCompact, eurSigned } from '../lib/format'
import Money from './Money'
import Card from './Card'

// Dias da semana (segunda primeiro) no idioma ativo; 1/1/2024 foi uma segunda-feira.
function weekdayLabels() {
  return Array.from({ length: 7 }, (_, i) => {
    const s = new Date(2024, 0, 1 + i).toLocaleDateString(languageInfo().locale, { weekday: 'short' }).replace('.', '')
    return s.charAt(0).toUpperCase() + s.slice(1, 3)
  })
}

// Resumo do dia aberto: num dia só de gastos (ou só de ganhos) basta o total;
// num dia misto discrimina Ganhos / Gastos / Saldo, porque o número da célula
// do calendário é só o saldo líquido e não diz de onde vem.
function DaySummary({ entry }) {
  const net = entry.income - entry.expense
  const mixed = entry.income > 0 && entry.expense > 0
  return (
    <dl className="space-y-0.5 border-t border-separator pt-1.5 text-sm">
      {mixed ? (
        <>
          <SummaryRow label={t('list.incomes')} tone="text-positive">
            {eurSigned(entry.income)}
          </SummaryRow>
          <SummaryRow label={t('list.expenses')} tone="text-negative">
            {eurSigned(-entry.expense)}
          </SummaryRow>
          <SummaryRow label={t('cal.dayBalance')} tone={net >= 0 ? 'text-positive' : 'text-negative'} bold>
            {eurSigned(net)}
          </SummaryRow>
        </>
      ) : (
        <SummaryRow label={t('cal.dayTotal')} tone={net >= 0 ? 'text-positive' : 'text-negative'} bold>
          {eurSigned(net)}
        </SummaryRow>
      )}
    </dl>
  )
}

function SummaryRow({ label, tone, bold = false, children }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className={`text-label-2 ${bold ? 'font-semibold' : ''}`}>{label}</dt>
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
    <Card as="section" className="space-y-3">
      <h3 className="text-center text-sm font-semibold text-label-2">{t('cal.title')}</h3>

      <div className="space-y-3">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-label-3">
          {weekdayLabels().map((label) => (
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
                className={`relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-control py-1 text-[0.8125rem] transition-colors ${
                  isToday ? 'ring-2 ring-accent ring-inset' : ''
                } ${
                  isSelected
                    ? 'bg-accent-fill text-white'
                    : entry
                      ? 'bg-fill hover:bg-fill-strong'
                      : 'text-label-3'
                }`}
              >
                <span
                  className={
                    isToday ? (isSelected ? 'font-bold' : 'font-bold text-label dark:text-white') : undefined
                  }
                >
                  {day}
                </span>
                {entry && (
                  <span
                    className={`text-[9px] ${
                      isSelected ? '' : entry.income - entry.expense >= 0 ? 'text-positive' : 'text-negative'
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
          <div className="space-y-1.5 rounded-control border border-separator p-2">
            <h4 className="text-xs font-semibold text-label-2">{t('cal.day', { day: selectedDay })}</h4>
            {!selectedEntry || selectedEntry.txs.length === 0 ? (
              <p className="py-1 text-center text-xs text-label-3">{t('cal.noTx')}</p>
            ) : (
              <ul className="divide-y divide-separator">
                {selectedEntry.txs.map((tx) => (
                  <li key={tx.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span className="min-w-0 truncate text-label">
                      {tx.note || tx.categories?.name || t('common.noNote')}
                      {tx.note && ` · ${tx.categories?.name ?? t('common.noCategory')}`}
                    </span>
                    <span
                      className={`shrink-0 font-medium ${
                        tx.type === 'income' ? 'text-positive' : 'text-negative'
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
    </Card>
  )
}
