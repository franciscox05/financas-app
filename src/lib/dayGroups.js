// Agrupar movimentos por dia (lista do Registo), já ordenados do mais recente
// para o mais antigo. Datas como texto 'AAAA-MM-DD', sem passar por UTC.

// Junta linhas seguidas com o mesmo `occurred_on` num grupo.
export function groupByDay(rows) {
  const groups = []
  for (const row of rows) {
    const last = groups[groups.length - 1]
    if (last && last.date === row.occurred_on) last.rows.push(row)
    else groups.push({ date: row.occurred_on, rows: [row] })
  }
  return groups
}

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + n)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Título do dia: "Hoje", "Ontem" ou dia da semana + data ("sexta, 20 nov").
// `labels` = { today, yesterday }; `locale` para o nome do dia e do mês.
export function dayHeading(iso, todayIso, labels, locale = 'pt-PT') {
  if (iso === todayIso) return labels.today
  if (iso === addDays(todayIso, -1)) return labels.yesterday
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const sameYear = iso.slice(0, 4) === todayIso.slice(0, 4)
  const text = date.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  return text.charAt(0).toUpperCase() + text.slice(1).replace('.', '')
}
