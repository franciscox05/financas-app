import { Bell, BellOff } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../context/toastContext'
import { getExistingSubscription, isPushSupported, subscribeToPush, unsubscribeFromPush } from '../lib/push'
import { t } from '../i18n'

const BLOCKED_MESSAGE =
  'notif.blockedHelp'

export default function NotificationToggle() {
  const toast = useToast()
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [busy, setBusy] = useState(false)

  // O estado vem sempre do browser (permissão + subscrição), não de memória:
  // assim, se a pessoa mudar a permissão nas Definições e voltar à app, o
  // botão acompanha sem precisar de recarregar.
  const refresh = useCallback(async () => {
    const ok = isPushSupported()
    setSupported(ok)
    if (!ok) return
    const denied = Notification.permission === 'denied'
    setBlocked(denied)
    try {
      const sub = await getExistingSubscription()
      setSubscribed(!!sub && !denied)
    } catch {
      setSubscribed(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  async function handleToggle() {
    if (busy) return
    // Depois de "Não permitir" o browser nunca volta a perguntar; o pedido
    // falharia sempre em silêncio. Explica onde se desbloqueia.
    if (!subscribed && Notification.permission === 'denied') {
      setBlocked(true)
      toast.info(t(BLOCKED_MESSAGE))
      return
    }
    setBusy(true)
    try {
      if (subscribed) {
        await unsubscribeFromPush()
        setSubscribed(false)
        toast.info(t('notif.off'))
      } else {
        await subscribeToPush()
        setSubscribed(true)
        toast.success(t('notif.on'))
      }
    } catch (err) {
      if (Notification.permission === 'denied') {
        setBlocked(true)
        toast.info(t(BLOCKED_MESSAGE))
      } else {
        toast.error(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!supported) return null

  const title = blocked
    ? t('notif.blocked')
    : subscribed
      ? t('notif.disable')
      : t('notif.enable')

  return (
    <button
      onClick={handleToggle}
      disabled={busy}
      title={title}
      aria-label={title}
      aria-pressed={subscribed}
      className="pressable flex size-11 shrink-0 items-center justify-center rounded-full text-label-2 disabled:opacity-50"
    >
      {subscribed ? (
        <Bell size={21} strokeWidth={1.9} aria-hidden="true" className="text-accent" />
      ) : (
        <BellOff size={21} strokeWidth={1.9} aria-hidden="true" className={blocked ? 'text-negative' : ''} />
      )}
    </button>
  )
}
