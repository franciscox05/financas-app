import { MessageCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { normalizePhone, reminderText, smsUrl, whatsappUrl } from '../lib/contactMessage'
import { getMyMbwayPhone } from '../lib/friendsDb'
import { COUNTING_STATUSES } from '../lib/linkedLogic'

const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2'

const whatsappClass = `${base} flex-1 border border-[#25d366] bg-[#dcf8c6] text-[#075e54] hover:bg-[#cdf2b0] focus-visible:outline-[#075e54] dark:border-[#25d366]/60 dark:bg-[#075e54]/40 dark:text-[#dcf8c6] dark:hover:bg-[#075e54]/60 dark:focus-visible:outline-[#dcf8c6]`

const smsClass = `${base} border border-neutral-300 text-neutral-800 hover:bg-neutral-100 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:focus-visible:outline-neutral-100`

// Botões de lembrete para quando o amigo me deve dinheiro.
export default function ReminderButtons({ friend, balance, entries }) {
  const [mbwayPhone, setMbwayPhone] = useState(null)

  useEffect(() => {
    let active = true
    getMyMbwayPhone()
      .then((phone) => {
        if (active) setMbwayPhone(phone)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const { whatsapp, sms } = useMemo(() => {
    // As movimentos vêm do mais recente para o mais antigo.
    const note = entries.find((e) => e.kind === 'paid_for_them' && COUNTING_STATUSES.includes(e.status))?.note
    const text = reminderText({ friendName: friend.name, amount: balance, note, mbwayPhone })
    const phone = normalizePhone(friend.phone)
    return { whatsapp: whatsappUrl(phone, text), sms: smsUrl(phone, text) }
  }, [friend.name, friend.phone, balance, entries, mbwayPhone])

  return (
    <div className="flex gap-2">
      <a href={whatsapp} target="_blank" rel="noopener" className={whatsappClass}>
        <MessageCircle size={16} aria-hidden="true" /> Lembrar por WhatsApp
      </a>
      <a href={sms} className={smsClass}>
        SMS
      </a>
    </div>
  )
}
