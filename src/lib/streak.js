// Sequência de dias seguidos com pelo menos um registo (gasto, ganho ou
// transferência). Conta até hoje; se hoje ainda não há registo, a sequência de
// ontem continua "viva" (a pessoa ainda vai a tempo), mas marca-se como por
// fazer hoje. Datas em 'YYYY-MM-DD', sem passar por fusos.

function shiftIso(iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

// `dates`: iterável de 'YYYY-MM-DD' (pode ter repetidos). `todayIso`: hoje.
// Devolve { days, loggedToday, best } — `best` é a maior sequência no período.
export function loggingStreak(dates, todayIso) {
  const set = new Set(dates)
  const loggedToday = set.has(todayIso)
  let cursor = loggedToday ? todayIso : shiftIso(todayIso, -1)
  let days = 0
  while (set.has(cursor)) {
    days += 1
    cursor = shiftIso(cursor, -1)
  }

  let best = 0
  let run = 0
  let prev = null
  for (const iso of [...set].sort()) {
    run = prev && shiftIso(prev, 1) === iso ? run + 1 : 1
    best = Math.max(best, run)
    prev = iso
  }
  return { days, loggedToday, best: Math.max(best, days) }
}

// Marcos que merecem festa (o mascote celebra quando se chega a um destes).
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365]

export function isMilestone(days) {
  return STREAK_MILESTONES.includes(days)
}
