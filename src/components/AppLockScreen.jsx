import { ScanFace } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import MascotTile from './MascotTile'
import { useAuth } from '../context/AuthContext'
import { useT } from '../i18n'
import { unlockApp } from '../lib/appLock'
import { primaryButton, textButton } from './ui/styles'

// Ecrã de bloqueio: aparece ao abrir a app quando o bloqueio está ligado.
// Tenta logo o Face ID; se a pessoa cancelar, fica o botão para tentar outra
// vez e a saída por "Entrar com a password" (termina sessão).
export default function AppLockScreen({ onUnlocked }) {
  const t = useT()
  const { user, signOut } = useAuth()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const tried = useRef(false)

  async function attempt() {
    setBusy(true)
    setError('')
    try {
      if (await unlockApp(user.id)) onUnlocked()
      else setError(t('lock.failed'))
    } catch {
      setError(t('lock.failed'))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (tried.current) return
    tried.current = true
    attempt()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só uma vez, ao abrir
  }, [])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas px-6 text-center">
      <MascotTile size={128} motion="enter" className="shadow-[var(--shadow-raised)]" />
      <div>
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-label">{t('lock.title')}</h1>
        <p className="mt-1 text-[0.9375rem] text-label-2">{t('lock.body')}</p>
      </div>
      <div className="w-full max-w-xs space-y-2">
        <button type="button" onClick={attempt} disabled={busy} className={`${primaryButton} flex w-full items-center justify-center gap-2`}>
          <ScanFace size={20} aria-hidden="true" />
          {t('lock.unlock')}
        </button>
        {error && (
          <p role="alert" className="text-[0.8125rem] text-negative">
            {error}
          </p>
        )}
        <button type="button" onClick={signOut} className={`${textButton} w-full`}>
          {t('lock.password')}
        </button>
      </div>
    </main>
  )
}
