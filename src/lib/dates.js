export function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1)
}

// Formata em hora LOCAL (YYYY-MM-DD). toISOString() converte para UTC e, num fuso
// com offset positivo (ex.: Portugal no verão), faz recuar a meia-noite local para
// o dia anterior (1 de outubro 00:00 -> "09-30").
export function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function today() {
  return toIsoDate(new Date())
}

export function monthLabel(date) {
  const label = date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export function shortMonthLabel(date) {
  return date.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '')
}
