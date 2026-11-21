import { buildExport } from './exportDataBuild.js'
import { supabase } from './supabase'

export { buildExport }

// "Exportar os meus dados" (RGPD, direito de portabilidade): tudo o que a
// pessoa tem na app num só ficheiro JSON. Lê tabela a tabela com a sessão do
// próprio utilizador, por isso a RLS garante que só vêm as linhas dele (e as
// partilhadas com ele, como movimentos com amigos ligados).
//
// Uma tabela que falhe (ex.: ainda não existe nesta base) não estraga o resto:
// fica registada em `errors` e as outras seguem.
// `friend_requests` fica de fora: a tabela não tem acesso direto pelo cliente
// ("permission denied"), só por funções do servidor.
export const EXPORT_TABLES = [
  'profiles',
  'accounts',
  'categories',
  'category_rules',
  'transactions',
  'transfers',
  'net_worth_snapshots',
  'budgets',
  'recurring_transactions',
  'friends',
  'ledger_entries',
  'goals',
  'notes',
]

const PAGE = 1000

async function readAll(table) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE) return rows
  }
}

export async function exportAllData() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  const results = {}
  for (const table of EXPORT_TABLES) {
    try {
      results[table] = { rows: await readAll(table) }
    } catch (err) {
      results[table] = { error: err.message }
    }
  }
  return buildExport(results, {
    userId: data.user.id,
    email: data.user.email,
    exportedAt: new Date().toISOString(),
  })
}

export function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
