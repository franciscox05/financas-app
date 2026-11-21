import { Download } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../context/toastContext'
import { useT } from '../i18n'
import { today } from '../lib/dates'
import { downloadJson, exportAllData } from '../lib/exportData'
import { secondaryButton } from './ui/styles'

// Perfil → "Os teus dados": descarregar tudo num ficheiro JSON (RGPD).
export default function DataExportSection() {
  const t = useT()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    setBusy(true)
    try {
      const data = await exportAllData()
      downloadJson(`stingy-dados-${today()}.json`, data)
      const total = Object.values(data.counts).reduce((s, n) => s + n, 0)
      if (data.errors) toast.error(t('data.partial', { n: Object.keys(data.errors).length }))
      else toast.success(t('data.done', { n: total }))
    } catch (err) {
      toast.error(t('data.error', { message: err.message }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[0.8125rem] leading-snug text-label-2">{t('data.body')}</p>
      <button type="button" onClick={handleExport} disabled={busy} className={`${secondaryButton} flex w-full items-center justify-center gap-2`}>
        <Download size={17} aria-hidden="true" />
        {busy ? t('data.busy') : t('data.button')}
      </button>
    </div>
  )
}
