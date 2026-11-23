// Edge Function invocada de hora a hora (via pg_cron + pg_net) para enviar um
// lembrete push "ainda não registaste nada hoje" a quem tem subscrição ativa,
// escolheu esta hora (profiles.reminder_hour, hora de Lisboa) e ainda não
// lançou nenhuma transação no dia de hoje.
//
// Protegida por um segredo partilhado (CRON_SECRET) em vez de verificar o JWT
// normal do Supabase, porque quem chama é o próprio Postgres (pg_net), não um
// utilizador autenticado.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'
import { isDue, lisbonNow, reminderBody, REMINDER_TITLE } from './reminder.js'

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
  // `occurred_on` é sempre a data LOCAL do utilizador (Europe/Lisbon).
  const now = lisbonNow()

  // Só quem escolheu esta hora e ainda não foi avisado hoje.
  const { data: profiles, error: profError } = await supabase
    .from('profiles')
    .select('id, locale, reminder_hour, reminder_last_sent_on')
    .eq('reminder_hour', now.hour)
  if (profError) {
    return new Response(JSON.stringify({ error: profError.message }), { status: 500 })
  }
  const due = (profiles ?? []).filter((p) => isDue(p, now))
  const dueIds = due.map((p) => p.id)
  if (dueIds.length === 0) {
    return new Response(JSON.stringify({ hour: now.hour, notified: 0, failed: 0, expiredRemoved: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const localeById = new Map(due.map((p) => [p.id, p.locale]))

  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', dueIds)
  if (subError) {
    return new Response(JSON.stringify({ error: subError.message }), { status: 500 })
  }

  const { data: loggedToday, error: txError } = await supabase
    .from('transactions')
    .select('user_id')
    .eq('occurred_on', now.date)
    .in('user_id', dueIds)
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
          title: REMINDER_TITLE,
          body: reminderBody(localeById.get(sub.user_id)),
        }),
      ),
    ),
  )

  // Subscricoes mortas (410 Gone / 404) sao removidas para nao voltar a tentar.
  const expiredIds: string[] = []
  const sentUserIds = new Set<string>()
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      sentUserIds.add(toNotify[i].user_id)
    } else {
      const statusCode = r.reason?.statusCode
      if (statusCode === 404 || statusCode === 410) {
        expiredIds.push(toNotify[i].id)
      }
    }
  })
  if (expiredIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expiredIds)
  }

  // Marca quem recebeu, para não repetir hoje (hora repetida em outubro, reexecuções).
  if (sentUserIds.size > 0) {
    await supabase
      .from('profiles')
      .update({ reminder_last_sent_on: now.date })
      .in('id', [...sentUserIds])
  }

  return new Response(
    JSON.stringify({
      hour: now.hour,
      notified: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
      expiredRemoved: expiredIds.length,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
