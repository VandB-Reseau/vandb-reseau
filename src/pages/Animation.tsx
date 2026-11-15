// « Envoyer au réseau » (refonte vague 4, Joseph 10/11/2026, 36A) : un seul menu pour créer une communication, une campagne,
// un sondage, une remontée, une réunion, une formation ou une bonne pratique. Choix 213-214 (Joseph, 15/11/2026) : l'ancien
// onglet « Sondages et rendez-vous » de Campagnes disparaît ; le bouton reste en tête de la page Animation, et le suivi de
// chaque contenu (lectures, réponses, présences, exécution) s'affiche sur le contenu lui-même.
import { Suspense, useState, type MouseEvent, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import TipsAndUpdatesOutlined from '@mui/icons-material/TipsAndUpdatesOutlined'
import AssignmentReturnOutlined from '@mui/icons-material/AssignmentReturnOutlined'
import QuizOutlined from '@mui/icons-material/QuizOutlined'
import SchoolOutlined from '@mui/icons-material/SchoolOutlined'
import GroupsOutlined from '@mui/icons-material/GroupsOutlined'
import FlagOutlined from '@mui/icons-material/FlagOutlined'
import { DialogPratique } from '../components/BonnesPratiques'
import { DialogSondage } from '../components/Questions'
import { DialogCampagne } from '../components/Campagnes'
import type { Reseau, TypeEvenement } from '../data/modele'
import { chargementDiffere } from '../lib/chargementDiffere'

const DialogEvenement = chargementDiffere(() => import('./Agenda').then((m) => ({ default: m.DialogEvenement })))

export type Genre = 'communication' | 'pratique' | 'sondage' | 'remontee' | 'formation' | 'reunion' | 'campagne'
// Refonte vague 4 (Joseph 10/11/2026, 36A) : « Envoyer au réseau », un seul panneau dans cet ordre ; la remontée est un
// sondage à réponse libre (chiffre ou texte), avec le nom
const genres: { v: Genre; libelle: string; pluriel: string; icone: ReactElement; couleur: string }[] = [
  { v: 'communication', libelle: 'Information', pluriel: 'Informations', icone: <CampaignOutlined />, couleur: '#307672' },
  { v: 'campagne', libelle: 'Campagne', pluriel: 'Campagnes', icone: <FlagOutlined />, couleur: '#a15c00' },
  { v: 'sondage', libelle: 'Sondage', pluriel: 'Sondages', icone: <QuizOutlined />, couleur: '#312e2e' },
  { v: 'remontee', libelle: 'Remontée', pluriel: 'Remontées', icone: <AssignmentReturnOutlined />, couleur: '#5b4b8a' },
  { v: 'reunion', libelle: 'Réunion', pluriel: 'Réunions', icone: <GroupsOutlined />, couleur: '#1d1d1b' },
  { v: 'formation', libelle: 'Formation', pluriel: 'Formations', icone: <SchoolOutlined />, couleur: '#c24119' },
  { v: 'pratique', libelle: 'Bonne pratique', pluriel: 'Bonnes pratiques', icone: <TipsAndUpdatesOutlined />, couleur: '#ea6029' },
]

// apres : appelé quand un sondage est enregistré (pour relire la liste affichée)
export function EnvoyerAuReseau({ reseau, apres }: { reseau: Reseau; apres?: () => void }) {
  const naviguer = useNavigate()
  const [creation, setCreation] = useState<Genre | null>(null)
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  const [message, setMessage] = useState('')
  const fermer = (m?: string) => { setCreation(null); if (m) setMessage(m) }
  const creer = (c: Genre) => {
    setAncre(null)
    if (c === 'communication') naviguer('/infos?vue=communications&publier=1')
    else setCreation(c)
  }
  const typeCree: TypeEvenement = creation === 'formation' ? 'formation' : 'reunion'
  return (
    <>
      <Button variant="contained" startIcon={<AddOutlined />} aria-haspopup="menu" aria-expanded={!!ancre} onClick={(e: MouseEvent<HTMLElement>) => setAncre(e.currentTarget)} sx={{ minHeight: 48, ml: 'auto' }}>Envoyer au réseau</Button>
      <Menu anchorEl={ancre} open={!!ancre} onClose={() => setAncre(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ list: { 'aria-label': 'Envoyer au réseau' }, paper: { sx: { mt: 0.5, minWidth: 220, borderRadius: 3 } } }}>
        {genres.map((g) => (
          <MenuItem key={g.v} onClick={() => creer(g.v)} sx={{ '&&': { minHeight: 52 }, gap: 1.5, fontWeight: 600 }}>
            <Box component="span" sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: g.couleur, color: '#ffffff', display: 'grid', placeItems: 'center', flexShrink: 0, '& svg': { fontSize: 18 } }}>{g.icone}</Box>
            {g.libelle}
          </MenuItem>
        ))}
      </Menu>
      {creation === 'pratique' && <DialogPratique reseau={reseau} pratique={null} onFermer={fermer} />}
      {(creation === 'sondage' || creation === 'remontee') && <DialogSondage reseau={reseau} remontee={creation === 'remontee'} onFermer={(m) => { fermer(m); if (m) apres?.() }} />}
      {creation === 'campagne' && <DialogCampagne reseau={reseau} campagne={null} onFermer={(m) => fermer(m)} />}
      {(creation === 'formation' || creation === 'reunion') && (
        <Suspense fallback={null}>
          <DialogEvenement reseau={reseau} evenement={null} typeInitial={typeCree} onFermer={fermer} />
        </Suspense>
      )}
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}
