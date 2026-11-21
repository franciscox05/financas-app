import test from 'node:test'
import assert from 'node:assert/strict'
import { categoryInsights } from './insights.js'

const tx = (name, amount) => ({ type: 'expense', amount, category_id: name, categories: { name } })

test('S2-8: meses sem movimentos não entram na média', () => {
  // Só 1 dos 3 meses anteriores tem dados (100 em Lazer). Este mês: 130.
  const prior = [{ txs: [] }, { txs: [] }, { txs: [tx('Lazer', 100)] }]
  const out = categoryInsights([{ name: 'Lazer', amount: 130 }], prior)
  assert.deepEqual(out, [{ name: 'Lazer', diffPct: 30 }]) // antes dava 290 %
})

test('abaixo de 20 % ou sem meses com dados: nada', () => {
  assert.deepEqual(categoryInsights([{ name: 'Lazer', amount: 110 }], [{ txs: [tx('Lazer', 100)] }]), [])
  assert.deepEqual(categoryInsights([{ name: 'Lazer', amount: 110 }], [{ txs: [] }]), [])
})

test('empréstimos ficam de fora', () => {
  const prior = [{ txs: [tx('Emp', 10)] }]
  assert.deepEqual(categoryInsights([{ name: 'Emp', amount: 100 }], prior, new Set(['Emp'])), [])
})
