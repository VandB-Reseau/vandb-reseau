import { Suspense } from 'react'
import Skeleton from '@mui/material/Skeleton'
import { chargementDiffere } from '../lib/chargementDiffere'

// Onglet « Budget » de la fiche d'un magasin (fusion avec le pilotage, Joseph 03/11/2026) : suivi, budget et saisies,
// chargés seulement quand on ouvre l'onglet
const Budget = chargementDiffere(() => import('../pilotage/Pilotage').then((m) => ({ default: m.OngletBudget })))

export function OngletBudget({ nom }: { nom: string }) {
  return <Suspense fallback={<Skeleton variant="rounded" height={240} />}><Budget nom={nom} /></Suspense>
}
