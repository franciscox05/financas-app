import { ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  createSnapshot,
  createTransfer,
  deleteSnapshot,
  deleteTransfer,
  listAccounts,
  listAllTransactionsForBalance,
  listNetWorthSnapshots,
  listTransfers,
} from '../lib/db'
import { Trash2 } from 'lucide-react'
import { ErrorNotice, Pager, Skeleton } from '../components/Feedback'
import { useToast } from '../context/toastContext'
import { balanceAt, groupHasReliableBaseline } from '../lib/accountBalance'
import { parseBalanceValue } from '../lib/balanceInput'
import { addMonths, endOfMonth, monthStart, shortMonthLabel, toIsoDate, today } from '../lib/dates'
import Card, { SectionCard } from '../components/Card'
import Money from '../components/Money'
import { usePrivacy } from '../context/privacyContext'
import HiddenChartNotice from '../components/HiddenChartNotice'
import { eur, ptDate } from '../lib/format'

const HISTORY_PAGE_SIZE = 10

const LINE_COLOR = '#2a78d6'

// Divisão visual pedida pelo Francisco: liquidez e investimento são dinheiros
// com naturezas diferentes e deixam de aparecer numa lista corrida só.
const ACCOUNT_SEGMENTS = [
  { type: 'cash', label: 'Liquidez', hint: 'Contas à ordem, poupança e dinheiro físico' },
  { type: 'investment', label: 'Investimento', hint: 'Valor atualizado pelos saldos que registas' },
]

// Soma o saldo (snapshot mais recente + transações desde esse snapshot) de
// cada conta do grupo, na mesma data — serve tanto para contas à ordem como
// de investimento.
function groupBalanceAt(transactions, snapshots, accountIds, asOfDate, transfers) {
  return accountIds.reduce(
    (sum, accountId) => sum + balanceAt(accountId, transactions, snapshots, asOfDate, transfers),
    0,
  )
}

export default function NetWorth() {
  const { hidden } = usePrivacy()
  const toast = useToast()
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [snapAccountId, setSnapAccountId] = useState('')
  const [snapValue, setSnapValue] = useState('')
  const [snapDate, setSnapDate] = useState(today())
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmingSnapshotId, setConfirmingSnapshotId] = useState(null)
  const [historyPage, setHistoryPage] = useState(1)

  const [confirmingTransferId, setConfirmingTransferId] = useState(null)
  const [transferHistoryPage, setTransferHistoryPage] = useState(1)

  const loadAll = useCallback(async () => {
    setError('')
    try {
      const [accs, txs, snaps, trs] = await Promise.all([
        listAccounts(),
        listAllTransactionsForBalance(),
        listNetWorthSnapshots(),
        listTransfers(),
      ])
      setAccounts(accs)
      setTransactions(txs)
      setSnapshots(snaps)
      setTransfers(trs)
      setSnapAccountId((prev) => prev || accs[0]?.id || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Evita ficar numa página vazia depois de apagar a última linha dela.
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(snapshots.length / HISTORY_PAGE_SIZE))
    if (historyPage > totalPages) setHistoryPage(totalPages)
  }, [snapshots, historyPage])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(transfers.length / HISTORY_PAGE_SIZE))
    if (transferHistoryPage > totalPages) setTransferHistoryPage(totalPages)
  }, [transfers, transferHistoryPage])

  const cashAccounts = useMemo(() => accounts.filter((a) => a.type === 'cash'), [accounts])
  const investmentAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'investment'),
    [accounts],
  )
  const investmentAccountIds = useMemo(
    () => investmentAccounts.map((a) => a.id),
    [investmentAccounts],
  )
  const cashAccountIds = useMemo(() => cashAccounts.map((a) => a.id), [cashAccounts])

  const cashBalance = useMemo(
    () => groupBalanceAt(transactions, snapshots, cashAccountIds, today(), transfers),
    [transactions, snapshots, cashAccountIds, transfers],
  )

  const balanceByAccountId = useMemo(() => {
    const now = today()
    const map = new Map()
    for (const acc of accounts) {
      map.set(acc.id, balanceAt(acc.id, transactions, snapshots, now, transfers))
    }
    return map
  }, [accounts, transactions, snapshots, transfers])

  const latestByAccount = useMemo(() => {
    const map = new Map()
    for (const accountId of investmentAccountIds) {
      const latest = snapshots
        .filter((s) => s.account_id === accountId)
        .sort((a, b) => (a.snapshot_date < b.snapshot_date ? 1 : -1))[0]
      if (latest) map.set(accountId, latest)
    }
    return map
  }, [snapshots, investmentAccountIds])

  const investmentTotal = useMemo(
    () => groupBalanceAt(transactions, snapshots, investmentAccountIds, today(), transfers),
    [transactions, snapshots, investmentAccountIds, transfers],
  )

  // Saldo consolidado de contas, direto — sem nenhuma mistura com dívidas de
  // amigos (esse saldo vive em Amigos; é um assunto diferente de "quanto
  // dinheiro tenho nas minhas contas").
  const totalNetWorth = cashBalance + investmentTotal

  // Os 6 pontos da janela, calculados uma vez: o mês corrente vai até hoje, os
  // anteriores até ao último dia do mês.
  const monthPoints = useMemo(() => {
    const points = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = addMonths(monthStart(new Date()), -i)
      points.push({
        label: shortMonthLabel(monthDate),
        asOfDate: i === 0 ? today() : toIsoDate(endOfMonth(monthDate)),
      })
    }
    return points
  }, [])

  // Um ponto só é desenhado se houver base fiável para todas as contas nessa
  // data (ver `hasReliableBaseline` em accountBalance.js); sem isso o valor
  // seria o fluxo de caixa acumulado desde zero, não o património do mês — e
  // uma transação antiga registada hoje afundava todos os meses anteriores ao
  // primeiro snapshot. Os meses sem base ficam a `null` e a linha simplesmente
  // não aparece até lá (connectNulls={false} no gráfico), sem inventar valor.
  const chartData = useMemo(() => {
    const allAccountIds = accounts.map((a) => a.id)
    return monthPoints.map(({ label, asOfDate }) => {
      if (!groupHasReliableBaseline(accounts, snapshots, asOfDate)) {
        return { month: label, Património: null }
      }
      const total = groupBalanceAt(transactions, snapshots, allAccountIds, asOfDate, transfers)
      return { month: label, Património: Number(total.toFixed(2)) }
    })
  }, [monthPoints, transactions, snapshots, accounts, transfers])

  async function handleAddSnapshot(e) {
    e.preventDefault()
    const numericValue = parseBalanceValue(snapValue)
    if (!snapAccountId) {
      setFormError('Escolhe uma conta.')
      return
    }
    if (numericValue === null) {
      setFormError('Indica um valor válido (ex.: 150,27).')
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      await createSnapshot({ accountId: snapAccountId, value: numericValue, snapshotDate: snapDate })
      setSnapValue('')
      setSnapDate(today())
      await loadAll()
      toast.success('Snapshot guardado.')
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteSnapshot(snapshot) {
    try {
      await deleteSnapshot(snapshot.id)
      setConfirmingSnapshotId(null)
      await loadAll()
      toast.success('Snapshot apagado.', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            try {
              await createSnapshot({
                accountId: snapshot.account_id,
                value: Number(snapshot.value),
                snapshotDate: snapshot.snapshot_date,
              })
              await loadAll()
              toast.success('Snapshot restaurado.')
            } catch (err) {
              toast.error(`Não foi possível desfazer: ${err.message}`)
            }
          },
        },
      })
    } catch (err) {
      toast.error(`Não foi possível apagar: ${err.message}`)
    }
  }

  async function handleDeleteTransfer(transfer) {
    try {
      await deleteTransfer(transfer.id)
      setConfirmingTransferId(null)
      await loadAll()
      toast.success('Transferência apagada.', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            try {
              await createTransfer({
                fromAccountId: transfer.from_account_id,
                toAccountId: transfer.to_account_id,
                amount: Number(transfer.amount),
                occurredOn: transfer.occurred_on,
                note: transfer.note,
                categoryId: transfer.category_id,
                countsAsExpense: transfer.counts_as_expense,
              })
              await loadAll()
              toast.success('Transferência restaurada.')
            } catch (err) {
              toast.error(`Não foi possível desfazer: ${err.message}`)
            }
          },
        },
      })
    } catch (err) {
      toast.error(`Não foi possível apagar: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-56" />
      </div>
    )
  }

  if (error) {
    return <ErrorNotice message={error} />
  }

  return (
    <div className="space-y-6">
      <Card className="text-center">
        <p className="text-xs text-neutral-500">Património total</p>
        <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          <Money value={totalNetWorth} />
        </p>
      </Card>

      {ACCOUNT_SEGMENTS.map((segment) => {
        const segmentAccounts = segment.type === 'cash' ? cashAccounts : investmentAccounts
        if (segmentAccounts.length === 0) return null
        const subtotal = segment.type === 'cash' ? cashBalance : investmentTotal
        return (
          <SectionCard
            key={segment.type}
            title={segment.label}
            hint={segment.hint}
            aside={
              <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                <Money value={subtotal} />
              </span>
            }
          >
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {segmentAccounts.map((acc) => {
                const latest = latestByAccount.get(acc.id)
                return (
                  <li key={acc.id}>
                    <Link
                      to={`/patrimonio/conta/${acc.id}`}
                      className="flex min-h-12 w-full items-center justify-between gap-3 py-2.5 text-left transition-transform active:scale-[0.99]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-neutral-700 dark:text-neutral-300">{acc.name}</p>
                        {latest && (
                          <p className="text-xs text-neutral-400">atualizado {ptDate(latest.snapshot_date)}</p>
                        )}
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5 font-semibold text-neutral-900 dark:text-neutral-100">
                        <Money value={balanceByAccountId.get(acc.id) ?? 0} />
                        <ChevronRight size={14} className="text-neutral-400" aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </SectionCard>
        )
      })}

      <SectionCard title="Evolução (últimos 6 meses)">
        <div className="h-56 w-full">
          {hidden ? (
            <HiddenChartNotice />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="networthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={LINE_COLOR} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={LINE_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#898781" strokeOpacity={0.2} strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: '#898781' }}
                  axisLine={{ stroke: '#c3c2b7' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#898781' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  formatter={(value) => eur(Number(value))}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 10,
                    border: '1px solid var(--tooltip-border)',
                    backgroundColor: 'var(--tooltip-bg)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
                  }}
                  itemStyle={{ color: 'var(--tooltip-text)' }}
                  labelStyle={{ color: 'var(--tooltip-text)', fontWeight: 600, marginBottom: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="Património"
                  stroke={LINE_COLOR}
                  strokeWidth={2.5}
                  fill="url(#networthFill)"
                  connectNulls={false}
                  dot={{ r: 3.5, strokeWidth: 0, fill: LINE_COLOR }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Atualizar saldo de uma conta"
        hint="Regista quanto tens numa conta numa data — só afeta o património a partir desse dia, nunca os meses anteriores."
      >
        <form onSubmit={handleAddSnapshot} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Conta</label>
            <select
              value={snapAccountId}
              onChange={(e) => setSnapAccountId(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-neutral-500">Data</label>
            <input
              type="date"
              value={snapDate}
              onChange={(e) => setSnapDate(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Valor total nessa data</label>
            <input
              type="text"
              inputMode="decimal"
              required
              placeholder="0,00 €"
              value={snapValue}
              onChange={(e) => setSnapValue(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-neutral-900 min-h-12 py-2.5 font-medium text-white transition-colors disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {submitting ? 'A guardar...' : 'Guardar atualização'}
          </button>
        </form>
      </SectionCard>

      {snapshots.length > 0 && (
        <SectionCard title="Histórico de atualizações de saldo">
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {snapshots
              .slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE)
              .map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {ptDate(s.snapshot_date)} · {s.accounts?.name ?? 'Conta'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      <Money value={Number(s.value)} />
                    </span>
                    {confirmingSnapshotId === s.id ? (
                      <span className="flex items-center gap-1">
                        <button
                          onClick={() => handleDeleteSnapshot(s)}
                          className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmingSnapshotId(null)}
                          className="rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
                        >
                          Cancelar
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmingSnapshotId(s.id)}
                        aria-label="Apagar atualização"
                        className="rounded p-1 text-neutral-400 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
          </ul>
          <Pager
            page={historyPage}
            totalPages={Math.ceil(snapshots.length / HISTORY_PAGE_SIZE)}
            onChange={setHistoryPage}
          />
        </SectionCard>
      )}

      {transfers.length > 0 && (
        <SectionCard
          title="Transferências entre contas"
          hint={'Para mover dinheiro entre as tuas contas (ex.: Conta Corrente → XTB ao investir), usa a opção "Mover para outra conta tua?" no Registo. Aqui fica o histórico, para apagar ou desfazer.'}
        >
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {transfers
              .slice((transferHistoryPage - 1) * HISTORY_PAGE_SIZE, transferHistoryPage * HISTORY_PAGE_SIZE)
              .map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="min-w-0 truncate text-neutral-600 dark:text-neutral-400">
                    {t.from_account?.name ?? 'Conta'} → {t.to_account?.name ?? 'Conta'} · {t.occurred_on}
                    {t.note ? ` · ${t.note}` : ''}
                    {t.counts_as_expense ? ` · ${t.categories?.name ?? 'Gasto'} (conta como gasto)` : ''}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`font-medium ${t.counts_as_expense ? 'text-red-600' : 'text-neutral-900 dark:text-neutral-100'}`}
                    >
                      <Money value={Number(t.amount)} />
                    </span>
                    {confirmingTransferId === t.id ? (
                      <span className="flex items-center gap-1">
                        <button
                          onClick={() => handleDeleteTransfer(t)}
                          className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmingTransferId(null)}
                          className="rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
                        >
                          Cancelar
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmingTransferId(t.id)}
                        aria-label="Apagar transferência"
                        className="rounded p-1 text-neutral-400 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
          </ul>
          <Pager
            page={transferHistoryPage}
            totalPages={Math.ceil(transfers.length / HISTORY_PAGE_SIZE)}
            onChange={setTransferHistoryPage}
          />
        </SectionCard>
      )}

    </div>
  )
}
