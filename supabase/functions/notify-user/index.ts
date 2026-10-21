// Edge Function chamada pelos triggers da base de dados (via pg_net) para enviar um push a um
// utilizador: pedidos de amizade e movimentos partilhados. Recebe { user_id, title, body, url }.
//
// Protegida pelo mesmo segredo partilhado (CRON_SECRET) das outras funções: quem chama é o
// próprio Postgres, não um utilizador autenticado.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  let payload: { user_id?: string; title?: string; body?: string; url?: string }
  try {
    payload = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }
  const { user_id, title, body, url } = payload
  if (!user_id || !UUID.test(user_id) || typeof body !== 'string' || !body || (title !== undefined && typeof title !== 'string')) {
    return new Response('Bad request', { status: 400 })
  }
  // O url só pode ser um caminho dentro da app.
  // Começa por "/" e não por "//" nem "/\" (que os browsers tratam como outro site).
  const safeUrl = typeof url === 'string' && /^\/(?![/\\])/.test(url) ? url : '/'

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', user_id)
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const message = JSON.stringify({ title: title || 'FinancasApp', body, url: safeUrl })
  const results = await Promise.allSettled(
    (subscriptions ?? []).map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        message,
        // Urgência alta: o iOS entrega logo em vez de agrupar avisos "normais" quando o ecrã
        // está bloqueado. Sem TTL, o serviço de push descarta ao fim de 0 s se o aparelho estiver offline.
        { urgency: 'high', TTL: 3600 },
      ),
    ),
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
      sent: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
      expiredRemoved: expiredIds.length,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
