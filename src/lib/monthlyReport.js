// Relatório mensal detalhado, para o mês atual ou qualquer mês do histórico.
// Só transformação de dados — quem chama (Balance.jsx) já tem tudo calculado
// para o ecrã e passa-o para cá, sem pedidos novos à base de dados.
//
// Duas saídas da mesma estrutura: um CSV por secções (para abrir no Excel ou
// guardar) e um resumo em texto (para colar no WhatsApp, como o resumo de
// conta-corrente em contactMessage.js).
import { toCsv } from './csv.js'
import { eur, shortDate } from './format.js'

// Maiores despesas do mês, da maior para a menor.
export function topExpenses(transactions, howMany = 5) {
  return transactions
    .filter((tx) => tx.type === 'expense')
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, howMany)
}

// Poupança líquida: o que sobrou no mês. Separada da parcela que foi
// deliberadamente para poupança/investimento (categorias marcadas com a
// mealheira) — são coisas diferentes e aparecem as duas no relatório.
export function netSavings(income, expense) {
  return income - expense
}

// Taxa de poupança com a base explícita, para nunca aparecer uma percentagem
// solta sem se ver de onde veio (o Francisco via "15% de poupança" em Out e
// não sabia a que se referia). `rate` fica null sem receitas no mês — 0% de
// uma base 0 não diz nada.
export function savingsRate(income, expense) {
  const saldo = netSavings(income, expense)
  return income > 0 ? Math.round((saldo / income) * 100) : null
}

// Dias do mês (28-31, com bissexto): `monthKeyValue` no formato "AAAA-MM",
// o mesmo que `monthKey()` (lib/dates.js) produz.
export function daysInMonth(monthKeyValue) {
  const [year, month] = monthKeyValue.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

// Ritmo de gasto: quanto se gastou, em média, por cada dia do mês (os 30/31
// dias do calendário — não só os dias já passados, mesmo no mês em curso,
// para o número não andar a subir artificialmente conforme o mês avança).
export function averageDailyExpense(expense, monthKeyValue) {
  return expense / daysInMonth(monthKeyValue)
}

// O dia do mês em que se gastou mais — soma as despesas por dia e devolve a
// data e o total desse dia. null se não houve despesas.
export function peakExpenseDay(transactions) {
  const byDay = new Map()
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue
    byDay.set(tx.occurred_on, (byDay.get(tx.occurred_on) ?? 0) + Number(tx.amount))
  }
  let peak = null
  for (const [date, amount] of byDay) {
    if (!peak || amount > peak.amount) peak = { date, amount }
  }
  return peak
}

// Quanto saiu de cada conta (só despesas — "de onde saiu o dinheiro", não
// "quanto entrou"), da maior para a menor.
export function expenseByAccount(transactions) {
  const byAccount = new Map()
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue
    const name = tx.accounts?.name ?? 'Sem conta'
    byAccount.set(name, (byAccount.get(name) ?? 0) + Number(tx.amount))
  }
  return [...byAccount.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
}

function summarySection({ monthLabel, income, expense, savingsAmount }) {
  const saldo = netSavings(income, expense)
  const rate = savingsRate(income, expense)
  return {
    title: `Resumo de ${monthLabel}`,
    headers: [
      { label: 'Indicador', value: (r) => r.label },
      { label: 'Valor', value: (r) => r.value },
    ],
    rows: [
      { label: 'Receitas', value: eur(income) },
      { label: 'Despesas', value: eur(expense) },
      { label: 'Poupança líquida', value: eur(saldo) },
      { label: 'Taxa de poupança', value: rate === null ? '—' : `${rate}%` },
      { label: 'Para poupança/investimento', value: eur(savingsAmount) },
    ],
  }
}

function categorySection(title, breakdown, total) {
  return {
    title,
    headers: [
      { label: 'Categoria', value: (r) => r.name },
      { label: 'Valor', value: (r) => eur(r.amount) },
      { label: '% do total', value: (r) => (total > 0 ? `${Math.round((r.amount / total) * 100)}%` : '—') },
    ],
    rows: breakdown.map((c) => ({ name: c.name, amount: c.amount })),
  }
}

function topExpensesSection(transactions) {
  return {
    title: 'Maiores despesas do mês',
    headers: [
      { label: 'Data', value: (r) => shortDate(r.occurred_on) },
      { label: 'Descrição', value: (r) => r.note || '(sem nota)' },
      { label: 'Categoria', value: (r) => r.categories?.name ?? 'Sem categoria' },
      { label: 'Conta', value: (r) => r.accounts?.name ?? '—' },
      { label: 'Valor', value: (r) => eur(Number(r.amount)) },
    ],
    rows: topExpenses(transactions),
  }
}

function evolutionSection(evolution) {
  return {
    title: 'Evolução (6 meses até ao mês selecionado)',
    headers: [
      { label: 'Mês', value: (r) => r.label },
      { label: 'Receitas', value: (r) => eur(r.income) },
      { label: 'Despesas', value: (r) => eur(r.expense) },
      { label: 'Saldo', value: (r) => eur(r.income - r.expense) },
    ],
    rows: evolution,
  }
}

export function monthlyReportSections(data) {
  const sections = [
    summarySection(data),
    categorySection('Despesas por categoria', data.expenseByCategory, data.expense),
  ]
  if (data.incomeByCategory.length > 0) {
    sections.push(categorySection('Receitas por categoria', data.incomeByCategory, data.income))
  }
  if (data.transactions.some((tx) => tx.type === 'expense')) {
    sections.push(topExpensesSection(data.transactions))
  }
  sections.push(evolutionSection(data.evolution))
  return sections
}

// Secções separadas por uma linha em branco, cada uma com o seu título numa
// linha só — abre no Excel/Numbers e continua legível em texto simples.
export function monthlyReportCsv(data) {
  return monthlyReportSections(data)
    .map((section) => `${section.title}\r\n${toCsv(section.rows, section.headers)}`)
    .join('\r\n\r\n')
}

export function monthlyReportFilename(monthKeyValue) {
  return `relatorio-${monthKeyValue}.csv`
}

// Versão curta para partilhar: os números que interessam, sem as tabelas todas.
export function monthlyReportText(data) {
  const saldo = netSavings(data.income, data.expense)
  const lines = [
    `Relatório de ${data.monthLabel}`,
    '',
    `Receitas: ${eur(data.income)}`,
    `Despesas: ${eur(data.expense)}`,
    `${saldo >= 0 ? 'Poupei' : 'Fiquei a descoberto'}: ${eur(Math.abs(saldo))}`,
  ]
  if (data.savingsAmount > 0) {
    lines.push(`Para poupança/investimento: ${eur(data.savingsAmount)}`)
  }

  const top = data.expenseByCategory.slice(0, 3)
  if (top.length > 0) {
    lines.push('', 'Onde foi o dinheiro:')
    for (const c of top) lines.push(`- ${c.name}: ${eur(c.amount)}`)
  }

  const biggest = topExpenses(data.transactions, 1)[0]
  if (biggest) {
    lines.push('', `Maior despesa: ${biggest.note || '(sem nota)'} — ${eur(Number(biggest.amount))}`)
  }
  return lines.join('\n')
}
