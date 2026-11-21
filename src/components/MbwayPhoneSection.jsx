import { t } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import { useToast } from '../context/toastContext'
import { getMyMbwayPhone, saveMbwayPhone } from '../lib/friendsDb'
import { focusRing } from './ui/styles'

// O número que aparece nos lembretes de WhatsApp/SMS para os amigos pagarem por MB Way.
export default function MbwayPhoneSection() {
  const toast = useToast()
  const [value, setValue] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    getMyMbwayPhone()
      .then((phone) => {
        if (mounted.current) setValue(phone ?? '')
      })
      .catch((err) => {
        if (mounted.current) setError(err.message || t('phone.loadFailed'))
      })
      .finally(() => {
        if (mounted.current) setLoaded(true)
      })
    return () => {
      mounted.current = false
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await saveMbwayPhone(value)
      if (mounted.current) {
        toast.success(value.trim() === '' ? t('mbway.removed') : t('mbway.saved'))
      }
    } catch (err) {
      if (mounted.current) setError(err.message || t('phone.saveFailed'))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <div className="border-t border-separator pt-4">
      <form onSubmit={handleSubmit} className="space-y-2">
        <label htmlFor="my-mbway" className="block text-xs font-medium text-label-2">
          {t('mbway.mine')}
        </label>
        <p className="text-xs text-label-2">{t('mbway.help')}</p>
        <div className="flex gap-2">
          <input
            id="my-mbway"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder={t('fr.phonePlaceholder')}
            value={value}
            disabled={!loaded || busy}
            onChange={(e) => setValue(e.target.value)}
            className={`min-h-11 min-w-0 flex-1 rounded-control border-0 bg-fill px-3.5 text-label focus:ring-2 focus:ring-accent transition-colors duration-150 ease-out disabled:opacity-50 motion-reduce:transition-none ${focusRing}`}
          />
          <button
            type="submit"
            disabled={busy || !loaded}
            className={`min-h-11 rounded-control bg-accent-fill px-4 text-sm font-medium text-white transition duration-150 ease-out active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing}`}
          >
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}
