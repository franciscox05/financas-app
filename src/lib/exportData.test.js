import test from 'node:test'
import assert from 'node:assert/strict'

// exportData.js importa o cliente Supabase (precisa das variáveis do Vite); a
// parte pura vive em exportDataBuild.js e é essa que se testa.
import { buildExport } from './exportDataBuild.js'

test('junta tabelas, conta linhas e regista as que falharam', () => {
  const out = buildExport(
    { accounts: { rows: [{ id: 1 }, { id: 2 }] }, budgets: { error: 'relation does not exist' } },
    { userId: 'u', email: 'a@b.c', exportedAt: '2026-11-21T10:00:00Z' },
  )
  assert.equal(out.app, 'Stingy')
  assert.deepEqual(out.counts, { accounts: 2 })
  assert.deepEqual(out.errors, { budgets: 'relation does not exist' })
  assert.deepEqual(out.user, { id: 'u', email: 'a@b.c' })
})

test('sem erros não há chave errors', () => {
  const out = buildExport({ notes: { rows: [] } }, { userId: 'u', email: null, exportedAt: 'x' })
  assert.equal('errors' in out, false)
  assert.deepEqual(out.counts, { notes: 0 })
})
