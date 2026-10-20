import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AlternateEmail from '@mui/icons-material/AlternateEmail'
import ArrowBack from '@mui/icons-material/ArrowBack'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import { useAuth } from '../auth/AuthContext'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { FilMessages } from '../components/Messages'
import { Bulle, ChampRecherche } from '../components/Outils'
import { PageHeader } from '../components/PageHeader'
import { useMessagerie } from '../data/MessagerieContext'
import { conversations, heureCourte, lienConversation, mesCles, type Conversation, type Messagerie } from '../data/messagerie'
import type { Reseau } from '../data/modele'
import { lienFiche } from '../lib/format'

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr')

function LigneConversation({ c, mg, actif, ouvrir }: { c: Conversation; mg: Messagerie; actif: boolean; ouvrir: () => void }) {
  const d = c.dernier
  const apercu = d ? `${d.auteur === mg.moi ? 'Moi' : d.auteurNom} : ${d.texte}` : [c.magasin.ville, c.magasin.coach && `Coach ${c.magasin.coach}`].filter(Boolean).join(' · ')
  const fort = c.nonLus > 0
  return (
    <ListItemButton selected={actif} onClick={ouvrir} aria-current={actif ? 'true' : undefined}
      aria-label={`${c.magasin.nom}${fort ? ` : ${c.nonLus} message${c.nonLus > 1 ? 's' : ''} non lu${c.nonLus > 1 ? 's' : ''}` : ''}`}
      sx={{ borderRadius: 3, mx: 1, mb: 0.25, minHeight: 72, gap: 1.5, alignItems: 'center' }}>
      <Avatar sx={{ width: 44, height: 44, bgcolor: fort ? 'secondary.main' : 'action.selected', color: fort ? 'secondary.contrastText' : 'text.secondary' }}><StorefrontOutlined /></Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="body1" sx={{ flex: 1, minWidth: 0, fontWeight: fort ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.magasin.nom}</Typography>
          {d && <Typography variant="caption" color={fort ? 'text.primary' : 'text.secondary'} sx={{ flexShrink: 0, fontWeight: fort ? 600 : 400 }}>{heureCourte(d.creeLe)}</Typography>}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color={fort ? 'text.primary' : 'text.secondary'} sx={{ flex: 1, minWidth: 0, fontWeight: fort ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apercu}</Typography>
          {c.mention && <AlternateEmail aria-hidden sx={{ fontSize: 18, color: 'error.main' }} />}
          {fort && <Box aria-hidden sx={{ flexShrink: 0, minWidth: 22, height: 22, px: 0.75, borderRadius: 999, bgcolor: 'error.main', color: 'error.contrastText', fontSize: '0.75rem', fontWeight: 700, display: 'grid', placeItems: 'center' }}>{c.nonLus > 99 ? '99+' : c.nonLus}</Box>}
        </Box>
      </Box>
    </ListItemButton>
  )
}

function ListeConversations({ liste, mg, actif, ouvrir }: { liste: Conversation[]; mg: Messagerie; actif?: string; ouvrir: (nom: string) => void }) {
  const [recherche, setRecherche] = useState('')
  const [nonLus, setNonLus] = useState(false)
  const q = sansAccents(recherche.trim())
  // Sans recherche : les conversations en cours ; avec recherche : tous les magasins, pour en démarrer une
  const affichees = liste.filter((c) => (q ? sansAccents(`${c.magasin.nom} ${c.magasin.ville ?? ''}`).includes(q) : !!c.dernier) && (!nonLus || c.nonLus > 0))
  const aLire = liste.filter((c) => c.nonLus > 0).length
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', px: { xs: 0, md: 2 }, pt: { xs: 0, md: 2 }, pb: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0, '& .MuiTextField-root': { width: '100%' } }}><ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher un magasin" /></Box>
        <Chip label={aLire ? `Non lus · ${aLire}` : 'Non lus'} onClick={() => setNonLus((v) => !v)} aria-pressed={nonLus}
          color={nonLus ? 'primary' : 'default'} variant={nonLus ? 'filled' : 'outlined'} sx={{ height: 48, borderRadius: 999, fontSize: '0.875rem' }} />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: { md: 'auto' }, mx: { xs: -1, md: 0 }, pb: 1 }}>
        {!affichees.length
          ? <EmptyState icone={<ForumOutlined />} titre={q ? 'Aucun magasin trouvé' : nonLus ? 'Tout est lu' : 'Aucune conversation'}
            texte={q ? 'Vérifie l’orthographe du magasin ou de la ville.' : nonLus ? 'Aucun message en attente.' : 'Les échanges sur tes magasins apparaîtront ici.'} />
          : <List aria-label="Conversations" disablePadding>{affichees.map((c) => <LigneConversation key={c.magasin.nom} c={c} mg={mg} actif={c.magasin.nom === actif} ouvrir={() => ouvrir(c.magasin.nom)} />)}</List>}
      </Box>
    </Box>
  )
}

function EnTeteConversation({ reseau, nom, retour, niveau }: { reseau: Reseau; nom: string; retour?: () => void; niveau: 'h1' | 'h2' }) {
  const naviguer = useNavigate()
  const m = reseau.magasins.find((x) => x.nom === nom)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 64 }}>
      {retour && <Bulle titre="Conversations"><IconButton onClick={retour} aria-label="Conversations" sx={{ width: 48, height: 48, ml: -1 }}><ArrowBack /></IconButton></Bulle>}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h3" component={niveau} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom}</Typography>
        {m && <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[m.ville, m.coach && `Coach ${m.coach}`].filter(Boolean).join(' · ')}</Typography>}
      </Box>
      <Bulle titre="Fiche du magasin"><IconButton onClick={() => naviguer(lienFiche(nom))} aria-label="Fiche du magasin" sx={{ width: 48, height: 48 }}><StorefrontOutlined /></IconButton></Bulle>
    </Box>
  )
}

function Contenu({ reseau, lectureSeule }: { reseau: Reseau; lectureSeule: boolean }) {
  const { nom } = useParams()
  const naviguer = useNavigate()
  const { profil } = useAuth()
  const { messagerie, charge } = useMessagerie()
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const [confirmation, setConfirmation] = useState('')
  const cles = useMemo(() => mesCles(profil), [profil])
  const liste = useMemo(() => (messagerie ? conversations(reseau, messagerie, cles) : []), [reseau, messagerie, cles])
  const ouvrir = (n: string) => naviguer(lienConversation(n), { replace: surPC && !!nom })
  const m = nom ? reseau.magasins.find((x) => x.nom === nom) : undefined
  const message = <Snackbar open={!!confirmation} autoHideDuration={5000} onClose={() => setConfirmation('')} message={confirmation} />

  if (!charge) return <Typography variant="body2" color="text.secondary">Chargement des messages…</Typography>
  if (!messagerie) return <><PageHeader titre="Messages" /><EmptyState icone={<ForumOutlined />} titre="Messagerie pas encore activée" texte="Les conversations apparaîtront ici dès son activation dans la base." /></>
  if (nom && !m) {
    return <EmptyState icone={<StorefrontOutlined />} titre="Magasin introuvable" texte="Ce magasin ne fait pas partie de tes magasins."
      action={<Button variant="contained" onClick={() => naviguer('/messages')} sx={{ minHeight: 48 }}>Voir les conversations</Button>} />
  }

  if (!surPC) {
    if (!m) return <><PageHeader titre="Messages" /><ListeConversations liste={liste} mg={messagerie} ouvrir={ouvrir} /></>
    return (
      <>
        <Box sx={{ position: 'sticky', top: 64, zIndex: 3, bgcolor: 'background.default', mx: -2, px: 2, mt: -3, borderBottom: '1px solid', borderColor: 'divider' }}>
          <EnTeteConversation reseau={reseau} nom={m.nom} retour={() => (window.history.length > 1 ? naviguer(-1) : naviguer('/messages'))} niveau="h1" />
        </Box>
        <FilMessages key={m.nom} reseau={reseau} m={m} signaler={setConfirmation} lectureSeule={lectureSeule} aLaFin fond="background.default" />
        {message}
      </>
    )
  }

  // PC : la liste à gauche, la conversation à droite ; sans magasin choisi, la plus récente
  const recente = liste.find((c) => c.dernier)?.magasin
  if (!m && recente) return <Navigate to={lienConversation(recente.nom)} replace />
  return (
    <>
      <PageHeader titre="Messages" />
      <Box sx={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: 2, height: 'calc(100dvh - 72px - 64px - 84px)', minHeight: 480 }}>
        <Card sx={{ minHeight: 0 }}><ListeConversations liste={liste} mg={messagerie} actif={m?.nom} ouvrir={ouvrir} /></Card>
        <Card sx={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {m
            ? <>
              <Box sx={{ px: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}><EnTeteConversation reseau={reseau} nom={m.nom} niveau="h2" /></Box>
              <Box sx={{ flex: 1, minHeight: 0 }}><FilMessages key={m.nom} reseau={reseau} m={m} signaler={setConfirmation} lectureSeule={lectureSeule} cadre /></Box>
            </>
            : <EmptyState icone={<ForumOutlined />} titre="Aucune conversation" texte="Cherche un magasin pour lui écrire." />}
        </Card>
      </Box>
      {message}
    </>
  )
}

// Messages : conversations par magasin, la plus récente d'abord, et le fil du magasin choisi
export function Conversations({ lectureSeule = false }: { lectureSeule?: boolean }) {
  return <AvecReseau>{(reseau) => <Contenu reseau={reseau} lectureSeule={lectureSeule} />}</AvecReseau>
}
