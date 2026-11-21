import test from 'node:test'
import assert from 'node:assert/strict'
import { dueRecurring, monthlyRecurringTotals, occurrenceDate, recurringState } from './recurring.js'

const rec = (over = {}) => ({ id: 'r', active: true, day_of_month: 10, last_generated_month: null, amount: 10, type: 'expense', ...over })

test('estado ao longo do mês', () => {
  assert.equal(recurringState(rec(), '2026-11-09'), 'upcoming')
  assert.equal(recurringState(rec(), '2026-11-10'), 'due')
  assert.equal(recurringState(rec(), '2026-11-30'), 'due')
  assert.equal(recurringState(rec({ last_generated_month: '2026-11-01' }), '2026-11-20'), 'done')
  assert.equal(recurringState(rec({ last_generated_month: '2026-10-01' }), '2026-11-20'), 'due')
  assert.equal(recurringState(rec({ active: false }), '2026-11-20'), 'paused')
})

test('lançado em dezembro não volta em dezembro; em janeiro volta', () => {
  const r = rec({ day_of_month: 1, last_generated_month: '2026-12-01' })
  assert.equal(recurringState(r, '2026-12-31'), 'done')
  assert.equal(recurringState(r, '2027-01-01'), 'due')
})

test('data do lançamento com zero à esquerda', () => {
  assert.equal(occurrenceDate(rec({ day_of_month: 5 }), '2026-11-21'), '2026-11-05')
})

test('lista por lançar, ordenada pelo dia', () => {
  const list = [rec({ id: 'b', day_of_month: 15 }), rec({ id: 'a', day_of_month: 3 }), rec({ id: 'c', day_of_month: 25 })]
  assert.deepEqual(dueRecurring(list, '2026-11-20').map((r) => r.id), ['a', 'b'])
})

test('totais mensais só dos ativos, em cêntimos', () => {
  const list = [rec({ amount: '0.10' }), rec({ amount: '0.20' }), rec({ amount: 500, type: 'income' }), rec({ amount: 99, active: false })]
  assert.deepEqual(monthlyRecurringTotals(list), { income: 500, expense: 0.3 })
})
