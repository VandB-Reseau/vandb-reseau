import Chip from '@mui/material/Chip'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import type { Destination } from '../navigation/destinations'

// Écran pas encore construit : dit clairement ce qu'il contiendra et quand.
export function Chantier({ destination }: { destination: Destination }) {
  return (
    <>
      <PageHeader titre={destination.libelle} sousTitre={destination.description} />
      <EmptyState
        icone={destination.icone}
        titre="Écran en construction"
        texte="En attendant, ces informations restent disponibles dans l’ancienne application."
        action={<Chip label={`Arrive au ${destination.sprint.toLowerCase()}`} color="secondary" />}
      />
    </>
  )
}
