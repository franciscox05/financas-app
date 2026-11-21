import { t } from '../i18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '../context/toastContext'
import { listIncomingRequests, respondFriendRequest } from '../lib/linkedDb'
import { notifyPendingChanged, onPendingChanged } from '../lib/pendingEvents'
import { primaryButton, secondaryButton } from './ui/styles'

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
              ? t('inc.acceptedPhone', { name: request.from_name })
              : t('inc.linked', { name: request.from_name })
            : request.awaiting
              ? t('inc.withdrawn')
              : t('inc.refused'),
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
      aria-label={t('inc.title')}
      className="space-y-3 rounded-control border border-separator bg-surface p-4"
    >
      <h3 className="text-sm font-semibold text-label-2">{t('inc.titleN', { n: requests.length })}</h3>

      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}

      <ul className="divide-y divide-separator">
        {requests.map((request) => (
          <li key={request.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
            {request.awaiting ? (
              <p className="text-sm text-label">
                {t('inc.awaitingPre')} <span className="font-medium">{request.from_name}</span>
                {t('inc.awaitingPost')}
              </p>
            ) : (
              <p className="text-sm text-label">
                <span className="font-medium">{request.from_name}</span> {t('inc.wantsLink')}
              </p>
            )}
            {request.via === 'phone' && !request.awaiting && (
              <p className="text-xs text-label-2">
                {t('inc.privacy', { name: request.from_name })}
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
                  {busyId === request.id ? t('freq.responding') : t('pend.accept')}
                </button>
              )}
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => respond(request, false)}
                className={secondaryButton}
              >
                {request.awaiting ? (busyId === request.id ? t('inc.withdrawing') : t('inc.withdraw')) : t('pend.refuse')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
