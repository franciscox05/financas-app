import test from 'node:test'
import assert from 'node:assert/strict'
import {
  signedCents,
  balanceOf,
  describeBalance,
  suggestedRepayment,
  entryLabel,
  lifetimeTotals,
  entryCounts,
} from './ledgerMath.js'

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
test('lifetimeTotals soma por direção, ignorando devoluções já feitas e movimentos que não contam', () => {
  const entries = [
    { kind: 'paid_for_them', amount: 25, status: 'confirmed' },
    { kind: 'repaid_to_me', amount: 25, status: 'confirmed' },
    { kind: 'paid_for_them', amount: 10, status: 'confirmed' },
    { kind: 'paid_for_me', amount: 5, status: 'confirmed' },
    // Cancelado: nunca conta, independentemente de quem criou.
    { kind: 'paid_for_them', amount: 999, status: 'cancelled' },
    // Pendente criado pelo amigo (não por mim): ainda não conta do meu lado.
    { kind: 'paid_for_them', amount: 888, status: 'pending', created_by: 'him', user_id: 'me' },
  ]
  assert.deepEqual(lifetimeTotals(entries), { lent: 35, borrowed: 5, repaidToMe: 25, repaidToThem: 0 })
})
test('lifetimeTotals de lista vazia é tudo 0', () => {
  assert.deepEqual(lifetimeTotals([]), { lent: 0, borrowed: 0, repaidToMe: 0, repaidToThem: 0 })
})
test('entryCounts: pendente conta se eu criei, não conta se o outro criou', () => {
  const ME = 'me'
  const HIM = 'him'
  assert.equal(entryCounts({ status: 'pending', created_by: ME, user_id: ME }), true)
  assert.equal(entryCounts({ status: 'pending', created_by: HIM, user_id: ME }), false)
  assert.equal(entryCounts({ status: 'confirmed', created_by: HIM, user_id: ME }), true)
  assert.equal(entryCounts({ status: 'cancel_requested', created_by: HIM, user_id: ME }), true)
  assert.equal(entryCounts({ status: 'declined', created_by: ME, user_id: ME }), true)
  assert.equal(entryCounts({ status: 'cancelled', created_by: ME, user_id: ME }), false)
})
test('balanceOf: um gasto partilhado pendente já conta do lado de quem o criou', () => {
  const ME = 'me'
  const HIM = 'him'
  // Eu paguei por ele (100), ainda pendente de ele confirmar: já conta a meu favor.
  assert.equal(
    balanceOf([{ kind: 'paid_for_them', amount: 100, status: 'pending', created_by: ME, user_id: ME }]),
    100,
  )
  // Pedido dele (ele diz que pagou por mim), ainda pendente da minha resposta: não conta.
  assert.equal(
    balanceOf([{ kind: 'paid_for_me', amount: 100, status: 'pending', created_by: HIM, user_id: ME }]),
    0,
  )
})
test('signedCents tabela de sinais e kind desconhecido', () => {
  assert.equal(signedCents('paid_for_them', 1.1), 110)
  assert.equal(signedCents('paid_for_me', '2.5'), -250)
  assert.equal(signedCents('repaid_to_me', 3), -300)
  assert.equal(signedCents('repaid_to_them', 4), 400)
  assert.throws(() => signedCents('xpto', 1))
})
