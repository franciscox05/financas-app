import { Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { suggestAmount, suggestCategoryId } from '../lib/categorySuggest'
import { useToast } from '../context/toastContext'
import { today } from '../lib/dates'
import { createTransaction, deleteTransaction } from '../lib/db'
import { eur } from '../lib/format'
import { createFriend, createLinkedEntry, listFriendsWithBalance } from '../lib/friendsDb'
import { createSharedEntry } from '../lib/linkedDb'
import { notifyPendingChanged } from '../lib/pendingEvents'
import { friendEntryKind, friendEntryMode } from '../lib/quickEntryFriend'
import { defaultCategoryId } from '../lib/repaymentInput'

export default function QuickEntryForm({ accounts, categories, transactions, onCreated }) {
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

  // Amigo associado (gasto: "alguém te deve"; ganho: "um amigo devolveu-te").
  const [showFriend, setShowFriend] = useState(false)
  const [friendId, setFriendId] = useState('')
  const [debtAmount, setDebtAmount] = useState('')
  const [friends, setFriends] = useState([])
  const [friendsFailed, setFriendsFailed] = useState(false)
  const [newFriendMode, setNewFriendMode] = useState(false)
  const [newFriendName, setNewFriendName] = useState('')
  const [newFriendBusy, setNewFriendBusy] = useState(false)
  const [newFriendError, setNewFriendError] = useState('')

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

  // "Investimentos"/"Outros Ganhos" são muitas vezes usadas para mover dinheiro
  // entre contas próprias (ex. Conta à Ordem -> XTB) registando um gasto numa
  // conta e um ganho na outra à mão — a secção "Transferir entre contas" em
  // Património faz isto automaticamente e não distorce o Balanço.
  const isLikelyOwnTransfer = categoriesForType
    .find((c) => c.id === effectiveCategoryId)
    ?.name?.toLowerCase()
    .includes('investiment')

  // Sugere categoria a partir do histórico quando o utilizador escreve uma nota,
  // desde que não tenha escolhido a categoria manualmente para esta transação,
  // nem tenha um amigo associado (nesse caso "Empréstimos"/"Devoluções" manda —
  // senão escrever a nota depois de escolher o amigo trocava a categoria de volta).
  useEffect(() => {
    if (categoryTouchedRef.current || friendId) return
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
    setDebtAmount('')
    setNewFriendMode(false)
    setNewFriendName('')
  }, [type])

  // Ao escolher um amigo, salta para "Empréstimos"/"Devoluções" (se existirem e a
  // categoria ainda não tiver sido escolhida à mão para esta transação).
  useEffect(() => {
    if (!friendId || categoryTouchedRef.current) return
    const id = defaultCategoryId(categories, friendEntryKind(type))
    if (id && categoriesForType.some((c) => c.id === id)) {
      setCategoryId(id)
      setSuggested(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId])

  async function handleCreateFriend(e) {
    e.preventDefault()
    if (newFriendBusy) return
    setNewFriendBusy(true)
    setNewFriendError('')
    try {
      const created = await createFriend({ name: newFriendName, phone: '', requestLink: false })
      setFriends((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'pt')))
      setFriendId(created.id)
      setNewFriendMode(false)
      setNewFriendName('')
    } catch (err) {
      setNewFriendError(err.message || 'Não foi possível adicionar. Tenta outra vez.')
    } finally {
      setNewFriendBusy(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) {
      setError('Indica um valor válido.')
      return
    }
    if (!accountId || !effectiveCategoryId) {
      setError('Escolhe conta e categoria.')
      return
    }
    if (!note.trim()) {
      setError('Indica uma nota (ex: supermercado).')
      return
    }

    const friend = showFriend ? friends.find((f) => f.id === friendId) : null
    const numericDebtAmount = Number(debtAmount)
    if (showFriend && !friend) {
      setError('Escolhe o amigo, ou fecha essa secção.')
      return
    }
    if (friend && type === 'expense' && (!numericDebtAmount || numericDebtAmount <= 0)) {
      setError('Indica quanto te deve (valor válido), ou fecha essa secção.')
      return
    }

    const mode = friend ? friendEntryMode(type, friend.status) : null
    const entryFields = friend && {
      friendId: friend.id,
      kind: friendEntryKind(type),
      amount: type === 'income' ? numericAmount : numericDebtAmount,
      note: note.trim(),
      occurredOn,
    }

    setSubmitting(true)
    setError('')
    try {
      let created = null
      if (mode === 'shared-repayment') {
        // Sem transação própria: é criada quando o amigo confirmar a devolução.
        await createSharedEntry({
          ...entryFields,
          settlement: 'bank',
          accountId,
          categoryId: effectiveCategoryId,
        })
      } else {
        created = await createTransaction({
          amount: numericAmount,
          type,
          accountId,
          categoryId: effectiveCategoryId,
          occurredOn,
          note: note.trim(),
        })
        if (friend) {
          // Tudo ou nada: se o movimento do amigo falhar, apaga a transação.
          try {
            if (mode === 'shared-expense') await createSharedEntry({ ...entryFields, transactionId: created.id })
            else {
              await createLinkedEntry({
                ...entryFields,
                settlement: type === 'income' ? 'bank' : null,
                transactionId: created.id,
              })
            }
          } catch (err) {
            await deleteTransaction(created.id).catch(() => {})
            throw err
          }
        }
      }
      if (mode?.startsWith('shared')) notifyPendingChanged()
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
      setDebtAmount('')
      setNewFriendMode(false)
      setNewFriendName('')
      if (created) onCreated(created)
      toast.success(
        mode === 'shared-repayment'
          ? `Enviado a ${friend.name} para confirmar.`
          : mode === 'shared-expense'
            ? `Gasto de ${eur(numericAmount)} registado. Enviado a ${friend.name} para confirmar.`
            : `${type === 'income' ? 'Ganho' : 'Gasto'} de ${eur(numericAmount)} registado.`,
      )
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
          {isLikelyOwnTransfer && (
            <p className="mt-0.5 text-xs text-neutral-400">
              A mover dinheiro entre as tuas contas?{' '}
              <Link to="/patrimonio" className="underline underline-offset-2">
                Usa Transferir entre contas
              </Link>{' '}
              em vez disto — não conta como Gasto/Ganho.
            </p>
          )}
        </div>

        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-neutral-500">Conta</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
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

      <div>
        <button
          type="button"
          onClick={() => {
            if (!showFriend && type === 'expense' && !debtAmount && amount) setDebtAmount(amount)
            setShowFriend((v) => !v)
            setNewFriendMode(false)
            setNewFriendName('')
          }}
          className="-my-1 flex min-h-9 items-center gap-0.5 text-xs text-neutral-600 underline-offset-2 hover:underline dark:text-neutral-400"
        >
          {showFriend ? 'Fechar' : (
            <>
              <Plus size={13} /> {type === 'expense' ? 'Alguém te deve por isto?' : 'Foi um amigo que te devolveu?'}
            </>
          )}
        </button>

        {showFriend && (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
            <div className="col-span-2 min-w-0">
              <label htmlFor="quick-entry-friend" className="mb-1 block text-xs font-medium text-neutral-500">
                {type === 'expense' ? 'Quem te deve' : 'Quem devolveu'}
              </label>
              {newFriendMode ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Nome do amigo"
                    value={newFriendName}
                    disabled={newFriendBusy}
                    onChange={(e) => setNewFriendName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCreateFriend(e)
                      }
                    }}
                    className="w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                  />
                  <button
                    type="button"
                    disabled={newFriendBusy || !newFriendName.trim()}
                    onClick={handleCreateFriend}
                    className="min-h-9 shrink-0 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                  >
                    {newFriendBusy ? '...' : 'Adicionar'}
                  </button>
                  <button
                    type="button"
                    disabled={newFriendBusy}
                    onClick={() => {
                      setNewFriendMode(false)
                      setNewFriendName('')
                      setNewFriendError('')
                    }}
                    className="min-h-9 shrink-0 rounded-lg border border-neutral-300 px-3 text-sm dark:border-neutral-700"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <select
                  id="quick-entry-friend"
                  value={friendId}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setNewFriendMode(true)
                      setNewFriendError('')
                      return
                    }
                    setFriendId(e.target.value)
                  }}
                  className="w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                >
                  <option value="">Escolhe um amigo</option>
                  {friends.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                  <option value="__new__">+ Novo amigo...</option>
                </select>
              )}
              {newFriendError && <p className="mt-1 text-xs text-red-600">{newFriendError}</p>}
              {friendsFailed && <p className="mt-1 text-xs text-red-600">Não foi possível carregar os amigos.</p>}
              {friends.find((f) => f.id === friendId)?.status === 'connected' && (
                <p className="mt-1 text-xs text-neutral-500">
                  {type === 'expense'
                    ? 'Ligado: o pedido vai para ele confirmar.'
                    : 'Ligado: só entra na conta quando ele confirmar.'}
                </p>
              )}
            </div>
            {type === 'expense' && (
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="Quanto te deve (€)"
                aria-label="Quanto te deve (€)"
                value={debtAmount}
                onChange={(e) => setDebtAmount(e.target.value)}
                className="col-span-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            )}
          </div>
        )}
      </div>

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
