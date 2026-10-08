export function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1)
}

export function toIsoDate(date) {
  return date.toISOString().slice(0, 10)
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
