import test from 'node:test'
import assert from 'node:assert/strict'
import { friendEntryKind, friendEntryMode } from './quickEntryFriend.js'

test('gasto: o amigo fica a dever-me; ganho: o amigo devolveu-me', () => {
  assert.equal(friendEntryKind('expense'), 'paid_for_them')
  assert.equal(friendEntryKind('income'), 'repaid_to_me')
})
test('amigo local liga o movimento à transação, em gasto e ganho', () => {
  assert.equal(friendEntryMode('expense', 'local'), 'local')
  assert.equal(friendEntryMode('income', 'local'), 'local')
  assert.equal(friendEntryMode('income', 'invited'), 'local')
})
test('amigo ligado envia para confirmar; ganho não cria transação própria', () => {
  assert.equal(friendEntryMode('expense', 'connected'), 'shared-expense')
  assert.equal(friendEntryMode('income', 'connected'), 'shared-repayment')
})
