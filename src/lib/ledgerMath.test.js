import test from 'node:test'
import assert from 'node:assert/strict'
import { signedCents, balanceOf, describeBalance, suggestedRepayment, entryLabel } from './ledgerMath.js'

test('balanceOf soma com sinal', () => {
  assert.equal(balanceOf([{ kind: 'paid_for_me', amount: 10 }, { kind: 'paid_for_them', amount: 11.5 }]), 1.5)
})
test('balanceOf evita erros de vírgula flutuante', () => {
  assert.equal(balanceOf([{ kind: 'paid_for_them', amount: 0.1 }, { kind: 'paid_for_them', amount: 0.2 }]), 0.3)
})
test('balanceOf de lista vazia é 0', () => {
  assert.equal(balanceOf([]), 0)
})
test('describeBalance', () => {
  assert.deepEqual(describeBalance(1.5), { state: 'owes_me', amount: 1.5 })
  assert.deepEqual(describeBalance(-5), { state: 'i_owe', amount: 5 })
  assert.deepEqual(describeBalance(0), { state: 'even', amount: 0 })
})
test('suggestedRepayment', () => {
  assert.deepEqual(suggestedRepayment(1.5), { kind: 'repaid_to_me', amount: 1.5 })
  assert.deepEqual(suggestedRepayment(-8.8), { kind: 'repaid_to_them', amount: 8.8 })
  assert.equal(suggestedRepayment(0), null)
})
test('entryLabel', () => {
  assert.equal(entryLabel('paid_for_them'), 'paguei por ele')
  assert.equal(entryLabel('paid_for_me'), 'ele pagou por mim')
  assert.equal(entryLabel('repaid_to_me'), 'ele devolveu-me')
  assert.equal(entryLabel('repaid_to_them'), 'devolvi-lhe')
})
test('signedCents tabela de sinais e kind desconhecido', () => {
  assert.equal(signedCents('paid_for_them', 1.1), 110)
  assert.equal(signedCents('paid_for_me', '2.5'), -250)
  assert.equal(signedCents('repaid_to_me', 3), -300)
  assert.equal(signedCents('repaid_to_them', 4), 400)
  assert.throws(() => signedCents('xpto', 1))
})
