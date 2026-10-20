// Mensagem de lembrete e ligações de contacto (WhatsApp/SMS) para amigos.
import { eur } from './format.js'

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
