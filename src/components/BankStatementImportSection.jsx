import { ArrowLeftRight, FileSpreadsheet, TriangleAlert, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import CollapsibleSection from './CollapsibleSection'
import { useToast } from '../context/toastContext'
import { applyCategoryRules } from '../lib/categoryRules'
import { normalize } from '../lib/categorySuggest'
import { buildCsvRows, detectColumns, parseCsvFile } from '../lib/csvImportParser'
import { createTransactionsBulk, listCategoryRules, listTransactionsInRange } from '../lib/db'
import { eur } from '../lib/format'
import { inputClass as sharedInputClass } from './ui/styles'

// Mesmo campo do resto da app (ui/styles.js).
const selectClass = sharedInputClass
const inputClass = selectClass

const ROW_TYPES = [
  { value: 'expense', label: 'Gasto' },
  { value: 'income', label: 'Ganho' },
]

export default function BankStatementImportSection({ accounts, categories }) {
  const toast = useToast()
  const [showSection, setShowSection] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')

  // null = ainda sem ficheiro; preenchido depois de parseCsvFile()
  const [detection, setDetection] = useState(null) // { headers, data, columns, confident }
  const [manualColumns, setManualColumns] = useState(null) // override do utilizador quando a deteção falha

  const [rows, setRows] = useState(null) // linhas prontas para revisão (fase 3)
  const [defaultAccountId, setDefaultAccountId] = useState('')
  const [bulkCategoryId, setBulkCategoryId] = useState('')
  const [categoryRules, setCategoryRules] = useState([])
  const [importing, setImporting] = useState(false)

  const needsManualMapping = detection && !detection.confident && !manualColumns

  async function handleFile(file) {
    if (!file) return
    setError('')
    setParsing(true)
    setDetection(null)
    setManualColumns(null)
    setRows(null)
    try {
      const { headers, data } = await parseCsvFile(file)
      const sample = data.slice(0, 20)
      const detected = detectColumns(headers, sample)
      setDetection({ headers, data, ...detected })
      if (detected.confident) {
        await buildPreview(data, detected.columns)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setParsing(false)
    }
  }

  async function buildPreview(data, cols) {
    setError('')
    try {
      const built = buildCsvRows(data, cols)
      const dates = built.map((r) => r.occurredOn).filter(Boolean).sort()
      const [existing, rules] = await Promise.all([
        dates.length > 0
          ? listTransactionsInRange({ from: dates[0], to: dates[dates.length - 1] })
          : Promise.resolve([]),
        listCategoryRules(),
      ])
      const existingKeys = new Set(
        existing.map((t) => `${t.occurred_on}|${Number(t.amount)}|${normalize(t.note || '')}`),
      )

      setCategoryRules(rules)

      const account = accounts.find((a) => a.type === 'cash')?.id ?? accounts[0]?.id ?? ''
      setDefaultAccountId(account)

      const withDefaults = built.map((row) => {
        const likelyDuplicate = !row.invalid && existingKeys.has(`${row.occurredOn}|${row.amount}|${normalize(row.note)}`)
        return {
          ...row,
          included: !row.invalid && !likelyDuplicate,
          likelyDuplicate,
          accountId: account,
          categoryId: row.invalid ? '' : defaultCategoryFor(row.type, rules, row.note),
          note: row.note,
        }
      })
      setRows(withDefaults)
    } catch (err) {
      setError(err.message)
    }
  }

  function defaultCategoryFor(type, rules, note) {
    const byRule = applyCategoryRules(note, type, rules)
    if (byRule) return byRule
    const fallbackName = type === 'income' ? 'Outros Ganhos' : 'Outros Gastos'
    const fallback = categories.find((c) => c.type === type && c.name === fallbackName)
    return fallback?.id ?? categories.find((c) => c.type === type)?.id ?? ''
  }

  async function handleConfirmManualMapping(cols) {
    setManualColumns(cols)
    setParsing(true)
    try {
      await buildPreview(detection.data, cols)
    } catch (err) {
      setError(err.message)
    } finally {
      setParsing(false)
    }
  }

  function updateRow(index, changes) {
    setRows((prev) => prev.map((r) => (r.index === index ? { ...r, ...changes } : r)))
  }

  function applyDefaultAccountToAll(accountId) {
    setDefaultAccountId(accountId)
    setRows((prev) => prev.map((r) => ({ ...r, accountId })))
  }

  // Trocar Gasto/Ganho tem de re-sugerir a categoria: as categorias são de um
  // tipo só, e manter a antiga deixaria a linha com uma categoria de gastos num
  // ganho (o <select> ficava vazio e a gravação era rejeitada).
  function changeRowType(index, type) {
    setRows((prev) =>
      prev.map((r) =>
        r.index === index ? { ...r, type, categoryId: defaultCategoryFor(type, categoryRules, r.note) } : r,
      ),
    )
  }

  // Alguns bancos exportam os gastos como valores positivos (ou invertem as
  // colunas Débito/Crédito): aí o extrato inteiro entra ao contrário e trocar
  // linha a linha seria impraticável.
  function invertAllTypes() {
    setRows((prev) =>
      prev.map((r) => {
        if (r.invalid) return r
        const type = r.type === 'income' ? 'expense' : 'income'
        return { ...r, type, categoryId: defaultCategoryFor(type, categoryRules, r.note) }
      }),
    )
  }

  function applyBulkCategory() {
    if (!bulkCategoryId) return
    setRows((prev) => prev.map((r) => (r.included ? { ...r, categoryId: bulkCategoryId } : r)))
  }

  function resetAll() {
    setDetection(null)
    setManualColumns(null)
    setRows(null)
    setError('')
  }

  async function handleImport() {
    const included = rows.filter((r) => r.included)
    if (included.length === 0) {
      setError('Seleciona pelo menos uma transação para importar.')
      return
    }
    if (included.some((r) => !r.accountId || !r.categoryId)) {
      setError('Há linhas selecionadas sem conta ou categoria escolhida.')
      return
    }
    setImporting(true)
    setError('')
    try {
      await createTransactionsBulk(
        included.map((r) => ({
          occurredOn: r.occurredOn,
          type: r.type,
          amount: r.amount,
          note: r.note,
          categoryId: r.categoryId,
          accountId: r.accountId,
        })),
      )
      toast.success(`${included.length} transações importadas.`)
      resetAll()
    } catch (err) {
      toast.error(`Não foi possível importar: ${err.message}`)
    } finally {
      setImporting(false)
    }
  }

  const includedCount = rows?.filter((r) => r.included).length ?? 0

  return (
    <CollapsibleSection
      title="Importar extrato bancário (CSV)"
      icon={FileSpreadsheet}
      description="Carrega o ficheiro CSV exportado do teu banco. A app tenta reconhecer as colunas automaticamente — revê e confirma cada movimento antes de guardar."
      open={showSection}
      onToggle={() => setShowSection((v) => !v)}
    >
      {error && <p className="text-sm text-negative">{error}</p>}

      {!detection && (
        <label className="flex flex-col items-center justify-center gap-2 rounded-control border-2 border-dashed border-separator px-4 py-10 text-center text-sm text-label-2 transition-colors hover:border-separator hover:bg-fill">
          <Upload size={22} className="text-label-3" aria-hidden="true" />
          <span className="font-medium text-label">
            {parsing ? 'A ler o ficheiro...' : 'Clica para escolher o ficheiro CSV'}
          </span>
          <span className="text-xs text-label-3">ou arrasta-o para aqui</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={parsing}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      )}

      {needsManualMapping && (
        <ManualColumnMapping headers={detection.headers} onConfirm={handleConfirmManualMapping} disabled={parsing} />
      )}

      {rows && rows.length > 0 && (
        <div className="space-y-3">
          <div className="space-y-2 rounded-control border border-warning/30 bg-warning/10 p-3">
            <p className="text-xs font-medium text-warning">
              Ações em bloco — aplicam-se a todas as linhas marcadas abaixo
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-warning">Conta destino (todas)</label>
                <select
                  value={defaultAccountId}
                  onChange={(e) => applyDefaultAccountToAll(e.target.value)}
                  className={selectClass}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-warning">Categoria (selecionadas)</label>
                <div className="flex gap-1">
                  <select
                    value={bulkCategoryId}
                    onChange={(e) => setBulkCategoryId(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Escolher...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={applyBulkCategory}
                    disabled={!bulkCategoryId}
                    className="shrink-0 rounded-control bg-warning px-3 text-xs font-medium text-white disabled:opacity-40"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={invertAllTypes}
              className="flex min-h-9 w-full items-center justify-center gap-1.5 rounded-control border border-warning/30 px-3 text-xs font-medium text-warning"
            >
              <ArrowLeftRight size={12} aria-hidden="true" />
              Trocar Gasto ↔ Ganho em todas
            </button>
            <p className="text-xs leading-relaxed text-warning">
              Usa isto se o teu banco exportar os gastos como valores positivos e o extrato tiver
              entrado todo ao contrário.
            </p>
          </div>

          <p className="text-xs text-label-2">
            {rows.length} linhas lidas · {includedCount} selecionadas para importar.
          </p>

          <ul className="space-y-2">
            {rows.map((row) => (
              <RowCard
                key={row.index}
                row={row}
                accounts={accounts}
                categories={categories.filter((c) => c.type === row.type)}
                onChange={(changes) => updateRow(row.index, changes)}
                onTypeChange={(type) => changeRowType(row.index, type)}
              />
            ))}
          </ul>

          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={importing || includedCount === 0}
              className="flex flex-1 items-center justify-center gap-1.5 min-h-11 rounded-control bg-accent-fill px-4 text-[0.9375rem] font-semibold text-white disabled:opacity-50"
            >
              <Upload size={15} />
              {importing ? 'A importar...' : `Importar ${includedCount} transações`}
            </button>
            <button
              onClick={resetAll}
              disabled={importing}
              className="min-h-11 rounded-control bg-fill px-4 text-[0.9375rem] font-semibold text-label"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </CollapsibleSection>
  )
}

function RowCard({ row, accounts, categories, onChange, onTypeChange }) {
  return (
    <li
      className={`space-y-2 rounded-control border p-3 ${
        row.invalid
          ? 'border-negative/30 bg-negative/10'
          : 'border-separator'
      }`}
    >
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={row.included}
          disabled={row.invalid}
          onChange={(e) => onChange({ included: e.target.checked })}
          className="mt-1 size-4 shrink-0"
        />
        <span className="min-w-0 flex-1 text-sm">
          <span className="flex items-center justify-between gap-2">
            <span className="text-label-2">{row.originalDate || '(sem data)'}</span>
            <span className={row.type === 'income' ? 'font-semibold text-positive' : 'font-semibold text-negative'}>
              {row.invalid ? row.originalAmount || '—' : eur(row.amount)}
            </span>
          </span>
          {row.invalid && (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-negative">
              <TriangleAlert size={12} /> Não consegui ler esta linha (data ou valor inválido) — ignorada.
            </span>
          )}
          {row.likelyDuplicate && (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-warning">
              <TriangleAlert size={12} /> Já existe uma transação igual — por defeito não vai ser importada.
            </span>
          )}
        </span>
      </label>

      {!row.invalid && (
        <div className="space-y-2 pl-6">
          <div role="group" aria-label="Gasto ou ganho" className="flex rounded-control bg-fill p-0.5">
            {ROW_TYPES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={!row.included}
                onClick={() => onTypeChange(opt.value)}
                aria-pressed={row.type === opt.value}
                className={`min-h-8 flex-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
                  row.type === opt.value
                    ? 'bg-surface text-label shadow-sm'
                    : 'text-label-2'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={row.note}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder="Título / nota"
            disabled={!row.included}
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={row.accountId}
              onChange={(e) => onChange({ accountId: e.target.value })}
              disabled={!row.included}
              className={selectClass}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select
              value={row.categoryId}
              onChange={(e) => onChange({ categoryId: e.target.value })}
              disabled={!row.included}
              className={selectClass}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </li>
  )
}

const ROLE_LABELS = {
  date: 'Data',
  amount: 'Valor (com sinal, ex. débitos negativos)',
  debit: 'Débito (opcional, se não houver coluna de Valor única)',
  credit: 'Crédito (opcional, se não houver coluna de Valor única)',
  description: 'Descrição',
}

function ManualColumnMapping({ headers, onConfirm, disabled }) {
  const [cols, setCols] = useState({ date: '', amount: '', debit: '', credit: '', description: '' })

  const canConfirm = useMemo(() => Boolean(cols.date) && (Boolean(cols.amount) || (cols.debit && cols.credit)), [cols])

  return (
    <div className="space-y-3 rounded-control border border-separator p-3">
      <p className="text-xs text-label-2">
        Não consegui reconhecer automaticamente as colunas deste ficheiro. Escolhe o que corresponde a cada campo
        (data e valor são obrigatórios; ou indica débito + crédito em vez de um valor único).
      </p>
      {Object.entries(ROLE_LABELS).map(([role, label]) => (
        <div key={role}>
          <label className="mb-1 block text-xs font-medium text-label-2">{label}</label>
          <select
            value={cols[role]}
            onChange={(e) => setCols((prev) => ({ ...prev, [role]: e.target.value }))}
            className={selectClass}
          >
            <option value="">— nenhuma —</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onConfirm(cols)}
        disabled={!canConfirm || disabled}
        className="w-full min-h-11 rounded-control bg-accent-fill px-4 text-[0.9375rem] font-semibold text-white disabled:opacity-50"
      >
        Confirmar colunas e continuar
      </button>
    </div>
  )
}
