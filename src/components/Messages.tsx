import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { SxProps, Theme } from '@mui/material/styles'
import AlternateEmail from '@mui/icons-material/AlternateEmail'
import CheckCircle from '@mui/icons-material/CheckCircle'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import PushPin from '@mui/icons-material/PushPin'
import PushPinOutlined from '@mui/icons-material/PushPinOutlined'
import ReplyOutlined from '@mui/icons-material/ReplyOutlined'
import SupportAgentOutlined from '@mui/icons-material/SupportAgentOutlined'
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked'
import SendOutlined from '@mui/icons-material/SendOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import Tag from '@mui/icons-material/Tag'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import { useAuth } from '../auth/AuthContext'
import { useMessagerie } from '../data/MessagerieContext'
import { useReseau } from '../data/ReseauContext'
import {
  cleFil, epinglerMessage, estNouveau, heure, horodatage, jourDuFil, libelleAuteur, libelleReaction, magasinsCites, messageDeNumero, messagesDu, messagesDuFil, mesCles, modifiable, participants,
  membresDuFil, reagirMessage, sansPrives, type Contact, type Fil, type GenreReaction, type Message, type Participant,
} from '../data/messagerie'
import { brouillonDe, garderBrouillon } from '../data/brouillons'
import type { Demande } from '../data/demandes'
import { BandeEpingles, Citation, DialogDemande, DialogModifier, iconeReaction, LigneReactions, PuceDemande, ReponseEnCours } from './MessagesGestes'
import { Onglets } from './Onglets'
import { actionsDuMagasin, echeanceDate, enRetard, type ActionSuivie } from '../data/actions'
import { type Magasin, type Reseau } from '../data/modele'
import { dateCourte } from '../lib/format'
import { EmptyState } from './EmptyState'
import { Bulle } from './Outils'
import { BoutonJoindre, ListePieces, PiecesEnAttente } from './Pieces'
import { DialogAction, useEcritureActions } from './Actions'
import type { Piece } from '../lib/pieces'
import { cartouche } from './Social'
import { BoutonDictee } from './Dictee'

const MAXI = 40
const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr')
const echapper = (n: string) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Texte d'un message : personnes citées (@Nom) et magasins cités (#Nom) en gras
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

// Gestes possibles sur un message choisi (refonte vague 6, 60A), selon les droits et la version de la base
export interface GestesMessage {
  repondre?: () => void; reagir?: (r: GenreReaction) => void; modifier?: () => void; epingler?: () => void
  enTache?: () => void; enDemande?: () => void; supprimer?: () => void
}

// contexte : magasins cités (échange à deux) ; choisi : l'heure complète et les actions du message sont affichées.
// cite : message auquel celui-ci répond ; demande : demande au siège née de ce message
function BulleMessage({ msg, moi, noms, premier, dernier, choisi, contexte, choisir, gestes, cite, allerA, demande }: {
  msg: Message; moi: boolean; noms: string[]; premier: boolean; dernier: boolean; choisi: boolean; contexte: string
  choisir?: () => void; gestes: GestesMessage; cite?: { x: Message | undefined }; allerA: (id: number) => void; demande?: { id: number; d: Demande | undefined }
}) {
  const rayon = 18
  // Coins resserrés côté auteur entre deux messages d'un même groupe
  const haut = `${premier ? rayon : 6}px`, bas = `${dernier ? rayon : 6}px`
  const coins: SxProps<Theme> = moi ? { borderTopRightRadius: haut, borderBottomRightRadius: bas } : { borderTopLeftRadius: haut, borderBottomLeftRadius: bas }
  const contenu = (
    <>
      {contexte && (
        <Typography variant="caption" component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600, opacity: 0.85, mb: 0.25 }}>
          <StorefrontOutlined sx={{ fontSize: 14 }} />{contexte}
        </Typography>
      )}
      {cite && <Citation cite={cite.x} clair={moi} aller={cite.x ? () => allerA(cite.x!.id) : undefined} />}
      {msg.texte && <Typography variant="body1" component="span" sx={{ display: 'block', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><Texte texte={msg.texte} noms={noms} /></Typography>}
      {msg.pieces.length > 0 && <ListePieces pieces={msg.pieces} clair={moi} />}
    </>
  )
  const bulleSx: SxProps<Theme> = {
    display: 'block', textAlign: 'left', maxWidth: { xs: '85%', md: '70%' }, minWidth: 0, px: 1.75, py: 1, borderRadius: `${rayon}px`, ...(coins as object),
    bgcolor: moi ? 'primary.main' : 'action.hover', color: moi ? 'primary.contrastText' : 'text.primary',
    ...(msg.epingleLe ? { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 1 } : {}),
  }
  const g = gestes
  const bouton = (libelle: string, icone: ReactNode, agir: () => void, etiquette?: string, presse?: boolean) => (
    <Button size="small" startIcon={icone} onClick={agir} aria-label={etiquette} aria-pressed={presse} sx={{ minHeight: 40 }}>{libelle}</Button>
  )
  return (
    <Box component="li" id={`message-${msg.id}`} aria-label={`Message de ${msg.auteurNom}`} sx={{ display: 'flex', flexDirection: 'column', alignItems: moi ? 'flex-end' : 'flex-start', mt: premier ? 1.5 : 0.25, scrollMarginTop: 96 }}>
      {!moi && premier && (
        <Typography variant="caption" color="text.secondary" sx={{ px: 1.75, mb: 0.25 }}>
          <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{msg.auteurNom}</Box>{libelleAuteur[msg.auteurRole] ? ` · ${libelleAuteur[msg.auteurRole]}` : ''}
        </Typography>
      )}
      {choisir
        ? <ButtonBase component="div" onClick={choisir} aria-expanded={choisi} sx={bulleSx}>{contenu}</ButtonBase>
        : <Box sx={bulleSx}>{contenu}</Box>}
      <LigneReactions x={msg} droite={moi} reagir={g.reagir} />
      {demande && <Box sx={{ mt: 0.5, px: 0.5 }}><PuceDemande id={demande.id} d={demande.d} /></Box>}
      {(dernier || choisi || msg.modifieLe) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, mt: 0.25, flexWrap: 'wrap', justifyContent: moi ? 'flex-end' : 'flex-start' }}>
          {(dernier || choisi) && <Typography variant="caption" color="text.secondary">{choisi ? horodatage(msg.creeLe) : heure(msg.creeLe)}</Typography>}
          {msg.modifieLe && <Typography variant="caption" color="text.secondary">· modifié</Typography>}
          {msg.epingleLe && <Typography variant="caption" color="text.secondary">· épinglé</Typography>}
        </Box>
      )}
      {choisi && (
        <Box role="group" aria-label="Actions du message" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, mt: 0.25, flexWrap: 'wrap', justifyContent: moi ? 'flex-end' : 'flex-start', maxWidth: '100%' }}>
          {g.repondre && bouton('Répondre', <ReplyOutlined />, g.repondre)}
          {g.reagir && (['vu', 'merci', 'accord'] as GenreReaction[]).map((r) => {
            const Icone = iconeReaction[r]
            const mienne = msg.reactions.some((x) => x.reaction === r && x.moi)
            return <Fragment key={r}>{bouton(libelleReaction[r], <Icone />, () => g.reagir!(r), mienne ? `Retirer « ${libelleReaction[r]} »` : `Réagir : ${libelleReaction[r]}`, mienne)}</Fragment>
          })}
          {g.modifier && bouton('Modifier', <EditOutlined />, g.modifier)}
          {g.epingler && bouton(msg.epingleLe ? 'Retirer l’épingle' : 'Épingler', msg.epingleLe ? <PushPin /> : <PushPinOutlined />, g.epingler)}
          {g.enTache && bouton('En faire une tâche', <TaskAltOutlined />, g.enTache)}
          {g.enDemande && bouton('Transformer en demande', <SupportAgentOutlined />, g.enDemande)}
          {g.supprimer && <Button size="small" color="error" startIcon={<DeleteOutlined />} onClick={g.supprimer} aria-label={`Supprimer mon message du ${horodatage(msg.creeLe)}`} sx={{ minHeight: 40 }}>Supprimer</Button>}
        </Box>
      )}
    </Box>
  )
}

// Carte d'une tâche dans le groupe du magasin : cochée depuis le fil
function CarteTache({ reseau, x, signaler }: { reseau: Reseau; x: ActionSuivie; signaler: (m: string) => void }) {
  const { recharger } = useReseau()
  const ecriture = useEcritureActions(reseau)
  const [enCours, setEnCours] = useState(false)
  const faite = !!x.a.faite
  const echeance = echeanceDate(x.a)
  const retard = enRetard(x.a, reseau.jour)
  const cocher = async () => {
    setEnCours(true)
    try { await ecriture.cocher(x, !faite); await recharger(); signaler(faite ? 'Tâche remise à faire.' : 'Tâche marquée faite.') }
    catch { signaler('La tâche n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.') }
    finally { setEnCours(false) }
  }
  const detail = faite
    ? `Faite${x.a.faitePar ? ` par ${x.a.faitePar}` : ''} le ${dateCourte(x.a.faite!)}`
    : [x.a.porteur, echeance ? `${retard ? 'en retard · ' : 'avant le '}${dateCourte(echeance)}` : ''].filter(Boolean).join(' · ')
  return (
    <Box component="li" aria-label={`Tâche : ${x.a.action}`} sx={{ display: 'flex', justifyContent: 'center', my: 1.5 }}>
      <Box sx={{ width: '100%', maxWidth: 440, display: 'flex', gap: 1.5, alignItems: 'center', p: 1.5, borderRadius: 3, border: '1px solid', borderColor: retard ? 'error.main' : 'divider', bgcolor: 'background.paper' }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: faite ? 'success.main' : 'secondary.main', color: faite ? 'success.contrastText' : 'secondary.contrastText', display: 'grid', placeItems: 'center', flexShrink: 0 }}><TaskAltOutlined /></Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, textDecoration: faite ? 'line-through' : 'none' }}>{x.a.action}</Typography>
          <Typography variant="body2" sx={{ color: retard ? 'error.main' : 'text.secondary', fontWeight: retard ? 600 : 400 }}>Tâche · {detail}</Typography>
        </Box>
        {!ecriture.lectureSeule && (
          <Button variant={faite ? 'text' : 'outlined'} onClick={() => void cocher()} disabled={enCours} startIcon={faite ? <CheckCircle /> : <RadioButtonUnchecked />}
            aria-label={faite ? `Remettre à faire : ${x.a.action}` : `Marquer faite : ${x.a.action}`} sx={{ minHeight: 48, borderRadius: 2, flexShrink: 0 }}>
            {faite ? 'Faite' : 'Fait'}
          </Button>
        )}
      </Box>
    </Box>
  )
}

const puce = { height: { xs: 48, sm: 40 }, borderRadius: 2, fontSize: '0.875rem' }
const bande = { display: 'flex', gap: 1, overflowX: 'auto', pb: 1, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }

// Saisie d'un message : champ arrondi et envoi sur une ligne.
// citables : magasins à citer avec « # » ; mentionnables : personnes à citer avec « @ » (proposées en puces au-dessus du champ).
// joindre : photos et fichiers possibles (base à jour)
// brouillon : clé du brouillon gardé sur l'appareil (72A) ; reponse : message cité (60A) ;
// visibilite : qui lira le message, dans le groupe d'un magasin (58A) : cadre bleu-vert avec le franchisé, jaune en équipe seule
function Saisie({ citables, mentionnables, envoyer, fond, collante, joindre, signaler, placeholder, brouillon, reponse, visibilite }: {
  citables: Magasin[]; mentionnables: Participant[]
  envoyer: (texte: string, pieces: Piece[]) => Promise<boolean>; fond: string; collante: boolean; joindre: boolean; signaler: (m: string) => void; placeholder: string
  brouillon: string; reponse?: { x: Message; annuler: () => void }; visibilite?: { texte: string; equipe: boolean }
}) {
  const [texte, setTexteBrut] = useState(() => brouillonDe(brouillon))
  const setTexte = (v: string | ((avant: string) => string)) => setTexteBrut((avant) => { const n = typeof v === 'function' ? v(avant) : v; garderBrouillon(brouillon, n); return n })
  const [pieces, setPieces] = useState<Piece[]>([])
  const [curseur, setCurseur] = useState(0)
  const [envoi, setEnvoi] = useState(false)
  const [masque, setMasque] = useState(false)
  const champ = useRef<HTMLTextAreaElement | null>(null)
  const clavier = useMediaQuery('(hover: hover) and (pointer: fine)')

  const avant = texte.slice(0, curseur)
  const recherche = citables.length ? avant.match(/(?:^|\s)#([^#@\n]{0,30})$/)?.[1] : undefined
  const rechercheNom = mentionnables.length ? avant.match(/(?:^|\s)@([^#@\n]{0,30})$/)?.[1] : undefined
  const suggestions = recherche === undefined || masque ? [] : citables.filter((m) => sansAccents(m.nom).includes(sansAccents(recherche.trimStart()))).slice(0, 20)
  const personnes = rechercheNom === undefined || masque ? [] : mentionnables.filter((p) => sansAccents(p.nom).includes(sansAccents(rechercheNom.trimStart())))
  const placer = (nouveau: string, pos: number) => {
    setTexte(nouveau); setCurseur(pos); setMasque(false)
    requestAnimationFrame(() => { champ.current?.focus(); champ.current?.setSelectionRange(pos, pos) })
  }
  const inserer = (signe: '#' | '@', nom: string, longueur: number) => {
    const debut = avant.slice(0, avant.length - longueur - 1)
    placer(`${debut}${signe}${nom} ${texte.slice(curseur)}`, debut.length + nom.length + 2)
  }
  const signe = (s: '#' | '@') => {
    const nouveau = `${avant}${curseur > 0 && !/\s$/.test(avant) ? ' ' : ''}${s}${texte.slice(curseur)}`
    placer(nouveau, nouveau.length - texte.slice(curseur).length)
  }
  const pret = (!!texte.trim() || pieces.length > 0) && !envoi
  const valider = async () => {
    if (!pret) return
    setEnvoi(true)
    if (await envoyer(texte.trim(), pieces)) { setTexte(''); setCurseur(0); setPieces([]) }
    else garderBrouillon(brouillon, texte)
    setEnvoi(false)
  }
  const premiere = personnes[0] ? () => inserer('@', personnes[0].nom, rechercheNom!.length) : suggestions[0] ? () => inserer('#', suggestions[0].nom, recherche!.length) : null
  const touche = (e: KeyboardEvent) => {
    if (premiere && (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey))) { e.preventDefault(); premiere(); return }
    if (premiere && e.key === 'Escape') { e.preventDefault(); setMasque(true); return }
    // Clavier physique : Entrée envoie, Maj + Entrée passe à la ligne ; sur téléphone, Entrée passe à la ligne
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || (clavier && !e.shiftKey))) { e.preventDefault(); void valider() }
  }
  return (
    <Box data-composeur sx={{ ...(collante ? { position: 'sticky', bottom: 'var(--barre-basse, 0px)', zIndex: 2 } : {}), bgcolor: fond, pt: 1, pb: { xs: 1, md: 0.5 } }}>
      {personnes.length > 0 && (
        <Box role="list" aria-label="Personnes à citer" sx={bande}>
          {personnes.map((p) => (
            <Box role="listitem" key={p.cle} sx={{ flexShrink: 0 }}>
              <Chip icon={<AlternateEmail />} onMouseDown={(e) => e.preventDefault()} onClick={() => inserer('@', p.nom, rechercheNom!.length)} variant="outlined"
                label={<><Box component="span" sx={{ fontWeight: 600 }}>{p.nom}</Box><Box component="span" sx={{ opacity: 0.8, ml: 0.75 }}>{p.role}</Box></>} sx={{ ...puce, bgcolor: 'background.paper' }} />
            </Box>
          ))}
        </Box>
      )}
      {suggestions.length > 0 && (
        <Box role="list" aria-label="Magasins à citer" sx={bande}>
          {suggestions.map((m) => (
            <Box role="listitem" key={m.nom} sx={{ flexShrink: 0 }}>
              <Chip icon={<StorefrontOutlined />} onMouseDown={(e) => e.preventDefault()} onClick={() => inserer('#', m.nom, recherche!.length)} variant="outlined" label={m.nom} sx={{ ...puce, bgcolor: 'background.paper' }} />
            </Box>
          ))}
        </Box>
      )}
      {pieces.length > 0 && <Box sx={{ pb: 1 }}><PiecesEnAttente pieces={pieces} changer={setPieces} /></Box>}
      {reponse && <ReponseEnCours x={reponse.x} annuler={reponse.annuler} />}
      {visibilite && (
        <Typography variant="caption" component="p" sx={{ px: 1, pb: 0.5, m: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5, color: visibilite.equipe ? 'warning.dark' : 'info.dark' }}>
          {visibilite.equipe ? <LockOutlined sx={{ fontSize: 16 }} /> : <StorefrontOutlined sx={{ fontSize: 16 }} />}{visibilite.texte}
        </Typography>
      )}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5 }}>
        {joindre && <BoutonJoindre pieces={pieces} changer={setPieces} signaler={signaler} />}
        {mentionnables.length > 0 && <Bulle titre="Citer une personne"><IconButton onClick={() => signe('@')} aria-label="Citer une personne" sx={{ width: 48, height: 48, flexShrink: 0 }}><AlternateEmail /></IconButton></Bulle>}
        {citables.length > 0 && <Bulle titre="Citer un magasin"><IconButton onClick={() => signe('#')} aria-label="Citer un magasin" sx={{ width: 48, height: 48, flexShrink: 0 }}><Tag /></IconButton></Bulle>}
        <TextField placeholder={placeholder} multiline maxRows={6} fullWidth value={texte} inputRef={champ}
          onChange={(e) => { setTexte(e.target.value); setCurseur(e.target.selectionStart ?? e.target.value.length); setMasque(false) }}
          onSelect={(e) => setCurseur((e.target as HTMLTextAreaElement).selectionStart ?? 0)} onKeyDown={touche}
          slotProps={{ htmlInput: { maxLength: 4000, 'aria-label': 'Message' }, input: { endAdornment: <BoutonDictee libelle="Message" changer={setTexte} signaler={signaler} /> } }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '24px', minHeight: 48, py: 1.25, px: 2, bgcolor: 'action.hover' },
            '& fieldset': visibilite ? { borderColor: visibilite.equipe ? 'warning.main' : 'info.main', borderWidth: 2 } : { borderColor: 'transparent' } }} />
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

type Element = { genre: 'message'; x: Message; instant: string } | { genre: 'tache'; t: ActionSuivie; instant: string }

// Un fil : groupe d'un magasin (avec ses comptes rendus et ses tâches), groupe libre ou échange avec une personne.
// cadre : le fil défile dans son cadre (PC) ; sinon la page défile et la saisie reste collée en bas.
// aLaFin : la page s'ouvre sur les derniers messages (téléphone).
// lectureSeule : aperçu de l'espace d'un franchisé par le Directeur de réseau.
// basculer : groupe d'un magasin vu par l'équipe, onglets « Avec le franchisé » / « Équipe seule » en tête (58A).
// demandes : demandes au siège connues, pour la puce d'un message devenu demande (57A).
export function FilMessages({ reseau, fil, contact, signaler, lectureSeule = false, cadre = false, aLaFin = false, fond = 'background.paper', basculer, demandes = [] }: {
  reseau: Reseau; fil: Fil; contact?: Contact; signaler: (msg: string) => void; lectureSeule?: boolean; cadre?: boolean; aLaFin?: boolean; fond?: string
  basculer?: (equipe: boolean) => void; demandes?: Demande[]
}) {
  const { profil } = useAuth()
  const { messagerie: brute, charge, envoyer, envoyerFil, supprimer, lireFil, signalerChangement } = useMessagerie()
  const [params] = useSearchParams()
  const [reponse, setReponse] = useState<Message | null>(null)
  const [aModifier, setAModifier] = useState<Message | null>(null)
  const [enDemande, setEnDemande] = useState<Message | null>(null)
  const [surligne, setSurligne] = useState<number | null>(null)
  const messagerie = useMemo(() => (brute && lectureSeule ? sansPrives(brute) : brute), [brute, lectureSeule])
  const [filtre, setFiltre] = useState<string | null>(null)
  const [tous, setTous] = useState(false)
  const [choisi, setChoisi] = useState<number | null>(null)
  const [tache, setTache] = useState<Message | null>(null)
  const zone = useRef<HTMLDivElement | null>(null)
  // Aller à un message (citation, épingle, résultat de recherche) : tout le fil s'affiche, le message est mis en évidence
  const allerA = (id: number) => {
    setTous(true); setSurligne(id)
    window.setTimeout(() => {
      document.getElementById(`message-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      window.setTimeout(() => setSurligne((s) => (s === id ? null : s)), 2500)
    }, 60)
  }
  const demandeParam = Number(params.get('message'))
  const dejaAlle = useRef(false)
  const m = fil.genre === 'magasin' ? reseau.magasins.find((x) => x.nom === fil.magasin) : undefined
  const groupe = fil.genre === 'groupe' ? messagerie?.groupes.find((g) => g.id === fil.id) : undefined
  const complet = useMemo(() => messagesDuFil(messagerie, fil), [messagerie, fil])
  const liste = filtre ? complet.filter((x) => x.magasins.includes(filtre)) : complet
  // Groupe d'un magasin : tâches rangées avec les messages ; les comptes rendus vont dans le fil d'actualité (Joseph, 22/10/2026)
  const elements = useMemo<Element[]>(() => {
    const l: Element[] = liste.map((x) => ({ genre: 'message', x, instant: x.creeLe }))
    if (fil.genre === 'magasin') {
      for (const t of actionsDuMagasin(reseau, fil.magasin)) {
        if (!t.libre || (t.libre.fil === 'equipe') !== fil.equipe) continue
        const source = t.libre.message ? liste.find((x) => x.id === t.libre!.message) : undefined
        l.push({ genre: 'tache', t, instant: source ? source.creeLe : `${t.libre.creeLe.slice(0, 10)}T00:00:00` })
      }
    }
    // Une tâche née d'un message vient juste après lui
    return l.sort((a, b) => a.instant.localeCompare(b.instant) || (a.genre === 'message' ? -1 : 1))
  }, [liste, fil, reseau])
  // Magasins cités dans un échange à deux, pour le trier
  const cites = useMemo(() => [...new Set(complet.flatMap((x) => x.magasins))].sort((a, b) => a.localeCompare(b, 'fr')), [complet])
  const citables = useMemo(() => (contact ? (contact.magasins.length ? contact.magasins : reseau.magasins) : []), [contact, reseau])
  const moi = mesCles(profil)
  const mentionnables = useMemo(() => membresDuFil(reseau, fil, groupe?.membres).filter((p) => !moi.includes(p.cle)), [reseau, fil, groupe, moi.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  const noms = useMemo(() => {
    const l = new Set<string>([...citables.map((x) => x.nom), ...cites, ...membresDuFil(reseau, fil, groupe?.membres).map((p) => p.nom)])
    for (const x of contact ? contact.magasins : []) for (const p of participants(reseau, x)) l.add(p.nom)
    return [...l]
  }, [citables, cites, contact, reseau, fil, groupe])
  // Séparateur « Nouveaux messages » : messages non lus à l'ouverture du fil
  const [nouveauxAvant, setNouveauxAvant] = useState<Set<number> | null>(null)
  const aLire = messagerie ? complet.filter((x) => estNouveau(x, messagerie)).length : 0
  useEffect(() => {
    if (messagerie && nouveauxAvant === null) setNouveauxAvant(new Set(complet.filter((x) => estNouveau(x, messagerie)).map((x) => x.id)))
    if (!lectureSeule && aLire > 0) lireFil(fil)
  }, [messagerie, nouveauxAvant, aLire, lectureSeule, lireFil, fil, complet])

  // Aller aux derniers messages à l'ouverture et à chaque nouveau message
  const nombre = elements.length
  useEffect(() => {
    if (!charge) return
    const id = requestAnimationFrame(() => {
      if (cadre && zone.current) zone.current.scrollTop = zone.current.scrollHeight
      else if (aLaFin) window.scrollTo({ top: document.documentElement.scrollHeight })
    })
    return () => cancelAnimationFrame(id)
  }, [charge, nombre, cadre, aLaFin])

  // Lien vers un message précis (recherche) : on y va une fois les messages chargés
  useEffect(() => {
    if (!charge || dejaAlle.current || !demandeParam || !complet.some((x) => x.id === demandeParam)) return
    dejaAlle.current = true
    const id = demandeParam
    const t = window.setTimeout(() => allerA(id), 200)
    return () => window.clearTimeout(t)
  }, [charge, demandeParam, complet]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!charge) return <Typography variant="body2" color="text.secondary">Chargement des messages…</Typography>
  if (!messagerie) return <EmptyState icone={<ForumOutlined />} titre="Messagerie pas encore activée" texte="Les messages apparaîtront ici dès son activation dans la base." />

  const ecrire = async (texte: string, pieces: Piece[]) => {
    try {
      if (fil.genre === 'personne') {
        const magasins = [...new Set([...(filtre ? [filtre] : []), ...magasinsCites(texte, citables)])]
        await envoyer(fil.cle, texte, magasins, magasins[0] ?? contact?.magasins[0]?.nom ?? null, pieces, reponse?.id ?? null)
      } else {
        const bas = texte.toLocaleLowerCase('fr')
        await envoyerFil(fil, texte, mentionnables.filter((p) => bas.includes(`@${p.nom.toLocaleLowerCase('fr')}`)).map((p) => p.cle), pieces, reponse?.id ?? null)
      }
      setReponse(null)
      return true
    } catch { signaler('Message non envoyé. Réessaie dans un instant.'); return false }
  }
  const ecrirePossible = !lectureSeule && (fil.genre !== 'magasin' || !!m) && (fil.genre !== 'groupe' || !!groupe)
  // Gestes sur un message (60A) : base en version 5 pour répondre en citant, réagir, modifier, épingler, créer une demande
  const v5 = messagerie.version >= 5 && !lectureSeule
  const equipeDuReseau = profil?.role !== 'franchise' && !reseau.espace
  const gestesDe = (x: Message, deMoi: boolean): GestesMessage => {
    const fermer = () => setChoisi(null)
    const echec = () => signaler('Action impossible pour le moment. Réessaie dans un instant.')
    return {
      repondre: v5 && ecrirePossible ? () => { fermer(); setReponse(x) } : undefined,
      reagir: v5 ? (r) => { reagirMessage(x.id, r).then(() => signalerChangement(), echec) } : undefined,
      modifier: v5 && modifiable(x, messagerie.moi) ? () => { fermer(); setAModifier(x) } : undefined,
      epingler: v5 && !x.lot ? () => { fermer(); epinglerMessage(x.id, !x.epingleLe).then(() => { void signalerChangement(); signaler(x.epingleLe ? 'Épingle retirée.' : 'Message épinglé en tête de la conversation.') }, echec) } : undefined,
      enTache: !lectureSeule && fil.genre === 'magasin' ? () => { fermer(); setTache(x) } : undefined,
      enDemande: v5 && equipeDuReseau && fil.genre === 'magasin' && !fil.equipe && x.demande === null && x.auteurRole === 'franchise' ? () => { fermer(); setEnDemande(x) } : undefined,
      supprimer: deMoi && !lectureSeule ? () => { supprimer(x.id).then(() => { fermer(); signaler('Message supprimé.') }, () => signaler('Suppression impossible pour le moment. Réessaie dans un instant.')) } : undefined,
    }
  }
  const affiches = tous ? elements : elements.slice(-MAXI)
  const msgAffiches = affiches.flatMap((e) => (e.genre === 'message' ? [e.x] : []))
  const premierNouveau = msgAffiches.find((x) => nouveauxAvant?.has(x.id))
  const contexteDe = (x: Message) => (fil.genre === 'personne' && !filtre ? x.magasins.join(', ') : '')
  const filtres = fil.genre === 'personne' && cites.length > 0 && (cites.length > 1 || complet.some((x) => !x.magasins.length)) && (
    <Box role="group" aria-label="Magasins affichés" sx={{ display: 'flex', gap: 1, overflowX: 'auto', py: 1, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
      {[null, ...cites].map((n) => (
        <Chip key={n ?? ''} label={n ?? 'Tous'} onClick={() => setFiltre(n)} aria-pressed={filtre === n}
          color={filtre === n ? 'primary' : 'default'} variant={filtre === n ? 'filled' : 'outlined'}
          sx={{ flexShrink: 0, height: { xs: 48, sm: 36 }, borderRadius: 2, fontSize: '0.875rem' }} />
      ))}
    </Box>
  )
  const titreFil = fil.genre === 'personne' ? contact?.nom ?? '' : fil.genre === 'groupe' ? groupe?.nom ?? '' : fil.magasin
  const vide = fil.genre === 'magasin' ? (fil.equipe ? 'Aucun message entre membres de l’équipe sur ce magasin.' : 'Aucun échange sur ce magasin pour le moment.') : 'Aucun message.'
  const corps = (
    <>
      {elements.length > MAXI && !tous && <Box sx={{ textAlign: 'center' }}><Button onClick={() => setTous(true)} sx={{ minHeight: 48 }}>Voir les {elements.length} éléments</Button></Box>}
      {!elements.length
        ? <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>{vide}</Typography>
        : (
          <Box component="ul" aria-label={`Messages de ${titreFil}`} sx={{ listStyle: 'none', m: 0, p: 0, pb: 1,
            ...(surligne ? { [`& #message-${surligne} > .MuiButtonBase-root, & #message-${surligne} > div:first-of-type`]: { boxShadow: (t) => `0 0 0 3px ${t.palette.secondary.main}` } } : {}) }}>
            {affiches.map((e, i) => {
              const precedent = affiches[i - 1]
              const nouveauJour = !precedent || jourDuFil(precedent.instant) !== jourDuFil(e.instant)
              const jour = nouveauJour && <Box component="li" aria-hidden sx={{ textAlign: 'center', mt: 2, mb: 0.5 }}><Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{jourDuFil(e.instant)}</Typography></Box>
              if (e.genre === 'tache') return <Fragment key={e.t.cle}>{jour}<CarteTache reseau={reseau} x={e.t} signaler={signaler} /></Fragment>
              const x = e.x
              const avantMsg = precedent?.genre === 'message' ? precedent.x : undefined
              const apres = affiches[i + 1]
              const suivant = apres?.genre === 'message' ? apres.x : undefined
              const deMoi = x.auteur === messagerie.moi
              const memeContexte = (a?: Message, b?: Message) => !!a && !!b && memeGroupe(a, b) && contexteDe(a) === contexteDe(b)
              const premier = nouveauJour || x === premierNouveau || !memeContexte(avantMsg, x)
              return (
                <Fragment key={x.id}>
                  {jour}
                  {x === premierNouveau && <Box component="li" aria-hidden sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1 }}>
                    <Divider sx={{ flex: 1, borderColor: 'error.main' }} /><Typography variant="caption" color="error" sx={{ fontWeight: 600 }}>Nouveaux messages</Typography><Divider sx={{ flex: 1, borderColor: 'error.main' }} />
                  </Box>}
                  <BulleMessage msg={x} moi={deMoi} noms={noms} premier={premier} dernier={suivant === premierNouveau || !memeContexte(x, suivant)}
                    contexte={premier ? contexteDe(x) : ''}
                    choisi={choisi === x.id} choisir={!lectureSeule ? () => setChoisi((c) => (c === x.id ? null : x.id)) : undefined}
                    cite={x.repondA !== null ? { x: messageDeNumero(complet, x.repondA) } : undefined} allerA={allerA}
                    demande={x.demande !== null ? { id: x.demande, d: demandes.find((d) => d.id === x.demande) } : undefined}
                    gestes={gestesDe(x, deMoi)} />
                </Fragment>
              )
            })}
          </Box>
        )}
      {tache && fil.genre === 'magasin' && (
        <DialogAction reseau={reseau} magasins={[fil.magasin]} action={null} depuis={{ texte: tache.texte, equipe: fil.equipe, message: tache.id }}
          porteurInitial={tache.auteur !== messagerie.moi && !fil.equipe && tache.auteurRole === 'franchise' ? tache.auteurNom : ''}
          onFermer={(msg) => { setTache(null); if (msg) signaler(msg) }} />
      )}
      {aModifier && <DialogModifier x={aModifier} fermer={() => setAModifier(null)} signaler={signaler} />}
      {enDemande && <DialogDemande x={enDemande} fermer={() => setEnDemande(null)} signaler={signaler} />}
    </>
  )
  // 58A : qui lira le message, dans le groupe d'un magasin vu par l'équipe
  const franchisesDuMagasin = m ? participants(reseau, m).filter((p) => p.cle.startsWith('franchise:')).map((p) => p.nom) : []
  const visibilite = fil.genre === 'magasin' && basculer
    ? fil.equipe ? { texte: 'Invisible du franchisé : équipe seule', equipe: true }
      : { texte: franchisesDuMagasin.length ? `Visible par ${franchisesDuMagasin.join(', ')} (franchisé)` : 'Visible par le franchisé', equipe: false }
    : undefined
  const ongletsFil = fil.genre === 'magasin' && basculer && (
    <OngletsFil magasin={fil.magasin} equipe={fil.equipe} changer={basculer} />
  )
  const epingles = v5 || lectureSeule ? <BandeEpingles messages={complet} aller={(x) => allerA(x.id)} retirer={v5 ? (x) => { epinglerMessage(x.id, false).then(() => signalerChangement(), () => signaler('Action impossible pour le moment. Réessaie dans un instant.')) } : undefined} /> : null
  const placeholder = fil.genre === 'personne' ? `Message à ${contact?.nom ?? ''}` : fil.genre === 'magasin' && fil.equipe ? 'Message à l’équipe' : 'Message au groupe'
  const saisie = ecrirePossible && (
    <Saisie citables={citables} mentionnables={mentionnables} envoyer={ecrire} fond={fond} collante={!cadre}
      joindre={fil.genre === 'personne' ? messagerie.version >= 3 : messagerie.version >= 4} signaler={signaler} placeholder={placeholder}
      brouillon={`${messagerie.cle}|${fil.genre === 'magasin' ? `magasin:${fil.magasin}` : cleFil(fil)}`} reponse={reponse ? { x: reponse, annuler: () => setReponse(null) } : undefined}
      visibilite={visibilite} />
  )
  if (cadre) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {ongletsFil && <Box sx={{ px: 2 }}>{ongletsFil}</Box>}
        {epingles && <Box sx={{ px: 2 }}>{epingles}</Box>}
        {filtres && <Box sx={{ px: 2 }}>{filtres}</Box>}
        <Box ref={zone} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2 }}>{corps}</Box>
        {saisie && <Box sx={{ px: 1, pb: 1, borderTop: '1px solid', borderColor: 'divider' }}>{saisie}</Box>}
      </Box>
    )
  }
  // Conversation sur téléphone : la saisie reste au bas de l'écran même quand le fil est court
  if (aLaFin) return <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - 64px - 130px)' }}>{ongletsFil}{epingles}{filtres}<Box sx={{ flex: 1 }}>{corps}</Box>{saisie}</Box>
  return <Box>{ongletsFil}{epingles}{filtres}{corps}{saisie}</Box>
}

// 58A : les deux fils du groupe d'un magasin en onglets soulignés, avec les non lus de chacun
function OngletsFil({ magasin, equipe, changer }: { magasin: string; equipe: boolean; changer: (equipe: boolean) => void }) {
  const n = useNonLusFils(magasin)
  return (
    <Onglets libres libelle={`Fils de ${magasin}`} valeur={equipe ? 'equipe' : 'avec'} onChange={(v) => changer(v === 'equipe')}
      rubriques={[
        { vue: 'avec', libelle: 'Avec le franchisé', court: 'Avec le franchisé', icone: <StorefrontOutlined />, pastille: equipe ? n.avec : 0 },
        { vue: 'equipe', libelle: 'Équipe seule', court: 'Équipe seule', icone: <LockOutlined />, pastille: equipe ? 0 : n.equipe },
      ]} />
  )
}

// Non lus des deux fils d'un magasin
export function useNonLusFils(magasin: string): { avec: number; equipe: number } {
  const { messagerie } = useMessagerie()
  if (!messagerie) return { avec: 0, equipe: 0 }
  const l = messagesDu(messagerie, magasin).filter((x) => estNouveau(x, messagerie))
  return { avec: l.filter((x) => !x.equipe).length, equipe: l.filter((x) => x.equipe).length }
}

// Messages non lus d'un magasin (pastille de l'onglet)
export function useNonLusMagasin(magasin: string): number {
  const n = useNonLusFils(magasin)
  return n.avec + n.equipe
}

// Groupe d'un magasin dans sa fiche ou dans un volet : le fil, et pour l'équipe les onglets des deux fils
export function SectionMessages({ reseau, m, signaler, lectureSeule = false, entete }: { reseau: Reseau; m: Magasin; signaler: (msg: string) => void; lectureSeule?: boolean; entete?: ReactNode }) {
  const { profil } = useAuth()
  const equipePossible = profil?.role !== 'franchise' && !lectureSeule
  const [equipe, setEquipe] = useState(false)
  const fil: Fil = useMemo(() => ({ genre: 'magasin', magasin: m.nom, equipe: equipePossible && equipe }), [m.nom, equipePossible, equipe])
  return (
    <Box sx={{ bgcolor: 'background.paper', borderRadius: 3, border: '1px solid', borderColor: 'divider', p: { xs: 2, md: 3 }, pb: { xs: 1, md: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 1 }}>
        <Typography component="h2" sx={[cartouche, { mr: 'auto' }]}>Échanges</Typography>
        {entete}
      </Box>
      <FilMessages key={`${m.nom}|${fil.genre === 'magasin' && fil.equipe}`} reseau={reseau} fil={fil} signaler={signaler} lectureSeule={lectureSeule}
        basculer={equipePossible ? setEquipe : undefined} />
    </Box>
  )
}
