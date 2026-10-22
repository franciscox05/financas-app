import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import GoalsSection from '../components/GoalsSection'
import MbwayPhoneSection from '../components/MbwayPhoneSection'
import MyPhoneSection from '../components/MyPhoneSection'
import NotesSection from '../components/NotesSection'
import PersonalInfoSection from '../components/PersonalInfoSection'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'

// Módulo pessoal: dados do perfil, telefone/MB Way (usados pelos Amigos) e um
// espaço livre para objetivos e notas, sem ligação a dinheiro.
export default function Profile() {
  return (
    <div className="space-y-8">
      <header>
        <Link
          to="/"
          className={`-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-neutral-600 transition-colors duration-150 ease-out hover:text-neutral-900 motion-reduce:transition-none dark:text-neutral-300 dark:hover:text-neutral-100 ${focusRing}`}
        >
          <ArrowLeft size={16} aria-hidden="true" /> Início
        </Link>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">Perfil</h2>
      </header>

      <PersonalInfoSection />
      <MyPhoneSection />
      <MbwayPhoneSection />
      <GoalsSection />
      <NotesSection />
    </div>
  )
}
