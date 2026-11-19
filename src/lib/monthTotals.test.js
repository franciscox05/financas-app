import test from 'node:test'
import assert from 'node:assert/strict'
import { monthTotals } from './monthTotals.js'

const cats = [
  { id: 'inv', is_savings: true },
  { id: 'emp', is_lending: true },
  { id: 'dev', is_lending: true },
  { id: 'cas' },
]
const tx = (type, amount, category_id) => ({ type, amount, category_id })

test('empréstimos e devoluções ficam fora de ganhos e gastos', () => {
  const t = monthTotals(
    [tx('income', 100, 'cas'), tx('expense', 40, 'cas'), tx('expense', 30, 'emp'), tx('income', 32, 'dev')],
    cats,
  )
  assert.equal(t.income, 100)
  assert.equal(t.expense, 40)
  assert.equal(t.lentOut, 30)
  assert.equal(t.lentBack, 32)
  assert.equal(t.lentNet, -2)
})

test('investimento continua nos gastos e aparece também à parte', () => {
  const t = monthTotals([tx('expense', 20, 'inv'), tx('expense', 10, 'cas')], cats)
  assert.equal(t.expense, 30)
  assert.equal(t.savings, 20)
})

test('soma em cêntimos: sem erro de vírgula flutuante', () => {
  const t = monthTotals([tx('income', 0.1, 'cas'), tx('income', 0.2, 'cas'), tx('expense', 0.3, 'cas')], cats)
  assert.equal(t.income - t.expense, 0)
})

test('sem categorias marcadas nada muda (antes da migração)', () => {
  const t = monthTotals([tx('expense', 30, 'emp'), tx('income', 5, 'dev')], [{ id: 'emp' }, { id: 'dev' }])
  assert.equal(t.expense, 30)
  assert.equal(t.income, 5)
  assert.equal(t.lentOut, 0)
})

test('lista vazia', () => {
  assert.deepEqual(monthTotals([], cats), { income: 0, expense: 0, savings: 0, lentOut: 0, lentBack: 0, lentNet: 0 })
})
