import { t } from '../i18n'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { suggestAmount, suggestCategoryId } from '../lib/categorySuggest'
import { useToast } from '../context/toastContext'
import { today } from '../lib/dates'
import { createTransaction, createTransfer, deleteTransaction } from '../lib/db'
import { currencySymbol, eur } from '../lib/format'
import { createFriend, createLinkedEntry, deleteLocalEntryById, listFriendsWithBalance } from '../lib/friendsDb'
import { cancelPendingEntry, createSharedEntry } from '../lib/linkedDb'
import { notifyPendingChanged } from '../lib/pendingEvents'
import { friendEntryKind, friendEntryMode } from '../lib/quickEntryFriend'
import { defaultCategoryId, overshootNote } from '../lib/repaymentInput'
import Segmented from './ui/Segmented'
import { inputClass } from './ui/styles'

// Campo comum da app (ui/styles.js): sem borda, fundo de preenchimento, 44 px.
const selectClass = inputClass

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
      toast.error(err.message || t('qe.addFailed'))
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
          placeholder={t('qe.friendName')}
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
          className="min-h-11 shrink-0 rounded-control bg-accent-fill px-4 text-[0.9375rem] font-semibold text-white disabled:opacity-50"
        >
          {busy ? '...' : t('common.add')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setNewMode(false)
            setNewName('')
          }}
          className="min-h-11 shrink-0 rounded-control bg-fill px-4 text-[0.9375rem] font-semibold text-label"
        >
          {t('common.cancel')}
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
      <option value="">{t('qe.pickFriend')}</option>
      {friends.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
      <option value="__new__">{t('qe.newFriend')}</option>
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

  // Terceiro modo, ao lado de Gasto/Ganho: mover dinheiro entre as tuas
  // próprias contas (ex. investimento: Conta à Ordem -> XTB). Por omissão é
  // neutro (não conta como Gasto/Ganho); marcar "Conta como gasto do mês"
  // faz-o entrar no Balanço com categoria — sempre UM registo, que atualiza
  // as duas contas sozinho.
  const [transferToId, setTransferToId] = useState('')
  const [transferCountsAsExpense, setTransferCountsAsExpense] = useState(false)

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

  // Transferência não tem categorias próprias — quando marcada como "conta
  // como gasto", usa as categorias de Gasto normais.
  const categoriesForType = useMemo(
    () => categories.filter((c) => c.type === (type === 'transfer' ? 'expense' : type)),
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
    if (type === 'transfer' || categoryTouchedRef.current || hasAnyFriend) return
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
    if (type === 'transfer' || amountTouchedRef.current) return
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
    setTransferCountsAsExpense(false)
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

  // Ganho: o amigo (um só) que devolveu o valor todo. Tem de existir aqui, no
  // corpo do componente, porque o JSX também o usa (aviso de "ligado" e de
  // devolução a mais) — estava declarado só dentro do handleSubmit, e abrir
  // "Foi um amigo que te devolveu?" rebentava com "repaymentFriend is not defined".
  const repaymentFriend = type === 'income' && showFriend ? (friends.find((f) => f.id === friendId) ?? null) : null

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
      setError(t('qe.err.pickAllFriends'))
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
        : t('qe.err.uneven', { total: eur(totalCents / 100), people, share: eur(shareCents / 100), yours: eur(yourCents / 100) }),
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!numericAmount || numericAmount <= 0) {
      setError(t('qe.err.amount'))
      return
    }

    if (!accountId) {
      setError(t('qe.err.account'))
      return
    }
    if (!note.trim()) {
      setError(t('qe.err.note'))
      return
    }

    // Transferência: um único registo que atualiza as duas contas sozinho —
    // opcionalmente conta como Gasto do mês (ex. investimentos), senão é
    // neutra. Não há segunda forma de o fazer.
    if (type === 'transfer') {
      if (!transferToId) {
        setError(t('qe.err.toAccount'))
        return
      }
      if (transferToId === accountId) {
        setError(t('qe.err.sameAccount'))
        return
      }
      if (transferCountsAsExpense && !effectiveCategoryId) {
        setError(t('qe.err.expenseCategory'))
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
          categoryId: transferCountsAsExpense ? effectiveCategoryId : undefined,
          countsAsExpense: transferCountsAsExpense,
        })
        setAmount('')
        setNote('')
        setOccurredOn(today())
        amountTouchedRef.current = false
        setAmountSuggested(false)
        setTransferToId('')
        setTransferCountsAsExpense(false)
        onTransferCreated?.()
        toast.success(
          transferCountsAsExpense
            ? t('qe.ok.transferExpense', { value: eur(numericAmount) })
            : t('qe.ok.transfer', { value: eur(numericAmount) }),
        )
      } catch (err) {
        toast.error(t('qe.err.save', { msg: err.message }))
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!effectiveCategoryId) {
      setError(t('qe.err.category'))
      return
    }

    // Ganho: amigo único, devolveu o valor todo (`repaymentFriend`, acima).
    if (type === 'income' && showFriend && !repaymentFriend) {
      setError(t('qe.err.friendOrClose'))
      return
    }

    // Gasto: uma ou várias pessoas, cada uma com a sua parte.
    const activeShares = type === 'expense' && showFriend ? friendShares.filter((s) => s.friendId) : []
    if (type === 'expense' && showFriend) {
      if (activeShares.length === 0) {
        setError(t('qe.err.oneFriend'))
        return
      }
      if (activeShares.some((s) => !Number(s.amount) || Number(s.amount) <= 0)) {
        setError(t('qe.err.shareAmount'))
        return
      }
      const ids = activeShares.map((s) => s.friendId)
      if (new Set(ids).size !== ids.length) {
        setError(t('qe.err.repeatFriend'))
        return
      }
      if (sharesExceed) {
        setError(t('qe.err.sharesExceed'))
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
        toast.success(t('qe.ok.repaid', { name: repaymentFriend.name }))
      } else if (activeShares.length > 0) {
        const names = activeShares.map((s) => friends.find((f) => f.id === s.friendId)?.name).join(', ')
        toast.success(t('qe.ok.split', { value: eur(numericAmount), names }))
      } else {
        toast.success(t(type === 'income' ? 'qe.ok.income' : 'qe.ok.expense', { value: eur(numericAmount) }))
      }
    } catch (err) {
      toast.error(t('qe.err.save', { msg: err.message }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-group bg-surface p-4"
    >
      {/* A cor deixou de pintar o botão inteiro: a opção escolhida é a pastilha
          elevada, e a cor (vermelho/verde/azul) fica só no texto dela. A
          Transferência só existe com mais de uma conta, como antes. */}
      <Segmented
        label={t('qe.typeLabel')}
        value={type}
        onChange={setType}
        options={[
          { value: 'expense', label: t('kind.expense'), tone: 'negative' },
          { value: 'income', label: t('kind.income'), tone: 'positive' },
          ...(accounts.length > 1 ? [{ value: 'transfer', label: t('kind.transfer'), tone: 'accent' }] : []),
        ]}
      />

      <div>
        <label htmlFor="quick-entry-amount" className="mb-1.5 block text-[0.8125rem] font-medium text-label-2">
          {t('common.amount')}
        </label>
        <input
          id="quick-entry-amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          required
          placeholder={eur(0)}
          value={amount}
          onChange={(e) => {
            amountTouchedRef.current = true
            setAmountSuggested(false)
            setAmount(e.target.value)
          }}
          className="amount w-full rounded-control border-0 bg-fill px-4 py-3 text-[2rem]! leading-tight font-bold tracking-tight text-label placeholder:text-label-3 focus:ring-2 focus:ring-accent"
        />
        {amountSuggested && (
          <p className="mt-0.5 text-[0.8125rem] leading-snug text-label-3">{t('qe.suggestedAmount')}</p>
        )}
      </div>

      {type === 'transfer' ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="mb-1.5 block text-[0.8125rem] font-medium text-label-2">{t('qe.fromAccount')}</label>
              <select
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value)
                  if (e.target.value === transferToId) setTransferToId('')
                }}
                className="w-full min-w-0 rounded-control border-0 bg-fill px-3 text-label focus:ring-2 focus:ring-accent"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="mb-1.5 block text-[0.8125rem] font-medium text-label-2">{t('qe.toAccount')}</label>
              <select
                value={transferToId}
                onChange={(e) => setTransferToId(e.target.value)}
                className="w-full min-w-0 rounded-control border-0 bg-fill px-3 text-label focus:ring-2 focus:ring-accent"
              >
                <option value="">{t('qe.pickAccount')}</option>
                {accounts
                  .filter((a) => a.id !== accountId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="flex min-h-11 items-center gap-3 text-[0.9375rem] text-label">
              <input
                type="checkbox"
                checked={transferCountsAsExpense}
                onChange={(e) => setTransferCountsAsExpense(e.target.checked)}
                className="size-5 min-h-0! shrink-0 accent-accent"
              />
              {t('qe.countsAsExpense')}
            </label>
            <p className="mt-0.5 text-[0.8125rem] leading-snug text-label-3">
              {transferCountsAsExpense
                ? t('qe.countsHelp')
                : t('qe.neutralHelp')}
            </p>
            {transferCountsAsExpense && (
              <div className="mt-2 min-w-0">
                <label className="mb-1.5 block text-[0.8125rem] font-medium text-label-2">{t('common.category')}</label>
                <select
                  value={effectiveCategoryId}
                  onChange={(e) => {
                    categoryTouchedRef.current = true
                    setCategoryId(e.target.value)
                  }}
                  className="w-full min-w-0 rounded-control border-0 bg-fill px-3 text-label focus:ring-2 focus:ring-accent"
                >
                  {categoriesForType.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="mb-1.5 block text-[0.8125rem] font-medium text-label-2">{t('common.category')}</label>
            <select
              value={effectiveCategoryId}
              onChange={(e) => {
                categoryTouchedRef.current = true
                setSuggested(false)
                setCategoryId(e.target.value)
              }}
              className="w-full min-w-0 rounded-control border-0 bg-fill px-3 text-label focus:ring-2 focus:ring-accent"
            >
              {categoriesForType.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {suggested && (
              <p className="mt-0.5 text-[0.8125rem] leading-snug text-label-3">{t('qe.suggested')}</p>
            )}
          </div>

          <div className="min-w-0">
            <label className="mb-1.5 block text-[0.8125rem] font-medium text-label-2">{t('common.account')}</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full min-w-0 rounded-control border-0 bg-fill px-3 text-label focus:ring-2 focus:ring-accent"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label className="mb-1.5 block text-[0.8125rem] font-medium text-label-2">{t('common.date')}</label>
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className="w-full min-w-0 appearance-none rounded-control border-0 bg-fill px-3 text-label focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1.5 block text-[0.8125rem] font-medium text-label-2">{t('common.note')}</label>
          <input
            type="text"
            placeholder={t('qe.notePlaceholder')}
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full min-w-0 rounded-control border-0 bg-fill px-3 text-label focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      {type !== 'transfer' && (
      <div>
        <button
          type="button"
          onClick={() => setShowFriend((v) => !v)}
          className="flex min-h-11 items-center gap-1 text-[0.9375rem] font-medium text-accent"
        >
          {showFriend ? t('qe.close') : (
            <>
              <Plus size={16} strokeWidth={2.4} aria-hidden="true" /> {type === 'expense' ? t('qe.split') : t('qe.repaid')}
            </>
          )}
        </button>

        {showFriend && type === 'income' && (
          <div className="mt-1 grid grid-cols-1 gap-2 rounded-control border-[0.5px] border-separator p-3">
            <label htmlFor="quick-entry-friend" className="mb-1.5 block text-[0.8125rem] font-medium text-label-2">
              {t('qe.whoRepaid')}
            </label>
            <FriendPicker
              id="quick-entry-friend"
              friends={friends}
              value={friendId}
              onChange={setFriendId}
              onFriendCreated={(f) => setFriends((prev) => [...prev, f].sort((a, b) => a.name.localeCompare(b.name, 'pt')))}
            />
            {friendsFailed && <p className="mt-1 text-[0.8125rem] leading-snug text-negative">{t('qe.friendsFailed')}</p>}
            {repaymentFriend?.status === 'connected' && (
              <p className="mt-1 text-[0.8125rem] leading-snug text-label-2">{t('qe.linkedHelp')}</p>
            )}
            {repaymentFriend &&
              numericAmount > 0 &&
              (() => {
                const note = overshootNote('repaid_to_me', repaymentFriend.balance, numericAmount)
                if (!note) return null
                const prefix = repaymentFriend.balance <= 0 ? t('qe.noDebts', { name: repaymentFriend.name }) : ''
                return (
                  <p className="mt-1 text-[0.8125rem] leading-snug text-warning">
                    {prefix}
                    {note}.
                  </p>
                )
              })()}
          </div>
        )}

        {showFriend && type === 'expense' && (
          <div className="mt-1 space-y-2 rounded-control border-[0.5px] border-separator p-3">
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
                  placeholder={currencySymbol()}
                  aria-label={t('qe.owes')}
                  value={share.amount}
                  onChange={(e) => updateShare(index, { amount: e.target.value })}
                  className="w-24 min-w-0 shrink-0 rounded-control border-0 bg-fill px-3 text-label focus:ring-2 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={() => removeShareRow(index)}
                  aria-label={t('qe.removePerson')}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-label-2"
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </div>
            ))}

            {friendsFailed && <p className="text-[0.8125rem] leading-snug text-negative">{t('qe.friendsFailed')}</p>}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={addShareRow}
                className="flex min-h-11 items-center gap-1 rounded-control bg-fill px-3 text-[0.8125rem] font-semibold text-label"
              >
                <Plus size={16} strokeWidth={2.4} aria-hidden="true" /> {t('qe.addPerson')}
              </button>
              <button
                type="button"
                onClick={splitEqually}
                disabled={!friendShares.some((s) => s.friendId) || !numericAmount}
                className="min-h-11 rounded-control bg-fill px-3 text-[0.8125rem] font-semibold text-label disabled:opacity-40"
              >
                {t('qe.splitEqually')}
              </button>
            </div>

            {numericAmount > 0 && (
              <p className={`text-[0.8125rem] leading-snug ${sharesExceed ? 'text-negative' : 'text-label-2'}`}>
                {sharesExceed
                  ? t('qe.sharesExceed')
                  : t('qe.leftForYou', { value: eur(Math.max(0, numericAmount - sharesTotal)) })}
              </p>
            )}
            {splitNotice && <p className="text-[0.8125rem] leading-snug text-warning">{splitNotice}</p>}
          </div>
        )}
      </div>
      )}

      {error && <p role="alert" className="text-[0.9375rem] text-negative">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="min-h-12 w-full rounded-control bg-accent-fill py-3 text-[1.0625rem] font-semibold text-white transition-opacity duration-150 active:opacity-70 disabled:opacity-50"
      >
        {submitting ? t('common.saving') : type === 'transfer' && !transferCountsAsExpense ? t('qe.transfer') : t('qe.register')}
      </button>
    </form>
  )
}
