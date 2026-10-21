import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '../context/toastContext'
import { listIncomingRequests, respondFriendRequest } from '../lib/linkedDb'
import { notifyPendingChanged, onPendingChanged } from '../lib/pendingEvents'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'
const buttonBase = `min-h-11 rounded-lg px-3 text-sm font-medium transition duration-150 ease-out active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing}`
const primaryButton = `${buttonBase} bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300`
const secondaryButton = `${buttonBase} border border-neutral-300 text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800`

// Faixa no topo dos Amigos com os pedidos de ligação que recebi.
// `onChanged` é chamado depois de aceitar/recusar (para recarregar a lista).
export default function IncomingRequests({ onChanged }) {
  const toast = useToast()
  const [requests, setRequests] = useState([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const mounted = useRef(true)
  const loadSeq = useRef(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    try {
      const list = await listIncomingRequests()
      if (mounted.current && seq === loadSeq.current) setRequests(list)
    } catch (err) {
      if (mounted.current && seq === loadSeq.current) setError(err.message)
    }
  }, [])

  useEffect(() => {
    load()
    return onPendingChanged(load)
  }, [load])

  async function respond(request, accept) {
    if (busyId) return
    setBusyId(request.id)
    setError('')
    try {
      await respondFriendRequest(request.id, accept)
      if (mounted.current) {
        toast.success(
          accept
            ? request.via === 'phone'
              ? `Aceitaste o pedido de ${request.from_name}.`
              : `Ligaste-te a ${request.from_name}.`
            : request.awaiting
              ? 'Pedido retirado.'
              : 'Pedido recusado.',
        )
      }
      notifyPendingChanged()
      await load()
      onChanged?.()
    } catch (err) {
      if (mounted.current) setError(err.message)
      // O pedido pode já não existir (cancelado pelo outro lado): refresca.
      await load()
    } finally {
      if (mounted.current) setBusyId(null)
    }
  }

  if (requests.length === 0 && !error) return null

  return (
    <section
      aria-label="Pedidos de amizade"
      className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h3 className="text-sm font-semibold text-neutral-500">Pedidos de amizade ({requests.length})</h3>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {requests.map((request) => (
          <li key={request.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
            {request.awaiting ? (
              <p className="text-sm text-neutral-800 dark:text-neutral-200">
                Aceitaste o pedido de <span className="font-medium">{request.from_name}</span>. À espera que
                confirme.
              </p>
            ) : (
              <p className="text-sm text-neutral-800 dark:text-neutral-200">
                <span className="font-medium">{request.from_name}</span> quer ligar contas
              </p>
            )}
            {request.via === 'phone' && !request.awaiting && (
              <p className="text-xs text-neutral-500">
                Ao aceitares, {request.from_name} vê o teu nome e o teu email.
              </p>
            )}
            <div className="flex gap-2">
              {!request.awaiting && (
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => respond(request, true)}
                  className={primaryButton}
                >
                  {busyId === request.id ? 'A responder...' : 'Aceitar'}
                </button>
              )}
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => respond(request, false)}
                className={secondaryButton}
              >
                {request.awaiting ? (busyId === request.id ? 'A retirar...' : 'Retirar') : 'Recusar'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
