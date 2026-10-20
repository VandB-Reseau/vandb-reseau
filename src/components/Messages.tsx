import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { SxProps, Theme } from '@mui/material/styles'
import AlternateEmail from '@mui/icons-material/AlternateEmail'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined'
import OpenInFull from '@mui/icons-material/OpenInFull'
import SendOutlined from '@mui/icons-material/SendOutlined'
import { useAuth } from '../auth/AuthContext'
import { useMessagerie } from '../data/MessagerieContext'
import { useReseau } from '../data/ReseauContext'
import { derniereLecture, heure, horodatage, jourDuFil, libelleAuteur, libelleNotification, lienConversation, mentionsDans, mesCles, messagesDu, notifications, participants, type Message, type Notification, type Participant } from '../data/messagerie'
import type { Magasin, Reseau } from '../data/modele'
import { EmptyState } from './EmptyState'
import { Bulle } from './Outils'

const MAXI = 30
const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr')

// Texte d'un message, mentions en gras
function Texte({ texte, noms }: { texte: string; noms: string[] }) {
  const tries = [...noms].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!tries.length) return <>{texte}</>
  const morceaux = texte.split(new RegExp(`(@(?:${tries.join('|')}))`, 'gi'))
  return <>{morceaux.map((x, i) => (i % 2 ? <Box key={i} component="strong" sx={{ fontWeight: 700 }}>{x}</Box> : <Fragment key={i}>{x}</Fragment>))}</>
}

// Deux messages se suivent dans un même groupe : même auteur, même jour, moins de 10 minutes d'écart
const ECART_GROUPE = 10 * 60_000
const memeGroupe = (a: Message | undefined, b: Message | undefined) =>
  !!a && !!b && a.auteur === b.auteur && jourDuFil(a.creeLe) === jourDuFil(b.creeLe) && Math.abs(Date.parse(b.creeLe) - Date.parse(a.creeLe)) < ECART_GROUPE

function BulleMessage({ msg, moi, noms, premier, dernier, choisi, choisir, supprimer }: {
  msg: Message; moi: boolean; noms: string[]; premier: boolean; dernier: boolean; choisi: boolean; choisir?: () => void; supprimer?: () => void
}) {
  const rayon = 18
  // Coins resserrés côté auteur entre deux messages d'un même groupe
  const haut = `${premier ? rayon : 6}px`, bas = `${dernier ? rayon : 6}px`
  const coins: SxProps<Theme> = moi ? { borderTopRightRadius: haut, borderBottomRightRadius: bas } : { borderTopLeftRadius: haut, borderBottomLeftRadius: bas }
  const contenu = <Typography variant="body1" component="span" sx={{ display: 'block', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><Texte texte={msg.texte} noms={noms} /></Typography>
  const bulleSx: SxProps<Theme> = {
    display: 'block', textAlign: 'left', maxWidth: { xs: '85%', md: '70%' }, minWidth: 0, px: 1.75, py: 1, borderRadius: `${rayon}px`, ...(coins as object),
    bgcolor: moi ? 'primary.main' : 'action.hover', color: moi ? 'primary.contrastText' : 'text.primary',
  }
  return (
    <Box component="li" aria-label={`Message de ${msg.auteurNom}`} sx={{ display: 'flex', flexDirection: 'column', alignItems: moi ? 'flex-end' : 'flex-start', mt: premier ? 1.5 : 0.25 }}>
      {!moi && premier && (
        <Typography variant="caption" color="text.secondary" sx={{ px: 1.75, mb: 0.25 }}>
          <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{msg.auteurNom}</Box>{libelleAuteur[msg.auteurRole] ? ` · ${libelleAuteur[msg.auteurRole]}` : ''}
        </Typography>
      )}
      {choisir
        ? <ButtonBase component="div" onClick={choisir} aria-expanded={choisi} sx={bulleSx}>{contenu}</ButtonBase>
        : <Box sx={bulleSx}>{contenu}</Box>}
      {(dernier || choisi) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, mt: 0.25 }}>
          <Typography variant="caption" color="text.secondary">{choisi ? horodatage(msg.creeLe) : heure(msg.creeLe)}</Typography>
          {choisi && supprimer && <Button size="small" color="error" startIcon={<DeleteOutlined />} onClick={supprimer} aria-label={`Supprimer mon message du ${horodatage(msg.creeLe)}`} sx={{ minHeight: 40 }}>Supprimer</Button>}
        </Box>
      )}
    </Box>
  )
}

// Saisie d'un message : champ arrondi, « @ » et envoi sur une ligne ; les personnes à mentionner
// s'affichent en puces sur une bande au-dessus du champ, sans le masquer.
function Saisie({ gens, exclus, envoyer, fond, collante }: { gens: Participant[]; exclus: string[]; envoyer: (texte: string, mentions: string[]) => Promise<boolean>; fond: string; collante: boolean }) {
  const [texte, setTexte] = useState('')
  const [curseur, setCurseur] = useState(0)
  const [envoi, setEnvoi] = useState(false)
  const [masque, setMasque] = useState(false)
  const champ = useRef<HTMLTextAreaElement | null>(null)
  const clavier = useMediaQuery('(hover: hover) and (pointer: fine)')
  const proposables = gens.filter((p) => !exclus.includes(p.cle))

  const avant = texte.slice(0, curseur)
  const recherche = avant.match(/(?:^|\s)@([^@\n]{0,30})$/)?.[1]
  const suggestions = recherche === undefined || masque ? [] : proposables.filter((p) => sansAccents(p.nom).includes(sansAccents(recherche.trimStart())))
  const placer = (nouveau: string, pos: number) => {
    setTexte(nouveau); setCurseur(pos); setMasque(false)
    requestAnimationFrame(() => { champ.current?.focus(); champ.current?.setSelectionRange(pos, pos) })
  }
  const choisir = (p: Participant) => {
    const debut = avant.slice(0, avant.length - (recherche?.length ?? 0) - 1)
    placer(`${debut}@${p.nom} ${texte.slice(curseur)}`, debut.length + p.nom.length + 2)
  }
  const mentionner = () => {
    const nouveau = `${avant}${curseur > 0 && !/\s$/.test(avant) ? ' ' : ''}@${texte.slice(curseur)}`
    placer(nouveau, nouveau.length - texte.slice(curseur).length)
  }
  const valider = async () => {
    if (!texte.trim() || envoi) return
    setEnvoi(true)
    if (await envoyer(texte.trim(), mentionsDans(texte, gens))) { setTexte(''); setCurseur(0) }
    setEnvoi(false)
  }
  const touche = (e: KeyboardEvent) => {
    if (suggestions.length && (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey))) { e.preventDefault(); choisir(suggestions[0]); return }
    if (suggestions.length && e.key === 'Escape') { e.preventDefault(); setMasque(true); return }
    // Clavier physique : Entrée envoie, Maj + Entrée passe à la ligne ; sur téléphone, Entrée passe à la ligne
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || (clavier && !e.shiftKey))) { e.preventDefault(); void valider() }
  }
  return (
    <Box data-composeur sx={{ ...(collante ? { position: 'sticky', bottom: 'var(--barre-basse, 0px)', zIndex: 2 } : {}), bgcolor: fond, pt: 1, pb: { xs: 1, md: 0.5 } }}>
      {suggestions.length > 0 && (
        <Box role="list" aria-label="Personnes à mentionner" sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
          {suggestions.map((p) => (
            <Box role="listitem" key={p.cle} sx={{ flexShrink: 0 }}>
              <Chip onMouseDown={(e) => e.preventDefault()} onClick={() => choisir(p)} variant="outlined"
                label={<><Box component="span" sx={{ fontWeight: 600 }}>{p.nom}</Box><Box component="span" sx={{ color: 'text.secondary', ml: 0.75 }}>{p.role}</Box></>}
                sx={{ height: { xs: 48, sm: 40 }, borderRadius: 999, fontSize: '0.875rem', bgcolor: 'background.paper' }} />
            </Box>
          ))}
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5 }}>
        <Bulle titre="Mentionner"><IconButton onClick={mentionner} aria-label="Mentionner quelqu’un" sx={{ width: 48, height: 48, flexShrink: 0 }}><AlternateEmail /></IconButton></Bulle>
        <TextField placeholder="Message" multiline maxRows={6} fullWidth value={texte} inputRef={champ}
          onChange={(e) => { setTexte(e.target.value); setCurseur(e.target.selectionStart ?? e.target.value.length); setMasque(false) }}
          onSelect={(e) => setCurseur((e.target as HTMLTextAreaElement).selectionStart ?? 0)} onKeyDown={touche}
          slotProps={{ htmlInput: { maxLength: 4000, 'aria-label': 'Message' } }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '24px', minHeight: 48, py: 1.25, px: 2, bgcolor: 'action.hover' }, '& fieldset': { borderColor: 'transparent' } }} />
        <Bulle titre="Envoyer">
          <span>
            <IconButton onClick={() => void valider()} disabled={!texte.trim() || envoi} aria-label="Envoyer"
              sx={{ width: 48, height: 48, flexShrink: 0, bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground' } }}>
              <SendOutlined />
            </IconButton>
          </span>
        </Bulle>
      </Box>
    </Box>
  )
}

// Fil de messages d'un magasin.
// cadre : le fil défile dans son cadre (conversations sur PC) ; sinon la page défile et la saisie reste collée en bas.
// aLaFin : la page s'ouvre sur les derniers messages (conversation sur téléphone).
// lectureSeule : aperçu de l'espace d'un franchisé par le Directeur de réseau.
export function FilMessages({ reseau, m, signaler, lectureSeule = false, cadre = false, aLaFin = false, fond = 'background.paper' }: {
  reseau: Reseau; m: Magasin; signaler: (msg: string) => void; lectureSeule?: boolean; cadre?: boolean; aLaFin?: boolean; fond?: string
}) {
  const { profil } = useAuth()
  const { messagerie, charge, envoyer, supprimer, marquerLu } = useMessagerie()
  const [tous, setTous] = useState(false)
  const [choisi, setChoisi] = useState<number | null>(null)
  const zone = useRef<HTMLDivElement | null>(null)
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

  // Aller aux derniers messages à l'ouverture et à chaque nouveau message
  const nombre = liste.length
  useEffect(() => {
    if (!charge) return
    const id = requestAnimationFrame(() => {
      if (cadre && zone.current) zone.current.scrollTop = zone.current.scrollHeight
      else if (aLaFin) window.scrollTo({ top: document.documentElement.scrollHeight })
    })
    return () => cancelAnimationFrame(id)
  }, [charge, nombre, cadre, aLaFin])

  if (!charge) return <Typography variant="body2" color="text.secondary">Chargement des messages…</Typography>
  if (!messagerie) return <EmptyState icone={<ForumOutlined />} titre="Messagerie pas encore activée" texte="Les messages de ce magasin apparaîtront ici dès son activation dans la base." />

  const ecrire = async (texte: string, mentions: string[]) => {
    try { await envoyer(m.nom, texte, mentions); return true } catch { signaler('Message non envoyé. Réessaie dans un instant.'); return false }
  }
  const affiches = tous ? liste : liste.slice(-MAXI)
  const premierNouveau = affiches.find((x) => x.auteur !== messagerie.moi && Date.parse(x.creeLe) > (luAvant ?? Infinity))
  const fil = (
    <>
      {liste.length > MAXI && !tous && <Box sx={{ textAlign: 'center' }}><Button onClick={() => setTous(true)} sx={{ minHeight: 48 }}>Voir les {liste.length} messages</Button></Box>}
      {!liste.length
        ? <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Aucun message sur ce magasin.</Typography>
        : (
          <Box component="ul" aria-label={`Messages de ${m.nom}`} sx={{ listStyle: 'none', m: 0, p: 0, pb: 1 }}>
            {affiches.map((x, i) => {
              const precedent = affiches[i - 1], suivant = affiches[i + 1]
              const nouveauJour = !precedent || jourDuFil(precedent.creeLe) !== jourDuFil(x.creeLe)
              const moi = x.auteur === messagerie.moi
              return (
                <Fragment key={x.id}>
                  {nouveauJour && <Box component="li" aria-hidden sx={{ textAlign: 'center', mt: 2, mb: 0.5 }}><Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{jourDuFil(x.creeLe)}</Typography></Box>}
                  {x === premierNouveau && <Box component="li" aria-hidden sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1 }}>
                    <Divider sx={{ flex: 1, borderColor: 'error.main' }} /><Typography variant="caption" color="error" sx={{ fontWeight: 600 }}>Nouveaux messages</Typography><Divider sx={{ flex: 1, borderColor: 'error.main' }} />
                  </Box>}
                  <BulleMessage msg={x} moi={moi} noms={noms}
                    premier={nouveauJour || x === premierNouveau || !memeGroupe(precedent, x)} dernier={suivant === premierNouveau || !memeGroupe(x, suivant)}
                    choisi={choisi === x.id} choisir={moi && !lectureSeule ? () => setChoisi((c) => (c === x.id ? null : x.id)) : undefined}
                    supprimer={moi && !lectureSeule ? () => { supprimer(x.id).then(() => { setChoisi(null); signaler('Message supprimé.') }, () => signaler('Suppression impossible pour le moment. Réessaie dans un instant.')) } : undefined} />
                </Fragment>
              )
            })}
          </Box>
        )}
    </>
  )
  const saisie = !lectureSeule && <Saisie gens={gens} exclus={mesCles(profil)} envoyer={ecrire} fond={fond} collante={!cadre} />
  if (cadre) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <Box ref={zone} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2 }}>{fil}</Box>
        {saisie && <Box sx={{ px: 1, pb: 1, borderTop: '1px solid', borderColor: 'divider' }}>{saisie}</Box>}
      </Box>
    )
  }
  // Conversation sur téléphone : la saisie reste au bas de l'écran même quand le fil est court
  if (aLaFin) return <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - 64px - 65px)' }}><Box sx={{ flex: 1 }}>{fil}</Box>{saisie}</Box>
  return <Box>{fil}{saisie}</Box>
}

// Onglet « Messages » d'une fiche magasin : le cadre laisse la saisie coller au bas de l'écran
export function SectionMessages({ reseau, m, signaler, lectureSeule = false }: { reseau: Reseau; m: Magasin; signaler: (msg: string) => void; lectureSeule?: boolean }) {
  const naviguer = useNavigate()
  return (
    <Card sx={{ overflow: 'visible' }}>
      <CardContent sx={{ p: { xs: 2, md: 3 }, '&:last-child': { pb: { xs: 1, md: 2 } } }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h3" component="h2" sx={{ flex: 1 }}>Messages</Typography>
          <Bulle titre="Ouvrir la conversation"><IconButton aria-label="Ouvrir la conversation" onClick={() => naviguer(lienConversation(m.nom))} sx={{ width: 48, height: 48 }}><OpenInFull /></IconButton></Bulle>
        </Box>
        <FilMessages key={m.nom} reseau={reseau} m={m} signaler={signaler} lectureSeule={lectureSeule} />
      </CardContent>
    </Card>
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
        <Divider />
        <Box sx={{ px: 1, pt: 0.5, display: 'flex', flexWrap: 'wrap' }}>
          <Button startIcon={<ForumOutlined />} onClick={() => { setAncre(null); naviguer('/messages') }} sx={{ minHeight: 48 }}>Toutes les conversations</Button>
          {liste.length > 0 && <Button onClick={toutLire} sx={{ minHeight: 48, ml: 'auto' }}>Tout marquer comme lu</Button>}
        </Box>
      </Menu>
    </>
  )
}

// Bouton « Messages » de l'en-tête : conversations par magasin, avec les nouveautés qui concernent le compte
export function BoutonMessages() {
  const { profil } = useAuth()
  const { reseau } = useReseau()
  const { messagerie } = useMessagerie()
  const naviguer = useNavigate()
  const nombre = useMemo(() => notifications(reseau, profil, messagerie).filter((n) => n.sujet === 'messages').length, [reseau, profil, messagerie])
  if (!messagerie) return null
  return (
    <Bulle titre="Messages">
      <IconButton aria-label={nombre ? `Messages : ${nombre} conversation${nombre > 1 ? 's' : ''} à lire` : 'Messages'} onClick={() => naviguer('/messages')} sx={{ color: '#ffffff', width: 48, height: 48 }}>
        <Badge color="error" badgeContent={nombre} max={99} sx={{ '& .MuiBadge-badge': { fontSize: '0.75rem' } }}><ForumOutlined /></Badge>
      </IconButton>
    </Bulle>
  )
}
