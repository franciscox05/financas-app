import test from 'node:test'
import assert from 'node:assert/strict'
import { eur } from './format.js'

test('eur formata em pt-PT com vírgula', () => {
  assert.equal(eur(483.83), '483,83 €')
})

test('eur não mostra zero negativo (soma em vírgula flutuante)', () => {
  assert.ok(0.3 - (0.1 + 0.2) < 0)
  assert.equal(eur(0.3 - (0.1 + 0.2)), '0,00 €')
  assert.equal(eur(-0), '0,00 €')
})

test('eur mantém o sinal em valores reais', () => {
  assert.equal(eur(-0.01), '-0,01 €')
})

import { eurCompact, setFormat } from './format.js'

test('eurCompact mantém o formato em pt-PT/EUR', () => {
  assert.equal(eurCompact(-11.06), '-11,06€')
  assert.equal(eurCompact(-209), '-209€')
  assert.equal(eurCompact(0), '0,00€')
  assert.equal(eurCompact(10, { signed: true }), '+10,00€')
})

test('setFormat troca idioma e moeda; valores inválidos são ignorados', () => {
  setFormat({ locale: 'en-US', currency: 'USD' })
  assert.equal(eur(1234.5), '$1,234.50')
  assert.equal(eurCompact(-11.06), '-$11.06')
  setFormat({ locale: 'xx-INVALID-zz', currency: 'NOPE' })
  assert.equal(eur(1), '$1.00')
  setFormat({ locale: 'pt-PT', currency: 'EUR' })
  assert.equal(eur(483.83), '483,83 €')
})
