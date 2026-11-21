import test from 'node:test'
import assert from 'node:assert/strict'
import { dayHeading, groupByDay } from './dayGroups.js'

test('agrupa linhas seguidas do mesmo dia', () => {
  const rows = [{ occurred_on: '2026-11-21' }, { occurred_on: '2026-11-21' }, { occurred_on: '2026-11-19' }]
  assert.deepEqual(groupByDay(rows).map((g) => [g.date, g.rows.length]), [['2026-11-21', 2], ['2026-11-19', 1]])
})

test('hoje, ontem (também na mudança de mês) e outros dias', () => {
  const labels = { today: 'Hoje', yesterday: 'Ontem' }
  assert.equal(dayHeading('2026-11-21', '2026-11-21', labels), 'Hoje')
  assert.equal(dayHeading('2026-10-31', '2026-11-01', labels), 'Ontem')
  const other = dayHeading('2026-11-13', '2026-11-21', labels)
  assert.match(other, /13/)
  assert.doesNotMatch(other, /2026/)
  assert.match(dayHeading('2025-11-13', '2026-11-21', labels), /2025/)
})
