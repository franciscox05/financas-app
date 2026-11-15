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
import { inputClass, primaryButton, secondaryButton, textButton } from './ui/styles'

const CHANGED_MESSAGE = 'O pedido mudou. Volta a ver quem aceitou.'

const boxClass = 'space-y-3 rounded-control border border-separator p-4'

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
  // Volta a ver sempre que o pedido recarrega (outra pessoa pode ter aceitado entretanto).
  const fetchAccepter = useCallback((id) => {
    const seq = ++accepterSeq.current
    if (!id) {
      setAccepter(null)
      setAccepterLoading(false)
      return Promise.resolve()
    }
    setAccepterLoading(true)
    return getRequestAccepter(id)
      .then((who) => {
        if (mounted.current && seq === accepterSeq.current) setAccepter(who)
      })
      .catch((err) => {
        if (mounted.current && seq === accepterSeq.current) setError(err.message)
      })
      .finally(() => {
        if (mounted.current && seq === accepterSeq.current) setAccepterLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchAccepter(request?.status === 'awaiting_confirmation' ? request.id : null)
  }, [request, fetchAccepter])

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
    if (busy || !request || !accepter) return
    setBusy(true)
    setError('')
    try {
      await confirmFriendRequest(request.id, confirm, accepter.accepterId)
      notifyPendingChanged()
      if (!mounted.current) return
      toast.success(confirm ? 'Contas ligadas.' : 'Não ligámos. O pedido continua à espera da pessoa certa.')
      await loadRequest()
      onChanged?.()
    } catch (err) {
      if (mounted.current) setError(err.message)
      if (err.message === CHANGED_MESSAGE) await fetchAccepter(request.id)
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
      <p className="inline-flex items-center gap-1.5 rounded-full bg-positive/10 px-3 py-1 text-sm font-medium text-positive">
        <Link2 size={14} aria-hidden="true" /> Ligado
      </p>
    )
  }

  if (loadingRequest) {
    return (
      <div
        role="status"
        aria-label="A carregar"
        className="h-11 animate-pulse rounded-control bg-fill-strong motion-reduce:animate-none"
      />
    )
  }

  const awaitingConfirmation = request?.status === 'awaiting_confirmation'
  // O último pedido manda; o estado do contacto só decide quando não há pedido visível.
  const pending = request ? request.status === 'pending' : friend.status === 'invited'
  const declined = !pending && !awaitingConfirmation && request?.status === 'declined'
  const hasPhone = Boolean(friend.phone)

  const errorLine = error && (
    <p role="alert" className="text-sm text-negative">
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
            className="h-10 animate-pulse rounded-control bg-fill-strong motion-reduce:animate-none"
          />
        ) : accepter ? (
          <p className="text-sm text-label">
            <span className="font-medium">
              {accepter.name} ({accepter.emailHint})
            </span>{' '}
            aceitou o teu pedido. É mesmo a pessoa que querias?
          </p>
        ) : (
          <p className="text-sm text-label">
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
        <p className="text-sm text-label">
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
        <p className="text-xs text-label-2">Fica a aguardar que a pessoa aceite.</p>
        {errorLine}
        {request ? (
          <button type="button" onClick={handleCancel} disabled={busy} className={secondaryButton}>
            {busy ? 'A cancelar...' : 'Cancelar pedido'}
          </button>
        ) : (
          <button type="button" onClick={loadRequest} disabled={busy} className={secondaryButton}>
            Tentar outra vez
          </button>
        )}
      </div>
    )
  }

  if (showForm) {
    return (
      <form onSubmit={handleSend} className={boxClass}>
        <div>
          <label htmlFor="friend-request-email" className="mb-1 block text-xs font-medium text-label-2">
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
          <p className="mt-1 text-xs text-label-2">Tem de ser o email com que ela criou a conta.</p>
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
        <p className="text-sm text-label">
          <span className="font-medium">Recusado</span>
          {request.to_email ? ` por ${request.to_email}` : ''}
        </p>
      ) : (
        <p className="text-sm text-label-2">
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
            Pedir por email
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
          <p className="text-xs text-label-2">
            Guarda também o número de telemóvel de {friend.name} para o poderes procurar só pelo número.
          </p>
        </>
      )}
    </div>
  )
}
