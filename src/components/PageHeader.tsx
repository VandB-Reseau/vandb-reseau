import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

// En-tête commun à toutes les pages : le titre toujours à la même place, les actions sur sa ligne,
// le sous-titre dessous, peu d'espace avant le contenu
export function PageHeader({ titre, sousTitre, actions }: { titre: string; sousTitre?: string; actions?: ReactNode }) {
  return (
    <Box sx={{ mb: { xs: 1.5, md: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', minHeight: 48 }}>
        <Typography variant="h1" sx={{ flex: 1, minWidth: 0 }}>{titre}</Typography>
        {actions}
      </Box>
      {sousTitre && <Typography variant="body2" color="text.secondary">{sousTitre}</Typography>}
    </Box>
  )
}
