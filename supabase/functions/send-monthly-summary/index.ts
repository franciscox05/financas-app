// Edge Function invocada no dia 1 de cada mes (via pg_cron + pg_net) para
// enviar um resumo push do mes anterior (gastos, ganhos, saldo e comparacao
// com o mes anterior a esse) a quem tem subscricao push ativa.
//
// Protegida pelo mesmo segredo partilhado (CRON_SECRET) que o lembrete
// diario, porque quem chama e o proprio Postgres (pg_net), nao um
// utilizador autenticado.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

function monthStartIso(date: Date, monthsAgo: number) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - monthsAgo, 1))
  return d.toISOString().slice(0, 10)
}

function sumByUser(transactions: { user_id: string; type: string; amount: number }[]) {
  const totals = new Map<string, { income: number; expense: number }>()
  for (const tx of transactions) {
    const entry = totals.get(tx.user_id) ?? { income: 0, expense: 0 }
    if (tx.type === 'income') entry.income += Number(tx.amount)
    else entry.expense += Number(tx.amount)
    totals.set(tx.user_id, entry)
  }
  return totals
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const now = new Date()

  const thisMonthStart = monthStartIso(now, 0)
  const lastMonthStart = monthStartIso(now, 1)
  const twoMonthsAgoStart = monthStartIso(now, 2)
  const lastMonthLabel = new Date(`${lastMonthStart}T00:00:00Z`).toLocaleDateString('pt-PT', {
    month: 'long',
    timeZone: 'UTC',
  })

  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
  if (subError) {
    return new Response(JSON.stringify({ error: subError.message }), { status: 500 })
  }

  const { data: lastMonthTxs, error: lastError } = await supabase
    .from('transactions')
    .select('user_id, type, amount')
    .gte('occurred_on', lastMonthStart)
    .lt('occurred_on', thisMonthStart)
  if (lastError) {
    return new Response(JSON.stringify({ error: lastError.message }), { status: 500 })
  }

  const { data: priorMonthTxs, error: priorError } = await supabase
    .from('transactions')
    .select('user_id, type, amount')
    .gte('occurred_on', twoMonthsAgoStart)
    .lt('occurred_on', lastMonthStart)
  if (priorError) {
    return new Response(JSON.stringify({ error: priorError.message }), { status: 500 })
  }

  const lastMonthByUser = sumByUser(lastMonthTxs ?? [])
  const priorMonthByUser = sumByUser(priorMonthTxs ?? [])

  function buildMessage(userId: string) {
    const last = lastMonthByUser.get(userId)
    if (!last || (last.income === 0 && last.expense === 0)) {
      return `Não registaste nada em ${lastMonthLabel}. Que tal começar o mês com o primeiro registo?`
    }
    const saldo = last.income - last.expense
    let comparison = ''
    const prior = priorMonthByUser.get(userId)
    if (prior && prior.expense >= 1) {
      const diffPct = Math.round(((last.expense - prior.expense) / prior.expense) * 100)
      if (diffPct !== 0) {
        comparison = ` Gastaste ${Math.abs(diffPct)}% ${diffPct > 0 ? 'mais' : 'menos'} que no mês anterior.`
      } else {
        comparison = ' Gastaste o mesmo que no mês anterior.'
      }
    }
    return (
      `Resumo de ${lastMonthLabel}: ${last.income.toFixed(2)} € de ganhos, ` +
      `${last.expense.toFixed(2)} € de gastos, saldo ${saldo.toFixed(2)} €.${comparison}`
    )
  }

  const toNotify = (subscriptions ?? []).map((sub) => ({ ...sub, body: buildMessage(sub.user_id) }))

  const results = await Promise.allSettled(
    toNotify.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title: 'FinancasApp — resumo mensal',
          body: sub.body,
        }),
      ),
    ),
  )

  // Subscricoes mortas (410 Gone / 404) sao removidas para nao voltar a tentar.
  const expiredIds: string[] = []
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const statusCode = (r.reason as { statusCode?: number })?.statusCode
      if (statusCode === 404 || statusCode === 410) {
        expiredIds.push(toNotify[i].id)
      }
    }
  })
  if (expiredIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expiredIds)
  }

  return new Response(
    JSON.stringify({
      notified: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
      expiredRemoved: expiredIds.length,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
