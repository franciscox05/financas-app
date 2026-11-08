import test from 'node:test'
import assert from 'node:assert/strict'
import { monthlyReportCsv, monthlyReportSections, monthlyReportText, netSavings, topExpenses } from './monthlyReport.js'

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
