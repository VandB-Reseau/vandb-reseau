import { useMemo, useState, type ReactNode } from 'react'
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
import ArrowBack from '@mui/icons-material/ArrowBack'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import { useAuth } from '../auth/AuthContext'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { FilMessages } from '../components/Messages'
import { Bulle, ChampRecherche } from '../components/Outils'
import { PageHeader } from '../components/PageHeader'
import { useMessagerie } from '../data/MessagerieContext'
import { conversationsPersonnes, heureCourte, lienPersonne, sansPrives, type Contact, type ConversationPersonne, type Messagerie } from '../data/messagerie'
import type { Reseau } from '../data/modele'
import { lienFiche } from '../lib/format'

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr')
const initiales = (nom: string) => nom.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase()
const detailContact = (c: Contact) => [c.role, c.magasins.length > 3 ? `${c.magasins.length} magasins` : c.magasins.map((m) => m.nom).join(', ')].filter(Boolean).join(' · ')

function LigneConversation({ c, mg, actif, ouvrir }: { c: ConversationPersonne; mg: Messagerie; actif: boolean; ouvrir: () => void }) {
  const d = c.dernier
  const apercu = d ? `${d.auteur === mg.moi ? 'Moi : ' : ''}${d.texte}` : detailContact(c.contact)
  const fort = c.nonLus > 0
  return (
    <ListItemButton selected={actif} onClick={ouvrir} aria-current={actif ? 'true' : undefined}
      aria-label={`${c.contact.nom}${fort ? ` : ${c.nonLus} message${c.nonLus > 1 ? 's' : ''} non lu${c.nonLus > 1 ? 's' : ''}` : ''}`}
      sx={{ borderRadius: 3, mx: 1, mb: 0.25, minHeight: 72, gap: 1.5, alignItems: 'center' }}>
      <Avatar sx={{ width: 44, height: 44, fontSize: '0.9375rem', fontWeight: 600, bgcolor: fort ? 'secondary.main' : 'action.selected', color: fort ? 'secondary.contrastText' : 'text.secondary' }}>{initiales(c.contact.nom)}</Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="body1" sx={{ flex: 1, minWidth: 0, fontWeight: fort ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.contact.nom}</Typography>
          {d && <Typography variant="caption" color={fort ? 'text.primary' : 'text.secondary'} sx={{ flexShrink: 0, fontWeight: fort ? 600 : 400 }}>{heureCourte(d.creeLe)}</Typography>}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color={fort ? 'text.primary' : 'text.secondary'} sx={{ flex: 1, minWidth: 0, fontWeight: fort ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apercu}</Typography>
          {fort && <Box aria-hidden sx={{ flexShrink: 0, minWidth: 22, height: 22, px: 0.75, borderRadius: 999, bgcolor: 'error.main', color: 'error.contrastText', fontSize: '0.75rem', fontWeight: 700, display: 'grid', placeItems: 'center' }}>{c.nonLus > 99 ? '99+' : c.nonLus}</Box>}
        </Box>
      </Box>
    </ListItemButton>
  )
}

const PETITE_LISTE = 30

function ListeConversations({ lignes, mg, actif, ouvrir }: { lignes: ConversationPersonne[]; mg: Messagerie; actif?: string; ouvrir: (lien: string) => void }) {
  const [recherche, setRecherche] = useState('')
  const [nonLus, setNonLus] = useState(false)
  const q = sansAccents(recherche.trim())
  // Sans recherche : les conversations en cours (toutes les personnes quand elles sont peu nombreuses) ;
  // avec recherche (nom ou magasin) : tout, pour démarrer une conversation
  const toutes = lignes.length <= PETITE_LISTE
  const affichees = lignes.filter((l) => (q ? sansAccents(`${l.contact.nom} ${l.contact.magasins.map((m) => `${m.nom} ${m.ville ?? ''}`).join(' ')}`).includes(q) : toutes || !!l.dernier) && (!nonLus || l.nonLus > 0))
  const aLire = lignes.filter((l) => l.nonLus > 0).length
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <Box sx={{ px: { xs: 0, md: 2 }, pt: { xs: 0, md: 2 }, pb: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
        <Box sx={{ flex: 1, minWidth: 0, '& .MuiTextField-root': { width: '100%' } }}>
          <ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Personne ou magasin" />
        </Box>
        <Chip label={aLire ? `Non lus · ${aLire}` : 'Non lus'} onClick={() => setNonLus((v) => !v)} aria-pressed={nonLus}
          color={nonLus ? 'primary' : 'default'} variant={nonLus ? 'filled' : 'outlined'} sx={{ height: 48, borderRadius: 999, fontSize: '0.875rem' }} />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: { md: 'auto' }, mx: { xs: -1, md: 0 }, pb: 1 }}>
        {!affichees.length
          ? <EmptyState icone={<ForumOutlined />} titre={q ? 'Aucun résultat' : nonLus ? 'Tout est lu' : 'Aucune conversation'}
            texte={q ? 'Vérifie l’orthographe du nom.' : nonLus ? 'Aucun message en attente.' : 'Tes échanges apparaîtront ici.'} />
          : <List aria-label="Conversations" disablePadding>{affichees.map((l) => <LigneConversation key={l.contact.cle} c={l} mg={mg} actif={l.contact.cle === actif} ouvrir={() => ouvrir(lienPersonne(l.contact.cle))} />)}</List>}
      </Box>
    </Box>
  )
}

function EnTete({ titre, detail, retour, niveau, action }: { titre: string; detail: string; retour?: () => void; niveau: 'h1' | 'h2'; action?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 64 }}>
      {retour && <Bulle titre="Conversations"><IconButton onClick={retour} aria-label="Conversations" sx={{ width: 48, height: 48, ml: -1 }}><ArrowBack /></IconButton></Bulle>}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h3" component={niveau} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titre}</Typography>
        {detail && <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</Typography>}
      </Box>
      {action}
    </Box>
  )
}

function Contenu({ reseau, lectureSeule }: { reseau: Reseau; lectureSeule: boolean }) {
  const { cle } = useParams()
  const naviguer = useNavigate()
  const { profil } = useAuth()
  const { messagerie: brute, charge } = useMessagerie()
  const messagerie = useMemo(() => (brute && lectureSeule ? sansPrives(brute) : brute), [brute, lectureSeule])
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const [confirmation, setConfirmation] = useState('')
  const lignes = useMemo(() => (messagerie ? conversationsPersonnes(reseau, messagerie, profil) : []), [reseau, messagerie, profil])
  const contact = cle ? lignes.find((c) => c.contact.cle === cle)?.contact : undefined
  const ouvrir = (lien: string) => naviguer(lien, { replace: surPC && !!cle })
  const message = <Snackbar open={!!confirmation} autoHideDuration={5000} onClose={() => setConfirmation('')} message={confirmation} />

  if (!charge) return <Typography variant="body2" color="text.secondary">Chargement des messages…</Typography>
  if (!messagerie) return <><PageHeader titre="Messages" /><EmptyState icone={<ForumOutlined />} titre="Messagerie pas encore activée" texte="Les conversations apparaîtront ici dès son activation dans la base." /></>
  if (cle && !contact) {
    return <EmptyState icone={<ForumOutlined />} titre="Conversation introuvable" texte="Cette personne ne partage aucun magasin avec toi."
      action={<Button variant="contained" onClick={() => naviguer('/messages')} sx={{ minHeight: 48 }}>Voir les conversations</Button>} />
  }

  const fil = (cadre: boolean) => contact && (
    <FilMessages key={contact.cle} reseau={reseau} contact={contact} signaler={setConfirmation} lectureSeule={lectureSeule}
      cadre={cadre} aLaFin={!cadre} fond={cadre ? 'background.paper' : 'background.default'} />
  )
  const liste = <ListeConversations lignes={lignes} mg={messagerie} actif={cle} ouvrir={ouvrir} />

  if (!surPC) {
    if (!contact) return <><PageHeader titre="Messages" />{liste}</>
    return (
      <>
        <Box sx={{ position: 'sticky', top: 64, zIndex: 3, bgcolor: 'background.default', mx: -2, px: 2, mt: -3, borderBottom: '1px solid', borderColor: 'divider' }}>
          <EnTete titre={contact.nom} detail={detailContact(contact)} niveau="h1" retour={() => (window.history.length > 1 ? naviguer(-1) : naviguer('/messages'))} />
        </Box>
        {fil(false)}
        {message}
      </>
    )
  }

  // PC : la liste à gauche, la conversation à droite ; sans choix, la plus récente
  const recente = lignes.find((l) => l.dernier)
  if (!contact && recente) return <Navigate to={lienPersonne(recente.contact.cle)} replace />
  return (
    <>
      <PageHeader titre="Messages" />
      <Box sx={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: 2, height: 'calc(100dvh - 72px - 64px - 84px)', minHeight: 480 }}>
        <Card sx={{ minHeight: 0 }}>{liste}</Card>
        <Card sx={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {contact
            ? <>
              <Box sx={{ px: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}><EnTete titre={contact.nom} detail={detailContact(contact)} niveau="h2" /></Box>
              <Box sx={{ flex: 1, minHeight: 0 }}>{fil(true)}</Box>
            </>
            : <EmptyState icone={<ForumOutlined />} titre="Aucune conversation" texte="Choisis une personne pour lui écrire." />}
        </Card>
      </Box>
      {message}
    </>
  )
}

// Ancien lien vers les messages d'un magasin : l'onglet Messages de sa fiche
function VersFiche() {
  const { nom } = useParams()
  return <Navigate to={nom ? `${lienFiche(nom)}?vue=messages` : '/messages'} replace />
}

// Messages : une conversation par personne, la plus récente d'abord ; /messages/:nom renvoie à la fiche du magasin
export function Conversations({ lectureSeule = false }: { lectureSeule?: boolean }) {
  const { nom } = useParams()
  if (nom) return <VersFiche />
  return <AvecReseau>{(reseau) => <Contenu reseau={reseau} lectureSeule={lectureSeule} />}</AvecReseau>
}
