// Edge Function invocada diariamente (via pg_cron + pg_net) para enviar um
// lembrete push "ainda não registaste nada hoje" a quem tem subscrição ativa
// e ainda não lançou nenhuma transação no dia de hoje.
//
// Protegida por um segredo partilhado (CRON_SECRET) em vez de verificar o JWT
// normal do Supabase, porque quem chama é o próprio Postgres (pg_net), não um
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

// O servidor corre em UTC; `occurred_on` é sempre a data LOCAL do utilizador
// (Europe/Lisbon). Usar toISOString().slice(0,10) aqui comparava com a data
// UTC, que fica um dia atrasada em relação a Lisboa na primeira hora depois
// da meia-noite local durante o horário de verão.
function todayLisbon() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date())
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const today = todayLisbon()

  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
  if (subError) {
    return new Response(JSON.stringify({ error: subError.message }), { status: 500 })
  }

  const { data: loggedToday, error: txError } = await supabase
    .from('transactions')
    .select('user_id')
    .eq('occurred_on', today)
  if (txError) {
    return new Response(JSON.stringify({ error: txError.message }), { status: 500 })
  }

  const loggedUserIds = new Set((loggedToday ?? []).map((t) => t.user_id))
  const toNotify = (subscriptions ?? []).filter((s) => !loggedUserIds.has(s.user_id))

  const results = await Promise.allSettled(
    toNotify.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title: 'FinancasApp',
          body: 'Ainda não registaste nenhum gasto/ganho hoje. Toca para abrir.',
        }),
      ),
    ),
  )

  // Subscricoes mortas (410 Gone / 404) sao removidas para nao voltar a tentar.
  const expiredIds: string[] = []
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const statusCode = r.reason?.statusCode
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
