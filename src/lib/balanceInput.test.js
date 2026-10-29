import test from 'node:test'
import assert from 'node:assert/strict'
import { parseBalanceValue } from './balanceInput.js'

test('aceita vírgula e ponto decimal', () => {
  assert.equal(parseBalanceValue('150,27'), 150.27)
  assert.equal(parseBalanceValue(' 150.27 '), 150.27)
})
test('arredonda a cêntimos inteiros', () => {
  assert.equal(parseBalanceValue('10.239'), 10.24)
})
test('zero escrito é válido (conta vazia)', () => {
  assert.equal(parseBalanceValue('0'), 0)
  assert.equal(parseBalanceValue('0,00'), 0)
})
test('rejeita vazio, negativo e texto (caixa vazia não pode zerar a conta)', () => {
  for (const v of ['', '   ', '-3', 'abc', '1,2,3', null, undefined]) {
    assert.equal(parseBalanceValue(v), null, String(v))
  }
})
