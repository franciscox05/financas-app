import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  phoneForStorage,
  mbwayForStorage,
  repaymentTransactionType,
  checkRepaymentInput,
  hasOpenBalance,
} from './friendsLogic.js'

test('phoneForStorage normaliza, aceita vazio e rejeita inválido', () => {
  assert.equal(phoneForStorage('912 345 678'), '351912345678')
  assert.equal(phoneForStorage('  '), null)
  assert.equal(phoneForStorage(null), null)
  assert.throws(() => phoneForStorage('123'), /inválido/)
})

test('mbwayForStorage guarda os 9 dígitos locais', () => {
  assert.equal(mbwayForStorage('912 345 678'), '912345678')
  assert.equal(mbwayForStorage('+351 912345678'), '912345678')
  assert.equal(mbwayForStorage('00351912345678'), '912345678')
  assert.equal(mbwayForStorage(''), null)
  assert.equal(mbwayForStorage(null), null)
  assert.equal(mbwayForStorage('+44 7911 123456'), '447911123456')
  assert.throws(() => mbwayForStorage('12'), /inválido/)
})

test('repaymentTransactionType', () => {
  assert.equal(repaymentTransactionType('repaid_to_me'), 'income')
  assert.equal(repaymentTransactionType('repaid_to_them'), 'expense')
})

test('checkRepaymentInput exige conta e categoria só com bank', () => {
  assert.throws(() => checkRepaymentInput({ settlement: 'bank' }), /conta e a categoria/)
  assert.throws(() => checkRepaymentInput({ settlement: 'bank', accountId: 'a' }), /conta e a categoria/)
  assert.doesNotThrow(() => checkRepaymentInput({ settlement: 'bank', accountId: 'a', categoryId: 'c' }))
  assert.doesNotThrow(() => checkRepaymentInput({ settlement: 'cash' }))
  assert.doesNotThrow(() => checkRepaymentInput({ settlement: 'offset' }))
})

test('hasOpenBalance', () => {
  assert.equal(hasOpenBalance(0), false)
  assert.equal(hasOpenBalance(undefined), false)
  assert.equal(hasOpenBalance(0.001), false)
  assert.equal(hasOpenBalance(0.01), true)
  assert.equal(hasOpenBalance(-5), true)
})
