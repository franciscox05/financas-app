import { Plus, TriangleAlert, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useToast } from '../context/toastContext'
import { applyCategoryRules } from '../lib/categoryRules'
import { normalize, suggestCategoryId } from '../lib/categorySuggest'
import { createTransactionsBulk, listCategoryRules, listTransactionsInRange } from '../lib/db'
import { endOfMonth, toIsoDate } from '../lib/dates'
import { buildImportRows, parseMonthText } from '../lib/importParser'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function eur(value) {
  return `${Number(value).toFixed(2)} €`
}

export default function ImportSection({ accounts, categories }) {
  const toast = useToast()
  const [showSection, setShowSection] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [text, setText] = useState('')
  const [groups, setGroups] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear()
    return [current, current - 1, current - 2]
  }, [])

  const defaultAccountId = accounts.find((a) => a.type === 'cash')?.id ?? accounts[0]?.id ?? ''

  function defaultCategoryFor(type, existingTransactions, rules, note) {
    const byRule = applyCategoryRules(note, type, rules)
    if (byRule) return byRule
    const suggested = suggestCategoryId(note, type, existingTransactions)
    if (suggested) return suggested
    const fallbackName = type === 'income' ? 'Outros Ganhos' : 'Outros Gastos'
    const fallback = categories.find((c) => c.type === type && c.name === fallbackName)
    return fallback?.id ?? categories.find((c) => c.type === type)?.id ?? ''
  }

  async function handleAnalyze() {
    setError('')
    const parsed = parseMonthText(text)
    if (parsed.length === 0) {
      setError('Não encontrei nenhuma linha no formato "Dia N -valor€ descrição". Confirma que colaste o texto certo.')
      return
    }

    setAnalyzing(true)
    try {
      const rows = buildImportRows(parsed, year, month)
      const rangeStart = toIsoDate(new Date(year, month - 1, 1))
      const rangeEnd = toIsoDate(endOfMonth(new Date(year, month - 1, 1)))
      const [existingThisMonth, existingAll, rules] = await Promise.all([
        listTransactionsInRange({ from: rangeStart, to: toIsoDate(new Date(year, month, 1)) }),
        listTransactionsInRange({ from: '2000-01-01', to: rangeEnd }),
        listCategoryRules(),
      ])

      const existingKeys = new Set(
        existingThisMonth.map((t) => `${t.occurred_on}|${Number(t.amount)}|${normalize(t.note || '')}`),
      )

      const byGroup = new Map()
      for (const row of rows) {
        const key = `${row.type}|${normalize(row.note)}`
        if (!byGroup.has(key)) {
          byGroup.set(key, {
            key,
            type: row.type,
            note: row.note,
            occurrences: [],
          })
        }
        byGroup.get(key).occurrences.push(row)
      }

      const builtGroups = [...byGroup.values()].map((g) => {
        const total = g.occurrences.reduce((s, o) => s + o.amount, 0)
        const duplicateCount = g.occurrences.filter((o) =>
          existingKeys.has(`${o.occurredOn}|${o.amount}|${normalize(o.note)}`),
        ).length
        return {
          ...g,
          total,
          duplicateCount,
          included: true,
          categoryId: defaultCategoryFor(g.type, existingAll, rules, g.note),
          accountId: defaultAccountId,
        }
      })

      builtGroups.sort((a, b) => b.occurrences.length - a.occurrences.length)
      setGroups(builtGroups)
    } catch (err) {
      setError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  function updateGroup(key, changes) {
    setGroups((prev) => prev.map((g) => (g.key === key ? { ...g, ...changes } : g)))
  }

  async function handleImport() {
    const included = groups.filter((g) => g.included)
    if (included.length === 0) {
      setError('Seleciona pelo menos uma nota para importar.')
      return
    }
    setImporting(true)
    setError('')
    try {
      const rows = included.flatMap((g) =>
        g.occurrences.map((o) => ({
          occurredOn: o.occurredOn,
          type: o.type,
          amount: o.amount,
          note: o.note,
          categoryId: g.categoryId,
          accountId: g.accountId,
        })),
      )
      await createTransactionsBulk(rows)
      toast.success(`${rows.length} transações importadas.`)
      setGroups(null)
      setText('')
    } catch (err) {
      toast.error(`Não foi possível importar: ${err.message}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-500">Importar histórico</h2>
        <button
          onClick={() => setShowSection((v) => !v)}
          className="flex items-center gap-0.5 text-xs text-neutral-500 underline-offset-2 hover:underline"
        >
          {showSection ? 'Fechar' : (
            <>
              <Plus size={13} /> Importar
            </>
          )}
        </button>
      </div>

      {showSection && (
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500">
            Cola o texto de um mês (linhas no formato "Dia N -valor€ descrição"). O resto do texto
            (resumos, totais) é ignorado automaticamente.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Dia 3 -100€ aparelho\nDia 4 -20€ gasóleo\n...'}
            rows={8}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          {!groups && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !text.trim()}
              className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {analyzing ? 'A analisar...' : 'Analisar texto'}
            </button>
          )}

          {groups && (
            <div className="space-y-3">
              <p className="text-xs text-neutral-500">
                {groups.reduce((s, g) => s + g.occurrences.length, 0)} transações encontradas, em{' '}
                {groups.length} notas distintas. Escolhe a categoria/conta de cada nota (aplica-se a
                todas as ocorrências dessa nota).
              </p>

              <ul className="space-y-2">
                {groups.map((g) => {
                  const categoriesForType = categories.filter((c) => c.type === g.type)
                  return (
                    <li
                      key={g.key}
                      className="space-y-1.5 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800"
                    >
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={g.included}
                          onChange={(e) => updateGroup(g.key, { included: e.target.checked })}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-neutral-800 dark:text-neutral-200">
                            {g.note || '(sem nota)'}
                          </span>
                          <span className="text-neutral-400">
                            {' '}
                            · {g.occurrences.length}x ·{' '}
                            <span className={g.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                              {eur(g.total)}
                            </span>
                          </span>
                          {g.duplicateCount > 0 && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
                              <TriangleAlert size={12} />
                              {g.duplicateCount} já parece{g.duplicateCount === 1 ? '' : 'm'} existir
                            </span>
                          )}
                        </span>
                      </label>
                      <div className="grid grid-cols-2 gap-2 pl-6">
                        <select
                          value={g.categoryId}
                          onChange={(e) => updateGroup(g.key, { categoryId: e.target.value })}
                          disabled={!g.included}
                          className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                        >
                          {categoriesForType.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={g.accountId}
                          onChange={(e) => updateGroup(g.key, { accountId: e.target.value })}
                          disabled={!g.included}
                          className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                        >
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                >
                  <Upload size={15} />
                  {importing
                    ? 'A importar...'
                    : `Importar ${groups.filter((g) => g.included).reduce((s, g) => s + g.occurrences.length, 0)} transações`}
                </button>
                <button
                  onClick={() => setGroups(null)}
                  disabled={importing}
                  className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm dark:border-neutral-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
