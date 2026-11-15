import { ChevronLeft, Pencil, Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import CollapsibleSection from '../components/CollapsibleSection'
import ConfirmDialog from '../components/ConfirmDialog'
import { EmptyState, ErrorNotice, PageSkeleton } from '../components/Feedback'
import FriendAvatar from '../components/FriendAvatar'
import FriendRequestPanel from '../components/FriendRequestPanel'
import LedgerEntryRow from '../components/LedgerEntryRow'
import Money from '../components/Money'
import NewExpenseSheet from '../components/NewExpenseSheet'
import OpeningBalanceOffer from '../components/OpeningBalanceOffer'
import ReminderButtons from '../components/ReminderButtons'
import RepaymentSheet from '../components/RepaymentSheet'
import ShareSummaryButtons from '../components/ShareSummaryButtons'
import { useToast } from '../context/toastContext'
import { getCurrentUserId } from '../lib/db'
import { deleteEntry, deleteFriend, listEntries, listFriendsWithBalance, updateFriend } from '../lib/friendsDb'
import { formatPhoneDisplay } from '../lib/contactMessage'
import { hasOpenBalance } from '../lib/friendsLogic'
import { balanceOf, describeBalance, lifetimeTotals, suggestedRepayment } from '../lib/ledgerMath'
import { hasPendingOpening, privateConfirmedEntries } from '../lib/linkedLogic'
import { onPendingChanged } from '../lib/pendingEvents'
import Modal from '../components/Modal'
import IconButton from '../components/ui/IconButton'
import {
  dangerButton,
  focusRing,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
  textButton,
} from '../components/ui/styles'

const STATE_TEXT = {
  owes_me: 'text-positive',
  i_owe: 'text-negative',
  even: 'text-label-2',
}

export default function FriendLedger() {
  const { friendId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()

  const [friend, setFriend] = useState(null)
  const [entries, setEntries] = useState([])
  const [viewerId, setViewerId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [panel, setPanel] = useState(null) // 'expense' | 'repayment' | null
  const [prefill, setPrefill] = useState(null) // valores de um movimento contestado a reenviar
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [phoneDraft, setPhoneDraft] = useState('')
  const [nameError, setNameError] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [confirmFriendDelete, setConfirmFriendDelete] = useState(false)
  const [showLifetime, setShowLifetime] = useState(false)

  // Só a carga mais recente (e só enquanto o ecrã existe) escreve no estado.
  const loadSeq = useRef(0)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const seq = ++loadSeq.current
      if (!silent) setLoading(true)
      setError('')
      try {
        const [friends, list, me] = await Promise.all([
          listFriendsWithBalance(),
          listEntries(friendId),
          getCurrentUserId(),
        ])
        if (seq !== loadSeq.current || !mounted.current) return
        setFriend(friends.find((f) => f.id === friendId) ?? null)
        setEntries(list)
        setViewerId(me)
      } catch (err) {
        if (seq === loadSeq.current && mounted.current) {
          setError(err.message || 'Não foi possível carregar este amigo. Tenta outra vez.')
        }
      } finally {
        if (seq === loadSeq.current && mounted.current) setLoading(false)
      }
    },
    [friendId],
  )

  useEffect(() => {
    load()
    // Movimentos e respostas do amigo chegam ao vivo (broadcast) sem piscar o ecrã.
    return onPendingChanged(() => load({ silent: true }))
  }, [load])

  // O toast de sucesso já é mostrado pela própria folha ao guardar.
  async function afterChange() {
    setPanel(null)
    setPrefill(null)
    await load()
  }

  function togglePanel(name) {
    setPrefill(null)
    setPanel(panel === name ? null : name)
  }

  // "Corrigir e reenviar": abre a folha certa com os valores do movimento contestado.
  function handleResend(entry) {
    setPrefill({
      id: entry.id,
      kind: entry.kind,
      amount: entry.amount,
      note: entry.note ?? '',
      occurredOn: entry.occurred_on,
      dueOn: entry.due_on ?? '',
      settlement: entry.settlement ?? undefined,
      accountId: entry.bank_account_id ?? undefined,
      categoryId: entry.bank_category_id ?? undefined,
    })
    setPanel(entry.kind === 'repaid_to_me' || entry.kind === 'repaid_to_them' ? 'repayment' : 'expense')
  }

  async function handleSaveName(e) {
    e.preventDefault()
    setSavingName(true)
    setNameError('')
    try {
      const updated = await updateFriend({ id: friend.id, name: nameDraft, phone: phoneDraft })
      setFriend((f) => ({ ...f, name: updated.name, phone: updated.phone }))
      setEditing(false)
      toast.success('Dados atualizados.')
    } catch (err) {
      setNameError(err.message || 'Não foi possível guardar os dados. Tenta outra vez.')
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
        <p className="text-label">Amigo não encontrado.</p>
        <Link to="/dividas" className={`inline-flex min-h-11 items-center text-sm underline ${focusRing}`}>
          Voltar aos amigos
        </Link>
      </div>
    )
  }

  const balance = balanceOf(entries)
  const { state, amount } = describeBalance(balance)
  const repayment = suggestedRepayment(balance)
  const canDeleteFriend = friend.status === 'local' && !hasOpenBalance(balance)
  const connected = friend.status === 'connected'
  const lifetime = lifetimeTotals(entries)
  const privateOnly = privateConfirmedEntries(entries)
  const privateBalance = balanceOf(privateOnly)
  const showOpeningOffer = connected && privateBalance !== 0 && !hasPendingOpening(entries)
  const deleteHasBank = deleteTarget?.settlement === 'bank' && Boolean(deleteTarget?.transaction_id)

  function startEditing(phone) {
    setNameDraft(friend.name)
    setPhoneDraft(phone)
    setNameError('')
    setEditing(true)
  }

  function closePanel() {
    setPanel(null)
    setPrefill(null)
  }

  return (
    <div className="space-y-8">
      {error && <ErrorNotice message={error} onRetry={load} />}

      <div className="-mb-4 flex items-center justify-between">
        <button
          type="button"
          // Volta exatamente para onde estavas (ex. a linha em Registo) quando vieste de
          // dentro da app; só cai em /dividas se abriste esta página diretamente (sem
          // histórico para trás).
          onClick={() => {
            if (location.key !== 'default') navigate(-1)
            else navigate('/dividas')
          }}
          className="pressable -ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-control pr-3 pl-1 text-[1.0625rem] text-accent"
        >
          <ChevronLeft size={24} strokeWidth={2.1} aria-hidden="true" /> Voltar
        </button>
        {!editing && (
          <IconButton
            label="Editar nome e telemóvel"
            tone="accent"
            className="-mr-2"
            onClick={() => startEditing(friend.phone ?? '')}
          >
            <Pencil size={20} aria-hidden="true" />
          </IconButton>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSaveName} className="space-y-3 rounded-group bg-surface p-4">
          <div>
            <label htmlFor="friend-edit-name" className={labelClass}>
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
          </div>
          <div>
            <label htmlFor="friend-edit-phone" className={labelClass}>
              Telemóvel (opcional)
            </label>
            <input
              id="friend-edit-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="Ex: 912 345 678"
              value={phoneDraft}
              onChange={(e) => setPhoneDraft(e.target.value)}
              className={inputClass}
            />
          </div>
          {nameError && (
            <p role="alert" className="text-[0.9375rem] text-negative">
              {nameError}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className={`${secondaryButton} flex-1`}>
              Cancelar
            </button>
            <button type="submit" disabled={savingName} className={`${primaryButton} flex-[2]`}>
              {savingName ? 'A guardar...' : 'Guardar'}
            </button>
          </div>
        </form>
      ) : (
        // Identidade ao centro, como um cartão de contacto: fotografia grande,
        // nome e telefone. O lápis de editar subiu para o canto de cima.
        <header className="flex flex-col items-center text-center">
          <FriendAvatar name={friend.name} avatarPath={friend.avatarPath} size="lg" />
          <h1 className="mt-3 max-w-full truncate text-[1.75rem] leading-tight font-bold tracking-tight text-label">
            {friend.name}
          </h1>
          {friend.phone ? (
            <p className="mt-0.5 text-[0.9375rem] text-label-2">{formatPhoneDisplay(friend.phone)}</p>
          ) : (
            <button type="button" onClick={() => startEditing('')} className={textButton}>
              Adicionar telefone
            </button>
          )}
        </header>
      )}

      <FriendRequestPanel friend={friend} onChanged={() => load({ silent: true })} />

      {showOpeningOffer && (
        <OpeningBalanceOffer friend={friend} balance={privateBalance} onShared={() => load({ silent: true })} />
      )}

      {/* O número principal do ecrã. O sentido ("Deve-te" / "Deves-lhe") fica
          numa linha própria por cima do valor, para valores grandes não
          partirem a linha. */}
      <section aria-label="Saldo" className="rounded-group bg-surface p-5 text-center">
        <p className="text-[0.8125rem] font-medium text-label-2">Neste momento</p>
        {state === 'even' ? (
          <p className="mt-1 text-[1.75rem] leading-tight font-bold tracking-tight text-label-2">Estão quites</p>
        ) : (
          <>
            <p className={`mt-1 text-[1.0625rem] font-semibold ${STATE_TEXT[state]}`}>
              {state === 'owes_me' ? 'Deve-te' : 'Deves-lhe'}
            </p>
            <p className={`amount display truncate text-[2.5rem] leading-tight font-bold tracking-tight ${STATE_TEXT[state]}`}>
              <Money value={amount} />
            </p>
          </>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => togglePanel('expense')}
            className={`${primaryButton} flex flex-1 items-center justify-center gap-1`}
          >
            <Plus size={17} strokeWidth={2.4} aria-hidden="true" /> Novo gasto
          </button>
          {repayment && (
            <button type="button" onClick={() => togglePanel('repayment')} className={`${secondaryButton} min-w-0 flex-1`}>
              {repayment.kind === 'repaid_to_me' ? 'Devolveu-me ' : 'Devolvi-lhe '}
              <Money value={repayment.amount} />
            </button>
          )}
        </div>
      </section>

      {balance > 0 && <ReminderButtons friend={friend} balance={balance} entries={entries} />}

      {(lifetime.lent > 0 || lifetime.borrowed > 0) && (
        <CollapsibleSection
          title="Totais desde sempre"
          open={showLifetime}
          onToggle={() => setShowLifetime((v) => !v)}
        >
          <dl className="space-y-2 text-[0.9375rem]">
            {lifetime.lent > 0 && (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-label-2">Já lhe emprestaste no total</dt>
                <dd className="amount font-medium text-label">
                  <Money value={lifetime.lent} />
                </dd>
              </div>
            )}
            {lifetime.repaidToMe > 0 && (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-label-2">Já te devolveu</dt>
                <dd className="amount font-medium text-label">
                  <Money value={lifetime.repaidToMe} />
                </dd>
              </div>
            )}
            {lifetime.borrowed > 0 && (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-label-2">Já te emprestou no total</dt>
                <dd className="amount font-medium text-label">
                  <Money value={lifetime.borrowed} />
                </dd>
              </div>
            )}
            {lifetime.repaidToThem > 0 && (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-label-2">Já lhe devolveste</dt>
                <dd className="amount font-medium text-label">
                  <Money value={lifetime.repaidToThem} />
                </dd>
              </div>
            )}
          </dl>
        </CollapsibleSection>
      )}

      {/* Gasto e devolução abrem numa folha por cima da página, em vez de um
          formulário a meio do ecrã que empurrava a lista de movimentos. As
          folhas só existem enquanto estão abertas (o Modal não as monta
          fechado), por isso começam sempre limpas, como antes. */}
      <Modal open={panel === 'expense'} onClose={closePanel}>
        <NewExpenseSheet
          key={prefill?.id ?? 'new'}
          friend={friend}
          prefill={prefill}
          onStale={() => load({ silent: true })}
          onDone={() => afterChange()}
          onCancel={closePanel}
        />
      </Modal>
      <Modal open={panel === 'repayment' && Boolean(repayment || prefill)} onClose={closePanel}>
        <RepaymentSheet
          key={prefill?.id ?? 'new'}
          friend={friend}
          balance={balance}
          prefill={prefill}
          onStale={() => load({ silent: true })}
          onDone={() => afterChange()}
          onCancel={closePanel}
        />
      </Modal>

      <section className="space-y-3">
        <h2 className="px-4 text-[0.8125rem] font-semibold tracking-wide text-label-2 uppercase">Movimentos</h2>
        {entries.length > 0 && <ShareSummaryButtons friend={friend} balance={balance} entries={entries} />}
        {entries.length === 0 ? (
          <EmptyState
            title="Ainda sem movimentos"
            description="Regista o primeiro gasto para começares o conta-corrente."
          />
        ) : (
          <ul className="grouped overflow-hidden rounded-group bg-surface">
            {entries.map((entry) => (
              <LedgerEntryRow
                key={entry.id}
                entry={entry}
                friend={friend}
                viewerId={viewerId}
                onDelete={setDeleteTarget}
                onChanged={() => load({ silent: true })}
                onResend={handleResend}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        {canDeleteFriend ? (
          <button type="button" onClick={() => setConfirmFriendDelete(true)} className={`${dangerButton} w-full`}>
            Apagar amigo
          </button>
        ) : (
          <p className="px-4 text-center text-[0.8125rem] leading-snug text-label-2">
            {friend.status === 'invited'
              ? 'Cancela o pedido de amizade antes de apagar este amigo.'
              : friend.status === 'connected'
                ? 'Amigos ligados não se apagam nesta versão.'
                : 'Só podes apagar quando estiverem quites.'}
          </p>
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
        message="Também apaga o histórico de movimentos com esta pessoa. As transações já criadas nas tuas contas ficam como estão."
        confirmLabel="Apagar amigo"
        onCancel={() => setConfirmFriendDelete(false)}
        onConfirm={handleDeleteFriend}
      />
    </div>
  )
}
