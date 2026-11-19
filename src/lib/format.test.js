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
