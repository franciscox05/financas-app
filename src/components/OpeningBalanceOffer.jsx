import { useEffect, useRef, useState } from 'react'
import { useToast } from '../context/toastContext'
import { eur } from '../lib/format'
import { describeBalance } from '../lib/ledgerMath'
import { shareOpeningBalance } from '../lib/linkedDb'
import { notifyPendingChanged } from '../lib/pendingEvents'
import ConfirmDialog from './ConfirmDialog'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'
const primaryButton = `min-h-11 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white transition duration-150 ease-out hover:bg-neutral-700 active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 ${focusRing}`

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
    <div className="space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="space-y-1">
        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Partilhar a conta que já tinham?</p>
        <p className="text-sm text-neutral-500">{friend.name} vai ter de aceitar.</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <button type="button" disabled={busy} onClick={() => setConfirming(true)} className={primaryButton}>
        {busy ? 'A enviar...' : 'Partilhar saldo anterior'}
      </button>
      <ConfirmDialog
        open={confirming}
        title="Partilhar saldo anterior?"
        message={`${summary}. ${friend.name} vai ter de confirmar este valor. Até aceitar, os teus movimentos anteriores continuam como estão.`}
        confirmLabel="Partilhar"
        onCancel={() => setConfirming(false)}
        onConfirm={handleShare}
      />
    </div>
  )
}
