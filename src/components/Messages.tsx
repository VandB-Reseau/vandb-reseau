import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Chip from '@mui/material/Chip'
import Badge from '@mui/material/Badge'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { SxProps, Theme } from '@mui/material/styles'
import AlternateEmail from '@mui/icons-material/AlternateEmail'
import CheckCircle from '@mui/icons-material/CheckCircle'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import LockOpenOutlined from '@mui/icons-material/LockOpenOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked'
import SendOutlined from '@mui/icons-material/SendOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import Tag from '@mui/icons-material/Tag'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import { useAuth } from '../auth/AuthContext'
import { useMessagerie } from '../data/MessagerieContext'
import { useReseau } from '../data/ReseauContext'
import {
  estNouveau, heure, horodatage, jourDuFil, libelleAuteur, magasinsCites, messagesDu, messagesDuFil, mesCles, participants,
  membresDuFil, sansPrives, type Contact, type Fil, type Message, type Participant,
} from '../data/messagerie'
import { actionsDuMagasin, echeanceDate, enRetard, type ActionSuivie } from '../data/actions'
import { libelleTypeVisite, visiteFaite, type Magasin, type Reseau, type Visite } from '../data/modele'
import { lienCompteRendu } from '../data/visites'
import { dateCourte } from '../lib/format'
import { EmptyState } from './EmptyState'
import { Bulle } from './Outils'
import { BoutonJoindre, ListePieces, PiecesEnAttente } from './Pieces'
import { DialogAction, useEcritureActions } from './Actions'
import type { Piece } from '../lib/pieces'

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

// contexte : magasins cités (échange à deux) ; choisi : l'heure complète et les actions du message sont affichées
function BulleMessage({ msg, moi, noms, premier, dernier, choisi, contexte, choisir, supprimer, enTache }: {
  msg: Message; moi: boolean; noms: string[]; premier: boolean; dernier: boolean; choisi: boolean; contexte: string
  choisir?: () => void; supprimer?: () => void; enTache?: () => void
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, mt: 0.25, flexWrap: 'wrap', justifyContent: moi ? 'flex-end' : 'flex-start' }}>
          <Typography variant="caption" color="text.secondary">{choisi ? horodatage(msg.creeLe) : heure(msg.creeLe)}</Typography>
          {choisi && enTache && <Button size="small" startIcon={<TaskAltOutlined />} onClick={enTache} sx={{ minHeight: 40 }}>En faire une tâche</Button>}
          {choisi && supprimer && <Button size="small" color="error" startIcon={<DeleteOutlined />} onClick={supprimer} aria-label={`Supprimer mon message du ${horodatage(msg.creeLe)}`} sx={{ minHeight: 40 }}>Supprimer</Button>}
        </Box>
      )}
    </Box>
  )
}

// Carte d'un compte rendu de visite dans le groupe du magasin
function CarteVisite({ v }: { v: Visite }) {
  const parties = v.plan.filter((a) => a.action.trim()).length
  return (
    <Box component="li" sx={{ display: 'flex', justifyContent: 'center', my: 1.5 }}>
      <ButtonBase component={RouterLink} to={lienCompteRendu(v)} aria-label={`Compte rendu : ${libelleTypeVisite(v.type)} du ${dateCourte(v.date)}`}
        sx={{ width: '100%', maxWidth: 440, display: 'flex', gap: 1.5, alignItems: 'center', textAlign: 'left', p: 1.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', '&:hover': { bgcolor: 'action.hover' } }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'action.selected', display: 'grid', placeItems: 'center', flexShrink: 0 }}><DescriptionOutlined /></Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }}>{libelleTypeVisite(v.type)} du {dateCourte(v.date)} · compte rendu</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[v.visiteurs.join(', '), parties ? `${parties} tâche${parties > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
        <Typography variant="body2" color="primary" sx={{ fontWeight: 600, flexShrink: 0 }}>Lire</Typography>
      </ButtonBase>
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
            aria-label={faite ? `Remettre à faire : ${x.a.action}` : `Marquer faite : ${x.a.action}`} sx={{ minHeight: 48, borderRadius: 999, flexShrink: 0 }}>
            {faite ? 'Faite' : 'Fait'}
          </Button>
        )}
      </Box>
    </Box>
  )
}

const puce = { height: { xs: 48, sm: 40 }, borderRadius: 999, fontSize: '0.875rem' }
const bande = { display: 'flex', gap: 1, overflowX: 'auto', pb: 1, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }

// Saisie d'un message : champ arrondi et envoi sur une ligne.
// citables : magasins à citer avec « # » ; mentionnables : personnes à citer avec « @ » (proposées en puces au-dessus du champ).
// joindre : photos et fichiers possibles (base à jour)
// bascule : groupe d'un magasin, picto « Avec le franchisé » / « Équipe seule » juste avant l'envoi ; le texte en cours suit le changement de fil
function Saisie({ citables, mentionnables, envoyer, fond, collante, joindre, signaler, placeholder, bascule }: {
  citables: Magasin[]; mentionnables: Participant[]
  envoyer: (texte: string, pieces: Piece[]) => Promise<boolean>; fond: string; collante: boolean; joindre: boolean; signaler: (m: string) => void; placeholder: string
  bascule?: Bascule
}) {
  const [texte, setTexte] = useState(() => reprendreBrouillon(bascule?.magasin))
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
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5 }}>
        {joindre && <BoutonJoindre pieces={pieces} changer={setPieces} signaler={signaler} />}
        {mentionnables.length > 0 && <Bulle titre="Citer une personne"><IconButton onClick={() => signe('@')} aria-label="Citer une personne" sx={{ width: 48, height: 48, flexShrink: 0 }}><AlternateEmail /></IconButton></Bulle>}
        {citables.length > 0 && <Bulle titre="Citer un magasin"><IconButton onClick={() => signe('#')} aria-label="Citer un magasin" sx={{ width: 48, height: 48, flexShrink: 0 }}><Tag /></IconButton></Bulle>}
        <TextField placeholder={placeholder} multiline maxRows={6} fullWidth value={texte} inputRef={champ}
          onChange={(e) => { setTexte(e.target.value); setCurseur(e.target.selectionStart ?? e.target.value.length); setMasque(false) }}
          onSelect={(e) => setCurseur((e.target as HTMLTextAreaElement).selectionStart ?? 0)} onKeyDown={touche}
          slotProps={{ htmlInput: { maxLength: 4000, 'aria-label': 'Message' } }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '24px', minHeight: 48, py: 1.25, px: 2, bgcolor: 'action.hover' }, '& fieldset': { borderColor: 'transparent' } }} />
        {bascule && <PictoFil b={bascule} changer={() => { garderBrouillon(bascule.magasin, texte); bascule.changer(!bascule.equipe) }} />}
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

type Element = { genre: 'message'; x: Message; instant: string } | { genre: 'visite'; v: Visite; instant: string } | { genre: 'tache'; t: ActionSuivie; instant: string }

// Un fil : groupe d'un magasin (avec ses comptes rendus et ses tâches), groupe libre ou échange avec une personne.
// cadre : le fil défile dans son cadre (PC) ; sinon la page défile et la saisie reste collée en bas.
// aLaFin : la page s'ouvre sur les derniers messages (téléphone).
// lectureSeule : aperçu de l'espace d'un franchisé par le Directeur de réseau.
export function FilMessages({ reseau, fil, contact, signaler, lectureSeule = false, cadre = false, aLaFin = false, fond = 'background.paper', basculer }: {
  reseau: Reseau; fil: Fil; contact?: Contact; signaler: (msg: string) => void; lectureSeule?: boolean; cadre?: boolean; aLaFin?: boolean; fond?: string
  basculer?: (equipe: boolean) => void
}) {
  const { profil } = useAuth()
  const { messagerie: brute, charge, envoyer, envoyerFil, supprimer, lireFil } = useMessagerie()
  const messagerie = useMemo(() => (brute && lectureSeule ? sansPrives(brute) : brute), [brute, lectureSeule])
  const [filtre, setFiltre] = useState<string | null>(null)
  const [tous, setTous] = useState(false)
  const [choisi, setChoisi] = useState<number | null>(null)
  const [tache, setTache] = useState<Message | null>(null)
  const zone = useRef<HTMLDivElement | null>(null)
  const m = fil.genre === 'magasin' ? reseau.magasins.find((x) => x.nom === fil.magasin) : undefined
  const groupe = fil.genre === 'groupe' ? messagerie?.groupes.find((g) => g.id === fil.id) : undefined
  const complet = useMemo(() => messagesDuFil(messagerie, fil), [messagerie, fil])
  const liste = filtre ? complet.filter((x) => x.magasins.includes(filtre)) : complet
  // Groupe d'un magasin : comptes rendus (avec le franchisé) et tâches, rangés avec les messages
  const elements = useMemo<Element[]>(() => {
    const l: Element[] = liste.map((x) => ({ genre: 'message', x, instant: x.creeLe }))
    if (fil.genre === 'magasin') {
      if (!fil.equipe) {
        for (const v of reseau.visites) if (v.magasin === fil.magasin && v.id !== null && visiteFaite(v, reseau.jour) && v.type !== 'appel' && v.type !== 'point') l.push({ genre: 'visite', v, instant: v.creeLe || `${v.date}T12:00:00` })
      }
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

  if (!charge) return <Typography variant="body2" color="text.secondary">Chargement des messages…</Typography>
  if (!messagerie) return <EmptyState icone={<ForumOutlined />} titre="Messagerie pas encore activée" texte="Les messages apparaîtront ici dès son activation dans la base." />

  const ecrire = async (texte: string, pieces: Piece[]) => {
    try {
      if (fil.genre === 'personne') {
        const magasins = [...new Set([...(filtre ? [filtre] : []), ...magasinsCites(texte, citables)])]
        await envoyer(fil.cle, texte, magasins, magasins[0] ?? contact?.magasins[0]?.nom ?? null, pieces)
      } else {
        const bas = texte.toLocaleLowerCase('fr')
        await envoyerFil(fil, texte, mentionnables.filter((p) => bas.includes(`@${p.nom.toLocaleLowerCase('fr')}`)).map((p) => p.cle), pieces)
      }
      return true
    } catch { signaler('Message non envoyé. Réessaie dans un instant.'); return false }
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
          sx={{ flexShrink: 0, height: { xs: 48, sm: 36 }, borderRadius: 999, fontSize: '0.875rem' }} />
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
          <Box component="ul" aria-label={`Messages de ${titreFil}`} sx={{ listStyle: 'none', m: 0, p: 0, pb: 1 }}>
            {affiches.map((e, i) => {
              const precedent = affiches[i - 1]
              const nouveauJour = !precedent || jourDuFil(precedent.instant) !== jourDuFil(e.instant)
              const jour = nouveauJour && <Box component="li" aria-hidden sx={{ textAlign: 'center', mt: 2, mb: 0.5 }}><Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{jourDuFil(e.instant)}</Typography></Box>
              if (e.genre === 'visite') return <Fragment key={`v${e.v.id}`}>{jour}<CarteVisite v={e.v} /></Fragment>
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
                    enTache={fil.genre === 'magasin' ? () => { setChoisi(null); setTache(x) } : undefined}
                    supprimer={deMoi && !lectureSeule ? () => { supprimer(x.id).then(() => { setChoisi(null); signaler('Message supprimé.') }, () => signaler('Suppression impossible pour le moment. Réessaie dans un instant.')) } : undefined} />
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
    </>
  )
  const ecrirePossible = !lectureSeule && (fil.genre !== 'magasin' || !!m) && (fil.genre !== 'groupe' || !!groupe)
  const placeholder = fil.genre === 'personne' ? `Message à ${contact?.nom ?? ''}` : fil.genre === 'magasin' && fil.equipe ? 'Message à l’équipe' : 'Message au groupe'
  const saisie = ecrirePossible && (
    <Saisie citables={citables} mentionnables={mentionnables} envoyer={ecrire} fond={fond} collante={!cadre}
      joindre={fil.genre === 'personne' ? messagerie.version >= 3 : messagerie.version >= 4} signaler={signaler} placeholder={placeholder}
      bascule={basculer && fil.genre === 'magasin' ? { magasin: fil.magasin, equipe: fil.equipe, changer: basculer } : undefined} />
  )
  if (cadre) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {filtres && <Box sx={{ px: 2 }}>{filtres}</Box>}
        <Box ref={zone} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2 }}>{corps}</Box>
        {saisie && <Box sx={{ px: 1, pb: 1, borderTop: '1px solid', borderColor: 'divider' }}>{saisie}</Box>}
      </Box>
    )
  }
  // Conversation sur téléphone : la saisie reste au bas de l'écran même quand le fil est court
  if (aLaFin) return <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - 64px - 130px)' }}>{filtres}<Box sx={{ flex: 1 }}>{corps}</Box>{saisie}</Box>
  return <Box>{filtres}{corps}{saisie}</Box>
}

// Fil d'un magasin, choisi par un picto à côté de l'envoi (Joseph, 22/10/2026) : cadenas ouvert = avec le franchisé, fermé = équipe seule.
// La pastille compte les non lus de l'autre fil.
export interface Bascule { magasin: string; equipe: boolean; changer: (equipe: boolean) => void }
let brouillon: { magasin: string; texte: string } | null = null
const garderBrouillon = (magasin: string, texte: string) => { brouillon = texte.trim() ? { magasin, texte } : null }
function reprendreBrouillon(magasin?: string) {
  const b = brouillon
  brouillon = null
  return b && b.magasin === magasin ? b.texte : ''
}

function PictoFil({ b, changer }: { b: Bascule; changer: () => void }) {
  const nonLus = useNonLusFils(b.magasin)
  const autre = b.equipe ? nonLus.avec : nonLus.equipe
  const titre = b.equipe ? 'Équipe seule' : 'Avec le franchisé'
  return (
    <Bulle titre={titre}>
      <IconButton onClick={changer} aria-label="Équipe seule" aria-pressed={b.equipe}
        sx={{ width: 48, height: 48, flexShrink: 0, ...(b.equipe ? { bgcolor: 'warning.light', color: 'warning.contrastText', '&:hover': { bgcolor: 'warning.main' } } : {}) }}>
        <Badge badgeContent={autre} color="error" aria-label={autre ? `${autre} non lu${autre > 1 ? 's' : ''} ${b.equipe ? 'avec le franchisé' : 'en équipe seule'}` : undefined}>
          {b.equipe ? <LockOutlined /> : <LockOpenOutlined />}
        </Badge>
      </IconButton>
    </Bulle>
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

// Groupe d'un magasin dans sa fiche : le fil, et pour l'équipe le picto du fil à côté de l'envoi
export function SectionMessages({ reseau, m, signaler, lectureSeule = false, entete }: { reseau: Reseau; m: Magasin; signaler: (msg: string) => void; lectureSeule?: boolean; entete?: ReactNode }) {
  const { profil } = useAuth()
  const equipePossible = profil?.role !== 'franchise' && !lectureSeule
  const [equipe, setEquipe] = useState(false)
  const fil: Fil = useMemo(() => ({ genre: 'magasin', magasin: m.nom, equipe: equipePossible && equipe }), [m.nom, equipePossible, equipe])
  return (
    <Box sx={{ bgcolor: 'background.paper', borderRadius: 3, border: '1px solid', borderColor: 'divider', p: { xs: 2, md: 3 }, pb: { xs: 1, md: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="h3" component="h2" sx={{ flex: 1 }}>Échanges</Typography>
        {entete}
      </Box>
      <FilMessages key={`${m.nom}|${fil.genre === 'magasin' && fil.equipe}`} reseau={reseau} fil={fil} signaler={signaler} lectureSeule={lectureSeule}
        basculer={equipePossible ? setEquipe : undefined} />
    </Box>
  )
}
