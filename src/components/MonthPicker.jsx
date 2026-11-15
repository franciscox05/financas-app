import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
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
          aria-label="Mês anterior"
          className="pressable flex size-11 items-center justify-center rounded-full text-accent"
        >
          <ChevronLeft size={24} strokeWidth={2.1} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={openJump}
          aria-expanded={showJump}
          className="pressable flex min-h-11 items-center gap-1 rounded-control px-3 text-[1.0625rem] font-semibold tracking-tight text-label"
        >
          {monthLabel(value)}
          <ChevronDown
            size={16}
            strokeWidth={2.4}
            aria-hidden="true"
            className={`text-label-3 transition-transform duration-200 ease-apple motion-reduce:transition-none ${showJump ? 'rotate-180' : ''}`}
          />
        </button>
        <button
          type="button"
          onClick={() => onChange(addMonths(value, 1))}
          disabled={disableFuture && monthKey(value) === monthKey(monthStart(new Date()))}
          aria-label="Mês seguinte"
          className="pressable flex size-11 items-center justify-center rounded-full text-accent disabled:text-label-3 disabled:opacity-50"
        >
          <ChevronRight size={24} strokeWidth={2.1} aria-hidden="true" />
        </button>
      </div>

      {showJump && (
        <form
          onSubmit={handleJump}
          className="flex items-center gap-2 rounded-control bg-fill p-2"
        >
          <select
            value={jumpMonth}
            onChange={(e) => setJumpMonth(Number(e.target.value))}
            aria-label="Mês"
            className="min-w-0 flex-1 rounded-[0.5625rem] border-0 bg-surface-raised px-3 text-label"
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
            aria-label="Ano"
            className="rounded-[0.5625rem] border-0 bg-surface-raised px-3 text-label"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="min-h-11 rounded-[0.5625rem] bg-accent-fill px-4 text-[0.9375rem] font-semibold text-white"
          >
            Ir
          </button>
        </form>
      )}
    </div>
  )
}
