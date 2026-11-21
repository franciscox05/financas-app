import { languageInfo, t } from '../i18n'
import { Save, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import CollapsibleSection from './CollapsibleSection'
import { useToast } from '../context/toastContext'
import { normalize } from '../lib/categorySuggest'
import { listTransactionsInRange, updateTransactionsBulk } from '../lib/db'
import { addMonths, toIsoDate } from '../lib/dates'
import { eur } from '../lib/format'

// Nomes dos meses no idioma ativo (ex.: "Janeiro" / "January").
function monthNames() {
  return Array.from({ length: 12 }, (_, i) => {
    const s = new Date(2000, i, 1).toLocaleDateString(languageInfo().locale, { month: 'long' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  })
}

// Agrupa transações já guardadas pela mesma nota exata (e tipo), para
// corrigir a categoria/conta de muitas de uma vez — útil depois de uma
// importação em massa que caiu tudo em "Outros Gastos"/"Outros Ganhos".
export default function ReclassifySection({ accounts, categories }) {
  const toast = useToast()
  const [showSection, setShowSection] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [groups, setGroups] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear()
    return [current, current - 1, current - 2]
  }, [])

  async function handleLoad() {
    setError('')
    setLoading(true)
    try {
      const rangeStart = new Date(year, month - 1, 1)
      const rangeEnd = addMonths(rangeStart, 1)
      const transactions = await listTransactionsInRange({
        from: toIsoDate(rangeStart),
        to: toIsoDate(rangeEnd),
      })

      if (transactions.length === 0) {
        setError(t('rc.noTx'))
        setGroups(null)
        return
      }

      const byGroup = new Map()
      for (const tx of transactions) {
        const key = `${tx.type}|${normalize(tx.note || '')}`
        if (!byGroup.has(key)) {
          byGroup.set(key, {
            key,
            type: tx.type,
            note: tx.note || t('rc.noNote'),
            ids: [],
            total: 0,
            categoryId: tx.category_id,
            accountId: tx.account_id,
          })
        }
        const g = byGroup.get(key)
        g.ids.push(tx.id)
        g.total += Number(tx.amount)
      }

      const builtGroups = [...byGroup.values()].sort((a, b) => b.ids.length - a.ids.length)
      setGroups(builtGroups)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function updateGroup(key, changes) {
    setGroups((prev) => prev.map((g) => (g.key === key ? { ...g, ...changes } : g)))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await Promise.all(
        groups.map((g) =>
          updateTransactionsBulk(g.ids, { category_id: g.categoryId, account_id: g.accountId }),
        ),
      )
      toast.success(t('rc.updated'))
      setGroups(null)
    } catch (err) {
      toast.error(t('common.saveFailed', { msg: err.message }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <CollapsibleSection
      title={t('rc.title')}
      icon={Wand2}
      description={t('rc.desc')}
      open={showSection}
      onToggle={() => setShowSection((v) => !v)}
    >
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

          {error && <p className="text-sm text-negative">{error}</p>}

          {!groups && (
            <button
              onClick={handleLoad}
              disabled={loading}
              className="w-full min-h-11 rounded-control bg-accent-fill px-4 text-[0.9375rem] font-semibold text-white disabled:opacity-50"
            >
              {loading ? t('common.loadingDots') : t('rc.load')}
            </button>
          )}

          {groups && (
            <div className="space-y-3">
              <p className="text-xs text-label-2">
                {t('rc.summary', { n: groups.reduce((s, g) => s + g.ids.length, 0), groups: groups.length })}
              </p>

              <ul className="space-y-2">
                {groups.map((g) => {
                  const categoriesForType = categories.filter((c) => c.type === g.type)
                  return (
                    <li
                      key={g.key}
                      className="space-y-1.5 rounded-control border border-separator p-2"
                    >
                      <p className="text-sm">
                        <span className="font-medium text-label">
                          {g.note}
                        </span>
                        <span className="text-label-3">
                          {' '}
                          · {g.ids.length}x ·{' '}
                          <span className={g.type === 'income' ? 'text-positive' : 'text-negative'}>
                            {eur(g.total)}
                          </span>
                        </span>
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={g.categoryId}
                          onChange={(e) => updateGroup(g.key, { categoryId: e.target.value })}
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
                  onClick={handleSave}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-1.5 min-h-11 rounded-control bg-accent-fill px-4 text-[0.9375rem] font-semibold text-white disabled:opacity-50"
                >
                  <Save size={15} />
                  {saving ? t('common.saving') : t('rc.save')}
                </button>
                <button
                  onClick={() => setGroups(null)}
                  disabled={saving}
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
