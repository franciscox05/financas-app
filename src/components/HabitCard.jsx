import { Bell, Check, ChevronRight, Flame, PiggyBank, Wallet, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '../i18n'
import { isMilestone } from '../lib/streak'
import { getExistingSubscription, isPushSupported } from '../lib/push'
import Card from './Card'
import MascotTile from './MascotTile'
import { focusRing } from './ui/styles'

const STEPS_DISMISSED_KEY = 'stingy.firstSteps.dismissed'

function readDismissed() {
  try {
    return localStorage.getItem(STEPS_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

// Saber se as notificações já estão ligadas sem ficar à espera para sempre
// (sem service worker, `serviceWorker.ready` nunca resolve).
function useNotificationsOn() {
  const [on, setOn] = useState(null)
  useEffect(() => {
    if (!isPushSupported()) {
      setOn(false)
      return undefined
    }
    let active = true
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 2500))
    Promise.race([getExistingSubscription(), timeout])
      .then((sub) => active && setOn(Boolean(sub)))
      .catch(() => active && setOn(false))
    return () => {
      active = false
    }
  }, [])
  return on
}

// Sequência de dias seguidos a registar, com o mascote. Festeja nos marcos
// (3, 7, 14, 30... dias) e lembra quando ainda falta registar hoje.
export function StreakCard({ streak }) {
  const t = useT()
  if (!streak) return null
  const { days, loggedToday, best } = streak
  const celebrating = loggedToday && isMilestone(days)
  const title = days === 0 ? t('habit.startTitle') : t(days === 1 ? 'habit.days1' : 'habit.daysN', { n: days })
  const body = loggedToday
    ? celebrating
      ? t('habit.milestone', { n: days })
      : t('habit.doneToday')
    : days > 0
      ? t('habit.keepItUp')
      : t('habit.start')

  return (
    <Card as="section" aria-label={t('habit.aria')} className="flex items-center gap-4">
      <MascotTile size={64} motion={celebrating ? 'cheer' : 'idle'} key={celebrating ? 'c' : 'i'} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[1.0625rem] font-bold tracking-tight text-label">
          <Flame
            size={18}
            strokeWidth={2.3}
            aria-hidden="true"
            className={days > 0 ? 'text-warning' : 'text-label-3'}
          />
          {title}
        </p>
        <p className="mt-0.5 text-[0.8125rem] leading-snug text-label-2">{body}</p>
        {best > days && best > 1 && (
          <p className="mt-0.5 text-[0.75rem] text-label-3">{t('habit.best', { n: best })}</p>
        )}
      </div>
    </Card>
  )
}

// Primeiros passos para quem começa: registar, definir um orçamento e ligar o
// lembrete diário. Desaparece quando está tudo feito ou quando se fecha.
export function FirstSteps({ hasTransactions, hasBudget, onAddFirst }) {
  const t = useT()
  const notificationsOn = useNotificationsOn()
  const [dismissed, setDismissed] = useState(readDismissed)

  const steps = [
    { id: 'tx', done: hasTransactions, Icon: Wallet, label: t('steps.tx'), action: onAddFirst },
    { id: 'budget', done: hasBudget, Icon: PiggyBank, label: t('steps.budget'), to: '/gestao' },
    { id: 'notif', done: notificationsOn === true, Icon: Bell, label: t('steps.notif'), hint: t('steps.notifHint') },
  ]
  const doneCount = steps.filter((s) => s.done).length
  if (dismissed || notificationsOn === null || doneCount === steps.length) return null

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(STEPS_DISMISSED_KEY, '1')
    } catch {
      // não guardar não é grave: volta a aparecer na próxima visita
    }
  }

  return (
    <Card as="section" aria-label={t('steps.title')} className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <MascotTile size={48} motion="idle" />
          <div>
            <h2 className="text-[1.0625rem] font-bold tracking-tight text-label">{t('steps.title')}</h2>
            <p className="text-[0.8125rem] text-label-2">{t('steps.progress', { done: doneCount, total: steps.length })}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('steps.dismiss')}
          className={`pressable -mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-label-3 ${focusRing}`}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-fill" aria-hidden="true">
        <div
          className="h-full rounded-full bg-accent-fill transition-[width] duration-500 ease-out"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>
      <ul className="divide-y divide-separator">
        {steps.map(({ id, done, Icon, label, action, to, hint }) => {
          const content = (
            <>
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full ${done ? 'bg-positive/15 text-positive' : 'bg-fill text-label-2'}`}
              >
                {done ? <Check size={16} strokeWidth={2.6} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[0.9375rem] ${done ? 'text-label-3 line-through' : 'text-label'}`}>{label}</span>
                {!done && hint && <span className="block text-[0.75rem] text-label-3">{hint}</span>}
              </span>
              {!done && (action || to) && <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-label-3" />}
            </>
          )
          const rowClass = 'flex min-h-12 w-full items-center gap-3 py-2 text-left'
          if (!done && to) {
            return (
              <li key={id}>
                <Link to={to} className={`pressable ${rowClass} ${focusRing}`}>
                  {content}
                </Link>
              </li>
            )
          }
          if (!done && action) {
            return (
              <li key={id}>
                <button type="button" onClick={action} className={`pressable ${rowClass} ${focusRing}`}>
                  {content}
                </button>
              </li>
            )
          }
          return (
            <li key={id} className={rowClass}>
              {content}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
