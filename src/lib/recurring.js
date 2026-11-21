// Movimentos recorrentes (tabela `recurring_transactions`): modelos que o
// utilizador lança com um toque quando chega o dia. Sem cron: o Registo mostra
// os que estão por lançar neste mês.
//
// - `day_of_month` vai de 1 a 28 (existe em todos os meses).
// - `last_generated_month` é o dia 1 do último mês em que foi lançado; um
//   recorrente já lançado este mês não volta a aparecer até ao mês seguinte.
// - Datas sempre como texto 'AAAA-MM-DD' (sem passar por Date em UTC).

export function monthOf(isoDate) {
  return `${isoDate.slice(0, 7)}-01`
}

// Data do lançamento neste mês: o dia do recorrente dentro do mês de `isoToday`.
export function occurrenceDate(rec, isoToday) {
  return `${isoToday.slice(0, 7)}-${String(rec.day_of_month).padStart(2, '0')}`
}

export function launchedThisMonth(rec, isoToday) {
  return Boolean(rec.last_generated_month) && rec.last_generated_month >= monthOf(isoToday)
}

// 'paused' | 'done' (já lançado este mês) | 'due' (dia chegou, por lançar) |
// 'upcoming' (dia ainda não chegou).
export function recurringState(rec, isoToday) {
  if (!rec.active) return 'paused'
  if (launchedThisMonth(rec, isoToday)) return 'done'
  return Number(isoToday.slice(8, 10)) >= rec.day_of_month ? 'due' : 'upcoming'
}

// Os que o Registo deve mostrar para lançar, pelo dia.
export function dueRecurring(list, isoToday) {
  return (list ?? [])
    .filter((r) => recurringState(r, isoToday) === 'due')
    .sort((a, b) => a.day_of_month - b.day_of_month)
}

// Total mensal dos recorrentes ativos (ganhos e gastos à parte), para o resumo
// em Gestão. Em cêntimos.
export function monthlyRecurringTotals(list) {
  let income = 0
  let expense = 0
  for (const r of list ?? []) {
    if (!r.active) continue
    const c = Math.round(Number(r.amount) * 100)
    if (r.type === 'income') income += c
    else expense += c
  }
  return { income: income / 100, expense: expense / 100 }
}
