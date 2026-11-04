import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — configure .env.local')
}

// Lido antes de criar o cliente: ao arrancar, o supabase-js consome o token do URL e limpa-o.
// Se o Supabase mandar o link de recuperação para a raiz (redirect não autorizado → Site URL),
// a app sabe na mesma que tem de pedir a nova password em vez de entrar diretamente.
export const isRecoveryLink = /type=recovery/.test(window.location.hash + window.location.search)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
