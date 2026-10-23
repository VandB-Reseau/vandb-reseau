import { Suspense, useState, type MouseEvent, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import AddOutlined from '@mui/icons-material/AddOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined'
import PhotoCameraOutlined from '@mui/icons-material/PhotoCameraOutlined'
import EventOutlined from '@mui/icons-material/EventOutlined'
import { brand } from '../theme/theme'
import { DialogVisite } from './DialogVisite'
import { DialogAction } from './Actions'
import { DialogPratique } from './BonnesPratiques'
import { useReseau } from '../data/ReseauContext'
import { chargementDiffere } from '../lib/chargementDiffere'

type Choix = 'visite' | 'tache' | 'pratique' | 'evenement'

// Absences retirées de l'app (Joseph, 22/10/2026)
// Fenêtre d'événement : chargée avec l'Agenda, seulement quand on la demande
const DialogEvenement = chargementDiffere(() => import('../pages/Agenda').then((m) => ({ default: m.DialogEvenement })))

const choixCreer: { id: Choix | 'message'; libelle: string; icone: ReactElement; fond: string; texte: string }[] = [
  { id: 'visite', libelle: 'Visite', icone: <EventNoteOutlined fontSize="small" />, fond: brand.noir, texte: '#ffffff' },
  { id: 'tache', libelle: 'Tâche', icone: <TaskAltOutlined fontSize="small" />, fond: brand.or, texte: brand.noir },
  { id: 'message', libelle: 'Message', icone: <ChatBubbleOutlineOutlined fontSize="small" />, fond: brand.vertFonce, texte: '#ffffff' },
  { id: 'pratique', libelle: 'Bonne pratique', icone: <PhotoCameraOutlined fontSize="small" />, fond: brand.orange, texte: brand.noir },
  { id: 'evenement', libelle: 'Événement', icone: <EventOutlined fontSize="small" />, fond: '#7c3aed', texte: '#ffffff' },
]

// Bouton « Créer » : visite, tâche, message, bonne pratique ou événement, depuis n'importe quel écran.
// Les choix s'ouvrent en menu juste sous le bouton (Joseph, 22/10/2026).
// entete : bouton rond blanc de la barre du haut (téléphone) ; sinon bouton en tête du menu latéral (PC)
export function BoutonCreer({ entete = false }: { entete?: boolean }) {
  const { reseau } = useReseau()
  const naviguer = useNavigate()
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  const [choix, setChoix] = useState<Choix | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const ouvrir = (ev: MouseEvent<HTMLElement>) => setAncre(ev.currentTarget)
  const fermer = (msg?: string) => { setChoix(null); if (msg) setConfirmation(msg) }
  const choisir = (id: Choix | 'message') => {
    setAncre(null)
    if (id === 'message') naviguer('/echanges')
    else setChoix(id)
  }
  return (
    <>
      {entete ? (
        <ButtonBase aria-label="Créer" aria-haspopup="menu" aria-expanded={!!ancre} onClick={ouvrir} sx={{ width: 48, height: 48, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: '#ffffff', color: '#000000', display: 'grid', placeItems: 'center' }}><AddOutlined /></Box>
        </ButtonBase>
      ) : (
        <Button variant="contained" aria-haspopup="menu" aria-expanded={!!ancre} startIcon={<AddOutlined />} onClick={ouvrir} sx={{ minHeight: 52, px: 3, fontSize: '0.9375rem' }}>Créer</Button>
      )}
      <Menu anchorEl={ancre} open={!!ancre} onClose={() => setAncre(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: entete ? 'right' : 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: entete ? 'right' : 'left' }}
        slotProps={{ list: { 'aria-label': 'Créer' }, paper: { sx: { mt: 0.5, minWidth: 220, borderRadius: 3 } } }}>
        {choixCreer.map((c) => (
          <MenuItem key={c.id} onClick={() => choisir(c.id)} disabled={!reseau} sx={{ '&&': { minHeight: 52 }, gap: 1.5, fontWeight: 600 }}>
            <Box component="span" sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: c.fond, color: c.texte, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{c.icone}</Box>
            {c.libelle}
          </MenuItem>
        ))}
      </Menu>
      {reseau && choix === 'visite' && <DialogVisite reseau={reseau} visite={null} onFermer={fermer} />}
      {reseau && choix === 'tache' && <DialogAction reseau={reseau} magasins={reseau.magasins.map((m) => m.nom)} action={null} onFermer={fermer} />}
      {reseau && choix === 'pratique' && <DialogPratique reseau={reseau} pratique={null} onFermer={fermer} />}
      {reseau && choix === 'evenement' && <Suspense fallback={null}><DialogEvenement reseau={reseau} evenement={null} onFermer={fermer} /></Suspense>}
      <Snackbar open={!!confirmation} autoHideDuration={5000} onClose={() => setConfirmation('')} message={confirmation} />
    </>
  )
}
