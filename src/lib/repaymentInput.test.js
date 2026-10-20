import test from 'node:test'
import assert from 'node:assert/strict'
import { overshootNote, defaultCategoryId } from './repaymentInput.js'

const norm = (s) => s.replace(/ /g, ' ')

test('sem aviso quando não ultrapassa o saldo', () => {
  assert.equal(overshootNote('repaid_to_me', 10, 10), null)
  assert.equal(overshootNote('repaid_to_me', 10, 1.5), null)
})
test('aviso quando ele me devia e devolve a mais', () => {
  assert.equal(norm(overshootNote('repaid_to_me', 10, 11.5)), 'Passa a ficar ele a dever-te 1,50 €')
})
test('aviso quando eu lhe devia e devolvo a mais', () => {
  assert.equal(norm(overshootNote('repaid_to_them', -10, 11.5)), 'Passa a ficar a dever-lhe 1,50 €')
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
