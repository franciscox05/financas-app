import { Bell, ChevronLeft, Database, Languages, Phone, ShieldCheck, Target, StickyNote } from 'lucide-react'
import { Link } from 'react-router-dom'
import AppLockSection from '../components/AppLockSection'
import Card from '../components/Card'
import DataExportSection from '../components/DataExportSection'
import GoalsSection from '../components/GoalsSection'
import MbwayPhoneSection from '../components/MbwayPhoneSection'
import MyPhoneSection from '../components/MyPhoneSection'
import NotesCalendar from '../components/NotesCalendar'
import PersonalInfoSection from '../components/PersonalInfoSection'
import ReminderSection from '../components/ReminderSection'
import LanguageSection from '../components/LanguageSection'
import SignOutButton from '../components/SignOutButton'
import { focusRing } from '../components/ui/styles'
import { t, useT } from '../i18n'

// Mesmo contentor e mesma hierarquia de título em todos os blocos da página —
// antes o Perfil usava cartões sem fundo e a Gestão usava rounded-2xl com
// fundo, duas caixas diferentes para o mesmo papel.
const cardTitleClass =
  'flex items-center gap-2 text-[1.25rem] font-bold tracking-tight text-label [&>svg]:size-5 [&>svg]:text-accent'

// Módulo pessoal: dados do perfil, telefone/MB Way (usados pelos Amigos) e um
// espaço livre para objetivos e notas, sem ligação a dinheiro.
export default function Profile() {
  const t = useT()
  return (
    <div className="space-y-8">
      <header>
        <Link
          to="/"
          className={`pressable -ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-control pr-3 pl-1 text-[1.0625rem] text-accent ${focusRing}`}
        >
          <ChevronLeft size={24} strokeWidth={2.1} aria-hidden="true" /> {t('prof.home')}
        </Link>
      </header>

      <PersonalInfoSection />

      <Card as="section" className="space-y-3">
        <h2 className={cardTitleClass}>
          <Phone size={14} aria-hidden="true" /> {t('prof.contacts')}
        </h2>
        <MyPhoneSection />
        <MbwayPhoneSection />
      </Card>

      <Card as="section" className="space-y-3">
        <h2 className={cardTitleClass}>
          <Target size={14} aria-hidden="true" /> {t('prof.goals')}
        </h2>
        <GoalsSection />
      </Card>

      <Card as="section" className="space-y-3">
        <h2 className={cardTitleClass}>
          <StickyNote size={14} aria-hidden="true" /> {t('prof.notes')}
        </h2>
        <NotesCalendar />
      </Card>

      <Card as="section" className="space-y-3">
        <h2 className={cardTitleClass}>
          <Languages size={14} aria-hidden="true" /> {t('lang.title')}
        </h2>
        <LanguageSection />
      </Card>

      <Card as="section" className="space-y-3">
        <h2 className={cardTitleClass}>
          <Bell size={14} aria-hidden="true" /> {t('reminder.title')}
        </h2>
        <ReminderSection />
      </Card>

      <Card as="section" className="space-y-3">
        <h2 className={cardTitleClass}>
          <ShieldCheck size={14} aria-hidden="true" /> {t('lock.section')}
        </h2>
        <AppLockSection />
      </Card>

      <Card as="section" className="space-y-3">
        <h2 className={cardTitleClass}>
          <Database size={14} aria-hidden="true" /> {t('data.title')}
        </h2>
        <DataExportSection />
      </Card>

      <SignOutButton />
    </div>
  )
}
