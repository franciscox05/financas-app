import { avatarInitials } from '../lib/avatar'
import { supabase } from '../lib/supabase'

const SIZE_CLASS = { sm: 'size-9 text-xs', md: 'size-11 text-sm', lg: 'size-20 text-2xl' }

// Foto do amigo (se ligado e tiver uma) ou um círculo com as iniciais.
export default function FriendAvatar({ name, avatarPath, size = 'sm' }) {
  const url = avatarPath && supabase.storage.from('avatars').getPublicUrl(avatarPath).data.publicUrl
  const sizeClass = SIZE_CLASS[size]

  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
      />
    )
  }

  return (
    <div
      aria-hidden="true"
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-fill-strong font-semibold text-label-2`}
    >
      {avatarInitials(name)}
    </div>
  )
}
