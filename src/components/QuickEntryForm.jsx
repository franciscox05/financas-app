import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { suggestAmount, suggestCategoryId } from '../lib/categorySuggest'
import { useToast } from '../context/toastContext'
import { today } from '../lib/dates'
import { createTransaction, createTransfer, deleteTransaction } from '../lib/db'
import { eur } from '../lib/format'
import { createFriend, createLinkedEntry, deleteLocalEntryById, listFriendsWithBalance } from '../lib/friendsDb'
import { cancelPendingEntry, createSharedEntry } from '../lib/linkedDb'
import { notifyPendingChanged } from '../lib/pendingEvents'
import { friendEntryKind, friendEntryMode } from '../lib/quickEntryFriend'
import { defaultCategoryId } from '../lib/repaymentInput'

const selectClass =
  'w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100'

// Seletor de amigo partilhado pelos dois fluxos (devolução única / divisão por
// vários) — select normal + "+ Novo amigo..." inline, sem sair do formulário.
function FriendPicker({ id, friends, value, onChange, onFriendCreated, disabled }) {
  const toast = useToast()
  const [newMode, setNewMode] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    if (busy || !newName.trim()) return
    setBusy(true)
    try {
      const created = await createFriend({ name: newName, phone: '', requestLink: false })
      onFriendCreated(created)
      onChange(created.id)
      setNewMode(false)
      setNewName('')
    } catch (err) {
      toast.error(err.message || 'Não foi possível adicionar. Tenta outra vez.')
    } finally {
      setBusy(false)
    }
  }

  if (newMode) {
    return (
      // Wrap: o nome ocupa a linha toda e os botões descem — numa coluna estreita (linha
      // da divisão) tudo na mesma linha sobrepunha-se ao campo do valor.
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          autoFocus
          placeholder="Nome do amigo"
          value={newName}
          disabled={busy}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate(e)
          }}
          className={`${selectClass} basis-full`}
        />
        <button
          type="button"
          disabled={busy || !newName.trim()}
          onClick={handleCreate}
          className="min-h-9 shrink-0 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {busy ? '...' : 'Adicionar'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setNewMode(false)
            setNewName('')
          }}
          className="min-h-9 shrink-0 rounded-lg border border-neutral-300 px-3 text-sm dark:border-neutral-700"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        if (e.target.value === '__new__') {
          setNewMode(true)
          return
        }
        onChange(e.target.value)
      }}
      className={selectClass}
    >
      <option value="">Escolhe um amigo</option>
      {friends.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
      <option value="__new__">+ Novo amigo...</option>
    </select>
  )
}

export default function QuickEntryForm({ accounts, categories, transactions, onCreated, onTransferCreated }) {
  const toast = useToast()
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState('')
  const [occurredOn, setOccurredOn] = useState(today())
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [suggested, setSuggested] = useState(false)
  const [amountSuggested, setAmountSuggested] = useState(false)
  const categoryTouchedRef = useRef(false)
  const amountTouchedRef = useRef(false)

  // Vai para outra conta tua (ex. investimento: Conta à Ordem -> XTB)? Só uma
  // forma de o fazer: escolher a conta destino aqui mesmo. Continua a ser um
  // Gasto normal (mesma categoria/nota), mas também atualiza a conta destino
  // sozinho — sem segunda transação, sem modo à parte.
  const [transferToId, setTransferToId] = useState('')

  const [showFriend, setShowFriend] = useState(false)
  const [friends, setFriends] = useState([])
  const [friendsFailed, setFriendsFailed] = useState(false)
  // Ganho: um só amigo devolveu-te o valor todo.
  const [friendId, setFriendId] = useState('')
  // Gasto: divide entre vários — cada linha é a parte de uma pessoa (a tua fica implícita).
  const [friendShares, setFriendShares] = useState([{ friendId: '', amount: '' }])
  const [splitNotice, setSplitNotice] = useState('')

  // Só carrega a lista quando o utilizador abre a secção.
  useEffect(() => {
    if (!showFriend) return
    let cancelled = false
    setFriendsFailed(false)
    listFriendsWithBalance()
      .then((list) => {
        if (!cancelled) setFriends(list)
      })
      .catch(() => {
        if (!cancelled) setFriendsFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [showFriend])

  const categoriesForType = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type],
  )

  const effectiveCategoryId = categoriesForType.some((c) => c.id === categoryId)
    ? categoryId
    : categoriesForType[0]?.id ?? ''

  const friendShareIds = friendShares.map((s) => s.friendId).join(',')
  const hasAnyFriend = type === 'income' ? Boolean(friendId) : friendShares.some((s) => s.friendId)

  // Sugere categoria a partir do histórico quando o utilizador escreve uma nota,
  // desde que não tenha escolhido a categoria manualmente para esta transação,
  // nem tenha um amigo associado (nesse caso "Empréstimos"/"Devoluções" manda —
  // senão escrever a nota depois de escolher o amigo trocava a categoria de volta).
  useEffect(() => {
    if (categoryTouchedRef.current || hasAnyFriend) return
    const id = suggestCategoryId(note, type, transactions ?? [])
    if (id && categoriesForType.some((c) => c.id === id)) {
      setCategoryId(id)
      setSuggested(true)
    } else {
      setSuggested(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note, type])

  // Além da categoria, sugere também o valor da transação mais recente com
  // nota semelhante (ex. "gasóleo" é quase sempre o mesmo valor) — só
  // enquanto o utilizador não tiver escrito nada no campo valor.
  useEffect(() => {
    if (amountTouchedRef.current) return
    const value = suggestAmount(note, type, transactions ?? [])
    if (value) {
      setAmount(String(value))
      setAmountSuggested(true)
    } else {
      setAmountSuggested(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note, type])

  // Gasto e ganho têm textos e campos diferentes: ao trocar, fecha a secção.
  useEffect(() => {
    setShowFriend(false)
    setFriendId('')
    setFriendShares([{ friendId: '', amount: '' }])
    setTransferToId('')
  }, [type])

  // Ao escolher um amigo (devolução, ou qualquer linha da divisão), salta para
  // "Empréstimos"/"Devoluções" (se existirem e a categoria ainda não tiver sido
  // escolhida à mão para esta transação).
  useEffect(() => {
    if (!hasAnyFriend || categoryTouchedRef.current) return
    const id = defaultCategoryId(categories, friendEntryKind(type))
    if (id && categoriesForType.some((c) => c.id === id)) {
      setCategoryId(id)
      setSuggested(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId, friendShareIds])

  const numericAmount = Number(amount)
  const sharesTotal = friendShares.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
  const sharesExceed = showFriend && type === 'expense' && sharesTotal > numericAmount + 0.001

  function updateShare(index, patch) {
    setSplitNotice('')
    setFriendShares((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function addShareRow() {
    setSplitNotice('')
    setFriendShares((prev) => [...prev, { friendId: '', amount: '' }])
  }

  function removeShareRow(index) {
    setSplitNotice('')
    setFriendShares((prev) => (prev.length === 1 ? [{ friendId: '', amount: '' }] : prev.filter((_, i) => i !== index)))
  }

  // Divide em partes iguais entre os amigos escolhidos E tu (és sempre uma das partes).
  // Faz as contas em cêntimos: se não der certo, cada amigo fica com o arredondado para
  // baixo e os cêntimos que sobram ficam na tua parte — e avisa, em vez de esconder.
  function splitEqually() {
    if (friendShares.some((s) => !s.friendId)) {
      setError('Escolhe o amigo em todas as linhas (ou remove as vazias) antes de dividir.')
      return
    }
    setError('')
    const people = friendShares.length + 1
    const totalCents = Math.round(numericAmount * 100)
    const shareCents = Math.floor(totalCents / people)
    const yourCents = totalCents - shareCents * friendShares.length
    setFriendShares((prev) => prev.map((s) => ({ ...s, amount: (shareCents / 100).toFixed(2) })))
    setSplitNotice(
      totalCents % people === 0
        ? ''
        : `${eur(totalCents / 100)} não divide em ${people} partes iguais: cada amigo fica com ${eur(shareCents / 100)} e a tua parte é ${eur(yourCents / 100)}.`,
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!numericAmount || numericAmount <= 0) {
      setError('Indica um valor válido.')
      return
    }

    if (!accountId || !effectiveCategoryId) {
      setError('Escolhe conta e categoria.')
      return
    }
    if (!note.trim()) {
      setError('Indica uma nota.')
      return
    }

    // Vai para outra conta tua (ex. investimento): um único registo que conta
    // como Gasto e atualiza as duas contas — não há segunda forma de o fazer.
    if (type === 'expense' && transferToId) {
      if (transferToId === accountId) {
        setError('A conta destino tem de ser diferente da conta de origem.')
        return
      }
      setSubmitting(true)
      setError('')
      try {
        await createTransfer({
          fromAccountId: accountId,
          toAccountId: transferToId,
          amount: numericAmount,
          occurredOn,
          note: note.trim(),
          categoryId: effectiveCategoryId,
          countsAsExpense: true,
        })
        setAmount('')
        setNote('')
        setOccurredOn(today())
        amountTouchedRef.current = false
        setAmountSuggested(false)
        setTransferToId('')
        onTransferCreated?.()
        toast.success(`Gasto de ${eur(numericAmount)} registado. Saldo da conta destino atualizado.`)
      } catch (err) {
        toast.error(`Não foi possível registar: ${err.message}`)
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Ganho: amigo único, devolveu o valor todo.
    const repaymentFriend = type === 'income' && showFriend ? friends.find((f) => f.id === friendId) : null
    if (type === 'income' && showFriend && !repaymentFriend) {
      setError('Escolhe o amigo, ou fecha essa secção.')
      return
    }

    // Gasto: uma ou várias pessoas, cada uma com a sua parte.
    const activeShares = type === 'expense' && showFriend ? friendShares.filter((s) => s.friendId) : []
    if (type === 'expense' && showFriend) {
      if (activeShares.length === 0) {
        setError('Escolhe pelo menos um amigo, ou fecha essa secção.')
        return
      }
      if (activeShares.some((s) => !Number(s.amount) || Number(s.amount) <= 0)) {
        setError('Indica quanto deve cada pessoa (valor válido).')
        return
      }
      const ids = activeShares.map((s) => s.friendId)
      if (new Set(ids).size !== ids.length) {
        setError('Não podes repetir o mesmo amigo.')
        return
      }
      if (sharesExceed) {
        setError('A soma das partes não pode exceder o valor total.')
        return
      }
    }

    setSubmitting(true)
    setError('')
    try {
      let created = null
      if (repaymentFriend) {
        const mode = friendEntryMode('income', repaymentFriend.status)
        const fields = {
          friendId: repaymentFriend.id,
          kind: friendEntryKind('income'),
          amount: numericAmount,
          note: note.trim(),
          occurredOn,
        }
        if (mode === 'shared-repayment') {
          // Sem transação própria: é criada quando o amigo confirmar a devolução.
          await createSharedEntry({ ...fields, settlement: 'bank', accountId, categoryId: effectiveCategoryId })
          notifyPendingChanged()
        } else {
          created = await createTransaction({
            amount: numericAmount,
            type,
            accountId,
            categoryId: effectiveCategoryId,
            occurredOn,
            note: note.trim(),
          })
          try {
            await createLinkedEntry({ ...fields, settlement: 'bank', transactionId: created.id })
          } catch (err) {
            await deleteTransaction(created.id).catch(() => {})
            throw err
          }
        }
      } else {
        created = await createTransaction({
          amount: numericAmount,
          type,
          accountId,
          categoryId: effectiveCategoryId,
          occurredOn,
          note: note.trim(),
        })
        // Tudo ou nada: se alguma parte falhar, desfaz as já criadas e a transação.
        const createdSoFar = []
        try {
          for (const share of activeShares) {
            const friend = friends.find((f) => f.id === share.friendId)
            const mode = friendEntryMode('expense', friend.status)
            const fields = {
              friendId: friend.id,
              kind: friendEntryKind('expense'),
              amount: Number(share.amount),
              note: note.trim(),
              occurredOn,
              transactionId: created.id,
            }
            const row = mode === 'shared-expense' ? await createSharedEntry(fields) : await createLinkedEntry(fields)
            createdSoFar.push({ friend, id: row?.id ?? row })
            if (mode === 'shared-expense') notifyPendingChanged()
          }
        } catch (err) {
          for (const done of createdSoFar) {
            if (done.friend.status === 'connected') await cancelPendingEntry(done.id).catch(() => {})
            else await deleteLocalEntryById(done.id).catch(() => {})
          }
          await deleteTransaction(created.id).catch(() => {})
          throw err
        }
      }

      setAmount('')
      setNote('')
      setOccurredOn(today())
      setCategoryId('')
      setSuggested(false)
      setAmountSuggested(false)
      categoryTouchedRef.current = false
      amountTouchedRef.current = false
      setShowFriend(false)
      setFriendId('')
      setFriendShares([{ friendId: '', amount: '' }])
      if (created) onCreated(created)

      if (repaymentFriend) {
        toast.success(`Já conta do teu lado. Enviado a ${repaymentFriend.name} para confirmar também.`)
      } else if (activeShares.length > 0) {
        const names = activeShares.map((s) => friends.find((f) => f.id === s.friendId)?.name).join(', ')
        toast.success(`Gasto de ${eur(numericAmount)} registado. Já conta do teu lado — dividido com ${names}.`)
      } else {
        toast.success(`${type === 'income' ? 'Ganho' : 'Gasto'} de ${eur(numericAmount)} registado.`)
      }
    } catch (err) {
      toast.error(`Não foi possível registar: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setType('expense')}
          className={`rounded-lg py-2 text-sm font-medium ${
            type === 'expense'
              ? 'bg-red-600 text-white'
              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
          }`}
        >
          Gasto
        </button>
        <button
          type="button"
          onClick={() => setType('income')}
          className={`rounded-lg py-2 text-sm font-medium ${
            type === 'income'
              ? 'bg-green-600 text-white'
              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
          }`}
        >
          Ganho
        </button>
      </div>

      <div>
        <label htmlFor="quick-entry-amount" className="mb-1 block text-xs font-medium text-neutral-500">
          Valor
        </label>
        <input
          id="quick-entry-amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          required
          placeholder="0.00 €"
          value={amount}
          onChange={(e) => {
            amountTouchedRef.current = true
            setAmountSuggested(false)
            setAmount(e.target.value)
          }}
          className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-2xl font-semibold dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
        {amountSuggested && (
          <p className="mt-0.5 text-xs text-neutral-400">valor sugerido a partir do histórico</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-neutral-500">Categoria</label>
          <select
            value={effectiveCategoryId}
            onChange={(e) => {
              categoryTouchedRef.current = true
              setSuggested(false)
              setCategoryId(e.target.value)
            }}
            className="w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {categoriesForType.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {suggested && (
            <p className="mt-0.5 text-xs text-neutral-400">sugerido a partir do histórico</p>
          )}
        </div>

        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-neutral-500">Conta</label>
          <select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value)
              if (e.target.value === transferToId) setTransferToId('')
            }}
            className="w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {type === 'expense' && accounts.length > 1 && !showFriend && (
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-neutral-500">
            Vai para outra conta tua? (opcional)
          </label>
          <select
            value={transferToId}
            onChange={(e) => setTransferToId(e.target.value)}
            className="w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            <option value="">Não — gasto normal</option>
            {accounts
              .filter((a) => a.id !== accountId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
          {transferToId && (
            <p className="mt-0.5 text-xs text-neutral-400">
              Ex. investimentos: conta como Gasto aqui e atualiza o saldo de {accounts.find((a) => a.id === transferToId)?.name} sozinho.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-neutral-500">Data</label>
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className="w-full min-w-0 appearance-none rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-neutral-500">Nota</label>
          <input
            type="text"
            placeholder="Ex: supermercado"
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>
      </div>

      {!transferToId && (
      <div>
        <button
          type="button"
          onClick={() => setShowFriend((v) => !v)}
          className="-my-1 flex min-h-9 items-center gap-0.5 text-xs text-neutral-600 underline-offset-2 hover:underline dark:text-neutral-400"
        >
          {showFriend ? 'Fechar' : (
            <>
              <Plus size={13} /> {type === 'expense' ? 'Dividir com amigos?' : 'Foi um amigo que te devolveu?'}
            </>
          )}
        </button>

        {showFriend && type === 'income' && (
          <div className="mt-2 grid grid-cols-1 gap-2 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
            <label htmlFor="quick-entry-friend" className="mb-1 block text-xs font-medium text-neutral-500">
              Quem devolveu
            </label>
            <FriendPicker
              id="quick-entry-friend"
              friends={friends}
              value={friendId}
              onChange={setFriendId}
              onFriendCreated={(f) => setFriends((prev) => [...prev, f].sort((a, b) => a.name.localeCompare(b.name, 'pt')))}
            />
            {friendsFailed && <p className="mt-1 text-xs text-red-600">Não foi possível carregar os amigos.</p>}
            {friends.find((f) => f.id === friendId)?.status === 'connected' && (
              <p className="mt-1 text-xs text-neutral-500">Ligado: só entra na conta depois da confirmação.</p>
            )}
          </div>
        )}

        {showFriend && type === 'expense' && (
          <div className="mt-2 space-y-2 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
            {friendShares.map((share, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <FriendPicker
                    friends={friends.filter((f) => !friendShares.some((s, i) => i !== index && s.friendId === f.id))}
                    value={share.friendId}
                    onChange={(id) => updateShare(index, { friendId: id })}
                    onFriendCreated={(f) => setFriends((prev) => [...prev, f].sort((a, b) => a.name.localeCompare(b.name, 'pt')))}
                  />
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="€"
                  aria-label="Quanto deve"
                  value={share.amount}
                  onChange={(e) => updateShare(index, { amount: e.target.value })}
                  className="w-20 min-w-0 shrink-0 rounded-lg border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                />
                <button
                  type="button"
                  onClick={() => removeShareRow(index)}
                  aria-label="Remover pessoa"
                  className="flex min-h-9 shrink-0 items-center justify-center rounded-lg px-2 text-neutral-400 hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}

            {friendsFailed && <p className="text-xs text-red-600">Não foi possível carregar os amigos.</p>}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={addShareRow}
                className="flex min-h-9 items-center gap-1 rounded-lg border border-neutral-300 px-2.5 text-xs font-medium dark:border-neutral-700"
              >
                <Plus size={13} /> Adicionar pessoa
              </button>
              <button
                type="button"
                onClick={splitEqually}
                disabled={!friendShares.some((s) => s.friendId) || !numericAmount}
                className="min-h-9 rounded-lg border border-neutral-300 px-2.5 text-xs font-medium disabled:opacity-40 dark:border-neutral-700"
              >
                Dividir por igual
              </button>
            </div>

            {numericAmount > 0 && (
              <p className={`text-xs ${sharesExceed ? 'text-red-600' : 'text-neutral-500'}`}>
                {sharesExceed
                  ? 'A soma das partes excede o valor total.'
                  : `Sobra para ti: ${eur(Math.max(0, numericAmount - sharesTotal))}`}
              </p>
            )}
            {splitNotice && <p className="text-xs text-amber-600 dark:text-amber-500">{splitNotice}</p>}
          </div>
        )}
      </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="min-h-12 w-full rounded-lg bg-neutral-900 py-3 font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {submitting ? 'A guardar...' : 'Registar'}
      </button>
    </form>
  )
}
