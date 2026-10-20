import { ChevronRight, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorNotice, PageSkeleton } from '../components/Feedback'
import Money from '../components/Money'
import { useToast } from '../context/toastContext'
import { createFriend, listFriendsWithBalance } from '../lib/friendsDb'
import { describeBalance } from '../lib/ledgerMath'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      setFriends(await listFriendsWithBalance())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
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
    if (!name.trim()) {
      setFormError('Indica o nome do amigo.')
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      await createFriend({ name, phone })
      setName('')
      setPhone('')
      setShowForm(false)
      await load()
      toast.success('Amigo adicionado.')
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <PageSkeleton />

  if (error && friends.length === 0) return <ErrorNotice message={error} onRetry={load} />

  return (
    <div className="space-y-6">
      {error && <ErrorNotice message={error} onRetry={load} />}

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
            description="Adiciona um amigo para registares o que pagaste por ele e o que ele pagou por ti."
            actionLabel={showForm ? undefined : '+ Adicionar amigo'}
            onAction={showForm ? undefined : () => setShowForm(true)}
          />
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {sorted.map((friend) => {
              const { state, amount } = describeBalance(friend.balance)
              const style = STATE_STYLES[state]
              return (
                <li key={friend.id}>
                  <Link
                    to={`/dividas/${friend.id}`}
                    className={`-mx-2 flex min-h-14 items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors duration-150 ease-out hover:bg-neutral-100 active:bg-neutral-200 motion-reduce:transition-none dark:hover:bg-neutral-800 dark:active:bg-neutral-700 ${focusRing}`}
                  >
                    <span className="min-w-0 truncate font-medium text-neutral-800 dark:text-neutral-200">
                      {friend.name}
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
