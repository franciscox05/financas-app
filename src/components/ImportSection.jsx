import { languageInfo, t } from '../i18n'
import { TriangleAlert, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import CollapsibleSection from './CollapsibleSection'
import { useToast } from '../context/toastContext'
import { applyCategoryRules } from '../lib/categoryRules'
import { normalize, suggestCategoryId } from '../lib/categorySuggest'
import { createTransactionsBulk, listCategoryRules, listTransactionsInRange } from '../lib/db'
import { endOfMonth, toIsoDate } from '../lib/dates'
import { buildImportRows, detectMonthHeader, parseMonthText } from '../lib/importParser'
import { eur } from '../lib/format'

// Nomes dos meses no idioma ativo (ex.: "Janeiro" / "January").
function monthNames() {
  return Array.from({ length: 12 }, (_, i) => {
    const s = new Date(2000, i, 1).toLocaleDateString(languageInfo().locale, { month: 'long' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  })
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
  const [monthNotice, setMonthNotice] = useState('')

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
    setMonthNotice('')
    const parsed = parseMonthText(text)
    if (parsed.length === 0) {
      setError(t('imp.noLines'))
      return
    }

    // O dropdown pode ter voltado ao mês atual sem dar por isso (ex. a app
    // recarregou entretanto) — o cabeçalho do próprio texto colado ("Maio
    // 25") é a fonte de verdade sempre que existir, para nunca mais
    // importar para o mês errado silenciosamente.
    let effectiveYear = year
    let effectiveMonth = month
    const detected = detectMonthHeader(text)
    if (detected && (detected.year !== year || detected.month !== month)) {
      effectiveYear = detected.year
      effectiveMonth = detected.month
      setYear(detected.year)
      setMonth(detected.month)
      setMonthNotice(
        t('imp.detected', { found: `${monthNames()[detected.month - 1]} ${detected.year}`, was: `${monthNames()[month - 1]} ${year}` }),
      )
    } else if (detected) {
      setMonthNotice(t('imp.confirmed', { found: `${monthNames()[detected.month - 1]} ${detected.year}` }))
    } else {
      setMonthNotice(
        t('imp.noHeader', { month: `${monthNames()[month - 1]} ${year}` }),
      )
    }

    setAnalyzing(true)
    try {
      const rows = buildImportRows(parsed, effectiveYear, effectiveMonth)
      const rangeStart = toIsoDate(new Date(effectiveYear, effectiveMonth - 1, 1))
      const rangeEnd = toIsoDate(endOfMonth(new Date(effectiveYear, effectiveMonth - 1, 1)))
      const [existingThisMonth, existingAll, rules] = await Promise.all([
        listTransactionsInRange({
          from: rangeStart,
          to: toIsoDate(new Date(effectiveYear, effectiveMonth, 1)),
        }),
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
      setError(t('imp.pickOne'))
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
      toast.success(t('imp.imported', { n: rows.length }))
      setGroups(null)
      setText('')
    } catch (err) {
      toast.error(t('imp.failed', { msg: err.message }))
    } finally {
      setImporting(false)
    }
  }

  return (
    <CollapsibleSection
      title={t('imp.title')}
      icon={Upload}
      description={t('imp.desc')}
      open={showSection}
      onToggle={() => setShowSection((v) => !v)}
    >
      <div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-label-2">{t('rc.month')}</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full rounded-control border-0 bg-fill px-3 text-label focus:ring-2 focus:ring-accent"
            >
              {monthNames().map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-label-2">{t('rc.year')}</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-control border-0 bg-fill px-3 text-label focus:ring-2 focus:ring-accent"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-label-2">{t('imp.text')}</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Dia 3 -100€ aparelho\nDia 4 -20€ gasóleo\n...'}
          rows={8}
          className="w-full rounded-control border-0 bg-fill px-3 text-label focus:ring-2 focus:ring-accent"
        />
      </div>

      {error && <p className="text-sm text-negative">{error}</p>}

      {!groups && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !text.trim()}
              className="w-full min-h-11 rounded-control bg-accent-fill px-4 text-[0.9375rem] font-semibold text-white disabled:opacity-50"
            >
              {analyzing ? t('imp.analyzing') : t('imp.analyze')}
            </button>
          )}

          {groups && (
            <div className="space-y-3">
              {monthNotice && (
                <p className="rounded-control border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
                  {monthNotice}
                </p>
              )}
              <p className="text-xs text-label-2">
                {t('imp.importingInto')} <strong>{monthNames()[month - 1]} {year}</strong> ·{' '}
                {t('imp.found', { n: groups.reduce((s, g) => s + g.occurrences.length, 0), groups: groups.length })}
              </p>

              <ul className="space-y-2">
                {groups.map((g) => {
                  const categoriesForType = categories.filter((c) => c.type === g.type)
                  return (
                    <li
                      key={g.key}
                      className="space-y-1.5 rounded-control border border-separator p-2"
                    >
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={g.included}
                          onChange={(e) => updateGroup(g.key, { included: e.target.checked })}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-label">
                            {g.note || t('rc.noNote')}
                          </span>
                          <span className="text-label-3">
                            {' '}
                            · {g.occurrences.length}x ·{' '}
                            <span className={g.type === 'income' ? 'text-positive' : 'text-negative'}>
                              {eur(g.total)}
                            </span>
                          </span>
                          {g.duplicateCount > 0 && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-warning">
                              <TriangleAlert size={12} />
                              {t(g.duplicateCount === 1 ? 'imp.dup1' : 'imp.dupN', { n: g.duplicateCount })}
                            </span>
                          )}
                        </span>
                      </label>
                      <div className="grid grid-cols-2 gap-2 pl-6">
                        <select
                          value={g.categoryId}
                          onChange={(e) => updateGroup(g.key, { categoryId: e.target.value })}
                          disabled={!g.included}
                          className="w-full rounded-control border-0 bg-fill px-3 text-label focus:ring-2 focus:ring-accent"
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
                          className="w-full rounded-control border-0 bg-fill px-3 text-label focus:ring-2 focus:ring-accent"
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
                  className="flex flex-1 items-center justify-center gap-1.5 min-h-11 rounded-control bg-accent-fill px-4 text-[0.9375rem] font-semibold text-white disabled:opacity-50"
                >
                  <Upload size={15} />
                  {importing
                    ? t('imp.importing')
                    : t('imp.importN', { n: groups.filter((g) => g.included).reduce((s, g) => s + g.occurrences.length, 0) })}
                </button>
                <button
                  onClick={() => setGroups(null)}
                  disabled={importing}
                  className="min-h-11 rounded-control bg-fill px-4 text-[0.9375rem] font-semibold text-label"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
    </CollapsibleSection>
  )
}
