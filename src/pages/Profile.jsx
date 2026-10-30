import { ArrowLeft, Phone, Target, StickyNote } from 'lucide-react'
import { Link } from 'react-router-dom'
import GoalsSection from '../components/GoalsSection'
import MbwayPhoneSection from '../components/MbwayPhoneSection'
import MyPhoneSection from '../components/MyPhoneSection'
import NotesCalendar from '../components/NotesCalendar'
import PersonalInfoSection from '../components/PersonalInfoSection'
import SignOutButton from '../components/SignOutButton'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'

const cardClass = 'space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800'
const cardTitleClass =
  'flex items-center gap-1.5 text-sm font-semibold text-neutral-500'

// Módulo pessoal: dados do perfil, telefone/MB Way (usados pelos Amigos) e um
// espaço livre para objetivos e notas, sem ligação a dinheiro.
export default function Profile() {
  return (
    <div className="space-y-6">
      <header>
        <Link
          to="/"
          className={`-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-neutral-600 transition-colors duration-150 ease-out hover:text-neutral-900 motion-reduce:transition-none dark:text-neutral-300 dark:hover:text-neutral-100 ${focusRing}`}
        >
          <ArrowLeft size={16} aria-hidden="true" /> Início
        </Link>
      </header>

      <PersonalInfoSection />

      <section className={cardClass}>
        <h2 className={cardTitleClass}>
          <Phone size={14} aria-hidden="true" /> Contactos para Amigos
        </h2>
        <MyPhoneSection />
        <MbwayPhoneSection />
      </section>

      <section className={cardClass}>
        <h2 className={cardTitleClass}>
          <Target size={14} aria-hidden="true" /> Objetivos
        </h2>
        <GoalsSection />
      </section>

      <section className={cardClass}>
        <h2 className={cardTitleClass}>
          <StickyNote size={14} aria-hidden="true" /> Notas
        </h2>
        <NotesCalendar />
      </section>

      <SignOutButton />
    </div>
  )
}
