import { t } from '../i18n'
import { Camera, Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/toastContext'
import { avatarInitials } from '../lib/avatar'
import { notifyAvatarChanged } from '../lib/avatarEvents'
import { getAvatarPath, getFullName, updateFullName, uploadAvatar } from '../lib/profileDb'
import { supabase } from '../lib/supabase'
import AvatarCropModal from './AvatarCropModal'
import { focusRing, inputClass, primaryButton, secondaryButton } from './ui/styles'

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
  const [cropFile, setCropFile] = useState(null)
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
        if (mounted.current) setError(err.message || t('pi.loadFailed'))
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
        toast.success(t('pi.nameSaved'))
      }
    } catch (err) {
      if (mounted.current) setError(err.message || t('sheet.saveRetry'))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite escolher o mesmo ficheiro outra vez depois
    if (!file || uploadingAvatar) return
    setAvatarError('')
    setCropFile(file)
  }

  async function handleCropped(blob) {
    setCropFile(null)
    setUploadingAvatar(true)
    setAvatarError('')
    try {
      const path = await uploadAvatar(blob)
      if (mounted.current) {
        setAvatarPath(path)
        setAvatarVersion((v) => v + 1)
        notifyAvatarChanged()
        toast.success(t('pi.photoUpdated'))
      }
    } catch (err) {
      if (mounted.current) setAvatarError(err.message || t('pi.photoFailed'))
    } finally {
      if (mounted.current) setUploadingAvatar(false)
    }
  }

  const avatarUrl =
    avatarPath && `${supabase.storage.from('avatars').getPublicUrl(avatarPath).data.publicUrl}?v=${avatarVersion}`

  // Bloco de identidade ao centro, sem caixa: fotografia grande com o botão da
  // câmara, nome e email. O botão da câmara tem 44 px de alvo (o círculo
  // visível é mais pequeno).
  return (
    <section className="flex flex-col items-center text-center">
      <div className="relative shrink-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="size-24 rounded-full object-cover" />
        ) : (
          <div
            aria-hidden="true"
            className="display flex size-24 items-center justify-center rounded-full bg-accent-fill text-[2rem] font-semibold text-white"
          >
            {avatarInitials(value, user?.email)}
          </div>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingAvatar}
          aria-label={t('pi.changePhoto')}
          className={`absolute -right-3 -bottom-3 flex size-11 items-center justify-center rounded-full transition-opacity disabled:opacity-60 ${focusRing}`}
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-surface-raised text-label shadow-[var(--shadow-raised)]">
            <Camera size={16} aria-hidden="true" />
          </span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="sr-only" />
      </div>

      <div className="mt-3 w-full min-w-0">
        {editing ? (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-group bg-surface p-4 text-left">
            <input
              type="text"
              autoFocus
              autoComplete="name"
              placeholder={t('pi.namePh')}
              value={draft}
              disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
              className={inputClass}
            />
            {error && (
              <p role="alert" className="text-[0.9375rem] text-negative">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => setEditing(false)} className={`${secondaryButton} flex-1`}>
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={busy} className={`${primaryButton} flex-[2]`}>
                {busy ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-center">
            {/* espaço igual ao do lápis, para o nome ficar mesmo ao centro */}
            <span aria-hidden="true" className="size-11 shrink-0" />
            <h1 className="min-w-0 truncate text-[1.75rem] leading-tight font-bold tracking-tight text-label">
              {loaded ? value || t('pi.noName') : '...'}
            </h1>
            <button
              type="button"
              onClick={() => {
                setDraft(value)
                setError('')
                setEditing(true)
              }}
              aria-label={t('pi.editName')}
              disabled={!loaded}
              className={`pressable flex size-11 shrink-0 items-center justify-center rounded-full text-accent disabled:opacity-40 ${focusRing}`}
            >
              <Pencil size={18} aria-hidden="true" />
            </button>
          </div>
        )}
        {!editing && <p className="truncate text-[0.9375rem] text-label-2">{user?.email}</p>}
      </div>
      {avatarError && (
        <p role="alert" className="mt-2 text-[0.9375rem] text-negative">
          {avatarError}
        </p>
      )}

      <AvatarCropModal file={cropFile} onCropped={handleCropped} onCancel={() => setCropFile(null)} />
    </section>
  )
}
