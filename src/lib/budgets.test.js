import test from 'node:test'
import assert from 'node:assert/strict'
import { budgetProgress, budgetStatus, budgetTotals } from './budgets.js'

const cats = [
  { id: 'food', name: 'Alimentação', type: 'expense' },
  { id: 'fun', name: 'Lazer', type: 'expense' },
  { id: 'loan', name: 'Empréstimos', type: 'expense', is_lending: true },
  { id: 'salary', name: 'Salário', type: 'income' },
]
const tx = (category_id, amount, type = 'expense') => ({ category_id, amount, type })

test('estado: abaixo de 80 %, a partir de 80 % e a partir de 100 %', () => {
  assert.equal(budgetStatus(79.99, 100), 'ok')
  assert.equal(budgetStatus(80, 100), 'warn')
  assert.equal(budgetStatus(100, 100), 'over')
  assert.equal(budgetStatus(5, 0), 'ok')
})

test('gasto por categoria contra o limite, em cêntimos', () => {
  const rows = budgetProgress(
    [{ id: 'b1', category_id: 'food', amount: '200.00' }],
    [tx('food', '0.10'), tx('food', '0.20'), tx('food', '150'), tx('fun', 30), tx('food', 500, 'income')],
    cats,
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0].spent, 150.3)
  assert.equal(rows[0].remaining, 49.7)
  assert.equal(rows[0].status, 'ok')
})

test('empréstimos e categorias de ganho nunca entram', () => {
  const rows = budgetProgress(
    [
      { id: 'b1', category_id: 'loan', amount: 50 },
      { id: 'b2', category_id: 'salary', amount: 50 },
      { id: 'b3', category_id: 'gone', amount: 50 },
    ],
    [tx('loan', 100)],
    cats,
  )
  assert.deepEqual(rows, [])
})

test('ordena pelo mais perto do limite e soma os totais', () => {
  const rows = budgetProgress(
    [
      { id: 'b1', category_id: 'food', amount: 100 },
      { id: 'b2', category_id: 'fun', amount: 50 },
    ],
    [tx('food', 20), tx('fun', 60)],
    cats,
  )
  assert.deepEqual(rows.map((r) => [r.name, r.status]), [['Lazer', 'over'], ['Alimentação', 'ok']])
  assert.deepEqual(budgetTotals(rows), { limit: 150, spent: 80, remaining: 70 })
})
