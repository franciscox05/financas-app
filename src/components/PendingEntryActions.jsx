import { useEffect, useRef, useState } from 'react'
import { useToast } from '../context/toastContext'
import { cancelPendingEntry, getMirrorSettlement, requestCancel, respondCancel, respondEntry } from '../lib/linkedDb'
import { canRequestCancel, canRespond, isCancelRequestForMe } from '../lib/linkedLogic'
import { notifyPendingChanged } from '../lib/pendingEvents'
import ConfirmDialog from './ConfirmDialog'
import SettlementFields from './SettlementFields'

const inputClass =
  'min-h-11 w-full rounded-lg border border-neutral-300 px-3 py-2 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 motion-reduce:transition-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus-visible:outline-neutral-100'
const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'
const buttonBase = `min-h-11 rounded-lg px-3 text-sm font-medium transition duration-150 ease-out active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing}`
const primaryButton = `${buttonBase} bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300`
const secondaryButton = `${buttonBase} border border-neutral-300 text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800`

const EMPTY_CHOICE = { ready: false, settlement: '', accountId: null, categoryId: null }

// Ações de uma linha do conta-corrente de um amigo ligado. `onChanged` recarrega
// o ecrã; `onResend` abre a folha pré-preenchida para corrigir um contestado.
export default function PendingEntryActions({ entry, friend, viewerId, onChanged, onResend }) {
  const toast = useToast()
  const [mode, setMode] = useState(null) // null | 'contest' | 'accept'
  const [note, setNote] = useState('')
  const [choice, setChoice] = useState(EMPTY_CHOICE)
  const [suggestedSettlement, setSuggestedSettlement] = useState('')
  const [loadingSuggestion, setLoadingSuggestion] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
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

  // Uma só ação de cada vez (também contra duplo toque antes de re-render).
  async function run(action, successMessage) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      await action()
      notifyPendingChanged()
      if (!mounted.current) return
      toast.success(successMessage)
      setMode(null)
      await onChanged()
    } catch (err) {
      if (mounted.current) setError(err.message)
    } finally {
      busyRef.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const isRepayment = entry.kind === 'repaid_to_me' || entry.kind === 'repaid_to_them'
  const errorLine = error && (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {error}
    </p>
  )

  if (canRespond(entry, viewerId)) {
    if (mode === 'contest') {
      return (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => respondEntry({ id: entry.id, accept: false, note: note.trim() }), 'Movimento contestado.')
          }}
        >
          <label htmlFor={`contest-${entry.id}`} className="block text-xs font-medium text-neutral-500">
            O que não está certo? (opcional)
          </label>
          <input
            id={`contest-${entry.id}`}
            type="text"
            autoComplete="off"
            autoFocus
            value={note}
            disabled={busy}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
          />
          {errorLine}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={primaryButton}>
              {busy ? 'A enviar...' : 'Contestar'}
            </button>
            <button type="button" disabled={busy} onClick={() => setMode(null)} className={secondaryButton}>
              Voltar
            </button>
          </div>
        </form>
      )
    }

    if (mode === 'accept') {
      return (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!choice.ready) return
            run(
              () =>
                respondEntry({
                  id: entry.id,
                  accept: true,
                  settlement: choice.settlement,
                  accountId: choice.accountId,
                  categoryId: choice.categoryId,
                }),
              'Movimento aceite.',
            )
          }}
        >
          <SettlementFields
            kind={entry.kind}
            idPrefix={`accept-${entry.id}`}
            disabled={busy}
            onChange={setChoice}
            initialSettlement={suggestedSettlement}
          />
          {errorLine}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !choice.ready} className={primaryButton}>
              {busy ? 'A guardar...' : 'Aceitar'}
            </button>
            <button type="button" disabled={busy} onClick={() => setMode(null)} className={secondaryButton}>
              Voltar
            </button>
          </div>
        </form>
      )
    }

    return (
      <div className="space-y-2">
        <p className="text-sm text-neutral-700 dark:text-neutral-300">Está certo?</p>
        {errorLine}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || loadingSuggestion}
            onClick={async () => {
              if (isRepayment) {
                setChoice(EMPTY_CHOICE)
                setError('')
                setSuggestedSettlement('')
                setLoadingSuggestion(true)
                try {
                  const suggestion = await getMirrorSettlement(entry.id)
                  if (mounted.current) setSuggestedSettlement(suggestion ?? '')
                } catch {
                  // Sem sugestão não é bloqueante: o aceitador escolhe à mão.
                } finally {
                  if (mounted.current) setLoadingSuggestion(false)
                }
                if (mounted.current) setMode('accept')
              } else {
                run(() => respondEntry({ id: entry.id, accept: true }), 'Movimento aceite.')
              }
            }}
            className={primaryButton}
          >
            {loadingSuggestion ? 'A carregar...' : 'Aceitar'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setNote('')
              setError('')
              setMode('contest')
            }}
            className={secondaryButton}
          >
            Contestar
          </button>
        </div>
      </div>
    )
  }

  if (entry.status === 'pending' && entry.mirror_id && entry.created_by === viewerId) {
    return (
      <div className="space-y-2">
        {errorLine}
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => cancelPendingEntry(entry.id), 'Pedido cancelado.')}
          className={secondaryButton}
        >
          {busy ? 'A cancelar...' : 'Cancelar'}
        </button>
      </div>
    )
  }

  if (isCancelRequestForMe(entry, viewerId)) {
    return (
      <div className="space-y-2">
        {errorLine}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => respondCancel(entry.id, true), 'Movimento anulado.')}
            className={primaryButton}
          >
            Aceitar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => respondCancel(entry.id, false), 'Anulação recusada.')}
            className={secondaryButton}
          >
            Recusar
          </button>
        </div>
      </div>
    )
  }

  if (entry.status === 'declined' && entry.created_by === viewerId && onResend && !entry.is_opening) {
    return (
      <button type="button" onClick={() => onResend(entry)} className={secondaryButton}>
        Corrigir e reenviar
      </button>
    )
  }

  // O saldo anterior não se anula.
  if (canRequestCancel(entry) && !entry.is_opening) {
    return (
      <div className="space-y-2">
        {errorLine}
        <button type="button" disabled={busy} onClick={() => setConfirmCancel(true)} className={secondaryButton}>
          Pedir anulação
        </button>
        <ConfirmDialog
          open={confirmCancel}
          title="Pedir anulação?"
          message={`${friend.name} vai ter de aceitar. Até lá, o movimento continua a contar.`}
          confirmLabel="Pedir anulação"
          onCancel={() => setConfirmCancel(false)}
          onConfirm={() => {
            setConfirmCancel(false)
            run(() => requestCancel(entry.id), 'Anulação pedida.')
          }}
        />
      </div>
    )
  }

  return null
}
