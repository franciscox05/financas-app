import test from 'node:test'
import assert from 'node:assert/strict'
import { TEMPLATES, TEMPLATE_IDS, buildCategories, suggestAccounts } from './onboardingTemplates.js'
import pt from '../i18n/locales/pt.js'
import en from '../i18n/locales/en.js'

const tr = (k) => pt[k] ?? k

test('todos os modelos têm pelo menos uma categoria de ganho e uma de gasto', () => {
  for (const id of TEMPLATE_IDS) {
    const cats = buildCategories(id, [], tr)
    assert.ok(cats.some((c) => c.type === 'income'), id)
    assert.ok(cats.some((c) => c.type === 'expense'), id)
  }
})

test('as chaves de todos os modelos existem em pt e en', () => {
  for (const tpl of Object.values(TEMPLATES)) {
    for (const key of [...tpl.income, ...tpl.expense]) {
      assert.ok(pt[key], `pt ${key}`)
      assert.ok(en[key], `en ${key}`)
    }
  }
  assert.deepEqual(Object.keys(pt).sort(), Object.keys(en).sort())
})

test('objetivos acrescentam poupança e empréstimos com as flags certas', () => {
  const cats = buildCategories('basic', ['invest', 'friends'], tr)
  assert.ok(cats.find((c) => c.name === 'Investimentos' && c.is_savings))
  assert.ok(cats.find((c) => c.name === 'Empréstimos' && c.is_lending && c.type === 'expense'))
  assert.ok(cats.find((c) => c.name === 'Devoluções' && c.is_lending && c.type === 'income'))
})

test('sem repetidos quando o objetivo repete uma categoria do modelo', () => {
  const cats = buildCategories('basic', ['invest', 'invest'], tr)
  assert.equal(cats.filter((c) => c.name === 'Investimentos').length, 1)
})

test('contas sugeridas dependem dos objetivos', () => {
  assert.deepEqual(suggestAccounts([]).map((a) => a.id), ['checking', 'cash'])
  assert.deepEqual(suggestAccounts(['save', 'invest']).map((a) => a.id), ['checking', 'cash', 'savings', 'investing'])
  assert.equal(suggestAccounts(['invest']).at(-1).type, 'investment')
})
