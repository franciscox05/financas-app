import { eur } from './format.js'

// Devolução maior que o saldo: o excedente passa a ser dívida do outro lado.
// Devolve o aviso informativo (não bloqueia) ou null se não ultrapassa.
export function overshootNote(kind, balance, amount) {
  const overshoot = Math.round(Math.abs(Number(amount)) * 100) - Math.round(Math.abs(Number(balance)) * 100)
  if (!(overshoot > 0)) return null
  const x = eur(overshoot / 100)
  return kind === 'repaid_to_me' ? `Passa a ficar ele a dever-te ${x}` : `Passa a ficar a dever-lhe ${x}`
}

// Categoria por defeito (como em Debts.jsx): "Outros Ganhos" para ganhos,
// "Outros Gastos" para gastos; senão a primeira do tipo; senão ''.
export function defaultCategoryId(categories, kind) {
  const type = kind === 'repaid_to_me' ? 'income' : 'expense'
  const name = type === 'income' ? 'Outros Ganhos' : 'Outros Gastos'
  const ofType = categories.filter((c) => c.type === type)
  return (ofType.find((c) => c.name === name) ?? ofType[0])?.id ?? ''
}
