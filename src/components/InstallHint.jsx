import { Share, X } from 'lucide-react'
import { useState } from 'react'
import { useT } from '../i18n'
import { focusRing } from './ui/styles'

const DISMISSED_KEY = 'stingy.installHint.dismissed'

function shouldShow() {
  try {
    if (localStorage.getItem(DISMISSED_KEY)) return false
  } catch {
    return false
  }
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
  if (standalone) return false
  // Só no iPhone/iPad com Safari: é onde instalar é um passo manual e escondido
  // (Partilhar → Adicionar ao ecrã principal). Noutros browsers o próprio
  // browser oferece a instalação.
  const ua = navigator.userAgent
  const iOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  return iOS
}

// Dica, uma vez, para instalar a app no ecrã principal do iPhone (a app
// instalada abre em ecrã inteiro e recebe notificações). Fecha-se e não volta.
export default function InstallHint() {
  const t = useT()
  const [visible, setVisible] = useState(shouldShow)
  if (!visible) return null

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // sem armazenamento: fecha só nesta visita
    }
    setVisible(false)
  }

  return (
    <aside className="flex items-start gap-3 rounded-group bg-surface p-4">
      <Share size={20} strokeWidth={2.1} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-semibold text-label">{t('install.title')}</p>
        <p className="text-[0.8125rem] leading-snug text-label-2">{t('install.body')}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('install.close')}
        className={`-mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-label-3 ${focusRing}`}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </aside>
  )
}
