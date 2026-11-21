import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/toastContext'
import { useT } from '../i18n'
import { disableAppLock, enableAppLock, isAppLockEnabled, isAppLockSupported } from '../lib/appLock'
import { focusRing } from './ui/styles'

// Perfil → Segurança: ligar/desligar o bloqueio com Face ID / impressão digital.
// Fica só neste aparelho (cada telemóvel liga o seu).
export default function AppLockSection() {
  const t = useT()
  const toast = useToast()
  const { user } = useAuth()
  const [supported, setSupported] = useState(null)
  const [enabled, setEnabled] = useState(() => isAppLockEnabled(user.id))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    isAppLockSupported().then((ok) => !cancelled && setSupported(ok))
    return () => {
      cancelled = true
    }
  }, [])

  async function toggle() {
    if (enabled) {
      disableAppLock(user.id)
      setEnabled(false)
      toast.success(t('lock.off'))
      return
    }
    setBusy(true)
    try {
      await enableAppLock(user)
      setEnabled(true)
      toast.success(t('lock.on'))
    } catch {
      toast.error(t('lock.enableFailed'))
    } finally {
      setBusy(false)
    }
  }

  if (supported === null) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p id="app-lock-label" className="text-[0.9375rem] font-medium text-label">
            {t('lock.setting')}
          </p>
          <p className="text-[0.8125rem] leading-snug text-label-2">
            {supported ? t('lock.settingHelp') : t('lock.unsupported')}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="app-lock-label"
          disabled={!supported || busy}
          onClick={toggle}
          className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40 ${
            enabled ? 'bg-positive' : 'bg-fill'
          } ${focusRing}`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow transition-transform duration-200 ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  )
}
