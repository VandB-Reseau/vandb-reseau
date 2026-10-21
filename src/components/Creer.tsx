import { useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined'
import PhotoCameraOutlined from '@mui/icons-material/PhotoCameraOutlined'
import BeachAccessOutlined from '@mui/icons-material/BeachAccessOutlined'
import EventOutlined from '@mui/icons-material/EventOutlined'
import { brand } from '../theme/theme'
import { useReseau } from '../data/ReseauContext'
import { DialogVisite } from './DialogVisite'
import { DialogAction } from './Actions'
import { DialogPratique } from './BonnesPratiques'
import { DialogConge, DialogEvenement } from '../pages/Agenda'

type Choix = 'visite' | 'tache' | 'pratique' | 'absence' | 'evenement'

const tuiles: { id: Choix | 'message'; libelle: string; icone: ReactElement; fond: string; texte: string }[] = [
  { id: 'visite', libelle: 'Visite', icone: <EventNoteOutlined />, fond: brand.noir, texte: '#ffffff' },
  { id: 'tache', libelle: 'Tâche', icone: <TaskAltOutlined />, fond: brand.or, texte: brand.noir },
  { id: 'message', libelle: 'Message', icone: <ChatBubbleOutlineOutlined />, fond: brand.bleu, texte: '#ffffff' },
  { id: 'pratique', libelle: 'Bonne pratique', icone: <PhotoCameraOutlined />, fond: brand.orange, texte: brand.noir },
  // Absence et événement rejoignent Créer : plus de boutons dans l'en-tête de l'Agenda (Joseph, 21/10/2026)
  { id: 'absence', libelle: 'Absence', icone: <BeachAccessOutlined />, fond: '#0f766e', texte: '#ffffff' },
  { id: 'evenement', libelle: 'Événement', icone: <EventOutlined />, fond: '#7c3aed', texte: '#ffffff' },
]

// Bouton « Créer » : visite, tâche, message, bonne pratique, absence ou événement, depuis n'importe quel écran.
// rond : bouton noir au centre de la barre du bas (téléphone) ; sinon bouton en tête du menu latéral (PC)
export function BoutonCreer({ rond = false }: { rond?: boolean }) {
  const { reseau } = useReseau()
  const naviguer = useNavigate()
  const [ouvert, setOuvert] = useState(false)
  const [choix, setChoix] = useState<Choix | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const fermer = (msg?: string) => { setChoix(null); if (msg) setConfirmation(msg) }
  const choisir = (id: Choix | 'message') => {
    setOuvert(false)
    if (id === 'message') naviguer('/messages')
    else setChoix(id)
  }
  return (
    <>
      {rond ? (
        <ButtonBase aria-label="Créer" onClick={() => setOuvert(true)} sx={{ flex: 1, minWidth: 0, height: 64, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center' }}><AddOutlined sx={{ fontSize: 28 }} /></Box>
        </ButtonBase>
      ) : (
        <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setOuvert(true)} sx={{ minHeight: 52, px: 3, fontSize: '0.9375rem' }}>Créer</Button>
      )}
      <Dialog open={ouvert} onClose={() => setOuvert(false)} fullWidth maxWidth={false} aria-labelledby="titre-creer" slotProps={{ paper: { sx: { width: { sm: 340 } } } }}>
        <DialogTitle id="titre-creer" sx={{ display: 'flex', alignItems: 'center', pr: 1, py: 1 }}>
          <Box component="span" sx={{ flex: 1 }}>Créer</Box>
          <IconButton aria-label="Fermer" onClick={() => setOuvert(false)} sx={{ width: 48, height: 48 }}><CloseOutlined /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pb: 2, px: 2 }}>
          {/* Téléphone : trois choix par ligne ; PC : deux par ligne */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
            {tuiles.map((t) => (
              <ButtonBase key={t.id} onClick={() => choisir(t.id)} disabled={!reseau}
                sx={{ minHeight: 84, py: 1, px: 0.5, borderRadius: 3, bgcolor: 'background.default', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: t.fond, color: t.texte, display: 'grid', placeItems: 'center' }}>{t.icone}</Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.25, textAlign: 'center' }}>{t.libelle}</Typography>
              </ButtonBase>
            ))}
          </Box>
        </DialogContent>
      </Dialog>
      {reseau && choix === 'visite' && <DialogVisite reseau={reseau} visite={null} onFermer={fermer} />}
      {reseau && choix === 'tache' && <DialogAction reseau={reseau} magasins={reseau.magasins.map((m) => m.nom)} action={null} onFermer={fermer} />}
      {reseau && choix === 'pratique' && <DialogPratique reseau={reseau} pratique={null} onFermer={fermer} />}
      {reseau && choix === 'absence' && <DialogConge reseau={reseau} conge={null} onFermer={fermer} />}
      {reseau && choix === 'evenement' && <DialogEvenement reseau={reseau} evenement={null} onFermer={fermer} />}
      <Snackbar open={!!confirmation} autoHideDuration={5000} onClose={() => setConfirmation('')} message={confirmation} />
    </>
  )
}
