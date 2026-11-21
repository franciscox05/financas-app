import { WifiOff } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { useT } from '../i18n'

function subscribe(callback) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

const getOnline = () => navigator.onLine

// Faixa discreta por baixo do cabeçalho quando o aparelho fica sem rede: os
// dados no ecrã podem estar desatualizados e gravar vai falhar. Desaparece
// sozinha quando a rede volta (o AppLayout já recarrega ao voltar à app).
export default function ConnectionBanner() {
  const t = useT()
  const online = useSyncExternalStore(subscribe, getOnline, () => true)
  if (online) return null
  return (
    <div role="status" className="mx-auto flex max-w-md items-center gap-2 px-4 pt-2 text-[0.8125rem] text-warning">
      <WifiOff size={15} strokeWidth={2.2} aria-hidden="true" className="shrink-0" />
      {t('net.offline')}
    </div>
  )
}
