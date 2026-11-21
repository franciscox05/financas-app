import { Repeat } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../context/toastContext'
import { useT } from '../i18n'
import { today } from '../lib/dates'
import { launchRecurring, listRecurring } from '../lib/db'
import { eur } from '../lib/format'
import { dueRecurring, monthOf, occurrenceDate } from '../lib/recurring'
import Money from './Money'
import { focusRing, primaryButton } from './ui/styles'

// Registo → recorrentes cujo dia já chegou e ainda não foram lançados este mês.
// Lançar cria a transação com a data do dia do recorrente (não a de hoje).
// Sem nada por lançar, não ocupa espaço.
export default function RecurringDueCard({ onLaunched }) {
  const t = useT()
  const toast = useToast()
  const [list, setList] = useState([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    listRecurring()
      .then(setList)
      .catch(() => setList([])) // sem a tabela ou sem rede: o Registo continua normal
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const now = today()
  const due = dueRecurring(list, now)
  if (due.length === 0) return null

  async function launch(items) {
    setBusy(true)
    let launched = 0
    try {
      for (const rec of items) {
        const result = await launchRecurring(rec, monthOf(now), occurrenceDate(rec, now))
        if (result.alreadyLaunched) toast.error(t('rec.due.already'))
        else launched += 1
      }
      if (launched === 1 && items.length === 1) {
        toast.success(t('rec.due.launched', { name: items[0].note || items[0].categories?.name || '' }))
      } else if (launched > 0) {
        toast.success(t('rec.due.launchedMany', { n: launched }))
      }
    } catch (err) {
      toast.error(t('rec.due.error', { message: err.message }))
    } finally {
      setBusy(false)
      load()
      if (launched > 0) onLaunched?.()
    }
  }

  const actionClass = `min-h-11 shrink-0 rounded-control px-3 text-[0.9375rem] font-semibold text-accent disabled:opacity-50 ${focusRing}`

  return (
    <section aria-label={t('rec.due.title')} className="rounded-group bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold text-label">
          <Repeat size={18} strokeWidth={2.2} aria-hidden="true" className="text-accent" />
          {t('rec.due.title')}
        </h2>
        <Link to="/gestao#recorrentes" className={`-mr-2 ${actionClass} inline-flex items-center font-medium`}>
          {t('rec.due.manage')}
        </Link>
      </div>
      <ul className="mt-2 divide-y divide-separator">
        {due.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9375rem] text-label">{r.note || r.categories?.name}</p>
              <p className="truncate text-xs text-label-2">
                {t('rec.dayOf', { day: r.day_of_month })} · {r.accounts?.name}
              </p>
            </div>
            <span className={`amount shrink-0 text-sm font-semibold ${r.type === 'income' ? 'text-positive' : 'text-negative'}`}>
              <Money>{`${r.type === 'income' ? '+' : '-'}${eur(r.amount)}`}</Money>
            </span>
            <button type="button" disabled={busy} onClick={() => launch([r])} className={`-mr-2 bg-fill ${actionClass}`}>
              {t('rec.due.launch')}
            </button>
          </li>
        ))}
      </ul>
      {due.length > 1 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => launch(due)}
          className={`${primaryButton} mt-2 w-full`}
        >
          {t('rec.due.launchAll')}
        </button>
      )}
    </section>
  )
}
