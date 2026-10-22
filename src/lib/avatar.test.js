import test from 'node:test'
import assert from 'node:assert/strict'
import { avatarInitials } from './avatar.js'

test('avatarInitials: nome com duas ou mais palavras usa as duas primeiras letras', () => {
  assert.equal(avatarInitials('Francisco Gonçalves', 'f@x.pt'), 'FG')
  assert.equal(avatarInitials('Francisco Miguel Gonçalves', 'f@x.pt'), 'FM')
})
test('avatarInitials: nome de uma palavra usa só essa letra', () => {
  assert.equal(avatarInitials('Francisco', 'f@x.pt'), 'F')
})
test('avatarInitials: sem nome cai na primeira letra do email', () => {
  assert.equal(avatarInitials('', 'tiago@x.pt'), 'T')
  assert.equal(avatarInitials(null, 'tiago@x.pt'), 'T')
})
test('avatarInitials: sem nome nem email dá "?"', () => {
  assert.equal(avatarInitials('', undefined), '?')
  assert.equal(avatarInitials(null, null), '?')
})
