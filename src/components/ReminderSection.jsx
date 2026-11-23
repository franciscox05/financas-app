import { useEffect, useState } from 'react'
import { useToast } from '../context/toastContext'
import { useT } from '../i18n'
import { getReminderHour, saveReminderHour } from '../lib/profileDb'
import { getExistingSubscription, isPushSupported } from '../lib/push'
import { inputClass, labelClass } from './ui/styles'

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const label = (h) => `${String(h).padStart(2, '0')}:00`

// Perfil → Lembrete diário. Uma hora e mais nada (hora de Lisboa; o servidor
// resolve o horário de verão). Só aparece com as notificações ativas.
export default function ReminderSection() {
  const t = useT()
  const toast = useToast()
  const [supported] = useState(isPushSupported)
  const [subscribed, setSubscribed] = useState(false)
  const [hour, setHour] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    Promise.all([getExistingSubscription().catch(() => null), getReminderHour().catch(() => null)]).then(
      ([sub, h]) => {
        if (cancelled) return
        setSubscribed(!!sub && Notification.permission !== 'denied')
        setHour(h)
      },
    )
    return () => {
      cancelled = true
    }
  }, [supported])

  // Sem suporte push ou coluna ainda inexistente (migração por aplicar): nada a mostrar.
  if (!supported || hour === null) return null

  if (!subscribed) {
    return <p className="text-[0.9375rem] text-label-2">{t('reminder.needsNotif')}</p>
  }

  async function onChange(e) {
    const next = Number(e.target.value)
    const previous = hour
    setHour(next)
    setBusy(true)
    try {
      await saveReminderHour(next)
      toast.success(t('reminder.saved'))
    } catch {
      setHour(previous)
      toast.error(t('reminder.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <label htmlFor="profile-reminder-hour" className={labelClass}>
        {t('reminder.label')}
      </label>
      <select id="profile-reminder-hour" value={hour} disabled={busy} onChange={onChange} className={inputClass}>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {label(h)}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[0.8125rem] text-label-3">{t('reminder.help')}</p>
    </div>
  )
}
