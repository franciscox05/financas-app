// Edge Function invocada diariamente (via pg_cron + pg_net) para avisar por push
// quem tem amigos a dever-lhe com a data limite ultrapassada e o saldo ainda a
// favor (ledger_entries + friend_balances). Só olha para os dados do próprio utilizador.
//
// Protegida pelo mesmo segredo partilhado (CRON_SECRET) das outras funções.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

// O servidor corre em UTC; `occurred_on`/`due_on` são sempre a data LOCAL do
// utilizador (Europe/Lisbon). Usar toISOString().slice(0,10) aqui comparava
// com a data UTC, que fica um dia atrasada em relação a Lisboa na primeira
// hora depois da meia-noite local durante o horário de verão.
function todayLisbon() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date())
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const today = todayLisbon()

  // Movimentos "paguei por ele" com a data limite passada...
  const { data: overdue, error: overdueError } = await supabase
    .from('ledger_entries')
    .select('user_id, friend_id')
    .eq('kind', 'paid_for_them')
    .lt('due_on', today)
  if (overdueError) {
    return new Response(JSON.stringify({ error: overdueError.message }), { status: 500 })
  }

  // ...só contam se o saldo com esse amigo continua a favor do utilizador.
  const friendIds = [...new Set((overdue ?? []).map((e) => e.friend_id))]
  const { data: balances, error: balanceError } = friendIds.length
    ? await supabase.from('friend_balances').select('friend_id, balance').in('friend_id', friendIds)
    : { data: [], error: null }
  if (balanceError) {
    return new Response(JSON.stringify({ error: balanceError.message }), { status: 500 })
  }
  const owedFriends = new Set(
    (balances ?? []).filter((b) => Number(b.balance) > 0).map((b) => b.friend_id),
  )

  // Amigos distintos em atraso por utilizador.
  const byUser = new Map<string, Set<string>>()
  for (const e of overdue ?? []) {
    if (!owedFriends.has(e.friend_id)) continue
    const friends = byUser.get(e.user_id) ?? new Set<string>()
    friends.add(e.friend_id)
    byUser.set(e.user_id, friends)
  }
  if (byUser.size === 0) {
    return new Response(JSON.stringify({ notified: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', [...byUser.keys()])
  if (subError) {
    return new Response(JSON.stringify({ error: subError.message }), { status: 500 })
  }

  const results = await Promise.allSettled(
    (subscriptions ?? []).map((sub) => {
      const count = byUser.get(sub.user_id)!.size
      return webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: 'FinancasApp',
          body: `Tens ${count} ${count === 1 ? 'amigo' : 'amigos'} com valores por receber em atraso. Toca para ver.`,
          url: '/dividas',
        }),
      )
    }),
  )

  // Subscrições mortas (410 Gone / 404) são removidas para não voltar a tentar.
  const expiredIds: string[] = []
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const statusCode = r.reason?.statusCode
      if (statusCode === 404 || statusCode === 410) {
        expiredIds.push((subscriptions ?? [])[i].id)
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
