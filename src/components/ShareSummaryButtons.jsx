import { Copy, MessageCircle } from 'lucide-react'
import { useMemo } from 'react'
import { useToast } from '../context/toastContext'
import { ledgerSummaryText, normalizePhone, whatsappUrl } from '../lib/contactMessage'

const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2'

const whatsappClass = `${base} flex-1 border border-[#25d366] bg-[#dcf8c6] text-[#075e54] hover:bg-[#cdf2b0] focus-visible:outline-[#075e54] dark:border-[#25d366]/60 dark:bg-[#075e54]/40 dark:text-[#dcf8c6] dark:hover:bg-[#075e54]/60 dark:focus-visible:outline-[#dcf8c6]`

const copyClass = `${base} border border-neutral-300 text-neutral-800 hover:bg-neutral-100 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:focus-visible:outline-neutral-100`

// Resumo do histórico para partilhar fora da app — sobretudo útil com alguém
// que nunca vai instalar a app (ex. um familiar a quem se emprestou dinheiro
// uma vez só), para mostrar de forma clara o que ficou registado entre os dois.
export default function ShareSummaryButtons({ friend, balance, entries }) {
  const toast = useToast()

  const text = useMemo(
    () => ledgerSummaryText({ friendName: friend.name, entries, balance }),
    [friend.name, entries, balance],
  )

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Resumo copiado.')
    } catch {
      toast.error('Não foi possível copiar. Tenta outra vez.')
    }
  }

  return (
    <div className="flex gap-2">
      <a
        href={whatsappUrl(normalizePhone(friend.phone), text)}
        target="_blank"
        rel="noopener"
        className={whatsappClass}
      >
        <MessageCircle size={16} aria-hidden="true" /> Partilhar resumo
      </a>
      <button type="button" onClick={handleCopy} className={copyClass}>
        <Copy size={16} aria-hidden="true" /> Copiar
      </button>
    </div>
  )
}
