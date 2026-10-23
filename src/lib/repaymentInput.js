import { eur } from './format.js'

// Devolução maior que o saldo: o excedente passa a ser dívida do outro lado.
// Devolve o aviso informativo (não bloqueia) ou null se não ultrapassa.
export function overshootNote(kind, balance, amount) {
  const overshoot = Math.round(Math.abs(Number(amount)) * 100) - Math.round(Math.abs(Number(balance)) * 100)
  if (!(overshoot > 0)) return null
  const x = eur(overshoot / 100)
  return kind === 'repaid_to_me' ? `Passa a ficar a dever-lhe ${x}` : `Passa a ficar a dever-te ${x}`
}

// Categoria por defeito para uma devolução: "Devoluções"/"Empréstimos" (dedicadas); se o
// utilizador ainda não as tiver (criado antes desta categoria existir), cai em
// "Outros Ganhos"/"Outros Gastos"; por fim a primeira do tipo; senão ''.
export function defaultCategoryId(categories, kind) {
  const type = kind === 'repaid_to_me' ? 'income' : 'expense'
  const names = type === 'income' ? ['Devoluções', 'Outros Ganhos'] : ['Empréstimos', 'Outros Gastos']
  const ofType = categories.filter((c) => c.type === type)
  for (const name of names) {
    const match = ofType.find((c) => c.name === name)
    if (match) return match.id
  }
  return ofType[0]?.id ?? ''
}
