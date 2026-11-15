import { useEffect, useRef, useState } from 'react'
import { useToast } from '../context/toastContext'
import { eur } from '../lib/format'
import { describeBalance } from '../lib/ledgerMath'
import { shareOpeningBalance } from '../lib/linkedDb'
import { notifyPendingChanged } from '../lib/pendingEvents'
import ConfirmDialog from './ConfirmDialog'
import { primaryButton } from './ui/styles'

// Cartão para partilhar a conta que já existia antes da ligação.
// `balance` é o saldo dos movimentos privados; `onShared` recarrega o ecrã.
export default function OpeningBalanceOffer({ friend, balance, onShared }) {
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(true)
  const busyRef = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const { state, amount } = describeBalance(balance)
  const summary =
    state === 'owes_me' ? `${friend.name} deve-te ${eur(amount)}` : `Deves ${eur(amount)} a ${friend.name}`

  async function handleShare() {
    setConfirming(false)
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      await shareOpeningBalance(friend.id)
      notifyPendingChanged()
      if (!mounted.current) return
      toast.success('Pedido enviado.')
      await onShared()
    } catch (err) {
      if (mounted.current) setError(err.message)
    } finally {
      busyRef.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-control border border-separator p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-label">Partilhar a conta que já tinham?</p>
        <p className="text-sm text-label-2">
          {friend.name} vai ter de aceitar. Os movimentos anteriores ficam arquivados e a conta passa para um só valor, "Saldo anterior". Se {friend.name} recusar, voltam a contar.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      <button type="button" disabled={busy} onClick={() => setConfirming(true)} className={primaryButton}>
        {busy ? 'A enviar...' : 'Partilhar saldo anterior'}
      </button>
      <ConfirmDialog
        open={confirming}
        title="Partilhar saldo anterior?"
        message={`${summary}. ${friend.name} vai ter de confirmar este valor. Os movimentos anteriores ficam arquivados e a conta passa para um só valor, "Saldo anterior". Se ${friend.name} recusar, voltam a contar.`}
        confirmLabel="Partilhar"
        onCancel={() => setConfirming(false)}
        onConfirm={handleShare}
      />
    </div>
  )
}
