import { ArrowLeft, Pencil, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import { EmptyState, ErrorNotice, PageSkeleton } from '../components/Feedback'
import LedgerEntryRow from '../components/LedgerEntryRow'
import Money from '../components/Money'
import NewExpenseSheet from '../components/NewExpenseSheet'
import RepaymentSheet from '../components/RepaymentSheet'
import { useToast } from '../context/toastContext'
import { deleteEntry, deleteFriend, listEntries, listFriendsWithBalance, updateFriend } from '../lib/friendsDb'
import { hasOpenBalance } from '../lib/friendsLogic'
import { balanceOf, describeBalance, suggestedRepayment } from '../lib/ledgerMath'

const inputClass =
  'min-h-11 w-full rounded-lg border border-neutral-300 px-3 py-2 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 motion-reduce:transition-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus-visible:outline-neutral-100'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'

const buttonBase = `min-h-11 rounded-lg px-3 text-sm font-medium transition duration-150 ease-out active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing}`
const primaryButton = `${buttonBase} bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300`
const secondaryButton = `${buttonBase} border border-neutral-300 text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800`

const STATE_TEXT = {
  owes_me: 'text-green-700 dark:text-green-500',
  i_owe: 'text-red-700 dark:text-red-500',
  even: 'text-neutral-500 dark:text-neutral-400',
}

export default function FriendLedger() {
  const { friendId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [friend, setFriend] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [panel, setPanel] = useState(null) // 'expense' | 'repayment' | null
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameError, setNameError] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [confirmFriendDelete, setConfirmFriendDelete] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [friends, list] = await Promise.all([listFriendsWithBalance(), listEntries(friendId)])
      setFriend(friends.find((f) => f.id === friendId) ?? null)
      setEntries(list)
    } catch (err) {
      setError(err.message || 'Não foi possível carregar este amigo. Tenta outra vez.')
    } finally {
      setLoading(false)
    }
  }, [friendId])

  useEffect(() => {
    load()
  }, [load])

  async function afterChange(message) {
    setPanel(null)
    await load()
    toast.success(message)
  }

  async function handleSaveName(e) {
    e.preventDefault()
    setSavingName(true)
    setNameError('')
    try {
      const updated = await updateFriend({ id: friend.id, name: nameDraft, phone: friend.phone })
      setFriend((f) => ({ ...f, name: updated.name }))
      setEditing(false)
      toast.success('Nome atualizado.')
    } catch (err) {
      setNameError(err.message || 'Não foi possível guardar o nome. Tenta outra vez.')
    } finally {
      setSavingName(false)
    }
  }

  async function handleDeleteEntry() {
    const entry = deleteTarget
    setDeleteTarget(null)
    try {
      await deleteEntry(entry)
      await load()
      toast.success('Movimento apagado.')
    } catch (err) {
      toast.error(err.message || 'Não foi possível apagar o movimento. Tenta outra vez.')
    }
  }

  async function handleDeleteFriend() {
    setConfirmFriendDelete(false)
    try {
      await deleteFriend(friend.id)
      toast.success('Amigo apagado.')
      navigate('/dividas')
    } catch (err) {
      toast.error(err.message || 'Não foi possível apagar o amigo. Tenta outra vez.')
    }
  }

  if (loading && !friend) return <PageSkeleton />
  if (error && !friend) return <ErrorNotice message={error} onRetry={load} />

  if (!friend) {
    return (
      <div className="space-y-3">
        <p className="text-neutral-700 dark:text-neutral-300">Amigo não encontrado.</p>
        <Link to="/dividas" className={`inline-flex min-h-11 items-center text-sm underline ${focusRing}`}>
          Voltar às dívidas
        </Link>
      </div>
    )
  }

  const balance = balanceOf(entries)
  const { state, amount } = describeBalance(balance)
  const repayment = suggestedRepayment(balance)
  const canDeleteFriend = !hasOpenBalance(balance)
  const deleteHasBank = deleteTarget?.settlement === 'bank' && Boolean(deleteTarget?.transaction_id)

  return (
    <div className="space-y-6">
      {error && <ErrorNotice message={error} onRetry={load} />}

      <header className="space-y-1">
        <Link
          to="/dividas"
          className={`-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-neutral-600 transition-colors duration-150 ease-out hover:text-neutral-900 motion-reduce:transition-none dark:text-neutral-300 dark:hover:text-neutral-100 ${focusRing}`}
        >
          <ArrowLeft size={16} aria-hidden="true" /> Dívidas
        </Link>

        {editing ? (
          <form onSubmit={handleSaveName} className="space-y-2">
            <label htmlFor="friend-edit-name" className="block text-xs font-medium text-neutral-500">
              Nome
            </label>
            <input
              id="friend-edit-name"
              type="text"
              autoComplete="off"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className={inputClass}
            />
            {nameError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {nameError}
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={savingName} className={primaryButton}>
                {savingName ? 'A guardar...' : 'Guardar'}
              </button>
              <button type="button" onClick={() => setEditing(false)} className={secondaryButton}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-1">
            <h2 className="min-w-0 truncate text-xl font-semibold tracking-tight">{friend.name}</h2>
            <button
              type="button"
              onClick={() => {
                setNameDraft(friend.name)
                setNameError('')
                setEditing(true)
              }}
              aria-label="Editar nome"
              className={`flex size-11 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors duration-150 ease-out hover:text-neutral-900 motion-reduce:transition-none dark:hover:text-neutral-100 ${focusRing}`}
            >
              <Pencil size={16} aria-hidden="true" />
            </button>
          </div>
        )}
        {friend.phone && !editing && <p className="text-sm text-neutral-500">{friend.phone}</p>}
      </header>

      <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="text-xs text-neutral-500">Neste momento</p>
        <p className={`text-2xl font-semibold tracking-tight ${STATE_TEXT[state]}`}>
          {state === 'even' ? (
            'Estão quites'
          ) : (
            <>
              {state === 'owes_me' ? 'Deve-te' : 'Deves-lhe'} <Money value={amount} />
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setPanel(panel === 'expense' ? null : 'expense')}
          aria-expanded={panel === 'expense'}
          className={`${primaryButton} flex items-center justify-center gap-1`}
        >
          <Plus size={14} aria-hidden="true" /> Novo gasto
        </button>
        {repayment && (
          <button
            type="button"
            onClick={() => setPanel(panel === 'repayment' ? null : 'repayment')}
            aria-expanded={panel === 'repayment'}
            className={secondaryButton}
          >
            {repayment.kind === 'repaid_to_me' ? 'Ele devolveu-me ' : 'Devolvi-lhe '}
            <Money value={repayment.amount} />
          </button>
        )}
      </div>

      {panel === 'expense' && (
        <NewExpenseSheet
          friend={friend}
          onDone={() => afterChange('Gasto registado.')}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel === 'repayment' && repayment && (
        <RepaymentSheet
          friend={friend}
          balance={balance}
          onDone={() => afterChange('Devolução registada.')}
          onCancel={() => setPanel(null)}
        />
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-neutral-500">Movimentos</h3>
        {entries.length === 0 ? (
          <EmptyState
            title="Ainda sem movimentos"
            description="Regista o primeiro gasto para começares o conta-corrente."
          />
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {entries.map((entry) => (
              <LedgerEntryRow key={entry.id} entry={entry} onDelete={setDeleteTarget} />
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
        {canDeleteFriend ? (
          <button
            type="button"
            onClick={() => setConfirmFriendDelete(true)}
            className={`${secondaryButton} text-red-700 dark:text-red-400`}
          >
            Apagar amigo
          </button>
        ) : (
          <p className="text-sm text-neutral-500">Ainda há saldo por acertar com esta pessoa.</p>
        )}
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Apagar movimento?"
        message={
          deleteHasBank
            ? 'Este movimento deixa de contar no saldo. Também apaga a transação criada na conta.'
            : 'Este movimento deixa de contar no saldo.'
        }
        confirmLabel="Apagar movimento"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteEntry}
      />
      <ConfirmDialog
        open={confirmFriendDelete}
        title={`Apagar ${friend.name}?`}
        message="Os movimentos antigos desta pessoa também são apagados."
        confirmLabel="Apagar amigo"
        onCancel={() => setConfirmFriendDelete(false)}
        onConfirm={handleDeleteFriend}
      />
    </div>
  )
}
