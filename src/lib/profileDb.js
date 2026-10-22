import { supabase } from './supabase'
import { getCurrentUserId } from './db'

export async function getFullName() {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle()
  if (error) throw error
  return data?.full_name ?? ''
}

export async function getAvatarPath() {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase.from('profiles').select('avatar_path').eq('id', userId).maybeSingle()
  if (error) throw error
  return data?.avatar_path ?? null
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

// Caminho fixo "{userId}/avatar.ext" (upsert: substitui a anterior, mesmo que
// tivesse outra extensão — apaga-se a antiga só se a extensão mudar).
export async function uploadAvatar(file) {
  if (!file.type.startsWith('image/')) throw new Error('Escolhe uma imagem.')
  if (file.size > MAX_AVATAR_BYTES) throw new Error('A imagem não pode passar de 5 MB.')
  const userId = await getCurrentUserId()
  const ext = EXT_BY_TYPE[file.type] ?? 'jpg'
  const path = `${userId}/avatar.${ext}`

  const previous = await getAvatarPath()
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) throw uploadError

  const { error } = await supabase.from('profiles').upsert({ id: userId, avatar_path: path })
  if (error) throw error

  if (previous && previous !== path) {
    await supabase.storage.from('avatars').remove([previous]).catch(() => {})
  }
  return path
}

// Upsert: garante que funciona mesmo que a linha de perfil ainda não exista.
export async function updateFullName(fullName) {
  const userId = await getCurrentUserId()
  const { error } = await supabase.from('profiles').upsert({ id: userId, full_name: fullName.trim() || null })
  if (error) throw error
}

// Por fazer (false) primeiro, por prazo mais próximo; feitos no fim, mais recentes primeiro.
export async function listGoals() {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .order('done')
    .order('due_on', { nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createGoal({ title, dueOn }) {
  const userId = await getCurrentUserId()
  const trimmed = title.trim()
  if (!trimmed) throw new Error('Escreve um objetivo.')
  const { data, error } = await supabase
    .from('goals')
    .insert({ user_id: userId, title: trimmed, due_on: dueOn || null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleGoalDone(id, done) {
  const { data, error } = await supabase.from('goals').update({ done }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteGoal(id) {
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) throw error
}

export async function listNotes() {
  const { data, error } = await supabase.from('notes').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createNote(body) {
  const userId = await getCurrentUserId()
  const trimmed = body.trim()
  if (!trimmed) throw new Error('Escreve algo para guardar.')
  const { data, error } = await supabase.from('notes').insert({ user_id: userId, body: trimmed }).select().single()
  if (error) throw error
  return data
}

export async function deleteNote(id) {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}
