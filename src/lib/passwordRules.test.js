import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkPassword, passwordErrorMessage } from './passwordRules.js'

test('password fraca falha nas regras certas', () => {
  const { rules, valid } = checkPassword('abcdefgh')
  assert.equal(valid, false)
  const failing = rules.filter((r) => !r.ok).map((r) => r.id)
  assert.deepEqual(failing, ['upper', 'digit'])
})

test('password curta falha só no comprimento', () => {
  const { rules, valid } = checkPassword('Ab1')
  assert.equal(valid, false)
  assert.deepEqual(
    rules.filter((r) => !r.ok).map((r) => r.id),
    ['length'],
  )
})

test('password com minúscula, maiúscula, número e 8+ caracteres é válida', () => {
  assert.equal(checkPassword('Financas2026').valid, true)
})

test('vazia não é válida', () => {
  assert.equal(checkPassword('').valid, false)
})

test('erros do Supabase têm mensagens em português', () => {
  assert.match(passwordErrorMessage({ code: 'same_password' }), /já tinhas/)
  assert.match(passwordErrorMessage({ code: 'weak_password' }), /regras/)
  assert.match(passwordErrorMessage({ code: 'qualquer_outro' }), /Tenta outra vez/)
  assert.equal(passwordErrorMessage(null), '')
})
