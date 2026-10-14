import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export function PageHeader({ titre, sousTitre, actions }: { titre: string; sousTitre?: string; actions?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 3, flexWrap: 'wrap' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h1">{titre}</Typography>
        {sousTitre && <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>{sousTitre}</Typography>}
      </Box>
      {actions}
    </Box>
  )
}
