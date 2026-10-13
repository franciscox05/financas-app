// Valores em cêntimos para evitar erros de vírgula flutuante (16.5 - 15 = 1.5).
const cents = (value) => Math.round(Number(value) * 100)

export function paidTotal(payments) {
  return payments.reduce((sum, p) => sum + cents(p.amount), 0) / 100
}

// Quanto falta pagar. Dívidas acertadas valem sempre 0.
export function remainingOf(debt, payments) {
  if (debt.status === 'settled') return 0
  return Math.max(0, cents(debt.amount) - cents(paidTotal(payments))) / 100
}
