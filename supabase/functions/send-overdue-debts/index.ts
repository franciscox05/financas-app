// Edge Function invocada diariamente (via pg_cron + pg_net) para avisar por push
// quem tem dívidas pendentes com a data limite ultrapassada ("Tens N dívidas
// atrasadas"). Só olha para as dívidas do próprio utilizador (debts.user_id).
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

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const today = new Date().toISOString().slice(0, 10)

  const { data: debts, error: debtError } = await supabase
    .from('debts')
    .select('user_id, direction')
    .eq('status', 'pending')
    .lt('due_on', today)
  if (debtError) {
    return new Response(JSON.stringify({ error: debtError.message }), { status: 500 })
  }

  // Contagem por utilizador: a receber (alguém me deve) e a pagar (eu devo).
  const byUser = new Map<string, { owedToMe: number; iOwe: number }>()
  for (const d of debts ?? []) {
    const entry = byUser.get(d.user_id) ?? { owedToMe: 0, iOwe: 0 }
    if (d.direction === 'owed_to_me') entry.owedToMe += 1
    else entry.iOwe += 1
    byUser.set(d.user_id, entry)
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
      const counts = byUser.get(sub.user_id)!
      const parts: string[] = []
      if (counts.owedToMe > 0) parts.push(`${counts.owedToMe} a receber`)
      if (counts.iOwe > 0) parts.push(`${counts.iOwe} a pagar`)
      return webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: 'FinancasApp',
          body: `Tens dívidas atrasadas (${parts.join(', ')}). Toca para ver.`,
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
