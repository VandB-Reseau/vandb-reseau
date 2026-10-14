import type { ReactElement, ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export function EmptyState({ icone, titre, texte, action }: { icone: ReactElement; titre: string; texte: string; action?: ReactNode }) {
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 2, color: 'text.secondary' }}>
      <Box sx={{ display: 'inline-flex', p: 2, borderRadius: '50%', bgcolor: 'action.hover', mb: 2, '& svg': { fontSize: 40 } }}>{icone}</Box>
      <Typography variant="h4" component="p" color="text.primary" gutterBottom>{titre}</Typography>
      <Typography variant="body2" sx={{ maxWidth: 420, mx: 'auto' }}>{texte}</Typography>
      {action && <Box sx={{ mt: 3 }}>{action}</Box>}
    </Box>
  )
}
