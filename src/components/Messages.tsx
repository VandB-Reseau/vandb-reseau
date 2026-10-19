import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AlternateEmail from '@mui/icons-material/AlternateEmail'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined'
import SendOutlined from '@mui/icons-material/SendOutlined'
import { useAuth } from '../auth/AuthContext'
import { useMessagerie } from '../data/MessagerieContext'
import { useReseau } from '../data/ReseauContext'
import { derniereLecture, horodatage, libelleAuteur, libelleNotification, mentionsDans, messagesDu, notifications, participants, type Message, type Notification, type Participant } from '../data/messagerie'
import type { Magasin, Reseau } from '../data/modele'
import { EmptyState } from './EmptyState'

const MAXI = 30
const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr')

// Texte d'un message, mentions en gras
function Texte({ texte, noms }: { texte: string; noms: string[] }) {
  const tries = [...noms].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!tries.length) return <>{texte}</>
  const morceaux = texte.split(new RegExp(`(@(?:${tries.join('|')}))`, 'gi'))
  return <>{morceaux.map((x, i) => (i % 2 ? <Box key={i} component="strong" sx={{ fontWeight: 700 }}>{x}</Box> : <Fragment key={i}>{x}</Fragment>))}</>
}

function Bulle({ msg, moi, noms, supprimer }: { msg: Message; moi: boolean; noms: string[]; supprimer?: () => void }) {
  return (
    <Box component="li" aria-label={`Message de ${msg.auteurNom}`} sx={{ display: 'flex', justifyContent: moi ? 'flex-end' : 'flex-start', py: 0.75 }}>
      <Box sx={{ maxWidth: { xs: '92%', md: '75%' }, bgcolor: moi ? 'action.selected' : 'action.hover', borderRadius: 2, px: 2, py: 1.25, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" component="p">{moi ? 'Moi' : msg.auteurNom}</Typography>
          {!moi && libelleAuteur[msg.auteurRole] && <Typography variant="caption" color="text.secondary">{libelleAuteur[msg.auteurRole]}</Typography>}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>{horodatage(msg.creeLe)}</Typography>
          {supprimer && <Tooltip title="Supprimer"><IconButton onClick={supprimer} aria-label={`Supprimer mon message du ${horodatage(msg.creeLe)}`} sx={{ width: 40, height: 40, mr: -1, my: -0.5 }}><DeleteOutlined fontSize="small" /></IconButton></Tooltip>}
        </Box>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', mt: 0.25 }}><Texte texte={msg.texte} noms={noms} /></Typography>
      </Box>
    </Box>
  )
}

// Fil de messages d'un magasin ; lectureSeule : aperçu de l'espace d'un franchisé par le Directeur de réseau
export function FilMessages({ reseau, m, signaler, lectureSeule = false }: { reseau: Reseau; m: Magasin; signaler: (msg: string) => void; lectureSeule?: boolean }) {
  const { messagerie, charge, envoyer, supprimer, marquerLu } = useMessagerie()
  const [texte, setTexte] = useState('')
  const [curseur, setCurseur] = useState(0)
  const [envoi, setEnvoi] = useState(false)
  const [tous, setTous] = useState(false)
  const champ = useRef<HTMLTextAreaElement | null>(null)
  const liste = messagesDu(messagerie, m.nom)
  const gens = useMemo(() => participants(reseau, m), [reseau, m])
  const noms = gens.map((p) => p.nom)
  // Séparateur « Nouveaux messages » : dernière lecture à l'ouverture du fil
  const [luAvant, setLuAvant] = useState<number | null>(null)
  const aLire = !!messagerie && liste.some((x) => x.auteur !== messagerie.moi && Date.parse(x.creeLe) > derniereLecture(messagerie, m.nom, 'messages'))
  useEffect(() => {
    if (messagerie && luAvant === null) setLuAvant(derniereLecture(messagerie, m.nom, 'messages'))
    if (aLire && !lectureSeule) marquerLu(m.nom, 'messages')
  }, [messagerie, luAvant, aLire, lectureSeule, marquerLu, m.nom])

  // Suggestions après « @ »
  const avant = texte.slice(0, curseur)
  const recherche = avant.match(/(?:^|\s)@([^@\n]{0,30})$/)?.[1]
  const suggestions = recherche === undefined ? [] : gens.filter((p) => sansAccents(p.nom).includes(sansAccents(recherche.trimStart())) && !avant.endsWith(`@${p.nom} `))
  const choisir = (p: Participant) => {
    const debut = avant.slice(0, avant.length - (recherche?.length ?? 0) - 1)
    const nouveau = `${debut}@${p.nom} ${texte.slice(curseur)}`
    setTexte(nouveau)
    const pos = debut.length + p.nom.length + 2
    setCurseur(pos)
    requestAnimationFrame(() => { champ.current?.focus(); champ.current?.setSelectionRange(pos, pos) })
  }
  const mentionner = () => {
    const nouveau = `${texte.slice(0, curseur)}${curseur > 0 && !/\s$/.test(texte.slice(0, curseur)) ? ' ' : ''}@${texte.slice(curseur)}`
    const pos = nouveau.length - texte.slice(curseur).length
    setTexte(nouveau); setCurseur(pos)
    requestAnimationFrame(() => { champ.current?.focus(); champ.current?.setSelectionRange(pos, pos) })
  }
  const valider = async () => {
    if (!texte.trim() || envoi) return
    setEnvoi(true)
    try {
      await envoyer(m.nom, texte.trim(), mentionsDans(texte, gens))
      setTexte(''); setCurseur(0)
    } catch {
      signaler('Message non envoyé. Réessaie dans un instant.')
    } finally {
      setEnvoi(false)
    }
  }
  const touche = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void valider() }
  }

  if (!charge) return <Typography variant="body2" color="text.secondary">Chargement des messages…</Typography>
  if (!messagerie) return <EmptyState icone={<ForumOutlined />} titre="Messagerie pas encore activée" texte="Les messages de ce magasin apparaîtront ici dès son activation dans la base." />

  const affiches = tous ? liste : liste.slice(-MAXI)
  const premierNouveau = affiches.find((x) => x.auteur !== messagerie.moi && Date.parse(x.creeLe) > (luAvant ?? Infinity))
  return (
    <Box>
      {liste.length > MAXI && !tous && <Button onClick={() => setTous(true)} sx={{ minHeight: 48, mb: 1 }}>Voir les {liste.length} messages</Button>}
      {!liste.length
        ? <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Aucun message sur ce magasin.</Typography>
        : (
          <Box component="ul" aria-label={`Messages de ${m.nom}`} sx={{ listStyle: 'none', m: 0, p: 0, mb: 2 }}>
            {affiches.map((x) => (
              <Fragment key={x.id}>
                {x === premierNouveau && <Box component="li" aria-hidden sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1 }}>
                  <Divider sx={{ flex: 1, borderColor: 'error.main' }} /><Typography variant="caption" color="error" sx={{ fontWeight: 600 }}>Nouveaux messages</Typography><Divider sx={{ flex: 1, borderColor: 'error.main' }} />
                </Box>}
                <Bulle msg={x} moi={x.auteur === messagerie.moi} noms={noms}
                  supprimer={x.auteur === messagerie.moi && !lectureSeule ? () => { supprimer(x.id).then(() => signaler('Message supprimé.'), () => signaler('Suppression impossible pour le moment. Réessaie dans un instant.')) } : undefined} />
              </Fragment>
            ))}
          </Box>
        )}
      {!lectureSeule && (
        <Box sx={{ position: 'relative' }}>
          <TextField label="Message" multiline minRows={2} maxRows={10} fullWidth value={texte} inputRef={champ}
            onChange={(e) => { setTexte(e.target.value); setCurseur(e.target.selectionStart ?? e.target.value.length) }}
            onSelect={(e) => setCurseur((e.target as HTMLTextAreaElement).selectionStart ?? 0)} onKeyDown={touche}
            slotProps={{ htmlInput: { maxLength: 4000 } }} />
          {suggestions.length > 0 && (
            <Paper elevation={4} sx={{ position: 'absolute', left: 0, right: 0, bottom: '100%', mb: 0.5, zIndex: 2, maxHeight: 288, overflowY: 'auto' }}>
              <List dense aria-label="Personnes à mentionner" disablePadding>
                {suggestions.map((p) => (
                  <ListItemButton key={p.cle} onMouseDown={(e) => e.preventDefault()} onClick={() => choisir(p)} sx={{ minHeight: 48 }}>
                    <ListItemText primary={p.nom} secondary={p.role} slotProps={{ secondary: { sx: { fontSize: '0.75rem' } } }} />
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <Tooltip title="Mentionner"><IconButton onClick={mentionner} aria-label="Mentionner quelqu’un" sx={{ width: 48, height: 48 }}><AlternateEmail /></IconButton></Tooltip>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" startIcon={<SendOutlined />} onClick={() => void valider()} disabled={!texte.trim() || envoi} sx={{ minHeight: 48 }}>Envoyer</Button>
          </Box>
        </Box>
      )}
    </Box>
  )
}

// Messages non lus d'un magasin (pastille de l'onglet)
export function useNonLusMagasin(magasin: string): number {
  const { messagerie } = useMessagerie()
  if (!messagerie) return 0
  const lu = derniereLecture(messagerie, magasin, 'messages')
  return messagesDu(messagerie, magasin).filter((x) => x.auteur !== messagerie.moi && Date.parse(x.creeLe) > lu).length
}

const iconeNotification = { message: <ForumOutlined />, mention: <AlternateEmail />, visite: <EventNoteOutlined /> }

// Cloche de l'en-tête : nouveautés du compte connecté
export function Cloche() {
  const { profil } = useAuth()
  const { reseau } = useReseau()
  const { messagerie, marquerLu } = useMessagerie()
  const naviguer = useNavigate()
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  const liste = useMemo(() => notifications(reseau, profil, messagerie), [reseau, profil, messagerie])
  if (!messagerie) return null
  const ouvrir = (n: Notification) => { setAncre(null); naviguer(n.lien) }
  const toutLire = () => { liste.forEach((n) => marquerLu(n.magasin, n.sujet)); setAncre(null) }
  return (
    <>
      <IconButton aria-label={liste.length ? `Notifications : ${liste.length} nouveauté${liste.length > 1 ? 's' : ''}` : 'Notifications'} onClick={(e) => setAncre(e.currentTarget)} sx={{ color: '#ffffff', width: 48, height: 48 }}>
        <Badge color="error" badgeContent={liste.length} max={99} sx={{ '& .MuiBadge-badge': { fontSize: '0.75rem' } }}><NotificationsOutlined /></Badge>
      </IconButton>
      <Menu anchorEl={ancre} open={!!ancre} onClose={() => setAncre(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 380, maxWidth: 'calc(100vw - 32px)' } }, list: { 'aria-label': 'Notifications' } }}>
        <Box sx={{ px: 2, py: 1 }}><Typography variant="subtitle2" component="p">Notifications</Typography></Box>
        <Divider />
        {!liste.length && <Box sx={{ px: 2, py: 2 }}><Typography variant="body2" color="text.secondary">Aucune nouveauté.</Typography></Box>}
        {liste.map((n) => (
          <ListItemButton key={n.cle} onClick={() => ouvrir(n)} sx={{ minHeight: 56, alignItems: 'flex-start' }}>
            <ListItemIcon sx={{ minWidth: 40, mt: 0.5, color: n.type === 'mention' ? 'error.main' : 'text.secondary' }}>{iconeNotification[n.type]}</ListItemIcon>
            <ListItemText primary={n.magasin}
              secondary={<>
                <Box component="span" sx={{ display: 'block', fontWeight: 600, color: 'text.primary' }}>{libelleNotification(n)}</Box>
                {n.apercu && <Box component="span" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.apercu}</Box>}
                <Box component="span" sx={{ display: 'block', fontSize: '0.75rem' }}>{horodatage(n.date)}</Box>
              </>}
              slotProps={{ primary: { sx: { fontWeight: 600 } }, secondary: { component: 'span' } }} />
          </ListItemButton>
        ))}
        {liste.length > 0 && [<Divider key="d" />, <Box key="b" sx={{ px: 1, pt: 0.5 }}><Button onClick={toutLire} sx={{ minHeight: 48 }}>Tout marquer comme lu</Button></Box>]}
      </Menu>
    </>
  )
}
