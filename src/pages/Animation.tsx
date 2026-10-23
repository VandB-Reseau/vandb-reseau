// Onglet Animation réseau (Joseph, 23/10/2026) : créer et suivre au même endroit communications, bonnes pratiques,
// sondages, formations, réunions et campagnes. Pour chacun : lectures, réponses, présences ou exécution.
// Directeur : tout le réseau ; Responsable Régional : ses magasins (les fonctions de la base ne lui renvoient que ceux-là).
import { Suspense, useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactElement, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import TipsAndUpdatesOutlined from '@mui/icons-material/TipsAndUpdatesOutlined'
import QuizOutlined from '@mui/icons-material/QuizOutlined'
import SchoolOutlined from '@mui/icons-material/SchoolOutlined'
import GroupsOutlined from '@mui/icons-material/GroupsOutlined'
import FlagOutlined from '@mui/icons-material/FlagOutlined'
import InsightsOutlined from '@mui/icons-material/InsightsOutlined'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { ChampRecherche } from '../components/Outils'
import { CarteLignes, Initiales, LigneCompacte, Puces, useParTranches } from '../components/Social'
import { DialogPratique } from '../components/BonnesPratiques'
import { CarteSondage, DialogSondage } from '../components/Questions'
import { BarreExecution, DialogCampagne } from '../components/Campagnes'
import { FenetreContenu, PresencesReunion } from '../components/Reunions'
import { useAuth } from '../auth/AuthContext'
import { chargerCommunications, chargerLectures, type Communication, type Lecture } from '../data/communications'
import { useLecturesPratiques, useReactionsPratiques } from '../data/reactionsPratiques'
import { chargerSondages, supprimerSondage, type Sondage } from '../data/questions'
import { usePresences, type Presence } from '../data/reunions'
import { bilan, magasinsConcernes, phase, type Bilan, type Campagne } from '../data/campagnes'
import { magasinsDu, perimetreDuProfil } from '../data/perimetre'
import { heureLisible } from '../data/agenda'
import { typeEvenement, type Evenement, type Reseau, type TypeEvenement } from '../data/modele'
import type { BonnePratique } from '../data/bonnesPratiques'
import { dateCourte } from '../lib/format'
import { chargementDiffere } from '../lib/chargementDiffere'

const DialogEvenement = chargementDiffere(() => import('./Agenda').then((m) => ({ default: m.DialogEvenement })))

export type Genre = 'communication' | 'pratique' | 'sondage' | 'formation' | 'reunion' | 'campagne'
const genres: { v: Genre; libelle: string; pluriel: string; icone: ReactElement; couleur: string }[] = [
  { v: 'communication', libelle: 'Communication', pluriel: 'Communications', icone: <CampaignOutlined />, couleur: '#307672' },
  { v: 'pratique', libelle: 'Bonne pratique', pluriel: 'Bonnes pratiques', icone: <TipsAndUpdatesOutlined />, couleur: '#ea6029' },
  { v: 'sondage', libelle: 'Sondage', pluriel: 'Sondages', icone: <QuizOutlined />, couleur: '#312e2e' },
  { v: 'formation', libelle: 'Formation', pluriel: 'Formations', icone: <SchoolOutlined />, couleur: '#c24119' },
  { v: 'reunion', libelle: 'Réunion', pluriel: 'Réunions', icone: <GroupsOutlined />, couleur: '#1d1d1b' },
  { v: 'campagne', libelle: 'Campagne', pluriel: 'Campagnes', icone: <FlagOutlined />, couleur: '#a15c00' },
]
const genreDe = (g: Genre) => genres.find((x) => x.v === g)!

// Suivi d'un contenu : n sur total, et ce que compte n
interface Suivi { n: number; total: number; libelle: string }
interface Contenu { cle: string; genre: Genre; titre: string; date: string; detail: string; suivi: Suivi | null; recherche: string; ouvert: Ouvert }
type Ouvert =
  | { genre: 'communication'; c: Communication; lecture?: Lecture }
  | { genre: 'pratique'; p: BonnePratique; lecture?: Lecture; jaime: number; commentaires: number }
  | { genre: 'sondage'; s: Sondage }
  | { genre: 'formation' | 'reunion'; e: Evenement; invites: string[]; presences: Presence[] }
  | { genre: 'campagne'; c: Campagne; b: Bilan }

const pourcent = (s: Suivi | null) => (s && s.total ? Math.round((s.n / s.total) * 100) : null)
const s_ = (n: number) => (n > 1 ? 's' : '')
const pluriel = (n: number, mot: string) => `${n} ${mot}${s_(n)}`
const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr')

// Tous les contenus suivis, du plus récent au plus ancien
function contenus(reseau: Reseau, magasinsSuivis: Set<string> | null, d: {
  communications: Communication[]; lectures: Map<number, Lecture> | null; lecturesPratiques: Map<string, Lecture> | null
  pouces: Record<string, unknown[]>; commentaires: Record<string, unknown[]>; sondages: Sondage[]; presences: Presence[]
}): Contenu[] {
  const suit = (m: string) => !magasinsSuivis || magasinsSuivis.has(m)
  const liste: Contenu[] = []
  for (const c of d.communications) {
    const l = d.lectures?.get(c.id)
    liste.push({
      cle: `c-${c.id}`, genre: 'communication', titre: c.titre, date: c.creeLe.slice(0, 10), recherche: `${c.titre} ${c.auteurNom}`,
      detail: [dateCourte(c.creeLe.slice(0, 10)), c.auteurNom, c.magasins === null ? 'Tout le réseau' : pluriel(c.magasins.length, 'magasin'), c.pouces.length ? `${c.pouces.length} J’aime` : null,
        c.commentaires.length ? pluriel(c.commentaires.length, 'commentaire') : null].filter(Boolean).join(' · '),
      suivi: l ? { n: l.lus.length, total: l.lus.length + l.nonLus.length, libelle: 'lue' } : null, ouvert: { genre: 'communication', c, lecture: l },
    })
  }
  for (const p of reseau.pratiques) {
    const l = d.lecturesPratiques?.get(p.id)
    const jaime = (d.pouces[p.id] ?? []).length || p.jaime.length
    const commentaires = (d.commentaires[p.id] ?? []).length
    liste.push({
      cle: `p-${p.id}`, genre: 'pratique', titre: p.titre, date: p.date, recherche: `${p.titre} ${p.magasin} ${p.par} ${p.theme}`,
      detail: [dateCourte(p.date), p.magasin, p.par, jaime ? `${jaime} J’aime` : null, commentaires ? pluriel(commentaires, 'commentaire') : null].filter(Boolean).join(' · '),
      suivi: l ? { n: l.lus.length, total: l.lus.length + l.nonLus.length, libelle: 'vue' } : null, ouvert: { genre: 'pratique', p, lecture: l, jaime, commentaires },
    })
  }
  for (const s of d.sondages) {
    liste.push({
      cle: `s-${s.id}`, genre: 'sondage', titre: s.titre, date: s.creeLe.slice(0, 10), recherche: `${s.titre} ${s.auteurNom}`,
      detail: [dateCourte(s.creeLe.slice(0, 10)), s.auteurNom, s.jusquAu >= reseau.jour ? `ouvert jusqu’au ${dateCourte(s.jusquAu)}` : 'clos'].filter(Boolean).join(' · '),
      suivi: { n: s.reponses.length, total: s.concernes, libelle: 'réponse' }, ouvert: { genre: 'sondage', s },
    })
  }
  for (const e of reseau.evenements) {
    const t = typeEvenement(e)
    if (t === 'event' || e.id === null) continue
    const invites = (e.invites ?? []).filter(suit)
    // Un Responsable Régional suit les réunions de ses magasins et les formations sans invités
    if (magasinsSuivis && e.invites?.length && !invites.length) continue
    const presences = d.presences.filter((p) => p.event === e.id && invites.includes(p.magasin))
    const commencee = e.debut <= reseau.jour
    const reponses = presences.filter((p) => p.reponse).length
    const presents = presences.filter((p) => p.present === true).length
    liste.push({
      cle: `e-${e.id}`, genre: t, titre: e.titre, date: e.debut, recherche: `${e.titre} ${e.notes}`,
      detail: [e.debut === e.fin ? dateCourte(e.debut) : `${dateCourte(e.debut)} au ${dateCourte(e.fin)}`, e.heure && `à ${heureLisible(e.heure)}`,
        invites.length ? `${pluriel(invites.length, 'magasin')} invité${s_(invites.length)}` : 'Sans invités', commencee && invites.length ? pluriel(presents, 'présent') : null].filter(Boolean).join(' · '),
      suivi: invites.length ? (commencee ? { n: presents, total: invites.length, libelle: 'présent' } : { n: reponses, total: invites.length, libelle: 'réponse' }) : null,
      ouvert: { genre: t, e, invites, presences },
    })
  }
  for (const c of reseau.campagnes.liste) {
    const magasins = magasinsConcernes(reseau, c).filter((m) => suit(m.nom))
    if (!magasins.length) continue
    const b = bilan(reseau.campagnes, c, magasins)
    const ph = phase(c, reseau.jour)
    liste.push({
      cle: `k-${c.id}`, genre: 'campagne', titre: c.nom, date: c.debut, recherche: c.nom,
      detail: [`Du ${dateCourte(c.debut)} au ${dateCourte(c.fin)}`, ph === 'avenir' ? 'à venir' : ph === 'terminee' ? 'terminée' : 'en cours', pluriel(b.total, 'magasin')].join(' · '),
      suivi: ph === 'avenir' ? null : { n: b.fait, total: b.total, libelle: 'exécutée' }, ouvert: { genre: 'campagne', c, b },
    })
  }
  return liste.sort((a, b) => b.date.localeCompare(a.date) || a.titre.localeCompare(b.titre, 'fr'))
}

// Quatre repères en tête : lecture, réponses, présences, exécution
function Reperes({ liste, jour, choisir }: { liste: Contenu[]; jour: string; choisir: (g: Genre) => void }) {
  const depuis = new Date(Date.parse(`${jour}T12:00:00Z`) - 90 * 86400000).toISOString().slice(0, 10)
  const somme = (l: Contenu[]) => l.reduce((t, c) => ({ n: t.n + (c.suivi?.n ?? 0), total: t.total + (c.suivi?.total ?? 0) }), { n: 0, total: 0 })
  const taux = (s: { n: number; total: number }) => (s.total ? `${Math.round((s.n / s.total) * 100)} %` : '—')
  const lectures = somme(liste.filter((c) => c.genre === 'communication' && c.date >= depuis))
  const sondages = liste.filter((c) => c.ouvert.genre === 'sondage' && c.ouvert.s.jusquAu >= jour)
  const reponses = somme(sondages)
  const aVenir = liste.filter((c) => (c.ouvert.genre === 'formation' || c.ouvert.genre === 'reunion') && c.ouvert.e.debut > jour)
  const inscrits = somme(aVenir)
  const campagnes = liste.filter((c) => c.ouvert.genre === 'campagne' && phase(c.ouvert.c, jour) === 'encours')
  const execution = somme(campagnes)
  const tuiles: { cle: Genre; libelle: string; valeur: string; detail: string }[] = [
    { cle: 'communication', libelle: 'Communications lues', valeur: taux(lectures), detail: '90 derniers jours' },
    { cle: 'sondage', libelle: 'Réponses aux sondages', valeur: taux(reponses), detail: `${pluriel(sondages.length, 'sondage')} ouvert${s_(sondages.length)}` },
    { cle: 'formation', libelle: 'Réponses aux invitations', valeur: taux(inscrits), detail: `${aVenir.length} à venir` },
    { cle: 'campagne', libelle: 'Campagnes exécutées', valeur: taux(execution), detail: `${campagnes.length} en cours` },
  ]
  return (
    <Box component="section" aria-label="Repères" sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: { xs: 1, md: 2 }, mb: { xs: 2, md: 3 } }}>
      {tuiles.map((t) => (
        <ButtonBase key={t.cle} onClick={() => choisir(t.cle)} aria-label={`${t.libelle} : ${t.valeur}, ${t.detail}`}
          sx={{ display: 'block', minWidth: 0, textAlign: 'left', px: { xs: 1.5, md: 2 }, py: { xs: 1, md: 2 }, borderRadius: '14px', bgcolor: 'background.paper', color: 'text.primary', fontFamily: 'inherit',
            '@media (hover: hover)': { '&:hover': { bgcolor: 'action.hover' } } }}>
          <Typography color="text.secondary" noWrap sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}>{t.libelle}</Typography>
          <Typography sx={{ fontSize: { xs: '1.25rem', md: '1.75rem' }, fontWeight: 700, lineHeight: 1.3 }}>{t.valeur}</Typography>
          <Typography color="text.secondary" noWrap sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>{t.detail}</Typography>
        </ButtonBase>
      ))}
    </Box>
  )
}

// À droite de chaque ligne : le taux en grand, n sur total dessous
function FinSuivi({ s }: { s: Suivi | null }) {
  const p = pourcent(s)
  if (!s || p === null) return null
  return (
    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
      <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.2 }}>{p} %</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{s.n} sur {s.total}</Typography>
    </Box>
  )
}

const libelleSuivi = (s: Suivi) => `${s.n} ${s.libelle}${s.n > 1 ? 's' : ''} sur ${s.total}`

function Noms({ titre, noms }: { titre: string; noms: string[] }) {
  if (!noms.length) return null
  return (
    <Box>
      <Typography variant="subtitle2" component="h3">{titre} ({noms.length})</Typography>
      <Typography variant="body2" color="text.secondary">{noms.join(', ')}</Typography>
    </Box>
  )
}

// Détail d'un contenu : qui a lu, répondu, assisté ; lien vers le contenu lui-même
function FenetreSuivi({ reseau, x, onFermer, relireSondages, modifierEvenement }: {
  reseau: Reseau; x: Contenu; onFermer: () => void; relireSondages: () => void; modifierEvenement: (e: Evenement) => void
}) {
  const pleinEcran = useMediaQuery(useTheme().breakpoints.down('sm'))
  const naviguer = useNavigate()
  const { profil, session } = useAuth()
  const [contenu, setContenu] = useState(false)
  const [message, setMessage] = useState('')
  const o = x.ouvert
  const aller = (lien: string) => { onFermer(); naviguer(lien) }
  let corps: ReactNode = null
  let action: ReactNode = null
  if (o.genre === 'communication' || o.genre === 'pratique') {
    const vue = o.genre === 'pratique'
    corps = <>
      {x.suivi ? <Typography sx={{ fontWeight: 600 }}>{vue ? 'Vue' : 'Lue'} par {x.suivi.n} franchisé{x.suivi.n > 1 ? 's' : ''} sur {x.suivi.total}</Typography>
        : <Typography color="text.secondary">Aucune lecture enregistrée.</Typography>}
      <Noms titre={vue ? 'Pas encore vue' : 'Pas encore lue'} noms={o.lecture?.nonLus ?? []} />
      <Noms titre={vue ? 'Vue par' : 'Lue par'} noms={o.lecture?.lus ?? []} />
      {o.genre === 'communication'
        ? <Typography variant="body2" color="text.secondary">{[`${o.c.pouces.length} J’aime`, pluriel(o.c.commentaires.length, 'commentaire')].join(' · ')}</Typography>
        : <Typography variant="body2" color="text.secondary">{[`${o.jaime} J’aime`, pluriel(o.commentaires, 'commentaire')].join(' · ')}</Typography>}
    </>
    action = <Button variant="contained" onClick={() => aller(o.genre === 'communication' ? `/infos?vue=communications&c=${o.c.id}` : '/infos?vue=pratiques')} sx={{ minHeight: 48 }}>Ouvrir</Button>
  } else if (o.genre === 'sondage') {
    const retirer = async () => {
      try { await supprimerSondage(o.s.id); relireSondages(); onFermer() } catch (e) { setMessage((e as Error).message) }
    }
    corps = <Box sx={{ mx: -2 }}><CarteSondage reseau={reseau} s={o.s} jour={reseau.jour} moi={session?.user.id ?? ''} directeur={profil?.role === 'directeur'} retirer={() => void retirer()} /></Box>
  } else if (o.genre === 'formation' || o.genre === 'reunion') {
    corps = <>
      <Typography color="text.secondary">{x.detail}</Typography>
      {o.e.notes && <Typography sx={{ whiteSpace: 'pre-line' }}>{o.e.notes}</Typography>}
      {o.e.html && <Button onClick={() => setContenu(true)} sx={{ minHeight: 48, alignSelf: 'flex-start' }}>Voir le contenu</Button>}
      {o.invites.length ? <PresencesReunion reseau={reseau} e={o.e} /> : <Typography color="text.secondary">Aucun magasin invité.</Typography>}
      {contenu && o.e.html && <FenetreContenu titre={o.e.titre} html={o.e.html} onFermer={() => setContenu(false)} />}
    </>
    action = <Button variant="contained" onClick={() => { onFermer(); modifierEvenement(o.e) }} sx={{ minHeight: 48 }}>Modifier</Button>
  } else if (o.genre === 'campagne') {
    corps = <>
      <Typography color="text.secondary">{x.detail}</Typography>
      <Typography sx={{ fontWeight: 600 }}>{o.b.fait} exécutée{o.b.fait > 1 ? 's' : ''} sur {o.b.total} · {o.b.partiel} en partie · {o.b.aConstater} à constater</Typography>
      <BarreExecution b={o.b} libelle={o.c.nom} />
    </>
    action = <Button variant="contained" onClick={() => aller(`/plus/sante?vue=campagnes&campagne=${encodeURIComponent(o.c.id)}`)} sx={{ minHeight: 48 }}>Ouvrir la campagne</Button>
  }
  return (
    <Dialog open onClose={onFermer} fullScreen={pleinEcran} fullWidth maxWidth="sm" aria-labelledby="titre-suivi">
      <DialogTitle id="titre-suivi">{x.titre}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">{genreDe(x.genre).libelle}{x.suivi ? ` · ${libelleSuivi(x.suivi)}` : ''}</Typography>
          {corps}
          {message && <Typography color="error">{message}</Typography>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onFermer} sx={{ minHeight: 48 }}>Fermer</Button>
        {action}
      </DialogActions>
    </Dialog>
  )
}

type Creation = 'communication' | 'pratique' | 'sondage' | 'formation' | 'reunion' | 'campagne'

function PageAnimation({ reseau }: { reseau: Reseau }) {
  const { profil } = useAuth()
  const naviguer = useNavigate()
  const perimetre = perimetreDuProfil(profil)
  const magasinsSuivis = useMemo(() => (perimetre ? new Set(magasinsDu(reseau, perimetre).map((m) => m.nom)) : null), [reseau, perimetre])
  const [communications, setCommunications] = useState<Communication[]>([])
  const [lectures, setLectures] = useState<Map<number, Lecture> | null>(null)
  const [sondages, setSondages] = useState<Sondage[]>([])
  const relireSondages = useCallback(() => { void chargerSondages().then((s) => setSondages(s ?? [])).catch(() => setSondages([])) }, [])
  useEffect(() => {
    void chargerCommunications().then((c) => setCommunications(c?.liste ?? [])).catch(() => undefined)
    void chargerLectures().then(setLectures).catch(() => undefined)
    relireSondages()
  }, [relireSondages])
  const lecturesPratiques = useLecturesPratiques(true)
  const reactions = useReactionsPratiques()
  const { presences } = usePresences()
  const [genre, setGenre] = useState<Genre | 'tout'>('tout')
  const [recherche, setRecherche] = useState('')
  const [ouvert, setOuvert] = useState<Contenu | null>(null)
  const [creation, setCreation] = useState<Creation | null>(null)
  const [evenement, setEvenement] = useState<Evenement | null>(null)
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  const [message, setMessage] = useState('')

  const tous = useMemo(() => contenus(reseau, magasinsSuivis, {
    communications, lectures, lecturesPratiques, pouces: reactions?.pouces ?? {}, commentaires: reactions?.commentaires ?? {}, sondages, presences: presences ?? [],
  }), [reseau, magasinsSuivis, communications, lectures, lecturesPratiques, reactions, sondages, presences])
  const q = sansAccents(recherche.trim())
  const liste = tous.filter((c) => (genre === 'tout' || c.genre === genre) && (!q || sansAccents(c.recherche).includes(q)))
  const { visibles, suite } = useParTranches(liste, `${genre}|${q}`)
  const fermer = (m?: string) => { setCreation(null); setEvenement(null); if (m) setMessage(m) }
  const creer = (c: Creation) => {
    setAncre(null)
    if (c === 'communication') naviguer('/infos?vue=communications&publier=1')
    else setCreation(c)
  }
  const ouvrirMenu = (e: MouseEvent<HTMLElement>) => setAncre(e.currentTarget)
  const typeCree: TypeEvenement = creation === 'formation' ? 'formation' : 'reunion'
  return (
    <>
      <PageHeader titre="Animation réseau" actions={
        <Button variant="contained" startIcon={<AddOutlined />} aria-haspopup="menu" aria-expanded={!!ancre} onClick={ouvrirMenu} sx={{ minHeight: 48 }}>Créer</Button>
      } />
      <Menu anchorEl={ancre} open={!!ancre} onClose={() => setAncre(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ list: { 'aria-label': 'Créer un contenu' }, paper: { sx: { mt: 0.5, minWidth: 220, borderRadius: 3 } } }}>
        {genres.map((g) => (
          <MenuItem key={g.v} onClick={() => creer(g.v)} sx={{ '&&': { minHeight: 52 }, gap: 1.5, fontWeight: 600 }}>
            <Box component="span" sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: g.couleur, color: '#ffffff', display: 'grid', placeItems: 'center', flexShrink: 0, '& svg': { fontSize: 18 } }}>{g.icone}</Box>
            {g.libelle}
          </MenuItem>
        ))}
      </Menu>
      <Reperes liste={tous} jour={reseau.jour} choisir={setGenre} />
      <Box sx={{ mb: 1 }}><ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Titre, auteur, magasin" libelle="Rechercher un contenu" /></Box>
      <Puces label="Type de contenu" valeur={genre} onChange={setGenre} options={[
        { v: 'tout' as const, libelle: `Tout (${tous.length})` },
        ...genres.map((g) => ({ v: g.v, libelle: `${g.pluriel} (${tous.filter((c) => c.genre === g.v).length})` })),
      ]} />
      {!liste.length
        ? <EmptyState icone={<InsightsOutlined />} titre={tous.length ? 'Aucun contenu ne correspond' : 'Aucun contenu pour l’instant'}
            texte={tous.length ? 'Change de type ou de recherche.' : 'Les communications, sondages, formations et campagnes apparaîtront ici avec leur suivi.'}
            action={<Button variant="contained" startIcon={<AddOutlined />} onClick={ouvrirMenu} sx={{ minHeight: 48 }}>Créer</Button>} />
        : (
          <CarteLignes label="Contenus">
            {visibles.map((c) => {
              const g = genreDe(c.genre)
              return (
                <LigneCompacte key={c.cle} onClick={() => setOuvert(c)} label={`${g.libelle} ${c.titre}${c.suivi ? ` : ${libelleSuivi(c.suivi)}` : ''}`}
                  avatar={<Initiales nom={c.titre} icone={g.icone} couleur={g.couleur} />} titre={c.titre}
                  detail={`${g.libelle} · ${c.detail}`} fin={<FinSuivi s={c.suivi} />} />
              )
            })}
          </CarteLignes>
        )}
      {suite}
      {ouvert && <FenetreSuivi reseau={reseau} x={ouvert} onFermer={() => setOuvert(null)} relireSondages={relireSondages} modifierEvenement={setEvenement} />}
      {creation === 'pratique' && <DialogPratique reseau={reseau} pratique={null} onFermer={fermer} />}
      {creation === 'sondage' && <DialogSondage reseau={reseau} onFermer={(m) => { fermer(m); if (m) relireSondages() }} />}
      {creation === 'campagne' && <DialogCampagne reseau={reseau} campagne={null} onFermer={(m) => fermer(m)} />}
      {(creation === 'formation' || creation === 'reunion' || evenement) && (
        <Suspense fallback={null}>
          <DialogEvenement reseau={reseau} evenement={evenement} typeInitial={typeCree} onFermer={fermer} />
        </Suspense>
      )}
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}

export function Animation() {
  return <AvecReseau>{(reseau) => <PageAnimation reseau={reseau} />}</AvecReseau>
}
