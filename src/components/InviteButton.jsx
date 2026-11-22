import { MessageCircle } from 'lucide-react'
import { useT } from '../i18n'
import { normalizePhone, whatsappUrl } from '../lib/contactMessage'
import { focusRing } from './ui/styles'

// Para amigos que ainda não estão ligados: convite por WhatsApp para instalarem
// a Stingy. Sem telemóvel guardado, o WhatsApp deixa escolher o contacto.
export default function InviteButton({ friend }) {
  const t = useT()
  const text = t('invite.text', { name: friend.name, url: window.location.origin })
  const href = whatsappUrl(normalizePhone(friend.phone), text)

  return (
    <div className="space-y-2">
      <p className="px-1 text-[0.8125rem] leading-snug text-label-2">{t('invite.hint', { name: friend.name })}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className={`flex min-h-11 items-center justify-center gap-2 rounded-control border border-separator px-4 text-[0.9375rem] font-medium text-label transition-colors hover:bg-fill ${focusRing}`}
      >
        <MessageCircle size={16} aria-hidden="true" /> {t('invite.button')}
      </a>
    </div>
  )
}
