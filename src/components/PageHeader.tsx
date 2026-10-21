import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

// En-tête commun à toutes les pages : le titre toujours à la même place, les actions sur sa ligne,
// le sous-titre dessous, peu d'espace avant le contenu. Sur téléphone, sans action, le sous-titre (un compteur)
// passe à droite du titre : le contenu remonte d'une ligne (Joseph, 21/10/2026).
export function PageHeader({ titre, sousTitre, actions }: { titre: string; sousTitre?: string; actions?: ReactNode }) {
  if (!actions && sousTitre) {
    return (
      <Box sx={{ mb: { xs: 1, md: 2 }, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: 'minmax(0, 1fr)' }, alignItems: 'center', columnGap: 2 }}>
        <Titre titre={titre} />
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: { xs: 'right', md: 'left' }, maxWidth: { xs: '45vw', md: 'none' } }}>{sousTitre}</Typography>
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
    </Box>
  )
}

// Le titre dans une case de hauteur fixe : il reste à la même place quelle que soit la hauteur des actions
function Titre({ titre }: { titre: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0, minHeight: { xs: 40, md: 48 }, display: 'flex', alignItems: 'center' }}>
      <Typography variant="h1" sx={{ minWidth: 0 }}>{titre}</Typography>
    </Box>
  )
}
