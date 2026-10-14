import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import CloudOffOutlined from '@mui/icons-material/CloudOffOutlined'
import { EmptyState } from './EmptyState'
import { useReseau } from '../data/ReseauContext'
import type { Reseau } from '../data/modele'

// Affiche chargement / erreur de manière lisible, puis le contenu une fois les données prêtes
export function AvecReseau({ children }: { children: (r: Reseau) => ReactNode }) {
  const { reseau, chargement, erreur, recharger } = useReseau()
  if (erreur && !reseau) {
    return (
      <EmptyState
        icone={<CloudOffOutlined />}
        titre="Impossible de charger le réseau"
        texte="Vérifie ta connexion internet puis réessaie. Tes données ne sont pas perdues."
        action={<Button variant="contained" onClick={recharger}>Réessayer</Button>}
      />
    )
  }
  if (chargement && !reseau) {
    return (
      <Box aria-label="Chargement des magasins" role="progressbar">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} variant="rounded" height={56} sx={{ mb: 1 }} />)}
      </Box>
    )
  }
  return <>{reseau && children(reseau)}</>
}
