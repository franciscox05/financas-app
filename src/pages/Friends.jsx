import { ChevronRight, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorNotice, PageSkeleton } from '../components/Feedback'
import FriendAvatar from '../components/FriendAvatar'
import IncomingRequests from '../components/IncomingRequests'
import Money from '../components/Money'
import PendingEntriesStrip from '../components/PendingEntriesStrip'
import { useToast } from '../context/toastContext'
import { createFriend, listFriendsWithBalance } from '../lib/friendsDb'
import { describeBalance } from '../lib/ledgerMath'
import { listPendingForMe } from '../lib/linkedDb'
import { friendStateLabel } from '../lib/linkedLogic'
import { onPendingChanged } from '../lib/pendingEvents'

const inputClass =
  'min-h-11 w-full rounded-lg border border-neutral-300 px-3 py-2 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 motion-reduce:transition-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus-visible:outline-neutral-100'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'

const STATE_STYLES = {
  owes_me: { text: 'text-green-700 dark:text-green-500', label: 'Deve-te' },
  i_owe: { text: 'text-red-700 dark:text-red-500', label: 'Deves-lhe' },
  even: { text: 'text-neutral-500 dark:text-neutral-400', label: 'Quites' },
}

function totalLabel(state) {
  if (state === 'owes_me') return 'Devem-te'
  if (state === 'i_owe') return 'Deves'
  return 'Quites'
}

export default function Friends() {
  const toast = useToast()
  const [friends, setFriends] = useState([])
  const [pendingEntries, setPendingEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [requestLink, setRequestLink] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const loadSeq = useRef(0)
  const mounted = useRef(true)

  // Amigos e movimentos por confirmar recarregam juntos. A lista de movimentos
  // é secundária: se falhar, os amigos continuam visíveis.
  async function load({ silent = false } = {}) {
    const seq = ++loadSeq.current
    if (!silent) setLoading(true)
    setError('')
    try {
      const [list, pending] = await Promise.all([
        listFriendsWithBalance(),
        listPendingForMe().catch(() => null),
      ])
      if (!mounted.current || seq !== loadSeq.current) return
      setFriends(list)
      if (pending) setPendingEntries(pending)
    } catch (err) {
      if (mounted.current && seq === loadSeq.current) setError(err.message)
    } finally {
      if (mounted.current && seq === loadSeq.current) setLoading(false)
    }
  }

  useEffect(() => {
    mounted.current = true
    load()
    // Quando o emblema muda (ex.: aceitaste algo noutro ecrã), recarrega em silêncio.
    const off = onPendingChanged(() => load({ silent: true }))
    return () => {
      mounted.current = false
      off()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sorted = useMemo(
    () =>
      [...friends].sort(
        (a, b) => Math.abs(b.balance) - Math.abs(a.balance) || a.name.localeCompare(b.name, 'pt'),
      ),
    [friends],
  )

  // Soma em cêntimos para não acumular erros de vírgula flutuante.
  const total = useMemo(
    () => describeBalance(friends.reduce((sum, f) => sum + Math.round(f.balance * 100), 0) / 100),
    [friends],
  )

  async function handleCreate(e) {
    e.preventDefault()
    if (submitting) return
    if (!name.trim()) {
      setFormError('Indica o nome do amigo.')
      return
    }
    const sendRequest = requestLink && phone.trim() !== ''
    setSubmitting(true)
    setFormError('')
    try {
      await createFriend({ name, phone, requestLink: sendRequest })
      resetForm()
      await load()
      if (mounted.current) {
        toast.success(sendRequest ? 'Amigo adicionado e pedido enviado.' : 'Amigo adicionado.')
      }
    } catch (err) {
      if (!mounted.current) return
      if (err instanceof Error && err.message.startsWith('Amigo criado, mas ')) {
        // O amigo existe; só o pedido falhou. Fecha o formulário e mostra o motivo.
        resetForm()
        await load()
        if (mounted.current) toast.error(err.message)
      } else {
        setFormError(err.message)
      }
    } finally {
      if (mounted.current) setSubmitting(false)
    }
  }

  function resetForm() {
    if (!mounted.current) return
    setName('')
    setPhone('')
    setRequestLink(true)
    setShowForm(false)
  }

  if (loading) return <PageSkeleton />

  if (error && friends.length === 0) return <ErrorNotice message={error} onRetry={load} />

  return (
    <div className="space-y-6">
      {error && <ErrorNotice message={error} onRetry={load} />}

      <IncomingRequests onChanged={() => load({ silent: true })} />

      <PendingEntriesStrip entries={pendingEntries} friends={friends} />

      <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="text-xs text-neutral-500">No total</p>
        <p className={`text-2xl font-semibold tracking-tight ${STATE_STYLES[total.state].text}`}>
          {total.state === 'even' ? (
            'Quites'
          ) : (
            <>
              {totalLabel(total.state)} <Money value={total.amount} />
            </>
          )}
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-500">Amigos</h3>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            aria-expanded={showForm}
            className={`flex min-h-11 items-center gap-0.5 rounded-lg px-2 text-sm text-neutral-600 transition-colors duration-150 ease-out hover:text-neutral-900 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 dark:text-neutral-300 dark:hover:text-neutral-100 ${focusRing}`}
          >
            {showForm ? (
              'Fechar'
            ) : (
              <>
                <Plus size={14} /> Adicionar amigo
              </>
            )}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div>
              <label htmlFor="friend-name" className="mb-1 block text-xs font-medium text-neutral-500">
                Nome
              </label>
              <input
                id="friend-name"
                type="text"
                placeholder="Ex: João"
                autoComplete="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="friend-phone" className="mb-1 block text-xs font-medium text-neutral-500">
                Telemóvel (opcional)
              </label>
              <input
                id="friend-phone"
                type="tel"
                inputMode="tel"
                placeholder="Ex: 912 345 678"
                autoComplete="off"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
            </div>

            {phone.trim() !== '' && (
              <div>
                <label className="flex min-h-11 items-center gap-3 text-sm text-neutral-800 dark:text-neutral-200">
                  <input
                    type="checkbox"
                    checked={requestLink}
                    disabled={submitting}
                    onChange={(e) => setRequestLink(e.target.checked)}
                    className={`size-5 shrink-0 accent-neutral-900 dark:accent-neutral-100 ${focusRing}`}
                    aria-describedby="friend-request-link-hint"
                  />
                  Pedir para ligar contas
                </label>
                <p id="friend-request-link-hint" className="text-xs text-neutral-500">
                  Só funciona se a pessoa tiver a app e este número no perfil. Para contactos sem app, desmarca.
                </p>
              </div>
            )}

            {formError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={`min-h-11 w-full rounded-lg bg-neutral-900 font-medium text-white transition duration-150 ease-out hover:bg-neutral-700 active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 ${focusRing}`}
            >
              {submitting ? 'A guardar...' : 'Guardar amigo'}
            </button>
          </form>
        )}

        {sorted.length === 0 ? (
          <EmptyState
            title="Ainda não tens amigos aqui"
            description="Adiciona um amigo para registares o que pagaste e o que te pagaram."
            actionLabel={showForm ? undefined : '+ Adicionar amigo'}
            onAction={showForm ? undefined : () => setShowForm(true)}
          />
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {sorted.map((friend) => {
              const { state, amount } = describeBalance(friend.balance)
              const style = STATE_STYLES[state]
              const link = friendStateLabel(friend, null)
              return (
                <li key={friend.id}>
                  <Link
                    to={`/dividas/${friend.id}`}
                    className={`-mx-2 flex min-h-14 items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors duration-150 ease-out hover:bg-neutral-100 active:bg-neutral-200 motion-reduce:transition-none dark:hover:bg-neutral-800 dark:active:bg-neutral-700 ${focusRing}`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <FriendAvatar name={friend.name} avatarPath={friend.avatarPath} />
                      <span className="min-w-0 truncate font-medium text-neutral-800 dark:text-neutral-200">
                        {friend.name}
                        {link !== 'Local' && (
                          <span className="ml-2 text-xs font-normal text-neutral-500">{link}</span>
                        )}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-sm">
                      <span className="text-right">
                        <span className={`block font-semibold ${style.text}`}>
                          {state === 'even' ? 'Quites' : <Money value={amount} />}
                        </span>
                        {state !== 'even' && (
                          <span className={`block text-xs ${style.text}`}>{style.label}</span>
                        )}
                      </span>
                      <ChevronRight size={16} aria-hidden="true" className="text-neutral-400" />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
