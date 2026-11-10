// Vague 7 (79A) : un seul bouton « Visite » partout (fiche, Visites, Ma semaine, Au magasin). Son libellé dit la prochaine
// étape (Planifier, Préparer, Commencer, Écrire le compte rendu) et il ouvre la page de la visite à cette étape.
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined'
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined'
import RateReviewOutlined from '@mui/icons-material/RateReviewOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import { prochaineEtape, type EtapeBouton } from '../data/ordreDuJour'
import type { Reseau } from '../data/modele'

export const iconeEtape: Record<EtapeBouton, ReactNode> = {
  planifier: <EventAvailableOutlined />, preparer: <AssignmentOutlined />, commencer: <StorefrontOutlined />, compterendu: <RateReviewOutlined />, voir: <RateReviewOutlined />,
}
// Libellés courts pour les lignes (téléphone, listes)
const court: Record<EtapeBouton, string> = { planifier: 'Planifier', preparer: 'Préparer', commencer: 'Commencer', compterendu: 'Compte rendu', voir: 'Voir' }

export function BoutonVisite({ reseau, magasin, forme = 'bouton', principal = false, dateProposee, sx }: {
  reseau: Reseau; magasin: string; forme?: 'bouton' | 'court' | 'icone'; principal?: boolean; dateProposee?: string; sx?: object
}) {
  const brut = prochaineEtape(reseau, magasin)
  // À planifier : la date proposée (Ma semaine) est reprise dans l'étape Préparer
  const e = brut.etape === 'planifier' && dateProposee ? { ...brut, lien: `${brut.lien}&date=${dateProposee}` } : brut
  const aria = `${e.libelle} : ${magasin}`
  if (forme === 'icone') {
    return <Tooltip title={e.libelle}><IconButton component={RouterLink} to={e.lien} aria-label={aria} sx={{ width: 48, height: 48, ...sx }}>{iconeEtape[e.etape]}</IconButton></Tooltip>
  }
  return (
    <Button component={RouterLink} to={e.lien} variant={principal ? 'contained' : 'outlined'} startIcon={iconeEtape[e.etape]} aria-label={aria}
      sx={{ minHeight: 48, flexShrink: 0, whiteSpace: 'nowrap', ...sx }}>
      {forme === 'court' ? court[e.etape] : e.libelle}
    </Button>
  )
}
