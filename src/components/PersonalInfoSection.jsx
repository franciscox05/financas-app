import { Camera, Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/toastContext'
import { avatarInitials } from '../lib/avatar'
import { notifyAvatarChanged } from '../lib/avatarEvents'
import { getAvatarPath, getFullName, updateFullName, uploadAvatar } from '../lib/profileDb'
import { supabase } from '../lib/supabase'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'

const inputClass = `min-h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-colors duration-150 ease-out disabled:opacity-50 motion-reduce:transition-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 ${focusRing}`

// Cabeçalho do Perfil: foto (ou iniciais) com upload, nome editável (mesmo
// padrão de edição em linha usado no nome de um amigo) e email (da conta,
// não editável aqui). A foto fica visível a amigos ligados (list_friend_avatars).
export default function PersonalInfoSection() {
  const { user } = useAuth()
  const toast = useToast()
  const [value, setValue] = useState('')
  const [avatarPath, setAvatarPath] = useState(null)
  const [avatarVersion, setAvatarVersion] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const mounted = useRef(true)
  const fileInputRef = useRef(null)

  useEffect(() => {
    mounted.current = true
    Promise.all([getFullName(), getAvatarPath()])
      .then(([name, path]) => {
        if (mounted.current) {
          setValue(name)
          setAvatarPath(path)
        }
      })
      .catch((err) => {
        if (mounted.current) setError(err.message || 'Não foi possível carregar o perfil.')
      })
      .finally(() => {
        if (mounted.current) setLoaded(true)
      })
    return () => {
      mounted.current = false
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await updateFullName(draft)
      if (mounted.current) {
        setValue(draft)
        setEditing(false)
        toast.success('Nome guardado.')
      }
    } catch (err) {
      if (mounted.current) setError(err.message || 'Não foi possível guardar. Tenta outra vez.')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite escolher o mesmo ficheiro outra vez depois
    if (!file || uploadingAvatar) return
    setUploadingAvatar(true)
    setAvatarError('')
    try {
      const path = await uploadAvatar(file)
      if (mounted.current) {
        setAvatarPath(path)
        setAvatarVersion((v) => v + 1)
        notifyAvatarChanged()
        toast.success('Foto atualizada.')
      }
    } catch (err) {
      if (mounted.current) setAvatarError(err.message || 'Não foi possível enviar a foto. Tenta outra vez.')
    } finally {
      if (mounted.current) setUploadingAvatar(false)
    }
  }

  const avatarUrl =
    avatarPath && `${supabase.storage.from('avatars').getPublicUrl(avatarPath).data.publicUrl}?v=${avatarVersion}`

  return (
    <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="size-14 rounded-full object-cover" />
          ) : (
            <div
              aria-hidden="true"
              className="flex size-14 items-center justify-center rounded-full bg-neutral-900 text-lg font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              {avatarInitials(value, user?.email)}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            aria-label="Mudar foto de perfil"
            className={`absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border-2 border-white bg-neutral-900 text-white transition-opacity disabled:opacity-60 dark:border-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 ${focusRing}`}
          >
            <Camera size={12} aria-hidden="true" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="sr-only"
          />
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={handleSubmit} className="space-y-2">
              <input
                type="text"
                autoFocus
                autoComplete="name"
                placeholder="O teu nome"
                value={draft}
                disabled={busy}
                onChange={(e) => setDraft(e.target.value)}
                className={inputClass}
              />
              {error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className={`min-h-9 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 ${focusRing}`}
                >
                  {busy ? 'A guardar...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                  className={`min-h-9 rounded-lg border border-neutral-300 px-3 text-sm dark:border-neutral-700 ${focusRing}`}
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-1">
              <h2 className="min-w-0 truncate text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                {loaded ? value || 'Sem nome' : '...'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setDraft(value)
                  setError('')
                  setEditing(true)
                }}
                aria-label="Editar nome"
                disabled={!loaded}
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors duration-150 ease-out hover:text-neutral-900 disabled:opacity-40 motion-reduce:transition-none dark:hover:text-neutral-100 ${focusRing}`}
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
            </div>
          )}
          {!editing && <p className="truncate text-sm text-neutral-500">{user?.email}</p>}
        </div>
      </div>
      {avatarError && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {avatarError}
        </p>
      )}
    </section>
  )
}
