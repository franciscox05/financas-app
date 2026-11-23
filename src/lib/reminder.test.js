import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isDue,
  lisbonNow,
  reminderBody,
  REMINDER_BODY,
} from '../../supabase/functions/send-daily-reminder/reminder.js'

test('lisbonNow: inverno = UTC', () => {
  assert.deepEqual(lisbonNow(new Date('2026-12-10T23:00:00Z')), { date: '2026-12-10', hour: 23 })
})

test('lisbonNow: verão = UTC+1 e passa a meia-noite', () => {
  assert.deepEqual(lisbonNow(new Date('2026-07-10T22:30:00Z')), { date: '2026-07-10', hour: 23 })
  assert.deepEqual(lisbonNow(new Date('2026-07-10T23:00:00Z')), { date: '2026-07-11', hour: 0 })
})

test('lisbonNow: mudança de março (01:00 UTC passa a 02:00 em Lisboa)', () => {
  assert.equal(lisbonNow(new Date('2026-03-29T00:59:00Z')).hour, 0)
  assert.equal(lisbonNow(new Date('2026-03-29T01:00:00Z')).hour, 2)
})

test('lisbonNow: hora 01 repete-se em outubro (00:xx e 01:xx UTC)', () => {
  assert.equal(lisbonNow(new Date('2026-10-25T00:00:00Z')).hour, 1)
  assert.equal(lisbonNow(new Date('2026-10-25T01:00:00Z')).hour, 1)
  assert.equal(lisbonNow(new Date('2026-10-25T02:00:00Z')).hour, 2)
})

test('isDue: só na hora escolhida e uma vez por dia', () => {
  const now = { date: '2026-10-25', hour: 1 }
  const p = { reminder_hour: 1, reminder_last_sent_on: null }
  assert.equal(isDue(p, now), true)
  assert.equal(isDue({ ...p, reminder_hour: 23 }, now), false)
  // segunda passagem pela hora 01 em outubro: já enviado hoje
  assert.equal(isDue({ ...p, reminder_last_sent_on: '2026-10-25' }, now), false)
  assert.equal(isDue({ ...p, reminder_last_sent_on: '2026-10-24' }, now), true)
})

test('reminderBody: PT por omissão, EN quando o perfil é inglês', () => {
  assert.equal(reminderBody('en'), REMINDER_BODY.en)
  assert.equal(reminderBody('en-GB'), REMINDER_BODY.en)
  assert.equal(reminderBody('pt'), REMINDER_BODY.pt)
  assert.equal(reminderBody(null), REMINDER_BODY.pt)
  assert.equal(reminderBody('fr'), REMINDER_BODY.pt)
})
