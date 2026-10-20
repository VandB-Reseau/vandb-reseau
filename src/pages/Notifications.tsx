import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import AlternateEmail from '@mui/icons-material/AlternateEmail'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined'
import { useAuth } from '../auth/AuthContext'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useMessagerie } from '../data/MessagerieContext'
import { useReseau } from '../data/ReseauContext'
import { heureCourte, historique, jourDuFil, type Evenement } from '../data/messagerie'

type Filtre = 'toutes' | 'nouvelles' | 'mentions'
const PAGE = 100
const icone = { message: <ForumOutlined />, mention: <AlternateEmail />, visite: <EventNoteOutlined /> }
const titre = (e: Evenement) => (e.type === 'visite' ? 'Nouveau compte rendu de visite' : e.type === 'mention' ? `${e.auteur} te mentionne` : `Message de ${e.auteur}`)

function LigneEvenement({ e, ouvrir }: { e: Evenement; ouvrir: () => void }) {
  return (
    <ListItemButton onClick={ouvrir} aria-label={`${e.nouveau ? 'Nouveau : ' : ''}${titre(e)} · ${e.magasins.join(', ')}`} sx={{ borderRadius: 3, minHeight: 64, gap: 1.5, alignItems: 'flex-start', py: 1.25 }}>
      <Box sx={{ position: 'relative', mt: 0.25, color: e.type === 'mention' ? 'error.main' : 'text.secondary', display: 'flex' }}>
        {icone[e.type]}
        {e.nouveau && <Box aria-hidden sx={{ position: 'absolute', top: -3, right: -4, width: 10, height: 10, borderRadius: '50%', bgcolor: 'error.main', border: '2px solid', borderColor: 'background.paper' }} />}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
          <Typography variant="body1" sx={{ flex: 1, minWidth: 0, fontWeight: e.nouveau ? 700 : 500 }}>{titre(e)}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{heureCourte(e.date)}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">{e.magasins.join(', ')}</Typography>
        {e.texte && <Typography variant="body2" color={e.nouveau ? 'text.primary' : 'text.secondary'} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{e.texte}</Typography>}
      </Box>
    </ListItemButton>
  )
}

// Notifications : les nouvelles en haut, puis l'historique déjà vu, jour par jour
export function Notifications() {
  const { profil } = useAuth()
  const { reseau } = useReseau()
  const { messagerie, charge, marquerLu } = useMessagerie()
  const naviguer = useNavigate()
  const [filtre, setFiltre] = useState<Filtre>('toutes')
  const [nombre, setNombre] = useState(PAGE)
  const tous = useMemo(() => historique(reseau, profil, messagerie), [reseau, profil, messagerie])
  if (!charge) return <><PageHeader titre="Notifications" /><Typography variant="body2" color="text.secondary">Chargement…</Typography></>
  if (!messagerie) return <><PageHeader titre="Notifications" /><EmptyState icone={<NotificationsOutlined />} titre="Notifications pas encore activées" texte="Les nouveautés de tes magasins apparaîtront ici dès l’activation de la messagerie." /></>

  const retenus = tous.filter((e) => filtre === 'toutes' || (filtre === 'nouvelles' ? e.nouveau : e.type === 'mention'))
  const nouvelles = retenus.filter((e) => e.nouveau)
  const vues = retenus.filter((e) => !e.nouveau).slice(0, nombre)
  const restantes = retenus.filter((e) => !e.nouveau).length - vues.length
  const toutLire = () => {
    const sujets = new Set(tous.filter((e) => e.nouveau).flatMap((e) => e.magasins.map((n) => `${n}|${e.type === 'visite' ? 'visites' : 'messages'}`)))
    sujets.forEach((s) => { const [n, sujet] = s.split('|'); marquerLu(n, sujet as 'messages' | 'visites') })
  }
  const ouvrir = (e: Evenement) => naviguer(e.lien)
  return (
    <>
      <PageHeader titre="Notifications" actions={tous.some((e) => e.nouveau) ? <Button variant="outlined" onClick={toutLire} sx={{ minHeight: 48 }}>Tout marquer comme lu</Button> : undefined} />
      <ToggleButtonGroup exclusive value={filtre} onChange={(_e, v: Filtre | null) => { if (v) setFiltre(v) }} aria-label="Notifications affichées" sx={{ mb: 2, width: { xs: '100%', sm: 'auto' } }}>
        <ToggleButton value="toutes" sx={{ minHeight: 48, flex: 1, px: 2, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Toutes</ToggleButton>
        <ToggleButton value="nouvelles" sx={{ minHeight: 48, flex: 1, px: 2, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Nouvelles{tous.some((e) => e.nouveau) ? ` · ${tous.filter((e) => e.nouveau).length}` : ''}</ToggleButton>
        <ToggleButton value="mentions" sx={{ minHeight: 48, flex: 1, px: 2, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Mentions</ToggleButton>
      </ToggleButtonGroup>
      {!retenus.length && <EmptyState icone={<NotificationsOutlined />} titre={filtre === 'nouvelles' ? 'Tout est lu' : 'Aucune notification'} texte={filtre === 'mentions' ? 'Personne ne t’a encore mentionné.' : 'Les nouveautés de tes magasins apparaîtront ici.'} />}
      {nouvelles.length > 0 && (
        <Box component="section" aria-label="Nouvelles" sx={{ mb: 3 }}>
          <Typography variant="overline" component="h2" color="text.secondary" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>Nouvelles</Typography>
          <Card><List disablePadding sx={{ p: 0.5 }}>{nouvelles.map((e) => <LigneEvenement key={e.cle} e={e} ouvrir={() => ouvrir(e)} />)}</List></Card>
        </Box>
      )}
      {vues.length > 0 && (
        <Box component="section" aria-label="Déjà vues">
          <Typography variant="overline" component="h2" color="text.secondary" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>Déjà vues</Typography>
          <Card>
            <List disablePadding sx={{ p: 0.5 }}>
              {vues.map((e, i) => (
                <Fragment key={e.cle}>
                  {(i === 0 || jourDuFil(vues[i - 1].date) !== jourDuFil(e.date)) && <Typography variant="caption" component="p" color="text.secondary" sx={{ fontWeight: 600, px: 2, pt: i ? 1.5 : 1, pb: 0.5 }}>{jourDuFil(e.date)}</Typography>}
                  <LigneEvenement e={e} ouvrir={() => ouvrir(e)} />
                </Fragment>
              ))}
            </List>
          </Card>
          {restantes > 0 && <Box sx={{ textAlign: 'center', mt: 1 }}><Button onClick={() => setNombre((n) => n + PAGE)} sx={{ minHeight: 48 }}>Voir plus ({restantes})</Button></Box>}
        </Box>
      )}
    </>
  )
}
