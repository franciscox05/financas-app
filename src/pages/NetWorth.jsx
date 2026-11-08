import { ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { listAccounts, listAllTransactionsForBalance, listNetWorthSnapshots, listTransfers } from '../lib/db'
import { ErrorNotice, Skeleton } from '../components/Feedback'
import { balanceAt, groupHasReliableBaseline } from '../lib/accountBalance'
import { addMonths, endOfMonth, monthStart, shortMonthLabel, toIsoDate, today } from '../lib/dates'
import AccountDetailModal from '../components/AccountDetailModal'
import Card, { SectionCard } from '../components/Card'
import Money from '../components/Money'
import { usePrivacy } from '../context/privacyContext'
import HiddenChartNotice from '../components/HiddenChartNotice'
import { eur, ptDate } from '../lib/format'

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
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  // `snapshots`/`transfers` só alimentam o cálculo de saldos (balanceAt,
  // chartData) — criar/apagar snapshots e transferências já não tem UI
  // própria aqui (existe em Gestão e no detalhe da conta), por isso não há
  // handlers de escrita nem paginação de histórico nesta página.
  const [snapshots, setSnapshots] = useState([])
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedAccount, setSelectedAccount] = useState(null) // abre o AccountDetailModal

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
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

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

      {/* Um só cartão para as duas naturezas de dinheiro (Liquidez/Investimento),
          separadas por uma divisória interna em vez de dois cartões — pedido
          do Francisco depois de testar no telemóvel. A ordem das contas dentro
          de cada bloco já vem de `accounts` (listAccounts ordena por
          `sort_order`), por isso o arrastar definido em Gestão continua a
          valer aqui sem nada extra. */}
      {accounts.length > 0 && (
        <Card>
          {ACCOUNT_SEGMENTS.filter(
            (segment) => (segment.type === 'cash' ? cashAccounts : investmentAccounts).length > 0,
          ).map((segment, visibleIndex) => {
            const segmentAccounts = segment.type === 'cash' ? cashAccounts : investmentAccounts
            const subtotal = segment.type === 'cash' ? cashBalance : investmentTotal
            return (
              <div
                key={segment.type}
                // O divisor só aparece a partir do 2.º bloco VISÍVEL — se não
                // houver contas de liquidez, o de investimento é o primeiro a
                // mostrar-se e não deve ter uma linha solta por cima. Mais
                // respiro que no resto do cartão (mt-6/pt-5 em vez de
                // mt-3/pt-3): é a única fronteira que precisa de se notar à
                // primeira vista, entre duas naturezas de dinheiro diferentes.
                className={visibleIndex > 0 ? 'mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800' : ''}
              >
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    {segment.label}
                  </h3>
                  <span className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    <Money value={subtotal} />
                  </span>
                </div>
                <p className="mb-3 text-xs text-neutral-400">{segment.hint}</p>
                <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {segmentAccounts.map((acc) => {
                    const latest = latestByAccount.get(acc.id)
                    return (
                      <li key={acc.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedAccount(acc)}
                          // Compacto e claramente "filho" do cabeçalho do bloco
                          // acima (text-base font-semibold): aqui é text-sm e
                          // peso normal/médio, nunca a competir em destaque.
                          className="flex w-full items-center justify-between gap-3 py-2 text-left transition-transform active:scale-[0.99]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-normal text-neutral-700 dark:text-neutral-300">
                              {acc.name}
                            </p>
                            {latest && (
                              <p className="text-xs text-neutral-400">atualizado {ptDate(latest.snapshot_date)}</p>
                            )}
                          </div>
                          <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            <Money value={balanceByAccountId.get(acc.id) ?? 0} />
                            <ChevronRight size={14} className="text-neutral-400" aria-hidden="true" />
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </Card>
      )}

      <AccountDetailModal
        account={selectedAccount}
        balance={selectedAccount ? balanceByAccountId.get(selectedAccount.id) ?? 0 : 0}
        onClose={() => setSelectedAccount(null)}
      />

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
    </div>
  )
}
