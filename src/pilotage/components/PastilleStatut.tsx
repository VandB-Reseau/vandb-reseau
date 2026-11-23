import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { statutLibelle, type Statut } from '../data/pilotage'

// Un seul rouge plein dans l'app : les autres états sont un texte coloré précédé d'un point (charte de l'app réseau)
export function PastilleStatut({ statut }: { statut: Statut | null }) {
  // C7 (Joseph, 23/11/2026) : sans budget, un simple texte gris ; la pastille ne sert qu'aux budgets qui existent
  if (!statut) return <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>Pas de budget</Box>
  const couleur = statut === 'valide' ? 'success' : statut === 'en_discussion' ? 'warning' : 'info'
  return <Chip size="small" variant="filled" color={couleur} label={statutLibelle[statut]} />
}
