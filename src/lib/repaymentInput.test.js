import test from 'node:test'
import assert from 'node:assert/strict'
import { overshootNote, defaultCategoryId } from './repaymentInput.js'

const norm = (s) => s.replace(/ /g, ' ')

test('sem aviso quando não ultrapassa o saldo', () => {
  assert.equal(overshootNote('repaid_to_me', 10, 10), null)
  assert.equal(overshootNote('repaid_to_me', 10, 1.5), null)
})
test('repaid_to_me (saldo 10, valor 11,5): passo a dever-lhe 1,50', () => {
  assert.equal(norm(overshootNote('repaid_to_me', 10, 11.5)), 'Passa a ficar a dever-lhe 1,50 €')
})
test('repaid_to_them (saldo -10, valor 11,5): ele passa a dever-me 1,50', () => {
  assert.equal(norm(overshootNote('repaid_to_them', -10, 11.5)), 'Passa a ficar a dever-te 1,50 €')
})
test('categoria por defeito', () => {
  const cats = [
    { id: 'a', type: 'expense', name: 'Comida' },
    { id: 'b', type: 'expense', name: 'Outros Gastos' },
    { id: 'c', type: 'income', name: 'Salário' },
  ]
  assert.equal(defaultCategoryId(cats, 'repaid_to_them'), 'b')
  assert.equal(defaultCategoryId(cats, 'repaid_to_me'), 'c')
  assert.equal(defaultCategoryId([], 'repaid_to_me'), '')
})
test('"Empréstimos"/"Devoluções" têm prioridade sobre "Outros Gastos"/"Outros Ganhos"', () => {
  const cats = [
    { id: 'a', type: 'expense', name: 'Outros Gastos' },
    { id: 'b', type: 'expense', name: 'Empréstimos' },
    { id: 'c', type: 'income', name: 'Outros Ganhos' },
    { id: 'd', type: 'income', name: 'Devoluções' },
  ]
  assert.equal(defaultCategoryId(cats, 'repaid_to_them'), 'b')
  assert.equal(defaultCategoryId(cats, 'repaid_to_me'), 'd')
})
