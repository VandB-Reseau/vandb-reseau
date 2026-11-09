import { createContext, Suspense, useCallback, useContext, useState, type MouseEvent, type ReactElement, type ReactNode } from 'react'
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

export type Choix = 'visite' | 'tache' | 'pratique' | 'evenement'

// Absences retirées de l'app (Joseph, 22/10/2026)
// Fenêtre d'événement : chargée avec l'Agenda, seulement quand on la demande
const DialogEvenement = chargementDiffere(() => import('../pages/Agenda').then((m) => ({ default: m.DialogEvenement })))

const choixCreer: { id: Choix | 'message'; libelle: string; icone: ReactElement; fond: string; texte: string }[] = [
  { id: 'visite', libelle: 'Visite', icone: <EventNoteOutlined fontSize="small" />, fond: brand.noir, texte: '#ffffff' },
  { id: 'tache', libelle: 'Tâche', icone: <TaskAltOutlined fontSize="small" />, fond: brand.or, texte: brand.noir },
  { id: 'message', libelle: 'Message', icone: <ChatBubbleOutlineOutlined fontSize="small" />, fond: brand.vertFonce, texte: '#ffffff' },
  { id: 'pratique', libelle: 'Bonne pratique', icone: <PhotoCameraOutlined fontSize="small" />, fond: brand.orange, texte: brand.noir },
  { id: 'evenement', libelle: 'Événement', icone: <EventOutlined fontSize="small" />, fond: brand.brique, texte: '#ffffff' },
]

// Créer depuis n'importe où (bouton « + » du téléphone, recherche Ctrl K du PC) : une seule source pour les fenêtres
// de création (refonte, Joseph 09/11/2026, choix 9A). magasin : la visite ou la tâche est déjà rattachée à ce magasin.
type Creer = (choix: Choix | 'message', magasin?: string) => void
const ContexteCreer = createContext<Creer>(() => {})
export const useCreer = () => useContext(ContexteCreer)

export function CreerProvider({ children }: { children: ReactNode }) {
  const { reseau } = useReseau()
  const naviguer = useNavigate()
  const [choix, setChoix] = useState<{ c: Choix; magasin?: string } | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const fermer = (msg?: string) => { setChoix(null); if (msg) setConfirmation(msg) }
  const creer = useCallback<Creer>((c, magasin) => {
    if (c === 'message') naviguer(magasin ? `/echanges/magasin/${encodeURIComponent(magasin)}` : '/echanges')
    else setChoix({ c, magasin })
  }, [naviguer])
  return (
    <ContexteCreer.Provider value={creer}>
      {children}
      {reseau && choix?.c === 'visite' && <DialogVisite reseau={reseau} visite={null} magasinsInitiaux={choix.magasin ? [choix.magasin] : undefined} onFermer={fermer} />}
      {reseau && choix?.c === 'tache' && <DialogAction reseau={reseau} magasins={choix.magasin ? [choix.magasin] : reseau.magasins.map((m) => m.nom)} action={null} onFermer={fermer} />}
      {reseau && choix?.c === 'pratique' && <DialogPratique reseau={reseau} pratique={null} onFermer={fermer} />}
      {reseau && choix?.c === 'evenement' && <Suspense fallback={null}><DialogEvenement reseau={reseau} evenement={null} onFermer={fermer} /></Suspense>}
      <Snackbar open={!!confirmation} autoHideDuration={5000} onClose={() => setConfirmation('')} message={confirmation} />
    </ContexteCreer.Provider>
  )
}

export const libellesCreer = choixCreer

// Bouton « + » de la barre du haut sur téléphone : visite, tâche, message, bonne pratique ou événement.
// Sur PC, la recherche (Ctrl K) propose les mêmes actions (refonte, choix 9A).
export function BoutonCreer({ entete = false }: { entete?: boolean }) {
  const { reseau } = useReseau()
  const creer = useCreer()
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  const ouvrir = (ev: MouseEvent<HTMLElement>) => setAncre(ev.currentTarget)
  const choisir = (id: Choix | 'message') => { setAncre(null); creer(id) }
  return (
    <>
      {entete ? (
        <ButtonBase aria-label="Créer" aria-haspopup="menu" aria-expanded={!!ancre} onClick={ouvrir} sx={{ width: 48, height: 48, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
          <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center' }}><AddOutlined /></Box>
        </ButtonBase>
      ) : (
        <Button variant="contained" aria-haspopup="menu" aria-expanded={!!ancre} startIcon={<AddOutlined />} onClick={ouvrir}>Créer</Button>
      )}
      <Menu anchorEl={ancre} open={!!ancre} onClose={() => setAncre(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: entete ? 'right' : 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: entete ? 'right' : 'left' }}
        slotProps={{ list: { 'aria-label': 'Créer' }, paper: { sx: { mt: 0.5, minWidth: 220, borderRadius: 2 } } }}>
        {choixCreer.map((c) => (
          <MenuItem key={c.id} onClick={() => choisir(c.id)} disabled={!reseau} sx={{ '&&': { minHeight: 52 }, gap: 1.5, fontWeight: 600 }}>
            <Box component="span" sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: c.fond, color: c.texte, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{c.icone}</Box>
            {c.libelle}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
