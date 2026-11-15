import { Plus, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorNotice, PageSkeleton } from '../components/Feedback'
import FriendAvatar from '../components/FriendAvatar'
import IncomingRequests from '../components/IncomingRequests'
import Money from '../components/Money'
import PendingEntriesStrip from '../components/PendingEntriesStrip'
import { useToast } from '../context/toastContext'
import { createFriend, listFriendsWithBalance } from '../lib/friendsDb'
import { describeBalance, positionsFromBalances } from '../lib/ledgerMath'
import { listPendingForMe } from '../lib/linkedDb'
import { friendStateLabel } from '../lib/linkedLogic'
import { onPendingChanged } from '../lib/pendingEvents'
import Modal from '../components/Modal'
import Group, { Row } from '../components/ui/Group'
import IconButton from '../components/ui/IconButton'
import PageHeader from '../components/ui/PageHeader'

// Campo de escrita das folhas novas: sem borda, fundo de preenchimento e anel
// na cor de destaque ao focar (o `border-color` global não se vê sem borda).
const inputClass =
  'min-h-11 w-full rounded-control border-0 bg-fill px-3.5 text-[1.0625rem] text-label placeholder:text-label-3 focus:ring-2 focus:ring-accent'

const STATE_STYLES = {
  owes_me: { text: 'text-positive', label: 'Deve-te' },
  i_owe: { text: 'text-negative', label: 'Deves-lhe' },
  even: { text: 'text-label-2', label: 'Quites' },
}

export default function Friends() {
  const toast = useToast()
  const formTitleId = useId()
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

  // Ordem alfabética estrita — pedido explícito do Francisco, em vez da
  // ordenação anterior por saldo em dívida (que ia mudando a posição de cada
  // amigo sempre que o saldo mudava e parecia aleatória/cronológica).
  const sorted = useMemo(
    () => [...friends].sort((a, b) => a.name.localeCompare(b.name, 'pt')),
    [friends],
  )

  // Duas posições, não um líquido: 50 € a receber de um amigo e 30 € a pagar a
  // outro não são "devem-te 20 €" — são dois valores que não se cancelam.
  const positions = useMemo(() => positionsFromBalances(friends.map((f) => f.balance)), [friends])

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

  // Fechar a folha não apaga o que já foi escrito (como o antigo "Fechar"):
  // só o guardar com sucesso limpa os campos.
  function closeForm() {
    if (submitting) return
    setFormError('')
    setShowForm(false)
  }

  const addButton = (
    <IconButton label="Adicionar amigo" tone="accent" onClick={() => setShowForm(true)}>
      <Plus size={26} strokeWidth={2.1} aria-hidden="true" />
    </IconButton>
  )

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader title="Amigos" />
        <PageSkeleton />
      </div>
    )
  }

  if (error && friends.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader title="Amigos" />
        <ErrorNotice message={error} onRetry={load} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Amigos" trailing={addButton} />

      {error && <ErrorNotice message={error} onRetry={load} />}

      <IncomingRequests onChanged={() => load({ silent: true })} />

      <PendingEntriesStrip entries={pendingEntries} friends={friends} />

      {sorted.length > 0 && (
        <section aria-label="Resumo" className="grid grid-cols-2 gap-3">
          <div className="min-w-0 rounded-group bg-surface p-4">
            <p className="text-[0.8125rem] text-label-2">A receber</p>
            <p
              className={`amount display mt-1 truncate text-[1.625rem] leading-tight font-bold tracking-tight ${
                positions.receivable > 0 ? 'text-positive' : 'text-label-3'
              }`}
            >
              <Money value={positions.receivable} />
            </p>
          </div>
          <div className="min-w-0 rounded-group bg-surface p-4">
            <p className="text-[0.8125rem] text-label-2">A pagar</p>
            <p
              className={`amount display mt-1 truncate text-[1.625rem] leading-tight font-bold tracking-tight ${
                positions.payable > 0 ? 'text-negative' : 'text-label-3'
              }`}
            >
              <Money value={positions.payable} />
            </p>
          </div>
        </section>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          title="Ainda não tens amigos aqui"
          description="Adiciona um amigo para registares o que pagaste e o que te pagaram."
          actionLabel="Adicionar amigo"
          onAction={() => setShowForm(true)}
        />
      ) : (
        // 4rem = margem (16) + avatar (36) + espaço (12): o separador começa
        // onde começa o nome, não por baixo da fotografia.
        <Group list inset="4rem">
          {sorted.map((friend) => {
            const { state, amount } = describeBalance(friend.balance)
            const style = STATE_STYLES[state]
            const link = friendStateLabel(friend, null)
            return (
              <Row
                key={friend.id}
                as={Link}
                to={`/dividas/${friend.id}`}
                leading={<FriendAvatar name={friend.name} avatarPath={friend.avatarPath} />}
                title={friend.name}
                subtitle={link !== 'Local' ? link : undefined}
                value={state === 'even' ? 'Quites' : <Money value={amount} />}
                valueNote={state !== 'even' ? style.label : undefined}
                valueClassName={`${style.text} ${state === 'even' ? '' : 'font-semibold'}`}
                chevron
              />
            )
          })}
        </Group>
      )}

      <Modal open={showForm} onClose={closeForm} labelledBy={formTitleId}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id={formTitleId} className="text-[1.375rem] font-bold tracking-tight text-label">
              Novo amigo
            </h2>
            <IconButton label="Fechar" onClick={closeForm} className="-mr-2">
              <X size={22} aria-hidden="true" />
            </IconButton>
          </div>

          <div>
            <label htmlFor="friend-name" className="mb-1.5 block text-[0.8125rem] font-medium text-label-2">
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
            <label htmlFor="friend-phone" className="mb-1.5 block text-[0.8125rem] font-medium text-label-2">
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
              <label className="flex min-h-11 items-center gap-3 text-[1.0625rem] text-label">
                <input
                  type="checkbox"
                  checked={requestLink}
                  disabled={submitting}
                  onChange={(e) => setRequestLink(e.target.checked)}
                  className="size-5 min-h-0! shrink-0 accent-[var(--accent)]"
                  aria-describedby="friend-request-link-hint"
                />
                Pedir para ligar contas
              </label>
              <p id="friend-request-link-hint" className="text-[0.8125rem] leading-snug text-label-2">
                Só funciona se a pessoa tiver a app e este número no perfil. Para contactos sem app, desmarca.
              </p>
            </div>
          )}

          {formError && (
            <p role="alert" className="text-[0.9375rem] text-negative">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="min-h-12 w-full rounded-control bg-accent-fill text-[1.0625rem] font-semibold text-white transition-opacity duration-150 active:opacity-70 disabled:opacity-50"
          >
            {submitting ? 'A guardar...' : 'Guardar amigo'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
