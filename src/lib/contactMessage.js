// Mensagem de lembrete e ligações de contacto (WhatsApp/SMS) para amigos.
import { eur, shortDate } from './format.js'
import { entryLabel, signedCents } from './ledgerMath.js'
import { COUNTING_STATUSES } from './linkedLogic.js'

// Só dígitos com indicativo, que é o que o wa.me exige. 9 dígitos assumem
// Portugal (+351); "00" é o prefixo internacional equivalente a "+".
export function normalizePhone(raw) {
  if (raw == null) return null
  let digits = String(raw).replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 9) digits = `351${digits}`
  // E.164 vai de ~8 a 15 dígitos; abaixo de 9 sem indicativo não dá para usar.
  if (digits.length < 9 || digits.length > 15) return null
  return digits
}

// "912345678" -> "912 345 678" para ler bem na mensagem; outros formatos ficam como vieram.
function formatMbway(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('351')) digits = digits.slice(3)
  if (digits.length === 9) return digits.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')
  return String(raw ?? '').trim()
}

// "351912345678" -> "912 345 678"; números estrangeiros ficam como
// guardados, com "+" à frente.
export function formatPhoneDisplay(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 12 && digits.startsWith('351')) {
    return digits.slice(3).replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')
  }
  return `+${digits}`
}

export function reminderText({ friendName, amount, note, mbwayPhone }) {
  const detail = note ? ` (${note})` : ''
  const ask = mbwayPhone
    ? `Podes enviar por MB Way para ${formatMbway(mbwayPhone)} quando puderes?`
    : 'Podes enviar quando puderes?'
  return `Olá ${friendName}! Ficou pendente ${eur(amount)}${detail}. ${ask} Obrigado!`
}

// Sem telefone o link abre na mesma, deixando o utilizador escolher o contacto.
export function whatsappUrl(phone, text) {
  return `https://wa.me/${phone ?? ''}?text=${encodeURIComponent(text)}`
}

// "?&body=" funciona tanto em iOS como em Android.
export function smsUrl(phone, text) {
  return `sms:${phone ? `+${phone}` : ''}?&body=${encodeURIComponent(text)}`
}

// Resumo em texto simples do conta-corrente com um amigo, para partilhar por
// WhatsApp/SMS ou copiar — útil para quem nunca vai instalar a app (ex. um
// familiar a quem se emprestou dinheiro uma vez). Só os movimentos que contam
// para o saldo entram no resumo; `entries` já vem do mais recente ao mais antigo.
export function ledgerSummaryText({ friendName, entries, balance }) {
  const lines = entries
    .filter((e) => COUNTING_STATUSES.includes(e.status ?? 'confirmed'))
    .map((e) => {
      const amount = signedCents(e.kind, e.amount) / 100
      const sign = amount >= 0 ? '+' : '-'
      return `${shortDate(e.occurred_on, { withYear: true })} · ${e.note || entryLabel(e.kind)}: ${sign}${eur(Math.abs(amount))}`
    })

  const balanceLine =
    Math.abs(balance) < 0.005
      ? 'Estão quites.'
      : balance > 0
        ? `Saldo atual: ${friendName} deve-te ${eur(balance)}.`
        : `Saldo atual: deves ${eur(Math.abs(balance))} a ${friendName}.`

  return [`Conta-corrente com ${friendName} — FinançasApp`, '', ...lines, '', balanceLine].join('\n')
}
