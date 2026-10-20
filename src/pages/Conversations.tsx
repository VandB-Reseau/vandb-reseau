import { useMemo, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import Snackbar from '@mui/material/Snackbar'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AlternateEmail from '@mui/icons-material/AlternateEmail'
import ArrowBack from '@mui/icons-material/ArrowBack'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import { useAuth } from '../auth/AuthContext'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { FilMessages } from '../components/Messages'
import { Bulle, ChampRecherche } from '../components/Outils'
import { PageHeader } from '../components/PageHeader'
import { useMessagerie } from '../data/MessagerieContext'
import { conversations, conversationsPersonnes, heureCourte, lienConversation, lienPersonne, mesCles, type Message, type Messagerie } from '../data/messagerie'
import type { Reseau } from '../data/modele'
import { lienFiche } from '../lib/format'

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr')
const initiales = (nom: string) => nom.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase()
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

// Une ligne commune aux deux classements : par personne et par magasin
interface Ligne { cle: string; titre: string; avatar: ReactNode; detail: string; dernier: Message | null; nonLus: number; mention: boolean; recherche: string; lien: string }

function LigneConversation({ l, mg, avecMagasin, actif, ouvrir }: { l: Ligne; mg: Messagerie; avecMagasin: boolean; actif: boolean; ouvrir: () => void }) {
  const d = l.dernier
  const apercu = d ? `${avecMagasin ? `${d.magasin} · ` : ''}${d.auteur === mg.moi ? 'Moi' : d.auteurNom} : ${d.texte}` : l.detail
  const fort = l.nonLus > 0
  return (
    <ListItemButton selected={actif} onClick={ouvrir} aria-current={actif ? 'true' : undefined}
      aria-label={`${l.titre}${fort ? ` : ${l.nonLus} message${l.nonLus > 1 ? 's' : ''} non lu${l.nonLus > 1 ? 's' : ''}` : ''}`}
      sx={{ borderRadius: 3, mx: 1, mb: 0.25, minHeight: 72, gap: 1.5, alignItems: 'center' }}>
      <Avatar sx={{ width: 44, height: 44, fontSize: '0.9375rem', fontWeight: 600, bgcolor: fort ? 'secondary.main' : 'action.selected', color: fort ? 'secondary.contrastText' : 'text.secondary' }}>{l.avatar}</Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="body1" sx={{ flex: 1, minWidth: 0, fontWeight: fort ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.titre}</Typography>
          {d && <Typography variant="caption" color={fort ? 'text.primary' : 'text.secondary'} sx={{ flexShrink: 0, fontWeight: fort ? 600 : 400 }}>{heureCourte(d.creeLe)}</Typography>}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {d?.equipe && <LockOutlined aria-hidden sx={{ fontSize: 16, color: 'text.secondary' }} />}
          <Typography variant="body2" color={fort ? 'text.primary' : 'text.secondary'} sx={{ flex: 1, minWidth: 0, fontWeight: fort ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apercu}</Typography>
          {l.mention && <AlternateEmail aria-hidden sx={{ fontSize: 18, color: 'error.main' }} />}
          {fort && <Box aria-hidden sx={{ flexShrink: 0, minWidth: 22, height: 22, px: 0.75, borderRadius: 999, bgcolor: 'error.main', color: 'error.contrastText', fontSize: '0.75rem', fontWeight: 700, display: 'grid', placeItems: 'center' }}>{l.nonLus > 99 ? '99+' : l.nonLus}</Box>}
        </Box>
      </Box>
    </ListItemButton>
  )
}

type Vue = 'personnes' | 'magasins'
const PETITE_LISTE = 30

function ListeConversations({ lignes, vue, changerVue, mg, actif, ouvrir }: { lignes: Ligne[]; vue: Vue; changerVue: (v: Vue) => void; mg: Messagerie; actif?: string; ouvrir: (lien: string) => void }) {
  const [recherche, setRecherche] = useState('')
  const [nonLus, setNonLus] = useState(false)
  const q = sansAccents(recherche.trim())
  // Sans recherche : les conversations en cours (toutes les personnes quand elles sont peu nombreuses) ;
  // avec recherche : tout, pour démarrer une conversation
  const toutes = vue === 'personnes' && lignes.length <= PETITE_LISTE
  const affichees = lignes.filter((l) => (q ? sansAccents(l.recherche).includes(q) : toutes || !!l.dernier) && (!nonLus || l.nonLus > 0))
  const aLire = lignes.filter((l) => l.nonLus > 0).length
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <Box sx={{ px: { xs: 0, md: 2 }, pt: { xs: 0, md: 2 }, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <ToggleButtonGroup exclusive fullWidth value={vue} onChange={(_e, v: Vue | null) => { if (v) changerVue(v) }} aria-label="Classer les conversations">
          <ToggleButton value="personnes" sx={{ minHeight: 48, fontSize: '0.875rem' }}>Par personne</ToggleButton>
          <ToggleButton value="magasins" sx={{ minHeight: 48, fontSize: '0.875rem' }}>Par magasin</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Box sx={{ flex: 1, minWidth: 0, '& .MuiTextField-root': { width: '100%' } }}>
            <ChampRecherche valeur={recherche} onChange={setRecherche} placeholder={vue === 'personnes' ? 'Rechercher une personne' : 'Rechercher un magasin'} />
          </Box>
          <Chip label={aLire ? `Non lus · ${aLire}` : 'Non lus'} onClick={() => setNonLus((v) => !v)} aria-pressed={nonLus}
            color={nonLus ? 'primary' : 'default'} variant={nonLus ? 'filled' : 'outlined'} sx={{ height: 48, borderRadius: 999, fontSize: '0.875rem' }} />
        </Box>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: { md: 'auto' }, mx: { xs: -1, md: 0 }, pb: 1 }}>
        {!affichees.length
          ? <EmptyState icone={<ForumOutlined />} titre={q ? 'Aucun résultat' : nonLus ? 'Tout est lu' : 'Aucune conversation'}
            texte={q ? 'Vérifie l’orthographe du nom.' : nonLus ? 'Aucun message en attente.' : 'Les échanges sur tes magasins apparaîtront ici.'} />
          : <List aria-label="Conversations" disablePadding>{affichees.map((l) => <LigneConversation key={l.cle} l={l} mg={mg} avecMagasin={vue === 'personnes'} actif={l.cle === actif} ouvrir={() => ouvrir(l.lien)} />)}</List>}
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
  const { nom, cle } = useParams()
  const [params] = useSearchParams()
  const naviguer = useNavigate()
  const { profil } = useAuth()
  const { messagerie, charge } = useMessagerie()
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const [confirmation, setConfirmation] = useState('')
  const vue: Vue = nom ? 'magasins' : cle ? 'personnes' : params.get('vue') === 'magasins' ? 'magasins' : 'personnes'
  const cles = useMemo(() => mesCles(profil), [profil])
  const personnes = useMemo(() => (messagerie ? conversationsPersonnes(reseau, messagerie, profil) : []), [reseau, messagerie, profil])
  const lignes = useMemo<Ligne[]>(() => {
    if (!messagerie) return []
    if (vue === 'magasins') {
      return conversations(reseau, messagerie, cles).map((c) => ({
        cle: c.magasin.nom, titre: c.magasin.nom, avatar: <StorefrontOutlined />, dernier: c.dernier, nonLus: c.nonLus, mention: c.mention,
        detail: [c.magasin.ville, c.magasin.coach && `Coach ${c.magasin.coach}`].filter(Boolean).join(' · '),
        recherche: `${c.magasin.nom} ${c.magasin.ville ?? ''}`, lien: lienConversation(c.magasin.nom),
      }))
    }
    return personnes.map((c) => ({
      cle: c.contact.cle, titre: c.contact.nom, avatar: initiales(c.contact.nom), dernier: c.dernier, nonLus: c.nonLus, mention: c.mention,
      detail: `${c.contact.role} · ${c.contact.magasins.length > 1 ? pluriel(c.contact.magasins.length, 'magasin') : c.contact.magasins[0]?.nom ?? ''}`,
      recherche: `${c.contact.nom} ${c.contact.magasins.map((m) => m.nom).join(' ')}`, lien: lienPersonne(c.contact.cle),
    }))
  }, [reseau, messagerie, cles, personnes, vue])
  const contact = cle ? personnes.find((c) => c.contact.cle === cle)?.contact : undefined
  const m = nom ? reseau.magasins.find((x) => x.nom === nom) : undefined
  const choisi = nom ?? cle
  const ouvrir = (lien: string) => naviguer(lien, { replace: surPC && !!choisi })
  const changerVue = (v: Vue) => naviguer(v === 'magasins' ? '/messages?vue=magasins' : '/messages', { replace: true })
  const message = <Snackbar open={!!confirmation} autoHideDuration={5000} onClose={() => setConfirmation('')} message={confirmation} />

  if (!charge) return <Typography variant="body2" color="text.secondary">Chargement des messages…</Typography>
  if (!messagerie) return <><PageHeader titre="Messages" /><EmptyState icone={<ForumOutlined />} titre="Messagerie pas encore activée" texte="Les conversations apparaîtront ici dès son activation dans la base." /></>
  if ((nom && !m) || (cle && !contact)) {
    return <EmptyState icone={<ForumOutlined />} titre="Conversation introuvable" texte={nom ? 'Ce magasin ne fait pas partie de tes magasins.' : 'Cette personne ne partage aucun magasin avec toi.'}
      action={<Button variant="contained" onClick={() => naviguer('/messages')} sx={{ minHeight: 48 }}>Voir les conversations</Button>} />
  }

  const ficheMagasin = m && <Bulle titre="Fiche du magasin"><IconButton onClick={() => naviguer(lienFiche(m.nom))} aria-label="Fiche du magasin" sx={{ width: 48, height: 48 }}><StorefrontOutlined /></IconButton></Bulle>
  const titre = m ? m.nom : contact?.nom ?? ''
  const detail = m ? [m.ville, m.coach && `Coach ${m.coach}`].filter(Boolean).join(' · ') : contact ? `${contact.role} · ${contact.magasins.map((x) => x.nom).join(', ')}` : ''
  const fil = (cadre: boolean) => (
    <FilMessages key={choisi} reseau={reseau} m={m} contact={contact} signaler={setConfirmation} lectureSeule={lectureSeule}
      cadre={cadre} aLaFin={!cadre} fond={cadre ? 'background.paper' : 'background.default'} />
  )
  const liste = <ListeConversations key={vue} lignes={lignes} vue={vue} changerVue={changerVue} mg={messagerie} actif={choisi} ouvrir={ouvrir} />

  if (!surPC) {
    if (!choisi) return <><PageHeader titre="Messages" />{liste}</>
    return (
      <>
        <Box sx={{ position: 'sticky', top: 64, zIndex: 3, bgcolor: 'background.default', mx: -2, px: 2, mt: -3, borderBottom: '1px solid', borderColor: 'divider' }}>
          <EnTete titre={titre} detail={detail} niveau="h1" action={ficheMagasin}
            retour={() => (window.history.length > 1 ? naviguer(-1) : naviguer(vue === 'magasins' ? '/messages?vue=magasins' : '/messages'))} />
        </Box>
        {fil(false)}
        {message}
      </>
    )
  }

  // PC : la liste à gauche, la conversation à droite ; sans choix, la plus récente
  const recente = lignes.find((l) => l.dernier)
  if (!choisi && recente) return <Navigate to={recente.lien} replace />
  return (
    <>
      <PageHeader titre="Messages" />
      <Box sx={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: 2, height: 'calc(100dvh - 72px - 64px - 84px)', minHeight: 480 }}>
        <Card sx={{ minHeight: 0 }}>{liste}</Card>
        <Card sx={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {choisi
            ? <>
              <Box sx={{ px: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}><EnTete titre={titre} detail={detail} niveau="h2" action={ficheMagasin} /></Box>
              <Box sx={{ flex: 1, minHeight: 0 }}>{fil(true)}</Box>
            </>
            : <EmptyState icone={<ForumOutlined />} titre="Aucune conversation" texte="Les échanges sur tes magasins apparaîtront ici." />}
        </Card>
      </Box>
      {message}
    </>
  )
}

// Messages : conversations par personne (sur tous les magasins partagés) ou par magasin, la plus récente d'abord
export function Conversations({ lectureSeule = false }: { lectureSeule?: boolean }) {
  return <AvecReseau>{(reseau) => <Contenu reseau={reseau} lectureSeule={lectureSeule} />}</AvecReseau>
}
