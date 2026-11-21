import test from 'node:test'
import assert from 'node:assert/strict'
import { accountStatement, balanceAt, groupHasReliableBaseline, hasReliableBaseline } from './accountBalance.js'

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

test('extrato: saldo antes/depois de cada movimento, do mais recente para o mais antigo', () => {
  const t = [
    tx('2026-10-01', '2026-10-01T10:00:00Z', 100, 'income'),
    tx('2026-10-05', '2026-10-05T10:00:00Z', 30),
  ]
  const lines = accountStatement(ACC, t, [], '2026-10-29')
  assert.deepEqual(
    lines.map((l) => [l.item.occurred_on, l.balanceBefore, l.balanceAfter]),
    [
      ['2026-10-05', 100, 70],
      ['2026-10-01', 0, 100],
    ],
  )
})

test('extrato: o acerto de saldo é uma linha própria com a diferença', () => {
  const t = [
    tx('2026-10-10', '2026-10-25T10:00:00Z', 12.5), // anterior ao acerto: já estava no valor indicado
    tx('2026-10-20', '2026-10-21T10:00:00Z', 2.05),
  ]
  const lines = accountStatement(ACC, t, [snap], '2026-10-29')
  assert.deepEqual(
    lines.map((l) => [l.kind, l.balanceBefore, l.balanceAfter, l.delta]),
    [
      ['transaction', 168, 165.95, -2.05],
      ['snapshot', -12.5, 168, 180.5],
      ['transaction', 0, -12.5, -12.5],
    ],
  )
})

test('extrato: transferências entram com o sentido certo', () => {
  const tr = [
    { id: 't1', from_account_id: 'outra', to_account_id: ACC, amount: 50, occurred_on: '2026-10-02', created_at: '2026-10-02T09:00:00Z' },
    { id: 't2', from_account_id: ACC, to_account_id: 'outra', amount: 20, occurred_on: '2026-10-03', created_at: '2026-10-03T09:00:00Z' },
  ]
  const lines = accountStatement(ACC, [], [], '2026-10-29', tr)
  assert.deepEqual(lines.map((l) => [l.item.id, l.balanceBefore, l.delta]), [['t2', 50, -20], ['t1', 0, 50]])
})

test('extrato: movimento com data futura fica no topo e não entra no saldo de hoje', () => {
  const t = [tx('2026-10-01', '2026-10-01T10:00:00Z', 10, 'income'), tx('2026-11-15', '2026-10-02T10:00:00Z', 4)]
  const lines = accountStatement(ACC, t, [], '2026-10-29')
  assert.equal(lines[0].future, true)
  assert.equal(lines[0].balanceBefore, 10)
  assert.equal(lines[1].balanceAfter, balanceAt(ACC, t, [], '2026-10-29'))
})

test('extrato: o último saldo até hoje é SEMPRE igual a balanceAt (dados aleatórios)', () => {
  let seed = 42
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const day = (n) => `2026-10-${String(1 + (n % 28)).padStart(2, '0')}`
  const time = (n) => `2026-10-${String(1 + (n % 28)).padStart(2, '0')}T${String(Math.floor(rnd() * 24)).padStart(2, '0')}:00:00Z`
  for (let run = 0; run < 200; run++) {
    const t = []
    const tr = []
    const sn = []
    for (let i = 0; i < 15; i++) {
      const d = Math.floor(rnd() * 28)
      t.push(tx(day(d), time(d + Math.floor(rnd() * 3)), (Math.floor(rnd() * 10000) / 100).toFixed(2), rnd() < 0.3 ? 'income' : 'expense'))
    }
    for (let i = 0; i < 4; i++) {
      const d = Math.floor(rnd() * 28)
      const out = rnd() < 0.5
      tr.push({ id: `tr${i}`, from_account_id: out ? ACC : 'x', to_account_id: out ? 'x' : ACC, amount: (Math.floor(rnd() * 5000) / 100).toFixed(2), occurred_on: day(d), created_at: time(d) })
    }
    for (let i = 0; i < Math.floor(rnd() * 3); i++) {
      const d = Math.floor(rnd() * 28)
      sn.push({ account_id: ACC, snapshot_date: day(d), value: (Math.floor(rnd() * 100000) / 100).toFixed(2), created_at: time(d) })
    }
    const asOf = day(Math.floor(rnd() * 28))
    const current = accountStatement(ACC, t, sn, asOf, tr).find((l) => !l.future && l.date <= asOf)
    const expected = balanceAt(ACC, t, sn, asOf, tr)
    const got = current ? current.balanceAfter : 0
    assert.ok(Math.abs(got - expected) < 0.005, `run ${run}: extrato ${got} vs balanceAt ${expected}`)
  }
})
