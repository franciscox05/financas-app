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

function summarySection({ monthLabel, income, expense, savingsAmount }) {
  const saldo = netSavings(income, expense)
  const rate = income > 0 ? Math.round((saldo / income) * 100) : null
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
