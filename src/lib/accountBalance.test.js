import test from 'node:test'
import assert from 'node:assert/strict'
import { balanceAt } from './accountBalance.js'

const ACC = 'conta'
const snap = { account_id: ACC, snapshot_date: '2026-10-19', value: 168, created_at: '2026-10-19T20:00:00Z' }
const tx = (occurred_on, created_at, amount, type = 'expense') => ({ account_id: ACC, occurred_on, created_at, amount, type })

test('sem snapshot soma tudo', () => {
  assert.equal(balanceAt(ACC, [tx('2026-10-01', '2026-10-01T10:00:00Z', 10, 'income')], [], '2026-10-29'), 10)
})

test('gasto esquecido com data ANTERIOR ao acerto, registado depois, não conta a dobrar', () => {
  const t = [tx('2026-10-10', '2026-10-25T10:00:00Z', 12.5)]
  assert.equal(balanceAt(ACC, t, [snap], '2026-10-29'), 168)
})

test('movimento com data POSTERIOR conta sempre', () => {
  const t = [tx('2026-10-20', '2026-10-21T10:00:00Z', 2.05)]
  assert.equal(balanceAt(ACC, t, [snap], '2026-10-29'), 165.95)
})

test('movimento posterior registado ANTES de um snapshot com data no passado conta', () => {
  const pastSnap = { ...snap, snapshot_date: '2026-09-30', created_at: '2026-10-05T12:00:00Z' }
  const t = [tx('2026-10-02', '2026-10-02T09:00:00Z', 8)]
  assert.equal(balanceAt(ACC, t, [pastSnap], '2026-10-29'), 160)
})

test('mesmo dia: antes do acerto já estava incluído, depois do acerto conta', () => {
  const antes = tx('2026-10-19', '2026-10-19T12:00:00Z', 5)
  const depois = tx('2026-10-19', '2026-10-19T21:00:00Z', 3)
  assert.equal(balanceAt(ACC, [antes, depois], [snap], '2026-10-29'), 165)
})

test('transferências seguem a mesma regra', () => {
  const tr = [
    { from_account_id: ACC, to_account_id: 'xtb', occurred_on: '2026-10-15', created_at: '2026-10-25T10:00:00Z', amount: 50 },
    { from_account_id: ACC, to_account_id: 'xtb', occurred_on: '2026-10-22', created_at: '2026-10-22T10:00:00Z', amount: 20 },
  ]
  assert.equal(balanceAt(ACC, [], [snap], '2026-10-29', tr), 148)
})
