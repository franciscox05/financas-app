import test from 'node:test'
import assert from 'node:assert/strict'
import { balanceAt, groupHasReliableBaseline, hasReliableBaseline } from './accountBalance.js'

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

// Base fiável para o histórico — o que impede uma transação antiga registada
// hoje de afundar os meses anteriores ao primeiro snapshot (bug do empréstimo
// de 4.490€ datado de 2025 a aparecer no gráfico de 6 meses de 2026).
test('conta sem snapshot nenhum conta como fiável (soma desde sempre, comportamento de sempre)', () => {
  assert.equal(hasReliableBaseline(ACC, [], '2026-06-30'), true)
})

test('data anterior ao primeiro snapshot da conta não é fiável', () => {
  assert.equal(hasReliableBaseline(ACC, [snap], '2026-06-30'), false)
})

test('data igual ou posterior ao snapshot é fiável', () => {
  assert.equal(hasReliableBaseline(ACC, [snap], '2026-10-19'), true)
  assert.equal(hasReliableBaseline(ACC, [snap], '2026-11-30'), true)
})

test('grupo: uma só conta sem base chega para o ponto não ser fiável', () => {
  const accounts = [
    { id: ACC, created_at: '2026-01-01T00:00:00Z' },
    { id: 'xtb', created_at: '2026-01-01T00:00:00Z' },
  ]
  // A segunda conta usa snapshots, mas o primeiro só é de novembro: a 29/10
  // ainda não há base para ela, logo o ponto todo deixa de ser fiável.
  const snaps = [snap, { account_id: 'xtb', snapshot_date: '2026-11-06', value: 549, created_at: '2026-11-06T10:00:00Z' }]
  assert.equal(groupHasReliableBaseline(accounts, snaps, '2026-10-29'), false)
})

test('grupo: conta criada depois da data não conta contra o ponto', () => {
  const accounts = [
    { id: ACC, created_at: '2026-01-01T00:00:00Z' },
    { id: 'cofre', created_at: '2026-11-06T10:00:00Z' },
  ]
  const snaps = [snap, { account_id: 'cofre', snapshot_date: '2026-11-06', value: 3000, created_at: '2026-11-06T10:00:00Z' }]
  assert.equal(groupHasReliableBaseline(accounts, snaps, '2026-10-29'), true)
})
