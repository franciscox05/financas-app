import test from 'node:test'
import assert from 'node:assert/strict'
import {
  COUNTING_STATUSES,
  entryStatusLabel,
  canRespond,
  canRequestCancel,
  friendStateLabel,
  normalizeEmail,
  entryStatusText,
  privateConfirmedEntries,
  hasPendingOpening,
  isCancelRequestForMe,
  countActionableRequests,
  blocksTransactionEdit,
  transactionLinkedMessage,
} from './linkedLogic.js'
import { balanceOf } from './ledgerMath.js'

const ME = 'me'
const HIM = 'him'

test('COUNTING_STATUSES', () => {
  assert.deepEqual(COUNTING_STATUSES, ['confirmed', 'cancel_requested'])
})
test('balanceOf conta confirmed/cancel_requested, e pending só se criado por quem vê', () => {
  const entries = [
    { kind: 'paid_for_them', amount: 10, status: 'confirmed' },
    { kind: 'paid_for_them', amount: 5, status: 'pending', created_by: HIM, user_id: ME },
    { kind: 'paid_for_them', amount: 3, status: 'archived' },
    { kind: 'paid_for_me', amount: 2, status: 'cancel_requested' },
    { kind: 'paid_for_them', amount: 7, status: 'pending', created_by: ME, user_id: ME },
  ]
  assert.equal(balanceOf(entries) * 100, 1500)
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
  assert.deepEqual(entryStatusLabel({ status: 'cancelled', cancel_requested_by: HIM }, ME), { text: 'Anulado', tone: 'muted' })
  assert.deepEqual(entryStatusLabel({ status: 'cancelled', created_by: HIM }, ME), { text: 'Cancelado', tone: 'muted' })
  assert.deepEqual(entryStatusLabel({ status: 'cancelled', created_by: ME }, ME), { text: 'Cancelado por ti', tone: 'muted' })
  assert.deepEqual(entryStatusLabel({ status: 'archived' }, ME), { text: 'Arquivado', tone: 'muted' })
  assert.deepEqual(entryStatusLabel({ status: 'confirmed' }, ME), { text: '', tone: 'none' })
})
test('friendStateLabel', () => {
  assert.equal(friendStateLabel({ status: 'local' }, null), 'Local')
  assert.equal(friendStateLabel({ status: 'invited' }, { status: 'pending' }), 'Pedido enviado')
  assert.equal(friendStateLabel({ status: 'local' }, { status: 'declined' }), 'Recusado')
  assert.equal(friendStateLabel({ status: 'connected' }, { status: 'accepted' }), 'Ligado')
  assert.equal(friendStateLabel({ status: 'local' }, { status: 'awaiting_confirmation' }), 'À espera de confirmação')
})
test('entryStatusText usa o nome do amigo', () => {
  assert.equal(entryStatusText({ status: 'pending', created_by: ME }, ME, 'Rui').text, 'À espera que Rui confirme')
  assert.equal(entryStatusText({ status: 'pending', created_by: HIM }, ME, 'Rui').text, 'Pendente de confirmação')
  assert.equal(
    entryStatusText({ status: 'cancel_requested', cancel_requested_by: ME }, ME, 'Rui').text,
    'Anulação pedida. À espera de Rui.',
  )
  assert.deepEqual(entryStatusText({ status: 'cancel_requested', cancel_requested_by: HIM }, ME, 'Rui'), {
    text: 'Rui quer anular este movimento',
    tone: 'action',
  })
  assert.equal(entryStatusText({ status: 'archived' }, ME, 'Rui').text, 'Arquivado')
})
test('privateConfirmedEntries e hasPendingOpening', () => {
  const list = [
    { id: 1, kind: 'paid_for_them', amount: 5, status: 'confirmed', mirror_id: null },
    { id: 2, kind: 'paid_for_them', amount: 5, mirror_id: null },
    { id: 3, kind: 'paid_for_them', amount: 5, status: 'confirmed', mirror_id: 'x' },
    { id: 4, kind: 'paid_for_them', amount: 5, status: 'archived', mirror_id: null },
  ]
  assert.deepEqual(privateConfirmedEntries(list).map((e) => e.id), [1, 2])
  assert.equal(hasPendingOpening(list), false)
  assert.equal(hasPendingOpening([{ is_opening: true, status: 'pending' }]), true)
})
test('isCancelRequestForMe', () => {
  assert.equal(isCancelRequestForMe({ status: 'cancel_requested', mirror_id: 'x', cancel_requested_by: HIM }, ME), true)
  assert.equal(isCancelRequestForMe({ status: 'cancel_requested', mirror_id: 'x', cancel_requested_by: ME }, ME), false)
  assert.equal(isCancelRequestForMe({ status: 'confirmed', mirror_id: 'x' }, ME), false)
})

test('countActionableRequests ignora pedidos que aguardam o remetente', () => {
  const rows = [{ awaiting: false }, { awaiting: true }, {}, { awaiting: false }]
  assert.equal(countActionableRequests(rows), 3)
  assert.equal(countActionableRequests([]), 0)
})

test('blocksTransactionEdit: só bloqueia enquanto o movimento ainda conta ou está por responder', () => {
  for (const status of ['pending', 'confirmed', 'cancel_requested', 'declined']) {
    assert.equal(blocksTransactionEdit({ status }), true, status)
  }
  for (const status of ['cancelled', 'archived', undefined]) {
    assert.equal(blocksTransactionEdit({ status }), false, String(status))
  }
  assert.equal(blocksTransactionEdit(null), false)
})

test('transactionLinkedMessage: texto diferente para pendente, contestado e já resolvido', () => {
  assert.match(
    transactionLinkedMessage({ status: 'pending', friendName: 'Tiago' }),
    /pedido pendente com Tiago/,
  )
  assert.match(
    transactionLinkedMessage({ status: 'declined', friendName: 'Tiago' }),
    /Tiago contestou este movimento, mas continua a contar/,
  )
  assert.match(
    transactionLinkedMessage({ status: 'confirmed', friendName: 'Tiago' }),
    /ligado a um movimento com Tiago/,
  )
})
