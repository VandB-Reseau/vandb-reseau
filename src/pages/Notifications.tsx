import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import Typography from '@mui/material/Typography'
import AlternateEmail from '@mui/icons-material/AlternateEmail'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined'
import DoneAllOutlined from '@mui/icons-material/DoneAllOutlined'
import { Glisser, Puces } from '../components/Social'
import { BoutonAction } from '../components/Outils'
import { useAuth } from '../auth/AuthContext'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useMessagerie } from '../data/MessagerieContext'
import { useReseau } from '../data/ReseauContext'
import { heureCourte, historique, type Evenement } from '../data/messagerie'

type Filtre = 'toutes' | 'nouvelles'

// Période d'une notification : Aujourd'hui, Hier, Cette semaine, puis le mois
function periode(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const minuit = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const ecart = Math.round((minuit(new Date()) - minuit(d)) / 86_400_000)
  if (ecart <= 0) return 'Aujourd’hui'
  if (ecart === 1) return 'Hier'
  if (ecart < 7) return 'Cette semaine'
  const m = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return m.charAt(0).toUpperCase() + m.slice(1)
}

// Lignes d'une section, avec un intertitre à chaque changement de période
function LignesParPeriode({ evenements, ouvrir, lire }: { evenements: Evenement[]; ouvrir: (e: Evenement) => void; lire?: (e: Evenement) => void }) {
  return (
    <Card>
      <List disablePadding sx={{ p: 0.5 }}>
        {evenements.map((e, i) => (
          <Fragment key={e.cle}>
            {(i === 0 || periode(evenements[i - 1].date) !== periode(e.date)) && <Typography variant="caption" component="p" color="text.secondary" sx={{ fontWeight: 600, px: 2, pt: i ? 1.5 : 1, pb: 0.5 }}>{periode(e.date)}</Typography>}
            <LigneEvenement e={e} ouvrir={() => ouvrir(e)} lire={lire && (() => lire(e))} />
          </Fragment>
        ))}
      </List>
    </Card>
  )
}
const PAGE = 100
const icone = { message: <ForumOutlined />, mention: <AlternateEmail />, visite: <EventNoteOutlined /> }
const titre = (e: Evenement) => (e.type === 'visite' ? 'Nouveau compte rendu de visite' : e.type === 'mention' ? `${e.auteur} te mentionne` : `Message de ${e.auteur}`)

function LigneEvenement({ e, ouvrir, lire }: { e: Evenement; ouvrir: () => void; lire?: () => void }) {
  return (
    <Glisser libelle="Lu" icone={<DoneAllOutlined />} actif={!!lire && e.nouveau} onGlisser={() => lire?.()} couleur="#1f1f23">
    <ListItemButton onClick={ouvrir} aria-label={`${e.nouveau ? 'Nouveau : ' : ''}${[titre(e), ...e.magasins].join(' · ')}`} sx={{ borderRadius: 3, minHeight: 64, gap: 1.5, alignItems: 'flex-start', py: 1.25 }}>
      <Box sx={{ position: 'relative', mt: 0.25, color: e.type === 'mention' ? 'error.main' : 'text.secondary', display: 'flex' }}>
        {icone[e.type]}
        {e.nouveau && <Box aria-hidden sx={{ position: 'absolute', top: -3, right: -4, width: 10, height: 10, borderRadius: '50%', bgcolor: 'error.main', border: '2px solid', borderColor: 'background.paper' }} />}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
          <Typography variant="body1" sx={{ flex: 1, minWidth: 0, fontWeight: e.nouveau ? 700 : 500 }}>{titre(e)}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{heureCourte(e.date)}</Typography>
        </Box>
        {e.magasins.length > 0 && <Typography variant="body2" color="text.secondary">{e.magasins.join(', ')}</Typography>}
        {e.texte && <Typography variant="body2" color={e.nouveau ? 'text.primary' : 'text.secondary'} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{e.texte}</Typography>}
      </Box>
    </ListItemButton>
    </Glisser>
  )
}

// Notifications : les nouvelles en haut, puis l'historique déjà vu, jour par jour
export function Notifications() {
  const { profil } = useAuth()
  const { reseau } = useReseau()
  const { messagerie, charge, lire } = useMessagerie()
  const naviguer = useNavigate()
  const [filtre, setFiltre] = useState<Filtre>('toutes')
  const [nombre, setNombre] = useState(PAGE)
  const tous = useMemo(() => historique(reseau, profil, messagerie), [reseau, profil, messagerie])
  if (!charge) return <><PageHeader titre="Notifications" /><Typography variant="body2" color="text.secondary">Chargement…</Typography></>
  if (!messagerie) return <><PageHeader titre="Notifications" /><EmptyState icone={<NotificationsOutlined />} titre="Notifications pas encore activées" texte="Les nouveautés de tes magasins apparaîtront ici dès l’activation de la messagerie." /></>

  const retenus = tous.filter((e) => filtre === 'toutes' || e.nouveau)
  const nouvelles = retenus.filter((e) => e.nouveau)
  const vues = retenus.filter((e) => !e.nouveau).slice(0, nombre)
  const restantes = retenus.filter((e) => !e.nouveau).length - vues.length
  const toutLire = () => {
    const lectures = new Map(tous.filter((e) => e.nouveau).map((e) => [JSON.stringify(e.lecture), e.lecture]))
    lectures.forEach((l) => lire(l))
  }
  const ouvrir = (e: Evenement) => naviguer(e.lien)
  return (
    <>
      <PageHeader titre="Notifications" />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Puces valeur={filtre} onChange={setFiltre} label="Notifications affichées"
            options={[{ v: 'toutes', libelle: 'Toutes' }, { v: 'nouvelles', libelle: `Nouvelles${tous.some((e) => e.nouveau) ? ` · ${tous.filter((e) => e.nouveau).length}` : ''}` }]} />
        </Box>
        {tous.some((e) => e.nouveau) && <Box sx={{ mb: 1 }}><BoutonAction libelle="Tout marquer comme lu" icone={<DoneAllOutlined />} onClick={toutLire} secondaire /></Box>}
      </Box>
      {!retenus.length && <EmptyState icone={<NotificationsOutlined />} titre={filtre === 'nouvelles' ? 'Tout est lu' : 'Aucune notification'} texte="Les nouveautés de tes magasins apparaîtront ici." />}
      {nouvelles.length > 0 && (
        <Box component="section" aria-label="Nouvelles" sx={{ mb: 3 }}>
          <Typography variant="overline" component="h2" color="text.secondary" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>Nouvelles</Typography>
          <LignesParPeriode evenements={nouvelles} ouvrir={ouvrir} lire={(e) => lire(e.lecture)} />
        </Box>
      )}
      {vues.length > 0 && (
        <Box component="section" aria-label="Déjà vues">
          <Typography variant="overline" component="h2" color="text.secondary" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>Déjà vues</Typography>
          <LignesParPeriode evenements={vues} ouvrir={ouvrir} />
          {restantes > 0 && <Box sx={{ textAlign: 'center', mt: 1 }}><Button onClick={() => setNombre((n) => n + PAGE)} sx={{ minHeight: 48 }}>Voir plus ({restantes})</Button></Box>}
        </Box>
      )}
    </>
  )
}
