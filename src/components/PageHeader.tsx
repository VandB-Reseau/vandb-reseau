import { useContext, useLayoutEffect, type ReactNode } from 'react'
import Chip from '@mui/material/Chip'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { ReclamerSelecteurCtx, useEtiquettePerimetre } from '../data/perimetreChoisi'
import { SelecteurPerimetre } from './SelecteurPerimetre'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

// En-tête commun à toutes les pages : le titre toujours à la même place, les actions sur sa ligne,
// le sous-titre dessous, peu d'espace avant le contenu. Sur téléphone, sans action, le sous-titre (un compteur)
// passe à droite du titre : le contenu remonte d'une ligne (Joseph, 21/10/2026).
export function PageHeader({ titre, sousTitre, actions }: { titre: string; sousTitre?: string; actions?: ReactNode }) {
  // Téléphone (vague 3, 21A) : le périmètre sous le titre, qui garde sa place d'une page à l'autre
  const reclamer = useContext(ReclamerSelecteurCtx)
  useLayoutEffect(() => (reclamer ? reclamer() : undefined), [reclamer])
  const selecteur = reclamer ? <Box sx={{ mt: 1 }}><SelecteurPerimetre /></Box> : null
  if (!actions && sousTitre) {
    return (
      <Box sx={{ mb: { xs: 1.5, md: 2 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: 'minmax(0, 1fr)' }, alignItems: 'center', columnGap: 2 }}>
          <Titre titre={titre} />
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: { xs: 'right', md: 'left' }, maxWidth: { xs: '45vw', md: 'none' } }}>{sousTitre}</Typography>
        </Box>
        {selecteur}
      </Box>
    )
  }
  return (
    <Box sx={{ mb: { xs: 1, md: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
        <Titre titre={titre} />
        {actions}
      </Box>
      {sousTitre && <Typography variant="body2" color="text.secondary">{sousTitre}</Typography>}
      {selecteur}
    </Box>
  )
}

// Le titre dans une case de hauteur fixe : il reste à la même place quelle que soit la hauteur des actions
// Vague 3 (21A) : sur PC, le périmètre choisi se rappelle à côté du titre, et se retire d'un clic
function Titre({ titre }: { titre: string }) {
  const etiquette = useEtiquettePerimetre()
  return (
    <Box sx={{ flex: 1, minWidth: 0, minHeight: { xs: 40, md: 48 }, display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Typography variant="h1" sx={{ minWidth: 0 }}>{titre}</Typography>
      {etiquette && <Chip variant="outlined" label={etiquette.libelle} onDelete={etiquette.revenir} deleteIcon={<CloseOutlined aria-label="Revenir à tout le périmètre" />} sx={{ display: { xs: 'none', md: 'inline-flex' }, fontWeight: 700, fontSize: '0.8125rem' }} />}
    </Box>
  )
}
