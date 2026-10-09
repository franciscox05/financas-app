import { Bell, BellOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getExistingSubscription, isPushSupported, subscribeToPush, unsubscribeFromPush } from '../lib/push'

export default function NotificationToggle() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const ok = isPushSupported()
    setSupported(ok)
    if (ok) {
      getExistingSubscription().then((sub) => setSubscribed(!!sub))
    }
  }, [])

  async function handleToggle() {
    setBusy(true)
    setError('')
    try {
      if (subscribed) {
        await unsubscribeFromPush()
        setSubscribed(false)
      } else {
        await subscribeToPush()
        setSubscribed(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!supported) return null

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        disabled={busy}
        title={subscribed ? 'Desativar lembretes' : 'Ativar lembrete diário'}
        className="rounded-lg border border-neutral-300 p-1.5 disabled:opacity-50 dark:border-neutral-700"
      >
        {subscribed ? <Bell size={16} /> : <BellOff size={16} className="text-neutral-400" />}
      </button>
      {error && (
        <p className="absolute right-0 top-full mt-1 w-48 text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
