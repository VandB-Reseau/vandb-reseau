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
  [/communication|annoncer|campagne|challenge|pratique/i, infos],
  [/tâche/i, taches],
  [/magasin|adresse|budget/i, magasins],
]

// Vague 8 (99A) : un seul état vide, en trois tailles. page = illustration, carte = petite illustration, ligne = texte seul.
// Jamais de bouton qui répète l'action déjà présente dans l'en-tête de la page.
export function EmptyState({ titre, texte, action, taille = 'page' }: { icone?: ReactElement; titre: string; texte: string; action?: ReactNode; taille?: 'page' | 'carte' | 'ligne' }) {
  const image = ILLUSTRATIONS.find(([motif]) => motif.test(titre))?.[1] ?? fleur
  return (
    <Box sx={{ textAlign: 'center', py: taille === 'page' ? 6 : taille === 'carte' ? 3 : 2, px: 2, color: 'text.secondary' }}>
      {/* Pictogrammes de la charte : toujours sur fond blanc, y compris en mode sombre */}
      {taille !== 'ligne' && <Box aria-hidden sx={{ display: 'inline-flex', p: taille === 'page' ? 1.5 : 1, borderRadius: 4, mb: taille === 'page' ? 2 : 1, bgcolor: '#ffffff' }}>
        <Box component="img" src={image} alt="" sx={{ height: taille === 'page' ? 96 : 56, width: 'auto', display: 'block' }} />
      </Box>}
      <Typography variant={taille === 'page' ? 'h4' : 'body1'} component="p" color="text.primary" sx={{ fontWeight: 600 }} gutterBottom>{titre}</Typography>
      <Typography variant="body2" sx={{ maxWidth: 420, mx: 'auto' }}>{texte}</Typography>
      {action && <Box sx={{ mt: 3 }}>{action}</Box>}
    </Box>
  )
}
