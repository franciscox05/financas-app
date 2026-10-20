import test from 'node:test'
import assert from 'node:assert/strict'
import { parseExpenseAmount } from './expenseInput.js'

test('aceita vírgula e ponto decimal', () => {
  assert.equal(parseExpenseAmount('11,50'), 11.5)
  assert.equal(parseExpenseAmount('11.5'), 11.5)
})
test('arredonda a cêntimos inteiros', () => {
  assert.equal(parseExpenseAmount('10.239'), 10.24)
  assert.equal(parseExpenseAmount('0.004'), null)
})
test('rejeita vazio, zero, negativo e texto', () => {
  for (const v of ['', '  ', '0', '0,00', '-3', 'abc', '1,2,3', null, undefined]) {
    assert.equal(parseExpenseAmount(v), null, String(v))
  }
})
