import { Suspense, type ReactNode } from 'react'
import Skeleton from '@mui/material/Skeleton'
import { chargementDiffere } from '../lib/chargementDiffere'

// Suivi, budget et saisies d'un magasin (fusion avec le pilotage, Joseph 03/11/2026), chargés seulement quand on ouvre
// l'onglet. Refonte (Joseph, 09/11/2026, 3A) : mode « chiffres » (onglet Chiffres : suivi, santé, saisies) ou
// « budget » (onglet Budget : les trois étapes)
const Budget = chargementDiffere(() => import('../pilotage/Pilotage').then((m) => ({ default: m.OngletBudget })))

export function OngletBudget({ nom, mode, sante, santeLibelle }: { nom: string; mode?: 'chiffres' | 'budget' | 'simulateurs'; sante?: ReactNode; santeLibelle?: string }) {
  return <Suspense fallback={<Skeleton variant="rounded" height={240} />}><Budget nom={nom} mode={mode} sante={sante} santeLibelle={santeLibelle} /></Suspense>
}
