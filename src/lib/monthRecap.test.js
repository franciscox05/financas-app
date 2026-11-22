import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldShowRecap, topExpenseCategory } from './monthRecap.js'

const cats = [
  { id: 'a', name: 'Alimentação' },
  { id: 'b', name: 'Lazer' },
  { id: 'l', name: 'Empréstimos', is_lending: true },
]

test('categoria com mais gasto, ignorando empréstimos', () => {
  const txs = [
    { type: 'expense', category_id: 'a', amount: 10 },
    { type: 'expense', category_id: 'a', amount: 5.5 },
    { type: 'expense', category_id: 'b', amount: 12 },
    { type: 'expense', category_id: 'l', amount: 100 },
    { type: 'income', category_id: 'a', amount: 999 },
  ]
  assert.deepEqual(topExpenseCategory(txs, cats), { name: 'Alimentação', amount: 15.5 })
})

test('sem despesas, não há categoria', () => {
  assert.equal(topExpenseCategory([], cats), null)
  assert.equal(topExpenseCategory([{ type: 'income', category_id: 'a', amount: 5 }], cats), null)
})

test('resumo só nos primeiros dias e com movimento', () => {
  assert.equal(shouldShowRecap({ day: 3, income: 0, expense: 20 }), true)
  assert.equal(shouldShowRecap({ day: 10, income: 5, expense: 0 }), true)
  assert.equal(shouldShowRecap({ day: 11, income: 5, expense: 5 }), false)
  assert.equal(shouldShowRecap({ day: 2, income: 0, expense: 0 }), false)
})
