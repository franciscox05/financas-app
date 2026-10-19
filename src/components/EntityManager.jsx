import { Pencil, PiggyBank, TrendingUp, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../context/toastContext'
import { MAX_NAME_LENGTH, validateName } from '../lib/names'
import { eur } from '../lib/format'

const inputClass =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100'

function ManageRow({
  item,
  canDelete,
  deleteHint,
  deleteWarning,
  siblings,
  balance,
  onRename,
  onDelete,
  onToggleSavings,
  onQuickSnapshot,
}) {
  const [editing, setEditing] = useState(false)
  const [updatingBalance, setUpdatingBalance] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [name, setName] = useState(item.name)
  const [newBalance, setNewBalance] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    const result = validateName(name, siblings, item.id)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.name === item.name) {
      setEditing(false)
      return
    }
    setBusy(true)
    setError('')
    try {
      await onRename(item, result.name)
      setEditing(false)
    } catch {
      // O toast já avisou do erro; fica em modo de edição para tentar de novo.
    } finally {
      setBusy(false)
    }
  }

  function handleCancel() {
    setName(item.name)
    setError('')
    setEditing(false)
  }

  async function handleSaveBalance(e) {
    e.preventDefault()
    const numeric = Number(newBalance)
    if (Number.isNaN(numeric) || numeric < 0) {
      setError('Indica um valor válido.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onQuickSnapshot(item, numeric)
      setNewBalance('')
      setUpdatingBalance(false)
    } catch {
      // O toast já avisou do erro.
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    try {
      await onDelete(item)
    } finally {
      setBusy(false)
      setConfirmingDelete(false)
    }
  }

  if (editing) {
    return (
      <li className="py-2">
        <form onSubmit={handleSave} className="space-y-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_NAME_LENGTH}
            aria-label={`Novo nome para ${item.name}`}
            className={inputClass}
          />
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-lg bg-neutral-900 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {busy ? 'A guardar...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy}
              className="flex-1 rounded-lg border border-neutral-300 py-1.5 text-sm dark:border-neutral-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm text-neutral-900 dark:text-neutral-100">
          {item.name}
          {balance !== undefined && (
            <span className="ml-1.5 text-xs text-neutral-400">· {eur(balance)}</span>
          )}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {onToggleSavings && item.type === 'expense' && (
            <button
              type="button"
              onClick={() => onToggleSavings(item, !item.is_savings)}
              title={
                item.is_savings
                  ? 'Marcada como poupança/investimento — não conta como gasto do dia a dia no resumo'
                  : 'Marcar como poupança/investimento'
              }
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                item.is_savings
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                  : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
              }`}
            >
              <PiggyBank size={14} />
            </button>
          )}
          {onQuickSnapshot && (
            <button
              type="button"
              onClick={() => setUpdatingBalance((v) => !v)}
              aria-label={`Atualizar saldo de ${item.name}`}
              title="Atualizar saldo (regista o valor de hoje)"
              className="rounded p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              <TrendingUp size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Renomear ${item.name}`}
            className="rounded p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <Pencil size={16} />
          </button>
          {confirmingDelete ? (
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={busy}
                className="rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
              >
                Cancelar
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={!canDelete}
              title={canDelete ? undefined : deleteHint}
              aria-label={`Apagar ${item.name}`}
              className="rounded p-1 text-neutral-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-neutral-400"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
      {updatingBalance && (
        <form onSubmit={handleSaveBalance} className="mt-2 flex items-center gap-2">
          <input
            autoFocus
            type="number"
            step="0.01"
            min="0"
            placeholder="Valor atual (€)"
            value={newBalance}
            onChange={(e) => setNewBalance(e.target.value)}
            aria-label={`Novo saldo de ${item.name}`}
            className={`${inputClass} flex-1`}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            OK
          </button>
        </form>
      )}
      {updatingBalance && error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
      {confirmingDelete && deleteWarning && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{deleteWarning}</p>
      )}
    </li>
  )
}

// Lista agrupada por tipo, com renomear, apagar e adicionar. `scope` define em que
// universo o nome tem de ser único e qual o último item que não se pode apagar:
// 'all' = todos os itens, 'group' = só os do mesmo tipo.
export default function EntityManager({
  title,
  noun, // ex.: 'conta', 'categoria'
  items,
  groups, // [{ type, label }]
  scope,
  deleteWarning,
  balances, // Map opcional item.id -> saldo atual (só para contas)
  onCreate,
  onRename,
  onDelete,
  onToggleSavings,
  onQuickSnapshot,
}) {
  const toast = useToast()
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState(groups[0].type)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const siblingsOf = (type) => (scope === 'all' ? items : items.filter((i) => i.type === type))

  async function handleCreate(e) {
    e.preventDefault()
    const result = validateName(newName, siblingsOf(newType))
    if (result.error) {
      setError(result.error)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onCreate({ name: result.name, type: newType })
      setNewName('')
      toast.success(`${noun[0].toUpperCase()}${noun.slice(1)} "${result.name}" criada.`)
    } catch (err) {
      toast.error(`Não foi possível criar: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRename(item, name) {
    try {
      await onRename(item, name)
      toast.success(`Renomeada para "${name}".`)
    } catch (err) {
      toast.error(`Não foi possível renomear: ${err.message}`)
      throw err
    }
  }

  async function handleDelete(item) {
    try {
      await onDelete(item)
      // Só é possível apagar quando nada referencia o item (apagar bloqueia
      // com transações/categorias associadas), por isso recriar com o mesmo
      // nome e tipo é sempre uma restauração completa e fiel.
      toast.success(`"${item.name}" apagada.`, {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            try {
              const restored = await onCreate({ name: item.name, type: item.type })
              if (item.is_savings && onToggleSavings) {
                await onToggleSavings(restored, true)
              }
              toast.success(`"${item.name}" restaurada.`)
            } catch (err) {
              toast.error(`Não foi possível desfazer: ${err.message}`)
            }
          },
        },
      })
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleQuickSnapshot(item, value) {
    try {
      await onQuickSnapshot(item, value)
      toast.success(`Saldo de "${item.name}" atualizado.`)
    } catch (err) {
      toast.error(`Não foi possível atualizar: ${err.message}`)
      throw err
    }
  }

  async function handleToggleSavings(item, value) {
    try {
      await onToggleSavings(item, value)
      toast.success(
        value
          ? `"${item.name}" marcada como poupança/investimento.`
          : `"${item.name}" volta a contar como gasto normal.`,
      )
    } catch (err) {
      toast.error(`Não foi possível atualizar: ${err.message}`)
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-neutral-500">{title}</h2>

      {groups.map((group) => {
        const groupItems = items.filter((i) => i.type === group.type)
        const pool = scope === 'all' ? items : groupItems
        return (
          <div key={group.type}>
            <h3 className="mb-1 text-xs uppercase tracking-wide text-neutral-400">{group.label}</h3>
            {groupItems.length === 0 ? (
              <p className="py-2 text-sm text-neutral-500">Sem {noun}s deste tipo.</p>
            ) : (
              <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {groupItems.map((item) => (
                  <ManageRow
                    key={item.id}
                    item={item}
                    siblings={siblingsOf(group.type)}
                    canDelete={pool.length > 1}
                    deleteHint={`Tem de existir pelo menos uma ${noun}${scope === 'group' ? ' deste tipo' : ''}.`}
                    deleteWarning={deleteWarning}
                    balance={balances?.get(item.id)}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onToggleSavings={onToggleSavings ? handleToggleSavings : undefined}
                    onQuickSnapshot={onQuickSnapshot ? handleQuickSnapshot : undefined}
                  />
                ))}
              </ul>
            )}
          </div>
        )
      })}

      <form
        onSubmit={handleCreate}
        className="space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
      >
        <p className="text-xs font-medium text-neutral-500">Nova {noun}</p>
        <div role="group" aria-label={`Tipo de ${noun}`} className="grid grid-cols-2 gap-1.5">
          {groups.map((group) => (
            <button
              key={group.type}
              type="button"
              aria-pressed={newType === group.type}
              onClick={() => {
                setNewType(group.type)
                setError('')
              }}
              className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
                newType === group.type
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              {group.label}
            </button>
          ))}
        </div>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder={`Nome da ${noun}`}
          aria-label={`Nome da nova ${noun}`}
          className={inputClass}
        />
        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {submitting ? 'A criar...' : `Adicionar ${noun}`}
        </button>
      </form>
    </section>
  )
}
