import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhone, reminderText, whatsappUrl, smsUrl, ledgerSummaryText } from './contactMessage.js'
import { eur } from './format.js'

test('normalizePhone: formatos portugueses convergem para 351 + 9 dígitos', () => {
  for (const raw of ['912 345 678', '+351 912345678', '00351912345678', '351912345678']) {
    assert.equal(normalizePhone(raw), '351912345678', raw)
  }
})

test('normalizePhone: inválidos dão null', () => {
  for (const raw of ['', null, undefined, 'abc', '123']) {
    assert.equal(normalizePhone(raw), null, String(raw))
  }
})

test('normalizePhone: números estrangeiros mantêm o indicativo', () => {
  assert.equal(normalizePhone('+44 7700 900123'), '447700900123')
})

test('reminderText: completo', () => {
  assert.equal(
    reminderText({ friendName: 'Miguel', amount: 8.8, note: 'Almoço de ontem', mbwayPhone: '912345678' }),
    `Olá Miguel! Ficou pendente ${eur(8.8)} (Almoço de ontem). Podes enviar por MB Way para 912 345 678 quando puderes? Obrigado!`,
  )
})

test('reminderText: sem nota omite o parêntesis', () => {
  assert.equal(
    reminderText({ friendName: 'Miguel', amount: 8.8, mbwayPhone: '912345678' }),
    `Olá Miguel! Ficou pendente ${eur(8.8)}. Podes enviar por MB Way para 912 345 678 quando puderes? Obrigado!`,
  )
})

test('reminderText: sem MB Way troca a frase', () => {
  assert.equal(
    reminderText({ friendName: 'Miguel', amount: 8.8, note: 'Almoço de ontem' }),
    `Olá Miguel! Ficou pendente ${eur(8.8)} (Almoço de ontem). Podes enviar quando puderes? Obrigado!`,
  )
})

test('reminderText: MB Way com 351 à frente mostra só os 9 dígitos agrupados', () => {
  const text = reminderText({ friendName: 'Miguel', amount: 8.8, mbwayPhone: '351912345678' })
  assert.ok(text.includes('para 912 345 678 quando'), text)
  assert.ok(!text.includes('351'), text)
})

test('whatsappUrl', () => {
  assert.equal(whatsappUrl('351912345678', 'Olá'), 'https://wa.me/351912345678?text=Ol%C3%A1')
  assert.equal(whatsappUrl(null, 'Olá'), 'https://wa.me/?text=Ol%C3%A1')
})

test('smsUrl', () => {
  assert.equal(smsUrl('351912345678', 'Olá'), 'sms:+351912345678?&body=Ol%C3%A1')
  assert.equal(smsUrl(null, 'Olá'), 'sms:?&body=Ol%C3%A1')
})

test('ledgerSummaryText: lista movimentos que contam e termina com o saldo', () => {
  const entries = [
    { kind: 'paid_for_them', amount: 25, note: 'Empréstimo', occurred_on: '2026-10-20', status: 'confirmed' },
    { kind: 'repaid_to_me', amount: 25, note: '', occurred_on: '2026-10-20', status: 'confirmed' },
    { kind: 'paid_for_them', amount: 999, occurred_on: '2026-10-19', status: 'declined' },
  ]
  const text = ledgerSummaryText({ friendName: 'Prima', entries, balance: 0 })
  assert.ok(text.includes('Conta-corrente com Prima'))
  assert.ok(text.includes(`20 out 2026 · Empréstimo: +${eur(25)}`))
  assert.ok(text.includes(`20 out 2026 · devolveu-me: -${eur(25)}`))
  assert.ok(!text.includes('999'))
  assert.ok(text.includes('Estão quites.'))
})

test('ledgerSummaryText: saldo diferente de zero em cada sentido', () => {
  assert.ok(
    ledgerSummaryText({ friendName: 'Prima', entries: [], balance: 12.5 }).includes(
      `Saldo atual: Prima deve-te ${eur(12.5)}.`,
    ),
  )
  assert.ok(
    ledgerSummaryText({ friendName: 'Prima', entries: [], balance: -12.5 }).includes(
      `Saldo atual: deves ${eur(12.5)} a Prima.`,
    ),
  )
})

test('formatPhoneDisplay mostra números portugueses legíveis e estrangeiros com +', async () => {
  const { formatPhoneDisplay } = await import('./contactMessage.js')
  assert.equal(formatPhoneDisplay('351912345678'), '912 345 678')
  assert.equal(formatPhoneDisplay('447911123456'), '+447911123456')
  assert.equal(formatPhoneDisplay(''), '')
})
