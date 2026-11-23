import { Suspense, type ComponentProps } from 'react'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import { chargementDiffere } from '../../lib/chargementDiffere'
import type { Simulateurs as SimulateursComplets } from './Simulateurs'

// Proposition 369 (Joseph, 23/11/2026) : les simulateurs (le plus gros écran du budget) ne se téléchargent qu'à leur
// ouverture, plus avec le budget, les chiffres ou les paramètres
const Charges = chargementDiffere(() => import('./Simulateurs').then((m) => ({ default: m.Simulateurs })))

function Silhouette() {
  return (
    <Box role="progressbar" aria-label="Chargement des simulateurs" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
      {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} variant="rounded" height={120} />)}
    </Box>
  )
}

export function Simulateurs(props: ComponentProps<typeof SimulateursComplets>) {
  return <Suspense fallback={<Silhouette />}><Charges {...props} /></Suspense>
}
