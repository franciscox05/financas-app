// Parte pura do "Exportar os meus dados" (ver exportData.js), sem Supabase,
// para poder ser testada com node --test.
// Monta o ficheiro a partir do resultado de cada tabela (puro, testável).
export function buildExport(results, { userId, email, exportedAt, app = 'Stingy' }) {
  const tables = {}
  const errors = {}
  for (const [table, result] of Object.entries(results)) {
    if (result.error) errors[table] = result.error
    else tables[table] = result.rows
  }
  return {
    app,
    format: 1,
    exported_at: exportedAt,
    user: { id: userId, email },
    counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
    tables,
    ...(Object.keys(errors).length ? { errors } : {}),
  }
}
