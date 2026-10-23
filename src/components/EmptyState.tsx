import type { ReactElement, ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import fleur from '../assets/illustrations/fleur.png'
import infos from '../assets/illustrations/infos.png'
import magasins from '../assets/illustrations/magasins.png'
import messages from '../assets/illustrations/messages.png'
import taches from '../assets/illustrations/taches.png'
import visites from '../assets/illustrations/visites.png'

// Illustrations de la charte V and B (banque de pictogrammes), choisies d'après le sujet de l'état vide
const ILLUSTRATIONS: [RegExp, string][] = [
  [/visite|semaine|prévu|agenda/i, visites],
  [/message|conversation|lu$/i, messages],
  [/communication|campagne|challenge|pratique/i, infos],
  [/tâche/i, taches],
  [/magasin/i, magasins],
]

export function EmptyState({ titre, texte, action }: { icone?: ReactElement; titre: string; texte: string; action?: ReactNode }) {
  const image = ILLUSTRATIONS.find(([motif]) => motif.test(titre))?.[1] ?? fleur
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 2, color: 'text.secondary' }}>
      {/* Pictogrammes de la charte : toujours sur fond blanc, y compris en mode sombre */}
      <Box aria-hidden sx={{ display: 'inline-flex', p: 1.5, borderRadius: 4, mb: 2, bgcolor: '#ffffff' }}>
        <Box component="img" src={image} alt="" sx={{ height: 96, width: 'auto', display: 'block' }} />
      </Box>
      <Typography variant="h4" component="p" color="text.primary" gutterBottom>{titre}</Typography>
      <Typography variant="body2" sx={{ maxWidth: 420, mx: 'auto' }}>{texte}</Typography>
      {action && <Box sx={{ mt: 3 }}>{action}</Box>}
    </Box>
  )
}
