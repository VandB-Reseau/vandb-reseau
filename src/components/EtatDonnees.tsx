import { useMemo, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import CloudOffOutlined from '@mui/icons-material/CloudOffOutlined'
import { EmptyState } from './EmptyState'
import { restreindre, useReseau } from '../data/ReseauContext'
import { useLocation } from 'react-router-dom'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { useAuth } from '../auth/AuthContext'
import { choisirPerimetre, EtiquettePerimetreCtx, libellePerimetre, perimetreRetenu, suitLePerimetre, useCleChoisie } from '../data/perimetreChoisi'
import { SelecteurPerimetre } from './SelecteurPerimetre'
import type { Reseau } from '../data/modele'

// Affiche chargement / erreur de manière lisible, puis le contenu une fois les données prêtes
export function AvecReseau({ children }: { children: (r: Reseau) => ReactNode }) {
  const { reseau: tout, chargement, erreur, recharger } = useReseau()
  // Vague 3 (21A) : les listes suivent le périmètre choisi dans le menu ; les fiches s'ouvrent toujours en entier
  const { pathname } = useLocation()
  const { profil } = useAuth()
  const cle = useCleChoisie()
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const suit = suitLePerimetre(pathname)
  const p = useMemo(() => (tout && suit ? perimetreRetenu(tout, profil, cle) : null), [tout, suit, profil, cle])
  const reseau = useMemo(() => (tout && p ? restreindre(tout, p) : tout), [tout, p])
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
  if (!reseau) return null
  const etiquette = p && tout ? { libelle: libellePerimetre(tout, p), nombre: reseau.magasins.filter((m) => m.statut !== 'avenir').length, revenir: () => choisirPerimetre('reseau') } : null
  return (
    <EtiquettePerimetreCtx.Provider value={etiquette}>
      {suit && !surPC && <Box sx={{ mb: 1.5 }}><SelecteurPerimetre /></Box>}
      {children(reseau)}
    </EtiquettePerimetreCtx.Provider>
  )
}
