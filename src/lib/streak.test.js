import test from 'node:test'
import assert from 'node:assert/strict'
import { isMilestone, loggingStreak } from './streak.js'

test('sequência conta até hoje quando hoje já tem registo', () => {
  const r = loggingStreak(['2026-11-19', '2026-11-20', '2026-11-21', '2026-11-21'], '2026-11-21')
  assert.deepEqual(r, { days: 3, loggedToday: true, best: 3 })
})

test('sem registo hoje, a sequência de ontem continua viva', () => {
  const r = loggingStreak(['2026-11-19', '2026-11-20'], '2026-11-21')
  assert.equal(r.days, 2)
  assert.equal(r.loggedToday, false)
})

test('um dia em falha parte a sequência', () => {
  const r = loggingStreak(['2026-11-17', '2026-11-18', '2026-11-20'], '2026-11-21')
  assert.equal(r.days, 1)
  assert.equal(r.best, 2)
})

test('sem registos recentes, sequência é zero', () => {
  assert.equal(loggingStreak(['2026-10-01'], '2026-11-21').days, 0)
  assert.equal(loggingStreak([], '2026-11-21').days, 0)
})

test('passa bem a viragem de mês e de ano', () => {
  assert.equal(loggingStreak(['2025-12-31', '2026-01-01'], '2026-01-01').days, 2)
  assert.equal(loggingStreak(['2026-02-28', '2026-03-01'], '2026-03-01').days, 2)
})

test('marcos', () => {
  assert.equal(isMilestone(7), true)
  assert.equal(isMilestone(8), false)
})
