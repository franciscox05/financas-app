import { t } from '../i18n'
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
    state === 'owes_me' ? t('ob.owesYou', { name: friend.name, value: eur(amount) }) : t('ob.youOwe', { name: friend.name, value: eur(amount) })

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
      toast.success(t('ob.sent'))
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
        <p className="text-sm font-medium text-label">{t('ob.title')}</p>
        <p className="text-sm text-label-2">
          {t('ob.body', { name: friend.name })}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      <button type="button" disabled={busy} onClick={() => setConfirming(true)} className={primaryButton}>
        {busy ? t('ob.sending') : t('ob.share')}
      </button>
      <ConfirmDialog
        open={confirming}
        title={t('ob.shareQ')}
        message={t('ob.confirmMsg', { summary, name: friend.name })}
        confirmLabel={t('ob.confirm')}
        onCancel={() => setConfirming(false)}
        onConfirm={handleShare}
      />
    </div>
  )
}
