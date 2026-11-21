import { useEffect, useState } from 'react'
import { accountStatement } from './accountBalance'
import { today } from './dates'
import { listAllAccountTransactions, listNetWorthSnapshots, listTransfers } from './db'

// Extrato de uma conta (ver `accountStatement`): `null` enquanto carrega ou sem
// conta. `reloadToken` volta a pedir tudo (ex.: depois de editar um movimento).
export function useAccountStatement(accountId, reloadToken) {
  const [state, setState] = useState({ lines: null, error: '' })

  useEffect(() => {
    if (!accountId) {
      setState({ lines: null, error: '' })
      return undefined
    }
    let cancelled = false
    Promise.all([listAllAccountTransactions(accountId), listNetWorthSnapshots(), listTransfers()])
      .then(([txs, snaps, trs]) => {
        if (cancelled) return
        setState({ lines: accountStatement(accountId, txs, snaps, today(), trs), error: '' })
      })
      .catch((err) => !cancelled && setState({ lines: null, error: err.message }))
    return () => {
      cancelled = true
    }
  }, [accountId, reloadToken])

  return state
}
