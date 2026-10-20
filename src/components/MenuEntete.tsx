// Aperçu déroulant d'une icône de l'en-tête (Tâches, Messages) : titre, quelques lignes, lien vers la page entière
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Menu from '@mui/material/Menu'
import Typography from '@mui/material/Typography'

export function MenuEntete({ ancre, fermer, titre, vide, children, tout, icone, ouvrirTout }: {
  ancre: HTMLElement | null; fermer: () => void; titre: string; vide: string | null; children: ReactNode
  tout: string; icone: ReactNode; ouvrirTout: () => void
}) {
  return (
    <Menu anchorEl={ancre} open={!!ancre} onClose={fermer} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { width: 380, maxWidth: 'calc(100vw - 32px)' } }, list: { 'aria-label': titre } }}>
      <Box sx={{ px: 2, py: 1 }}><Typography variant="subtitle2" component="p">{titre}</Typography></Box>
      <Divider />
      {vide !== null ? <Box sx={{ px: 2, py: 2 }}><Typography variant="body2" color="text.secondary">{vide}</Typography></Box> : children}
      <Divider />
      <Box sx={{ px: 1, pt: 0.5 }}>
        <Button startIcon={icone} onClick={() => { fermer(); ouvrirTout() }} sx={{ minHeight: 48 }}>{tout}</Button>
      </Box>
    </Menu>
  )
}
