import test from 'node:test'
import assert from 'node:assert/strict'
import {
  averageDailyExpense,
  daysInMonth,
  expenseByAccount,
  monthlyReportCsv,
  monthlyReportSections,
  monthlyReportText,
  netSavings,
  peakExpenseDay,
  savingsRate,
  topExpenses,
} from './monthlyReport.js'

const tx = (amount, note, type = 'expense', category = 'Casa') => ({
  amount,
  note,
  type,
  occurred_on: '2026-10-14',
  categories: { name: category },
  accounts: { name: 'Conta à Ordem' },
})

const data = {
  monthLabel: 'Outubro 2026',
  income: 1000,
  expense: 400,
  savingsAmount: 150,
  expenseByCategory: [
    { name: 'Casa', amount: 300 },
    { name: 'Alimentação', amount: 100 },
  ],
  incomeByCategory: [{ name: 'Salário', amount: 1000 }],
  transactions: [tx(300, 'Renda'), tx(100, 'Compras', 'expense', 'Alimentação'), tx(1000, 'Salário', 'income', 'Salário')],
  evolution: [
    { label: 'set', income: 900, expense: 500 },
    { label: 'out', income: 1000, expense: 400 },
  ],
}

test('poupança líquida é receitas menos despesas', () => {
  assert.equal(netSavings(1000, 400), 600)
  assert.equal(netSavings(300, 400), -100)
})

test('maiores despesas ignoram receitas e vêm da maior para a menor', () => {
  const top = topExpenses(data.transactions)
  assert.deepEqual(top.map((t) => t.note), ['Renda', 'Compras'])
})

test('secções incluem resumo, categorias, maiores despesas e evolução', () => {
  const titles = monthlyReportSections(data).map((s) => s.title)
  assert.deepEqual(titles, [
    'Resumo de Outubro 2026',
    'Despesas por categoria',
    'Receitas por categoria',
    'Maiores despesas do mês',
    'Evolução (6 meses até ao mês selecionado)',
  ])
})

test('um mês sem receitas não inventa uma taxa de poupança nem uma secção vazia', () => {
  const semReceitas = { ...data, income: 0, incomeByCategory: [], transactions: [tx(50, 'Café')] }
  const sections = monthlyReportSections(semReceitas)
  assert.equal(sections.some((s) => s.title === 'Receitas por categoria'), false)
  const resumo = sections[0]
  const taxa = resumo.rows.find((r) => r.label === 'Taxa de poupança')
  assert.equal(taxa.value, '—')
})

test('CSV traz os totais e as percentagens por categoria', () => {
  const csv = monthlyReportCsv(data)
  assert.match(csv, /Resumo de Outubro 2026/)
  assert.match(csv, /Poupança líquida/)
  assert.match(csv, /Casa/)
  assert.match(csv, /75%/) // 300 de 400 em despesas
})

test('resumo em texto diz quanto sobrou e para onde foi o dinheiro', () => {
  const text = monthlyReportText(data)
  assert.match(text, /Relatório de Outubro 2026/)
  assert.match(text, /Poupei/)
  assert.match(text, /Casa/)
  assert.match(text, /Maior despesa: Renda/)
})

test('mês com saldo negativo diz que ficou a descoberto, sem sinal duplicado', () => {
  const text = monthlyReportText({ ...data, income: 300, expense: 400 })
  assert.match(text, /Fiquei a descoberto/)
  assert.doesNotMatch(text, /-100/)
})

// Taxa de poupança com base explícita — o que resolve o "15% sem saber de
// onde veio": agora é sempre saldo/receitas, nunca uma percentagem solta.
test('savingsRate: percentagem do rendimento, arredondada', () => {
  assert.equal(savingsRate(1000, 400), 60)
  assert.equal(savingsRate(1000, 850), 15)
})

test('savingsRate: sem receitas no mês, não inventa uma percentagem', () => {
  assert.equal(savingsRate(0, 50), null)
})

test('daysInMonth: meses normais e fevereiro em ano bissexto/comum', () => {
  assert.equal(daysInMonth('2026-10'), 31)
  assert.equal(daysInMonth('2026-04'), 30)
  assert.equal(daysInMonth('2024-02'), 29)
  assert.equal(daysInMonth('2026-02'), 28)
})

test('averageDailyExpense: divide pelos dias do mês, não pelos dias já passados', () => {
  assert.equal(averageDailyExpense(310, '2026-10'), 10) // 31 dias
})

const expenseTx = (amount, occurred_on, accountName = 'Conta à Ordem') => ({
  amount,
  type: 'expense',
  occurred_on,
  accounts: { name: accountName },
})

test('peakExpenseDay: soma por dia e devolve o dia com mais despesa', () => {
  const transactions = [
    expenseTx(20, '2026-10-01'),
    expenseTx(15, '2026-10-01'),
    expenseTx(50, '2026-10-15'),
    { amount: 999, type: 'income', occurred_on: '2026-10-20' }, // ignorado, não é despesa
  ]
  assert.deepEqual(peakExpenseDay(transactions), { date: '2026-10-15', amount: 50 })
})

test('peakExpenseDay: sem despesas devolve null', () => {
  assert.equal(peakExpenseDay([{ amount: 10, type: 'income', occurred_on: '2026-10-01' }]), null)
})

test('expenseByAccount: soma só despesas por conta, da maior para a menor', () => {
  const transactions = [
    expenseTx(100, '2026-10-01', 'Conta à Ordem'),
    expenseTx(50, '2026-10-02', 'Dinheiro'),
    expenseTx(30, '2026-10-03', 'Conta à Ordem'),
    { amount: 500, type: 'income', occurred_on: '2026-10-04', accounts: { name: 'Conta à Ordem' } },
  ]
  assert.deepEqual(expenseByAccount(transactions), [
    { name: 'Conta à Ordem', amount: 130 },
    { name: 'Dinheiro', amount: 50 },
  ])
})
