import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { addMonths, monthKey, monthLabel, monthStart } from '../lib/dates'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// Navegação por mês (< Mês Ano >) com um "ir para" de mês+ano, partilhada
// entre o Balanço e a lista de Transações recentes do Registo.
export default function MonthPicker({ value, onChange, disableFuture = false }) {
  const [showJump, setShowJump] = useState(false)
  const [jumpMonth, setJumpMonth] = useState(value.getMonth() + 1)
  const [jumpYear, setJumpYear] = useState(value.getFullYear())

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear()
    return [current, current - 1, current - 2, current - 3, current - 4]
  }, [])

  function openJump() {
    setJumpMonth(value.getMonth() + 1)
    setJumpYear(value.getFullYear())
    setShowJump((v) => !v)
  }

  function handleJump(e) {
    e.preventDefault()
    onChange(new Date(jumpYear, jumpMonth - 1, 1))
    setShowJump(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChange(addMonths(value, -1))}
          className="rounded-lg border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={openJump}
          className="rounded-lg px-2 py-1 text-sm font-semibold text-neutral-700 underline-offset-2 hover:underline dark:text-neutral-300"
        >
          {monthLabel(value)}
        </button>
        <button
          type="button"
          onClick={() => onChange(addMonths(value, 1))}
          disabled={disableFuture && monthKey(value) === monthKey(monthStart(new Date()))}
          className="rounded-lg border border-neutral-300 px-3 py-1 text-sm disabled:opacity-30 dark:border-neutral-700"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {showJump && (
        <form
          onSubmit={handleJump}
          className="flex items-center gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
        >
          <select
            value={jumpMonth}
            onChange={(e) => setJumpMonth(Number(e.target.value))}
            className="flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={jumpYear}
            onChange={(e) => setJumpYear(Number(e.target.value))}
            className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            Ir
          </button>
        </form>
      )}
    </div>
  )
}
