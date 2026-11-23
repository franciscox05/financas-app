// Lógica pura do lembrete diário (sem Deno nem Supabase), para poder ser testada
// com `node --test` (ver src/lib/reminder.test.js).

// TEXTO PROVISÓRIO: o Francisco ainda não o confirmou. Para o trocar, mexe só aqui.
export const REMINDER_TITLE = 'Stingy'
export const REMINDER_BODY = {
  pt: 'Ainda não registaste nada hoje. Queres lançar agora?',
  en: 'Nothing logged today. Want to add something?',
}

// `profiles.locale` guarda o código do idioma ('pt', 'en', ...). Sem valor ou
// com um idioma ainda sem tradução, usa português.
export function reminderBody(locale) {
  const lang = String(locale ?? '').slice(0, 2).toLowerCase()
  return REMINDER_BODY[lang] ?? REMINDER_BODY.pt
}

// Data (YYYY-MM-DD) e hora (0-23) em Lisboa. O servidor corre em UTC; é a hora
// de Lisboa que o utilizador escolhe, por isso o horário de verão resolve-se
// aqui, em cada execução, e o cron fica sempre em UTC.
export function lisbonNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type) => parts.find((p) => p.type === type).value
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}

// Quem recebe nesta execução: escolheu a hora atual (Lisboa) e ainda não foi
// avisado hoje. `reminder_last_sent_on` evita o duplo envio na hora repetida
// quando os relógios recuam (outubro) e em reexecuções do cron.
export function isDue(profile, { date, hour }) {
  return profile.reminder_hour === hour && profile.reminder_last_sent_on !== date
}
