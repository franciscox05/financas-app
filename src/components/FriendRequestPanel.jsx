import { Link2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '../context/toastContext'
import {
  cancelFriendRequest,
  confirmFriendRequest,
  getOutgoingRequest,
  getRequestAccepter,
  sendFriendRequest,
  sendFriendRequestByPhone,
} from '../lib/linkedDb'
import { normalizeEmail } from '../lib/linkedLogic'
import { notifyPendingChanged } from '../lib/pendingEvents'

const inputClass =
  'min-h-11 w-full rounded-lg border border-neutral-300 px-3 py-2 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 motion-reduce:transition-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus-visible:outline-neutral-100'
const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'
const buttonBase = `min-h-11 rounded-lg px-3 text-sm font-medium transition duration-150 ease-out active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing}`
const primaryButton = `${buttonBase} bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300`
const secondaryButton = `${buttonBase} border border-neutral-300 text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800`
const textButton = `${buttonBase} text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline dark:text-neutral-300 dark:hover:text-neutral-100`

const boxClass = 'space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800'

// Esconde o número todo menos os 3 últimos dígitos.
function maskPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length <= 3) return digits
  return '•'.repeat(digits.length - 3) + digits.slice(-3)
}

// Estado da ligação com um contacto, na página do conta-corrente.
// `onChanged` recarrega o amigo (o estado muda no servidor).
export default function FriendRequestPanel({ friend, onChanged }) {
  const toast = useToast()
  const [request, setRequest] = useState(null)
  const [loadingRequest, setLoadingRequest] = useState(friend.status !== 'connected')
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [accepter, setAccepter] = useState(null)
  const [accepterLoading, setAccepterLoading] = useState(false)
  const mounted = useRef(true)
  const loadSeq = useRef(0)
  const accepterSeq = useRef(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const friendId = friend.id
  const connected = friend.status === 'connected'

  const loadRequest = useCallback(async () => {
    const seq = ++loadSeq.current
    try {
      const latest = await getOutgoingRequest(friendId)
      if (mounted.current && seq === loadSeq.current) setRequest(latest)
    } catch (err) {
      if (mounted.current && seq === loadSeq.current) setError(err.message)
    } finally {
      if (mounted.current && seq === loadSeq.current) setLoadingRequest(false)
    }
  }, [friendId])

  useEffect(() => {
    if (connected) return
    loadRequest()
  }, [connected, loadRequest])

  // Pedido por número aceite: quem aceitou (nome e dica do email), para eu confirmar.
  const awaitingId = request?.status === 'awaiting_confirmation' ? request.id : null
  useEffect(() => {
    const seq = ++accepterSeq.current
    if (!awaitingId) {
      setAccepter(null)
      setAccepterLoading(false)
      return
    }
    setAccepterLoading(true)
    getRequestAccepter(awaitingId)
      .then((who) => {
        if (mounted.current && seq === accepterSeq.current) setAccepter(who)
      })
      .catch((err) => {
        if (mounted.current && seq === accepterSeq.current) setError(err.message)
      })
      .finally(() => {
        if (mounted.current && seq === accepterSeq.current) setAccepterLoading(false)
      })
  }, [awaitingId])

  async function handleSend(e) {
    e.preventDefault()
    if (busy) return
    const valid = normalizeEmail(email)
    if (!valid) {
      setError('Escreve um email válido.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await sendFriendRequest({ friendId, email: valid })
      notifyPendingChanged()
      if (!mounted.current) return
      toast.success('Pedido enviado.')
      setShowForm(false)
      setEmail('')
      await loadRequest()
      onChanged?.()
    } catch (err) {
      if (mounted.current) setError(err.message)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function handleSendPhone() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await sendFriendRequestByPhone(friendId)
      notifyPendingChanged()
      if (!mounted.current) return
      toast.success('Pedido enviado.')
      await loadRequest()
      onChanged?.()
    } catch (err) {
      if (mounted.current) setError(err.message)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function handleConfirm(confirm) {
    if (busy || !request) return
    setBusy(true)
    setError('')
    try {
      await confirmFriendRequest(request.id, confirm)
      notifyPendingChanged()
      if (!mounted.current) return
      toast.success(confirm ? 'Contas ligadas.' : 'Combinado. O pedido ficou à espera de outra pessoa.')
      await loadRequest()
      onChanged?.()
    } catch (err) {
      if (mounted.current) setError(err.message)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function handleCancel() {
    if (busy || !request) return
    setBusy(true)
    setError('')
    try {
      await cancelFriendRequest(request.id)
      notifyPendingChanged()
      if (!mounted.current) return
      toast.success('Pedido cancelado.')
      await loadRequest()
      onChanged?.()
    } catch (err) {
      if (mounted.current) setError(err.message)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  function openForm(prefill = '') {
    setEmail(prefill)
    setError('')
    setShowForm(true)
  }

  if (connected) {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-950/50 dark:text-green-400">
        <Link2 size={14} aria-hidden="true" /> Ligado
      </p>
    )
  }

  if (loadingRequest) {
    return (
      <div
        role="status"
        aria-label="A carregar"
        className="h-11 animate-pulse rounded-lg bg-neutral-200 motion-reduce:animate-none dark:bg-neutral-800"
      />
    )
  }

  const awaitingConfirmation = request?.status === 'awaiting_confirmation'
  // O último pedido manda; o estado do contacto só decide quando não há pedido visível.
  const pending = request ? request.status === 'pending' : friend.status === 'invited'
  const declined = !pending && !awaitingConfirmation && request?.status === 'declined'
  const hasPhone = Boolean(friend.phone)

  const errorLine = error && (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {error}
    </p>
  )

  if (awaitingConfirmation) {
    return (
      <div className={boxClass}>
        {accepterLoading ? (
          <div
            role="status"
            aria-label="A carregar"
            className="h-10 animate-pulse rounded-lg bg-neutral-200 motion-reduce:animate-none dark:bg-neutral-800"
          />
        ) : accepter ? (
          <p className="text-sm text-neutral-800 dark:text-neutral-200">
            <span className="font-medium">
              {accepter.name} ({accepter.emailHint})
            </span>{' '}
            aceitou o teu pedido. É mesmo a pessoa que querias?
          </p>
        ) : (
          <p className="text-sm text-neutral-800 dark:text-neutral-200">
            Alguém aceitou o teu pedido, mas não foi possível ver quem. Podes cancelar e tentar outra vez.
          </p>
        )}
        {errorLine}
        <div className="flex flex-wrap gap-2">
          {accepter && (
            <>
              <button type="button" onClick={() => handleConfirm(true)} disabled={busy} className={primaryButton}>
                {busy ? 'A responder...' : 'Sim, ligar'}
              </button>
              <button type="button" onClick={() => handleConfirm(false)} disabled={busy} className={secondaryButton}>
                Não é ele/ela
              </button>
            </>
          )}
          <button type="button" onClick={handleCancel} disabled={busy} className={secondaryButton}>
            Cancelar pedido
          </button>
        </div>
      </div>
    )
  }

  if (pending) {
    return (
      <div className={boxClass}>
        <p className="text-sm text-neutral-800 dark:text-neutral-200">
          {request?.to_phone ? (
            <>
              Pedido enviado ao número <span className="font-medium">{maskPhone(request.to_phone)}</span>
            </>
          ) : request?.to_email ? (
            <>
              Pedido enviado a <span className="font-medium">{request.to_email}</span>
            </>
          ) : (
            'Pedido enviado'
          )}
        </p>
        <p className="text-xs text-neutral-500">Fica a aguardar que a pessoa aceite.</p>
        {errorLine}
        <button type="button" onClick={handleCancel} disabled={busy || !request} className={secondaryButton}>
          {busy ? 'A cancelar...' : 'Cancelar pedido'}
        </button>
      </div>
    )
  }

  if (showForm) {
    return (
      <form onSubmit={handleSend} className={boxClass}>
        <div>
          <label htmlFor="friend-request-email" className="mb-1 block text-xs font-medium text-neutral-500">
            Email da pessoa
          </label>
          <input
            id="friend-request-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoFocus
            placeholder="Ex: nome@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-neutral-500">Tem de ser o email com que ela criou a conta.</p>
        </div>
        {errorLine}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className={primaryButton}>
            {busy ? 'A enviar...' : 'Enviar pedido'}
          </button>
          <button type="button" disabled={busy} onClick={() => setShowForm(false)} className={secondaryButton}>
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  const emailPrefill = declined ? (request.to_email ?? '') : ''

  return (
    <div className={boxClass}>
      {declined ? (
        <p className="text-sm text-neutral-800 dark:text-neutral-200">
          <span className="font-medium">Recusado</span>
          {request.to_email ? ` por ${request.to_email}` : ''}
        </p>
      ) : (
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Liga-te a {friend.name} para os dois verem os mesmos movimentos.
        </p>
      )}
      {errorLine}
      {hasPhone ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleSendPhone} disabled={busy} className={primaryButton}>
            {busy ? 'A enviar...' : declined ? 'Pedir de novo' : 'Pedir amizade'}
          </button>
          <button type="button" onClick={() => openForm(emailPrefill)} disabled={busy} className={textButton}>
            Ligar por email
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => openForm(emailPrefill)}
            className={declined ? secondaryButton : primaryButton}
          >
            {declined ? 'Reenviar' : 'Pedir amizade'}
          </button>
          <p className="text-xs text-neutral-500">
            Guarda também o número de telemóvel de {friend.name} para o poderes procurar só pelo número.
          </p>
        </>
      )}
    </div>
  )
}
