import { GripVertical, HandCoins, Pencil, PiggyBank, TrendingUp, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../context/toastContext'
import { parseBalanceValue } from '../lib/balanceInput'
import { MAX_NAME_LENGTH, validateName } from '../lib/names'
import { eur } from '../lib/format'
import ConfirmDialog from './ConfirmDialog'
import DragReorderList from './DragReorderList'
import Money from './Money'
import Segmented from './ui/Segmented'
import { inputClass, primaryButton, secondaryButton } from './ui/styles'

// Botão de ícone das linhas: 44 px de alvo de toque (antes eram ~24 px).
const iconButton = 'pressable flex size-11 shrink-0 items-center justify-center rounded-full'

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
  onToggleLending,
  onQuickSnapshot,
  dragHandleProps, // ligado à asa de arrastar; ausente = esta lista não é reordenável
  isDragging,
}) {
  const [editing, setEditing] = useState(false)
  const [updatingBalance, setUpdatingBalance] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [name, setName] = useState(item.name)
  const [newBalance, setNewBalance] = useState('')
  const [pendingBalance, setPendingBalance] = useState(null) // valor validado à espera de confirmação
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

  // 1.º passo: valida o que foi escrito e pede confirmação (o acerto substitui
  // o saldo calculado da conta — um engano aqui desalinha tudo a partir de hoje).
  function handleSaveBalance(e) {
    e.preventDefault()
    const value = parseBalanceValue(newBalance)
    if (value === null) {
      setError(newBalance.trim() === '' ? 'Escreve o saldo atual da conta (ex.: 150,27).' : 'Indica um valor válido (ex.: 150,27).')
      return
    }
    setError('')
    setPendingBalance(value)
  }

  // 2.º passo: só grava depois de confirmado.
  async function confirmSaveBalance() {
    const value = pendingBalance
    setPendingBalance(null)
    setBusy(true)
    try {
      await onQuickSnapshot(item, value)
      setNewBalance('')
      setUpdatingBalance(false)
    } catch {
      // O toast já avisou do erro.
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setConfirmingDelete(false)
    setBusy(true)
    try {
      await onDelete(item)
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <div className="py-2">
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
            <p role="alert" className="text-xs text-negative">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className={`${primaryButton} flex-1`}
            >
              {busy ? 'A guardar...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy}
              className={`${secondaryButton} flex-1`}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className={`py-1 ${isDragging ? 'bg-fill' : ''}`}>
      <div className="flex min-h-11 items-center justify-between gap-1">
        <span className="flex min-w-0 items-center gap-1">
          {dragHandleProps && (
            <button
              type="button"
              aria-label={`Arrastar para reordenar ${item.name}`}
              className="-ml-3 flex h-11 w-9 shrink-0 items-center justify-center rounded-control text-label-3"
              {...dragHandleProps}
            >
              <GripVertical size={18} aria-hidden="true" />
            </button>
          )}
          <span className="min-w-0">
            <span className="block truncate text-[1.0625rem] leading-snug text-label">{item.name}</span>
            {balance !== undefined && (
              <span className="amount block truncate text-[0.8125rem] leading-snug text-label-2">
                <Money value={balance} />
              </span>
            )}
          </span>
        </span>
        <div className="-mr-2 flex shrink-0 items-center">
          {onToggleSavings && item.type === 'expense' && (
            <button
              type="button"
              onClick={() => onToggleSavings(item, !item.is_savings)}
              title={
                item.is_savings
                  ? 'Marcada como poupança/investimento — não conta como gasto do dia a dia no resumo'
                  : 'Marcar como poupança/investimento'
              }
              aria-label={item.is_savings ? 'Poupança/investimento: ativo' : 'Marcar como poupança/investimento'}
              aria-pressed={item.is_savings}
              className={`flex size-11 shrink-0 items-center justify-center rounded-full ${
                item.is_savings
                  ? 'text-positive'
                  : 'text-label-3'
              }`}
            >
              <span className={`flex size-8 items-center justify-center rounded-full ${item.is_savings ? 'bg-positive/15' : ''}`}>
                <PiggyBank size={18} aria-hidden="true" />
              </span>
            </button>
          )}
          {onToggleLending && (
            <button
              type="button"
              onClick={() => onToggleLending(item, !item.is_lending)}
              title={
                item.is_lending
                  ? 'Marcada como empréstimo/devolução — não conta como gasto nem ganho do mês, aparece à parte'
                  : 'Marcar como empréstimo/devolução'
              }
              aria-label={item.is_lending ? 'Empréstimo/devolução: ativo' : 'Marcar como empréstimo/devolução'}
              aria-pressed={Boolean(item.is_lending)}
              className={`flex size-11 shrink-0 items-center justify-center rounded-full ${
                item.is_lending ? 'text-accent' : 'text-label-3'
              }`}
            >
              <span className={`flex size-8 items-center justify-center rounded-full ${item.is_lending ? 'bg-accent/15' : ''}`}>
                <HandCoins size={18} aria-hidden="true" />
              </span>
            </button>
          )}
          {onQuickSnapshot && (
            <button
              type="button"
              onClick={() => setUpdatingBalance((v) => !v)}
              aria-label={`Atualizar saldo de ${item.name}`}
              title="Atualizar saldo (regista o valor de hoje)"
              className={`${iconButton} text-accent`}
            >
              <TrendingUp size={19} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Renomear ${item.name}`}
            className={`${iconButton} text-label-2`}
          >
            <Pencil size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={!canDelete || busy}
            title={canDelete ? undefined : deleteHint}
            aria-label={`Apagar ${item.name}`}
            className={`${iconButton} text-label-2 disabled:cursor-not-allowed disabled:opacity-30`}
          >
            <Trash2 size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      {updatingBalance && (
        <form onSubmit={handleSaveBalance} className="mt-2 flex items-center gap-2">
          {/* type="text" + inputMode="decimal": com type="number", no iOS em
              português "150,27" chegava como '' e passava a 0. */}
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            placeholder="Valor atual (€)"
            value={newBalance}
            onChange={(e) => {
              setNewBalance(e.target.value)
              if (error) setError('')
            }}
            aria-label={`Novo saldo de ${item.name}`}
            aria-invalid={Boolean(error)}
            className={`${inputClass} flex-1`}
          />
          <button
            type="submit"
            disabled={busy || newBalance.trim() === ''}
            className={primaryButton}
          >
            OK
          </button>
        </form>
      )}
      <ConfirmDialog
        open={pendingBalance !== null}
        title={`Atualizar o saldo de "${item.name}"?`}
        message={
          pendingBalance === null
            ? ''
            : `${balance !== undefined ? `Passa de ${eur(balance)} para ${eur(pendingBalance)}.` : `Novo saldo: ${eur(pendingBalance)}.`} A partir de hoje a app usa este valor como saldo real da conta.`
        }
        confirmLabel="Atualizar saldo"
        onConfirm={confirmSaveBalance}
        onCancel={() => setPendingBalance(null)}
      />
      <ConfirmDialog
        open={confirmingDelete}
        title={`Apagar "${item.name}"?`}
        message={deleteWarning}
        confirmLabel="Apagar"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
      {updatingBalance && error && (
        <p role="alert" className="mt-1 text-xs text-negative">
          {error}
        </p>
      )}
    </div>
  )
}

// Lista agrupada por tipo, com renomear, apagar e adicionar. `scope` define em que
// universo o nome tem de ser único e qual o último item que não se pode apagar:
// 'all' = todos os itens, 'group' = só os do mesmo tipo.
export default function EntityManager({
  title,
  icon: Icon, // componente lucide-react opcional, visual de "hub" de definições
  noun, // ex.: 'conta', 'categoria'
  items,
  groups, // [{ type, label, tone? }] — `tone` pinta o texto do separador ativo
  scope,
  tabbed = false, // mostra um grupo de cada vez, em separadores como no Balanço
  deleteWarning,
  balances, // Map opcional item.id -> saldo atual (só para contas)
  onCreate,
  onRename,
  onDelete,
  onToggleSavings,
  onToggleLending,
  onQuickSnapshot,
  onReorder, // (groupItems, id, 'up'|'down') => Promise; só as contas usam
}) {
  const toast = useToast()
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState(groups[0].type)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const siblingsOf = (type) => (scope === 'all' ? items : items.filter((i) => i.type === type))
  // Com separadores, o separador ativo é também o tipo do item a criar.
  const activeGroup = groups.find((g) => g.type === newType)
  const visibleGroups = tabbed ? [activeGroup] : groups

  function selectType(type) {
    setNewType(type)
    setError('')
  }

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

  // Chamado pelo DragReorderList só UMA vez por gesto (ao soltar), já com a
  // lista desse grupo na ordem final — nunca a meio do arrasto.
  async function handleReorder(newGroupOrder) {
    try {
      await onReorder(newGroupOrder)
    } catch (err) {
      toast.error(`Não foi possível reordenar: ${err.message}`)
    }
  }

  async function handleToggleLending(item, value) {
    try {
      await onToggleLending(item, value)
      toast.success(
        value
          ? `"${item.name}" marcada como empréstimo/devolução: fica fora dos ganhos e gastos do mês.`
          : `"${item.name}" volta a contar nos ganhos e gastos do mês.`,
      )
    } catch (err) {
      toast.error(`Não foi possível atualizar: ${err.message}`)
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
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-[1.25rem] font-bold tracking-tight text-label">
        {Icon && <Icon size={20} strokeWidth={2.1} aria-hidden="true" className="text-accent" />} {title}
      </h2>

      {tabbed && (
        <Segmented
          label={`Tipo de ${noun}`}
          value={newType}
          onChange={selectType}
          options={groups.map((group) => ({ value: group.type, label: group.label, tone: group.tone }))}
        />
      )}

      {visibleGroups.map((group) => {
        const groupItems = items.filter((i) => i.type === group.type)
        const pool = scope === 'all' ? items : groupItems
        return (
          <div key={group.type}>
            {!tabbed && (
              <h3 className="mt-1 text-[0.8125rem] font-semibold tracking-wide text-label-2 uppercase">{group.label}</h3>
            )}
            {groupItems.length === 0 ? (
              <p className="py-3 text-[0.9375rem] text-label-2">Sem {noun}s deste tipo.</p>
            ) : onReorder ? (
              <DragReorderList
                items={groupItems}
                onReorder={handleReorder}
                className="divide-y divide-separator"
                renderItem={(item, { dragHandleProps, isDragging }) => (
                  <ManageRow
                    item={item}
                    dragHandleProps={dragHandleProps}
                    isDragging={isDragging}
                    siblings={siblingsOf(group.type)}
                    canDelete={pool.length > 1}
                    deleteHint={`Tem de existir pelo menos uma ${noun}${scope === 'group' ? ' deste tipo' : ''}.`}
                    deleteWarning={deleteWarning}
                    balance={balances?.get(item.id)}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onToggleSavings={onToggleSavings ? handleToggleSavings : undefined}
                    onToggleLending={onToggleLending ? handleToggleLending : undefined}
                    onQuickSnapshot={onQuickSnapshot ? handleQuickSnapshot : undefined}
                  />
                )}
              />
            ) : (
              <ul className="divide-y divide-separator">
                {groupItems.map((item) => (
                  <li key={item.id}>
                    <ManageRow
                      item={item}
                      siblings={siblingsOf(group.type)}
                      canDelete={pool.length > 1}
                      deleteHint={`Tem de existir pelo menos uma ${noun}${scope === 'group' ? ' deste tipo' : ''}.`}
                      deleteWarning={deleteWarning}
                      balance={balances?.get(item.id)}
                      onRename={handleRename}
                      onDelete={handleDelete}
                      onToggleSavings={onToggleSavings ? handleToggleSavings : undefined}
                    onToggleLending={onToggleLending ? handleToggleLending : undefined}
                      onQuickSnapshot={onQuickSnapshot ? handleQuickSnapshot : undefined}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}

      <form
        onSubmit={handleCreate}
        className="space-y-2 border-t-[0.5px] border-separator pt-4"
      >
        <p className="text-[0.8125rem] font-medium text-label-2">
          Nova {noun}
          {tabbed && ` · ${activeGroup.label}`}
        </p>
        {!tabbed && (
          <Segmented
            label={`Tipo de ${noun}`}
            value={newType}
            onChange={selectType}
            options={groups.map((group) => ({ value: group.type, label: group.label }))}
          />
        )}
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder={`Nome da ${noun}`}
          aria-label={`Nome da nova ${noun}`}
          className={inputClass}
        />
        {error && (
          <p role="alert" className="text-xs text-negative">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className={`${primaryButton} w-full`}
        >
          {submitting ? 'A criar...' : `Adicionar ${noun}`}
        </button>
      </form>
    </section>
  )
}
