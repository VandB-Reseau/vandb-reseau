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
import LockOutlined from '@mui/icons-material/LockOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined'
import SendOutlined from '@mui/icons-material/SendOutlined'
import Tag from '@mui/icons-material/Tag'
import { useAuth } from '../auth/AuthContext'
import { useMessagerie } from '../data/MessagerieContext'
import { useReseau } from '../data/ReseauContext'
import {
  concerne, conversationsPersonnes, destinatairesDu, estNouveau, lienPersonne, heure, horodatage, interlocuteur, jourDuFil, libelleAuteur, libelleNotification, magasinsCites, messagesDu, nomDe, notifications,
  participants, sansPrives, type Contact, type Message, type Notification, type Participant,
} from '../data/messagerie'
import type { Magasin, Reseau } from '../data/modele'
import { EmptyState } from './EmptyState'
import { Bulle } from './Outils'
import { LigneConversation } from './LigneConversation'
import { MenuEntete } from './MenuEntete'
import { BoutonJoindre, ListePieces, PiecesEnAttente } from './Pieces'
import type { Piece } from '../lib/pieces'

const MAXI = 30
const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr')
const echapper = (n: string) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Texte d'un message : mentions (@Nom) et magasins cités (#Nom) en gras
function Texte({ texte, noms }: { texte: string; noms: string[] }) {
  const tries = [...noms].sort((a, b) => b.length - a.length).map(echapper)
  if (!tries.length) return <>{texte}</>
  const morceaux = texte.split(new RegExp(`([@#](?:${tries.join('|')}))`, 'gi'))
  return <>{morceaux.map((x, i) => (i % 2 ? <Box key={i} component="strong" sx={{ fontWeight: 700 }}>{x}</Box> : <Fragment key={i}>{x}</Fragment>))}</>
}

// Deux messages se suivent dans un même groupe : même auteur, même jour, moins de 10 minutes d'écart
const ECART_GROUPE = 10 * 60_000
const memeGroupe = (a: Message | undefined, b: Message | undefined) =>
  !!a && !!b && a.auteur === b.auteur && jourDuFil(a.creeLe) === jourDuFil(b.creeLe) && Math.abs(Date.parse(b.creeLe) - Date.parse(a.creeLe)) < ECART_GROUPE

// contexte : à qui (sur une fiche magasin) ou les magasins cités ; ancien message caché au franchisé : « Confidentiel »
function BulleMessage({ msg, moi, noms, premier, dernier, choisi, contexte, choisir, supprimer }: {
  msg: Message; moi: boolean; noms: string[]; premier: boolean; dernier: boolean; choisi: boolean; contexte: string; choisir?: () => void; supprimer?: () => void
}) {
  const rayon = 18
  // Coins resserrés côté auteur entre deux messages d'un même groupe
  const haut = `${premier ? rayon : 6}px`, bas = `${dernier ? rayon : 6}px`
  const coins: SxProps<Theme> = moi ? { borderTopRightRadius: haut, borderBottomRightRadius: bas } : { borderTopLeftRadius: haut, borderBottomLeftRadius: bas }
  const etiquette = [contexte, msg.equipe ? 'Confidentiel' : ''].filter(Boolean).join(' · ')
  const contenu = (
    <>
      {etiquette && (
        <Typography variant="caption" component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600, opacity: 0.85, mb: 0.25 }}>
          {msg.equipe ? <LockOutlined sx={{ fontSize: 14 }} /> : contexte && !contexte.startsWith('À ') ? <StorefrontOutlined sx={{ fontSize: 14 }} /> : null}{etiquette}
        </Typography>
      )}
      {msg.texte && <Typography variant="body1" component="span" sx={{ display: 'block', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><Texte texte={msg.texte} noms={noms} /></Typography>}
      {msg.pieces.length > 0 && <ListePieces pieces={msg.pieces} clair={moi} />}
    </>
  )
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

const puce = { height: { xs: 48, sm: 40 }, borderRadius: 999, fontSize: '0.875rem' }
const bande = { display: 'flex', gap: 1, overflowX: 'auto', pb: 1, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }

// Saisie d'un message : champ arrondi et envoi sur une ligne.
// citables : magasins à citer avec « # » (proposés en puces au-dessus du champ, sans le masquer) ;
// destinataires : sur une fiche magasin, la personne à qui l'on écrit.
// joindre : photos et fichiers possibles (base à jour)
function Saisie({ citables, destinataires, dest, setDest, envoyer, fond, collante, joindre, signaler }: {
  citables: Magasin[]; destinataires: Participant[]; dest: string | null; setDest: (cle: string) => void
  envoyer: (texte: string, pieces: Piece[]) => Promise<boolean>; fond: string; collante: boolean; joindre: boolean; signaler: (m: string) => void
}) {
  const [texte, setTexte] = useState('')
  const [pieces, setPieces] = useState<Piece[]>([])
  const [curseur, setCurseur] = useState(0)
  const [envoi, setEnvoi] = useState(false)
  const [masque, setMasque] = useState(false)
  const champ = useRef<HTMLTextAreaElement | null>(null)
  const clavier = useMediaQuery('(hover: hover) and (pointer: fine)')

  const avant = texte.slice(0, curseur)
  const recherche = citables.length ? avant.match(/(?:^|\s)#([^#\n]{0,30})$/)?.[1] : undefined
  const suggestions = recherche === undefined || masque ? [] : citables.filter((m) => sansAccents(m.nom).includes(sansAccents(recherche.trimStart()))).slice(0, 20)
  const placer = (nouveau: string, pos: number) => {
    setTexte(nouveau); setCurseur(pos); setMasque(false)
    requestAnimationFrame(() => { champ.current?.focus(); champ.current?.setSelectionRange(pos, pos) })
  }
  const citer = (m: Magasin) => {
    const debut = avant.slice(0, avant.length - (recherche?.length ?? 0) - 1)
    placer(`${debut}#${m.nom} ${texte.slice(curseur)}`, debut.length + m.nom.length + 2)
  }
  const diese = () => {
    const nouveau = `${avant}${curseur > 0 && !/\s$/.test(avant) ? ' ' : ''}#${texte.slice(curseur)}`
    placer(nouveau, nouveau.length - texte.slice(curseur).length)
  }
  const pret = (!!texte.trim() || pieces.length > 0) && !!dest && !envoi
  const valider = async () => {
    if (!pret) return
    setEnvoi(true)
    if (await envoyer(texte.trim(), pieces)) { setTexte(''); setCurseur(0); setPieces([]) }
    setEnvoi(false)
  }
  const touche = (e: KeyboardEvent) => {
    if (suggestions.length && (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey))) { e.preventDefault(); citer(suggestions[0]); return }
    if (suggestions.length && e.key === 'Escape') { e.preventDefault(); setMasque(true); return }
    // Clavier physique : Entrée envoie, Maj + Entrée passe à la ligne ; sur téléphone, Entrée passe à la ligne
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || (clavier && !e.shiftKey))) { e.preventDefault(); void valider() }
  }
  const nomDest = destinataires.find((p) => p.cle === dest)?.nom
  return (
    <Box data-composeur sx={{ ...(collante ? { position: 'sticky', bottom: 'var(--barre-basse, 0px)', zIndex: 2 } : {}), bgcolor: fond, pt: 1, pb: { xs: 1, md: 0.5 } }}>
      {suggestions.length > 0 && (
        <Box role="list" aria-label="Magasins à citer" sx={bande}>
          {suggestions.map((m) => (
            <Box role="listitem" key={m.nom} sx={{ flexShrink: 0 }}>
              <Chip icon={<StorefrontOutlined />} onMouseDown={(e) => e.preventDefault()} onClick={() => citer(m)} variant="outlined" label={m.nom} sx={{ ...puce, bgcolor: 'background.paper' }} />
            </Box>
          ))}
        </Box>
      )}
      {destinataires.length > 0 && !suggestions.length && (
        <Box role="radiogroup" aria-label="Écrire à" sx={{ ...bande, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, pr: 0.5 }}>À</Typography>
          {destinataires.map((p) => (
            <Chip key={p.cle} role="radio" aria-checked={p.cle === dest} onClick={() => setDest(p.cle)}
              color={p.cle === dest ? 'primary' : 'default'} variant={p.cle === dest ? 'filled' : 'outlined'}
              label={<><Box component="span" sx={{ fontWeight: 600 }}>{p.nom}</Box><Box component="span" sx={{ opacity: 0.8, ml: 0.75 }}>{p.role}</Box></>}
              sx={{ ...puce, flexShrink: 0 }} />
          ))}
        </Box>
      )}
      {pieces.length > 0 && <Box sx={{ pb: 1 }}><PiecesEnAttente pieces={pieces} changer={setPieces} /></Box>}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5 }}>
        {joindre && <BoutonJoindre pieces={pieces} changer={setPieces} signaler={signaler} />}
        {citables.length > 0 && <Bulle titre="Citer un magasin"><IconButton onClick={diese} aria-label="Citer un magasin" sx={{ width: 48, height: 48, flexShrink: 0 }}><Tag /></IconButton></Bulle>}
        <TextField placeholder={nomDest && destinataires.length ? `Message à ${nomDest}` : 'Message'} multiline maxRows={6} fullWidth value={texte} inputRef={champ}
          onChange={(e) => { setTexte(e.target.value); setCurseur(e.target.selectionStart ?? e.target.value.length); setMasque(false) }}
          onSelect={(e) => setCurseur((e.target as HTMLTextAreaElement).selectionStart ?? 0)} onKeyDown={touche}
          slotProps={{ htmlInput: { maxLength: 4000, 'aria-label': 'Message' } }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '24px', minHeight: 48, py: 1.25, px: 2, bgcolor: 'action.hover' }, '& fieldset': { borderColor: 'transparent' } }} />
        <Bulle titre="Envoyer">
          <span>
            <IconButton onClick={() => void valider()} disabled={!pret} aria-label="Envoyer"
              sx={{ width: 48, height: 48, flexShrink: 0, bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground' } }}>
              <SendOutlined />
            </IconButton>
          </span>
        </Bulle>
      </Box>
    </Box>
  )
}

// Échange avec une personne (contact), ou messages d'un magasin (m) : les échanges du compte qui le citent et l'ancien fil.
// cadre : le fil défile dans son cadre (conversations sur PC) ; sinon la page défile et la saisie reste collée en bas.
// aLaFin : la page s'ouvre sur les derniers messages (conversation sur téléphone).
// lectureSeule : aperçu de l'espace d'un franchisé par le Directeur de réseau.
export function FilMessages({ reseau, m, contact, signaler, lectureSeule = false, cadre = false, aLaFin = false, fond = 'background.paper' }: {
  reseau: Reseau; m?: Magasin; contact?: Contact; signaler: (msg: string) => void; lectureSeule?: boolean; cadre?: boolean; aLaFin?: boolean; fond?: string
}) {
  const { profil } = useAuth()
  const { messagerie: brute, charge, envoyer, supprimer, marquerLu, marquerLuPersonne } = useMessagerie()
  const messagerie = useMemo(() => (brute && lectureSeule ? sansPrives(brute) : brute), [brute, lectureSeule])
  const [filtre, setFiltre] = useState<string | null>(null)
  const [tous, setTous] = useState(false)
  const [choisi, setChoisi] = useState<number | null>(null)
  const zone = useRef<HTMLDivElement | null>(null)
  const complet = useMemo(() => {
    if (!messagerie) return []
    return contact ? messagerie.messages.filter((x) => concerne(x, contact, messagerie)) : m ? messagesDu(messagerie, m.nom) : []
  }, [messagerie, contact, m])
  const liste = filtre ? complet.filter((x) => x.magasins.includes(filtre)) : complet
  // Magasins cités dans l'échange, pour le trier
  const cites = useMemo(() => [...new Set(complet.flatMap((x) => x.magasins))].sort((a, b) => a.localeCompare(b, 'fr')), [complet])
  const citables = useMemo(() => (contact ? (contact.magasins.length ? contact.magasins : reseau.magasins) : []), [contact, reseau])
  const destinataires = useMemo(() => (m && !contact ? destinatairesDu(reseau, m, profil) : []), [reseau, m, contact, profil])
  const noms = useMemo(() => {
    const l = new Set<string>([...citables.map((x) => x.nom), ...cites])
    for (const x of contact ? contact.magasins : m ? [m] : []) for (const p of participants(reseau, x)) l.add(p.nom)
    return [...l]
  }, [citables, cites, contact, m, reseau])
  // Destinataire sur une fiche magasin : la personne du dernier échange, sinon le franchisé (l'équipe) ou le Coach (le franchisé)
  const [destChoisi, setDest] = useState<string | null>(null)
  const dernierInterlocuteur = messagerie ? [...complet].reverse().map((x) => interlocuteur(x, messagerie)).find((c) => c && destinataires.some((p) => p.cle === c)) : undefined
  const dest = contact ? contact.cle : destChoisi ?? dernierInterlocuteur ?? (destinataires.find((p) => p.cle.startsWith('franchise:')) ?? destinataires[0])?.cle ?? null
  // Séparateur « Nouveaux messages » : messages non lus à l'ouverture du fil
  const [nouveauxAvant, setNouveauxAvant] = useState<Set<number> | null>(null)
  const aLire = messagerie ? complet.filter((x) => estNouveau(x, messagerie)) : []
  const personnesALire = [...new Set(aLire.filter((x) => x.destinataire && x.auteurCle).map((x) => x.auteurCle!))]
  const magasinsALire = [...new Set(aLire.filter((x) => !x.destinataire).flatMap((x) => x.magasins))]
  useEffect(() => {
    if (messagerie && nouveauxAvant === null) setNouveauxAvant(new Set(aLire.map((x) => x.id)))
    if (lectureSeule) return
    personnesALire.forEach((c) => marquerLuPersonne(c))
    magasinsALire.forEach((n) => marquerLu(n, 'messages'))
  }, [messagerie, nouveauxAvant, personnesALire.join('|'), magasinsALire.join('|'), lectureSeule, marquerLu, marquerLuPersonne]) // eslint-disable-line react-hooks/exhaustive-deps

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
  if (!messagerie) return <EmptyState icone={<ForumOutlined />} titre="Messagerie pas encore activée" texte="Les messages apparaîtront ici dès son activation dans la base." />

  const ecrire = async (texte: string, pieces: Piece[]) => {
    if (!dest) return false
    // Échange avec une personne : magasins cités par « # » (et le magasin affiché) ; fiche magasin : ce magasin
    const magasins = contact ? [...new Set([...(filtre ? [filtre] : []), ...magasinsCites(texte, citables)])] : m ? [m.nom] : []
    try { await envoyer(dest, texte, magasins, magasins[0] ?? contact?.magasins[0]?.nom ?? null, pieces); return true } catch { signaler('Message non envoyé. Réessaie dans un instant.'); return false }
  }
  const affiches = tous ? liste : liste.slice(-MAXI)
  const premierNouveau = affiches.find((x) => nouveauxAvant?.has(x.id))
  const contexteDe = (x: Message) => {
    if (contact) return filtre ? '' : x.magasins.join(', ')
    return x.destinataire && x.auteur === messagerie.moi ? `À ${nomDe(reseau, x.destinataire)}` : ''
  }
  const filtres = contact && cites.length > 0 && (cites.length > 1 || complet.some((x) => !x.magasins.length)) && (
    <Box role="group" aria-label="Magasins affichés" sx={{ display: 'flex', gap: 1, overflowX: 'auto', py: 1, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
      {[null, ...cites].map((n) => (
        <Chip key={n ?? ''} label={n ?? 'Tous'} onClick={() => setFiltre(n)} aria-pressed={filtre === n}
          color={filtre === n ? 'primary' : 'default'} variant={filtre === n ? 'filled' : 'outlined'}
          sx={{ flexShrink: 0, height: { xs: 48, sm: 36 }, borderRadius: 999, fontSize: '0.875rem' }} />
      ))}
    </Box>
  )
  const fil = (
    <>
      {liste.length > MAXI && !tous && <Box sx={{ textAlign: 'center' }}><Button onClick={() => setTous(true)} sx={{ minHeight: 48 }}>Voir les {liste.length} messages</Button></Box>}
      {!liste.length
        ? <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>{contact ? 'Aucun message.' : 'Aucun message sur ce magasin.'}</Typography>
        : (
          <Box component="ul" aria-label={`Messages de ${contact ? contact.nom : m?.nom ?? ''}`} sx={{ listStyle: 'none', m: 0, p: 0, pb: 1 }}>
            {affiches.map((x, i) => {
              const precedent = affiches[i - 1], suivant = affiches[i + 1]
              const nouveauJour = !precedent || jourDuFil(precedent.creeLe) !== jourDuFil(x.creeLe)
              const moi = x.auteur === messagerie.moi
              const memeContexte = (a?: Message, b?: Message) => !!a && !!b && memeGroupe(a, b) && a.equipe === b.equipe && contexteDe(a) === contexteDe(b)
              const premier = nouveauJour || x === premierNouveau || !memeContexte(precedent, x)
              return (
                <Fragment key={x.id}>
                  {nouveauJour && <Box component="li" aria-hidden sx={{ textAlign: 'center', mt: 2, mb: 0.5 }}><Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{jourDuFil(x.creeLe)}</Typography></Box>}
                  {x === premierNouveau && <Box component="li" aria-hidden sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1 }}>
                    <Divider sx={{ flex: 1, borderColor: 'error.main' }} /><Typography variant="caption" color="error" sx={{ fontWeight: 600 }}>Nouveaux messages</Typography><Divider sx={{ flex: 1, borderColor: 'error.main' }} />
                  </Box>}
                  <BulleMessage msg={x} moi={moi} noms={noms} premier={premier} dernier={suivant === premierNouveau || !memeContexte(x, suivant)}
                    contexte={premier ? contexteDe(x) : ''}
                    choisi={choisi === x.id} choisir={moi && !lectureSeule ? () => setChoisi((c) => (c === x.id ? null : x.id)) : undefined}
                    supprimer={moi && !lectureSeule ? () => { supprimer(x.id).then(() => { setChoisi(null); signaler('Message supprimé.') }, () => signaler('Suppression impossible pour le moment. Réessaie dans un instant.')) } : undefined} />
                </Fragment>
              )
            })}
          </Box>
        )}
    </>
  )
  const saisie = !lectureSeule && (contact || destinataires.length > 0) && (
    <Saisie citables={citables} destinataires={destinataires} dest={dest} setDest={setDest} envoyer={ecrire} fond={fond} collante={!cadre} joindre={messagerie.version >= 3} signaler={signaler} />
  )
  if (cadre) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {filtres && <Box sx={{ px: 2 }}>{filtres}</Box>}
        <Box ref={zone} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2 }}>{fil}</Box>
        {saisie && <Box sx={{ px: 1, pb: 1, borderTop: '1px solid', borderColor: 'divider' }}>{saisie}</Box>}
      </Box>
    )
  }
  // Conversation sur téléphone : la saisie reste au bas de l'écran même quand le fil est court
  if (aLaFin) return <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - 64px - 65px)' }}>{filtres}<Box sx={{ flex: 1 }}>{fil}</Box>{saisie}</Box>
  return <Box>{filtres}{fil}{saisie}</Box>
}

// Onglet « Messages » d'une fiche magasin : le cadre laisse la saisie coller au bas de l'écran
export function SectionMessages({ reseau, m, signaler, lectureSeule = false }: { reseau: Reseau; m: Magasin; signaler: (msg: string) => void; lectureSeule?: boolean }) {
  return (
    <Card sx={{ overflow: 'visible' }}>
      <CardContent sx={{ p: { xs: 2, md: 3 }, '&:last-child': { pb: { xs: 1, md: 2 } } }}>
        <Typography variant="h3" component="h2">Messages</Typography>
        <FilMessages key={m.nom} reseau={reseau} m={m} signaler={signaler} lectureSeule={lectureSeule} />
      </CardContent>
    </Card>
  )
}

// Messages non lus d'un magasin (pastille de l'onglet)
export function useNonLusMagasin(magasin: string): number {
  const { messagerie } = useMessagerie()
  if (!messagerie) return 0
  return messagesDu(messagerie, magasin).filter((x) => estNouveau(x, messagerie)).length
}

const iconeNotification = { message: <ForumOutlined />, mention: <AlternateEmail />, visite: <EventNoteOutlined /> }

// Cloche de l'en-tête : nouveautés du compte connecté
export function Cloche() {
  const { profil } = useAuth()
  const { reseau } = useReseau()
  const { messagerie, lire } = useMessagerie()
  const naviguer = useNavigate()
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  const liste = useMemo(() => notifications(reseau, profil, messagerie), [reseau, profil, messagerie])
  if (!messagerie) return null
  const ouvrir = (n: Notification) => { setAncre(null); naviguer(n.lien) }
  const toutLire = () => { liste.forEach((n) => lire(n.lecture)); setAncre(null) }
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
            <ListItemText primary={n.titre}
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
          <Button startIcon={<NotificationsOutlined />} onClick={() => { setAncre(null); naviguer('/notifications') }} sx={{ minHeight: 48 }}>Toutes les notifications</Button>
          {liste.length > 0 && <Button onClick={toutLire} sx={{ minHeight: 48, ml: 'auto' }}>Tout marquer comme lu</Button>}
        </Box>
      </Menu>
    </>
  )
}

// Bouton « Messages » de l'en-tête : aperçu des dernières conversations, avec le nombre de messages non lus
const APERCU_MESSAGES = 6

export function BoutonMessages() {
  const { profil } = useAuth()
  const { reseau } = useReseau()
  const { messagerie } = useMessagerie()
  const naviguer = useNavigate()
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  // Messages non lus qui concernent le compte (mêmes règles que la cloche), un par un
  const nombre = useMemo(() => notifications(reseau, profil, messagerie).filter((n) => n.lecture.sujet === 'messages').reduce((t, n) => t + n.nombre, 0), [reseau, profil, messagerie])
  const recentes = useMemo(() => (ancre && reseau && messagerie ? conversationsPersonnes(reseau, messagerie, profil).filter((c) => c.dernier).slice(0, APERCU_MESSAGES) : []), [ancre, reseau, messagerie, profil])
  if (!messagerie) return null
  const fermer = () => setAncre(null)
  return (
    <>
      <Bulle titre="Messages">
        <IconButton aria-label={nombre ? `Messages : ${nombre} non lu${nombre > 1 ? 's' : ''}` : 'Messages'} onClick={(e) => setAncre(e.currentTarget)} sx={{ color: '#ffffff', width: 48, height: 48 }}>
          <Badge color="error" badgeContent={nombre} max={99} sx={{ '& .MuiBadge-badge': { fontSize: '0.75rem' } }}><ForumOutlined /></Badge>
        </IconButton>
      </Bulle>
      <MenuEntete ancre={ancre} fermer={fermer} titre="Messages" vide={recentes.length ? null : 'Aucune conversation pour le moment.'}
        tout="Tous les messages" icone={<ForumOutlined />} ouvrirTout={() => naviguer('/messages')}>
        <Box sx={{ py: 0.5 }}>
          {recentes.map((c) => <LigneConversation key={c.contact.cle} c={c} mg={messagerie} actif={false} ouvrir={() => { fermer(); naviguer(lienPersonne(c.contact.cle)) }} />)}
        </Box>
      </MenuEntete>
    </>
  )
}
