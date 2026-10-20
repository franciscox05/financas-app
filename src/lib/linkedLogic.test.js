import test from 'node:test'
import assert from 'node:assert/strict'
import {
  COUNTING_STATUSES,
  entryStatusLabel,
  canRespond,
  canRequestCancel,
  friendStateLabel,
  normalizeEmail,
} from './linkedLogic.js'
import { balanceOf } from './ledgerMath.js'

const ME = 'me'
const HIM = 'him'

test('COUNTING_STATUSES', () => {
  assert.deepEqual(COUNTING_STATUSES, ['confirmed', 'cancel_requested'])
})
test('balanceOf só conta confirmed e cancel_requested', () => {
  const entries = [
    { kind: 'paid_for_them', amount: 10, status: 'confirmed' },
    { kind: 'paid_for_them', amount: 5, status: 'pending' },
    { kind: 'paid_for_them', amount: 3, status: 'archived' },
    { kind: 'paid_for_me', amount: 2, status: 'cancel_requested' },
  ]
  assert.equal(balanceOf(entries) * 100, 800)
})
test('balanceOf trata movimentos sem estado como confirmados', () => {
  assert.equal(balanceOf([{ kind: 'paid_for_them', amount: 4 }]), 4)
})
test('normalizeEmail', () => {
  assert.equal(normalizeEmail(' Ana@Mail.COM '), 'ana@mail.com')
  assert.equal(normalizeEmail('sem-arroba'), null)
  assert.equal(normalizeEmail('a@b'), null)
  assert.equal(normalizeEmail('a b@c.pt'), null)
  assert.equal(normalizeEmail(''), null)
  assert.equal(normalizeEmail(null), null)
})
test('canRespond só para o destinatário de uma linha pending com mirror_id', () => {
  const row = { status: 'pending', mirror_id: 'm', created_by: HIM }
  assert.equal(canRespond(row, ME), true)
  assert.equal(canRespond({ ...row, created_by: ME }, ME), false)
  assert.equal(canRespond({ ...row, mirror_id: null }, ME), false)
  assert.equal(canRespond({ ...row, status: 'confirmed' }, ME), false)
})
test('canRequestCancel só em confirmed com mirror_id', () => {
  assert.equal(canRequestCancel({ status: 'confirmed', mirror_id: 'm' }), true)
  assert.equal(canRequestCancel({ status: 'confirmed', mirror_id: null }), false)
  assert.equal(canRequestCancel({ status: 'pending', mirror_id: 'm' }), false)
})
test('entryStatusLabel', () => {
  assert.deepEqual(entryStatusLabel({ status: 'pending', created_by: ME }, ME), { text: 'À espera que ele confirme', tone: 'waiting' })
  assert.deepEqual(entryStatusLabel({ status: 'pending', created_by: HIM }, ME), { text: 'Pendente de confirmação', tone: 'action' })
  assert.deepEqual(entryStatusLabel({ status: 'declined', decline_note: 'não foi assim' }, ME), { text: 'Contestado: não foi assim', tone: 'danger' })
  assert.equal(entryStatusLabel({ status: 'declined' }, ME).text, 'Contestado')
  assert.deepEqual(entryStatusLabel({ status: 'cancel_requested' }, ME), { text: 'Anulação pedida', tone: 'waiting' })
  assert.deepEqual(entryStatusLabel({ status: 'cancelled' }, ME), { text: 'Anulado', tone: 'muted' })
  assert.deepEqual(entryStatusLabel({ status: 'archived' }, ME), { text: 'Arquivado', tone: 'muted' })
  assert.deepEqual(entryStatusLabel({ status: 'confirmed' }, ME), { text: '', tone: 'none' })
})
test('friendStateLabel', () => {
  assert.equal(friendStateLabel({ status: 'local' }, null), 'Local')
  assert.equal(friendStateLabel({ status: 'invited' }, { status: 'pending' }), 'Pedido enviado')
  assert.equal(friendStateLabel({ status: 'local' }, { status: 'declined' }), 'Recusado')
  assert.equal(friendStateLabel({ status: 'connected' }, { status: 'accepted' }), 'Ligado')
})
