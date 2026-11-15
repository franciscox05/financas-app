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
import Money from '../components/Money'
import Group, { Row } from '../components/ui/Group'
import PageHeader from '../components/ui/PageHeader'
import { usePrivacy } from '../context/privacyContext'
import HiddenChartNotice from '../components/HiddenChartNotice'
import { eur, ptDate } from '../lib/format'

// Cores do gráfico pelos tokens de index.css (já com par claro/escuro).
const LINE_COLOR = 'var(--accent)'
const AXIS_COLOR = 'var(--label-2)'
const GRID_COLOR = 'var(--separator)'

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
      <div className="space-y-8">
        <PageHeader title="Património" />
        <Skeleton className="h-20" />
        <Skeleton className="h-40" />
        <Skeleton className="h-56" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader title="Património" />
        <ErrorNotice message={error} onRetry={loadAll} />
      </div>
    )
  }

  // Só os blocos com contas: sem contas de liquidez, o de investimento é o
  // único grupo a aparecer (e vice-versa).
  const visibleSegments = ACCOUNT_SEGMENTS.map((segment) => ({
    ...segment,
    accounts: segment.type === 'cash' ? cashAccounts : investmentAccounts,
    subtotal: segment.type === 'cash' ? cashBalance : investmentTotal,
  })).filter((segment) => segment.accounts.length > 0)

  return (
    <div className="space-y-8">
      <PageHeader title="Património" />

      {/* O número que interessa neste ecrã, sozinho e grande — sem caixa à
          volta, para ser a primeira coisa que se lê. */}
      <section aria-label="Património total" className="px-1">
        <p className="text-[0.9375rem] text-label-2">Património total</p>
        <p className="amount mt-1 text-[2.75rem] leading-none font-bold tracking-tight text-label">
          <Money value={totalNetWorth} />
        </p>
      </section>

      {/* Liquidez e Investimento são dinheiros de naturezas diferentes (pedido
          do Francisco): cada um é um grupo de lista com o subtotal no título.
          A ordem das contas dentro de cada grupo já vem de `accounts`
          (listAccounts ordena por `sort_order`), por isso o arrastar definido
          em Gestão continua a valer aqui sem nada extra. */}
      {visibleSegments.map((segment) => (
        <Group
          key={segment.type}
          list
          header={segment.label}
          aside={<Money value={segment.subtotal} />}
          footer={segment.hint}
        >
          {segment.accounts.map((acc) => {
            const latest = latestByAccount.get(acc.id)
            return (
              <Row
                key={acc.id}
                as="button"
                onClick={() => setSelectedAccount(acc)}
                title={acc.name}
                subtitle={latest ? `atualizado ${ptDate(latest.snapshot_date)}` : undefined}
                value={<Money value={balanceByAccountId.get(acc.id) ?? 0} />}
                chevron
              />
            )
          })}
        </Group>
      ))}

      <AccountDetailModal
        account={selectedAccount}
        balance={selectedAccount ? balanceByAccountId.get(selectedAccount.id) ?? 0 : 0}
        onClose={() => setSelectedAccount(null)}
      />

      <Group header="Evolução" footer="Últimos 6 meses. Os meses sem saldo registado não aparecem.">
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
                <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: AXIS_COLOR }}
                  axisLine={{ stroke: GRID_COLOR }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: AXIS_COLOR }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  formatter={(value) => eur(Number(value))}
                  contentStyle={{
                    fontSize: 13,
                    borderRadius: 12,
                    border: '0.5px solid var(--separator)',
                    backgroundColor: 'var(--surface-raised)',
                    boxShadow: 'var(--shadow-raised)',
                  }}
                  itemStyle={{ color: 'var(--label)' }}
                  labelStyle={{ color: 'var(--label-2)', fontWeight: 600, marginBottom: 2 }}
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
      </Group>
    </div>
  )
}
