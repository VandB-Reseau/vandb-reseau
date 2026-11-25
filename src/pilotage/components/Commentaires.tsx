import { LigneVide } from '../../components/Section'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import LockOutlined from '@mui/icons-material/LockOutlined'
import { Choix } from '../../components/Carnet'
import { useReseauSiDispo } from '../../data/ReseauContext'
import { monNomPorteur } from '../../data/actions'
import { useAuth } from '../../auth/AuthContext'
import { collegues } from '../../data/carnet'
import Alert from '@mui/material/Alert'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Drawer from '@mui/material/Drawer'
import GlobalStyles from '@mui/material/GlobalStyles'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddCommentOutlined from '@mui/icons-material/AddCommentOutlined'
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import { roleLibelle, type Profil, type Role } from '../auth/roles'
import { chargerCommentaires, chargerEchanges, envoyerCommentaire, resoudreCommentaire, retirerMessage, statutLibelle, type Commentaire } from '../data/pilotage'
import { useChargement } from '../data/useChargement'

// Joseph (03/11/2026) : les échanges deviennent des commentaires comme dans un document partagé. On commente un point
// précis (une carte, une ligne d'hypothèse, un investissement…), on répond dessous, on marque « Résolu ». Ce n'est pas une
// messagerie : pas de fil général, pas de sujet.
// Joseph (09/11/2026) : la colonne des commentaires mangeait la largeur du compte de résultat ; ils s'ouvrent à la demande
// dans un volet à droite (bouton « Commentaires » de l'en-tête du budget, ou bulle d'un point), qui laisse la page défiler.
// Joseph (24/11/2026, proposition C retenue pour le budget) : sur PC large, les commentaires passent dans la marge, chacun
// à hauteur de la ligne qu'il commente, comme dans un document partagé. Chacun dit qui le lit (« Équipe seule » ou « Avec
// le franchisé », migration pilotage 0037) et peut prévenir des collègues dans leur cloche. Téléphone et petit écran : volet.
// Joseph (25/11/2026) : un commentaire du budget est toujours lu par le franchisé, plus de choix « Équipe seule ». Ceux
// déjà écrits ainsi restent cachés au franchisé et gardent leur puce.

export const ANCRE_BUDGET = { ancre: 'budget', libelle: 'Le budget en général' }
const MAX_TEXTE = 2000
const quand = (d: string) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const qui = (role: Role | null, nom: string | null) => [nom, role ? roleLibelle[role] : null].filter(Boolean).join(', ') || 'Compte retiré'

interface Contexte { ouverts: (ancre: string) => number; ouvrir: (ancre: string, libelle: string) => void; total: number; ouvrirTout: () => void; volet: boolean; marge: boolean }
const Ctx = createContext<Contexte | null>(null)

// Bouton « Commenter » d'un point : la bulle porte le nombre de commentaires ouverts sur ce point
// Sur une ligne de tableau (« ligne »), le bouton se nomme « cette ligne » : le nom de la ligne est déjà lu avec elle, et
// le champ de saisie garde seul son nom
export function BoutonCommenter({ ancre, libelle, compact, ligne }: { ancre: string; libelle: string; compact?: boolean; ligne?: boolean }) {
  const c = useContext(Ctx)
  if (!c) return null
  const n = c.ouverts(ancre)
  const quoi = ligne ? 'cette ligne' : libelle
  return (
    <Tooltip title={n ? `${n} commentaire${n > 1 ? 's' : ''} ouvert${n > 1 ? 's' : ''}` : 'Commenter'}>
      <IconButton className="pas-a-l-impression" data-ancre-commentaire={ancre} aria-label={n ? `Commentaires sur ${quoi} (${n} ouvert${n > 1 ? 's' : ''})` : `Commenter ${ligne ? quoi : `: ${quoi}`}`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); c.ouvrir(ancre, libelle) }}
        sx={{ width: { xs: 48, lg: compact ? 28 : 36 }, height: { xs: 48, lg: compact ? 28 : 36 }, flexShrink: 0, color: n ? 'warning.dark' : 'text.secondary', opacity: n ? 1 : 0.6, '&:hover, &:focus-visible': { opacity: 1 } }}>
        <Badge badgeContent={n} color="warning" invisible={!n}><ChatBubbleOutlineOutlined fontSize="small" /></Badge>
      </IconButton>
    </Tooltip>
  )
}

// Bouton de l'en-tête du budget : ouvre (ou ferme) le volet avec tous les commentaires, et porte le nombre d'ouverts.
// compact (refonte vague 2, 11A : étapes dans la ligne d'en-tête) : le picto seul, le nom en infobulle
export function BoutonCommentaires({ compact }: { compact?: boolean } = {}) {
  const c = useContext(Ctx)
  if (!c) return null
  const nom = c.total ? `Commentaires (${c.total} ouvert${c.total > 1 ? 's' : ''})` : 'Commentaires'
  // En marge, le bouton montre ou cache la marge
  if (compact) return (
    <Tooltip title={nom}>
      <IconButton onClick={c.ouvrirTout} aria-expanded={c.volet} aria-label={nom} className="pas-a-l-impression"
        sx={{ width: 48, height: 48, border: 1, borderColor: c.total ? 'warning.main' : 'divider', borderRadius: 2, color: c.total ? 'warning.dark' : 'text.secondary', bgcolor: c.volet ? 'action.selected' : undefined }}>
        <Badge badgeContent={c.total} color="warning" invisible={!c.total}><ChatBubbleOutlineOutlined /></Badge>
      </IconButton>
    </Tooltip>
  )
  return (
    <Button variant={c.volet ? 'contained' : 'outlined'} color={c.total ? 'warning' : 'inherit'} onClick={c.ouvrirTout} aria-expanded={c.volet} className="pas-a-l-impression"
      startIcon={<Badge badgeContent={c.total} color="warning" invisible={!c.total || c.volet}><ChatBubbleOutlineOutlined /></Badge>}
      aria-label={nom} sx={{ minHeight: 48, borderColor: 'divider' }}>
      Commentaires
    </Button>
  )
}

type Fil = Commentaire & { reponses: Commentaire[] }
export function filsDe(l: Commentaire[]): Fil[] {
  const racines = l.filter((c) => c.parent === null)
  return racines.map((r) => ({ ...r, reponses: l.filter((c) => c.parent === r.id) }))
    // Ouverts d'abord, du plus récent échange au plus ancien
    .sort((a, b) => Number(!!a.resoluLe) - Number(!!b.resoluLe) || (dernier(b) > dernier(a) ? 1 : -1))
}
const dernier = (f: Fil) => f.reponses.at(-1)?.creeLe ?? f.creeLe

type Point = { ancre: string; libelle: string }
type Agir = (f: () => Promise<void>, apres?: () => void) => Promise<void>
interface Commun { magasin: string; annee: number; moi: Profil | null; equipeDuReseau: boolean; autres: string[]; occupe: boolean; agir: Agir }

// Fournit les bulles aux points du budget et affiche la marge (PC large) ou le volet ; « panneau » reçoit ce qu'il faut placer
export function CommentairesBudget({ magasin, annee, moi, children }: {
  magasin: string; annee: number; moi: Profil | null
  children: (panneau: ReactNode, ouverts: number) => ReactNode
}) {
  const { donnees, erreur, recharger } = useChargement(() => chargerCommentaires(magasin, annee), [magasin, annee])
  const theme = useTheme()
  const marge = useMediaQuery(theme.breakpoints.up('lg'))
  const reseau = useReseauSiDispo()?.reseau ?? null
  const [point, setPoint] = useState<Point | null>(null)
  const [demande, setDemande] = useState(0)
  const [volet, setVolet] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const [probleme, setProbleme] = useState<string | null>(null)
  const fils = filsDe(donnees ?? [])
  const ouverts = fils.filter((f) => !f.resoluLe)
  // Sur un grand écran (1 680 px et plus), la marge s'ouvre d'elle-même quand des commentaires sont ouverts (une fois par
  // budget) ; en dessous, elle s'ouvre à la demande pour laisser au compte de résultat toute sa largeur (Joseph, 09/11/2026)
  const grandEcran = useMediaQuery('(min-width: 1680px)')
  const deja = useRef(false)
  useEffect(() => { deja.current = false }, [magasin, annee])
  useEffect(() => { if (grandEcran && donnees && !deja.current) { deja.current = true; if (ouverts.length) setVolet(true) } }, [grandEcran, donnees, ouverts.length])
  const equipeDuReseau = !!moi && moi.role !== 'franchise' && moi.role !== 'aucun'
  const profilReseau = useAuth().profil
  const monNom = reseau && profilReseau ? monNomPorteur(reseau, profilReseau) : ''
  const autres = equipeDuReseau && reseau ? collegues(reseau, magasin, monNom).map((p) => p.nom) : []
  const agir: Agir = async (f, apres) => {
    setOccupe(true); setProbleme(null)
    try { await f(); apres?.(); recharger() } catch { setProbleme('Le commentaire n’est pas enregistré. Vérifie ta connexion, puis réessaie.') } finally { setOccupe(false) }
  }
  const commun: Commun = { magasin, annee, moi, equipeDuReseau, autres, occupe, agir }
  const ctx: Contexte = {
    ouverts: (ancre) => ouverts.filter((f) => f.ancre === ancre).length,
    ouvrir: (ancre, libelle) => { setPoint({ ancre, libelle }); setVolet(true); setDemande((n) => n + 1) },
    total: ouverts.length, volet, marge,
    ouvrirTout: () => { setPoint(null); setVolet((v) => !v) },
  }
  const fermer = useCallback(() => { setVolet(false); setPoint(null) }, [])
  const panneau = marge ? (
    <>
      <Box data-marge-depart aria-hidden sx={{ height: 0 }} />
      {volet && <Marge key={`marge-${magasin}-${annee}`} fils={fils} commun={commun} panne={!!erreur && !donnees} probleme={probleme}
        point={point} demande={demande} onPoint={setPoint} onFermer={fermer} />}
    </>
  ) : (
    // Volet sans fond grisé : la page reste lisible et défile pendant qu'on écrit
    <Drawer variant="persistent" anchor="right" open={volet} className="pas-a-l-impression"
      slotProps={{ paper: { role: 'complementary', 'aria-label': 'Volet des commentaires', sx: { top: { xs: 64, md: 0 }, height: { xs: 'calc(100% - 64px - var(--barre-basse, 0px))', md: '100%' }, width: { xs: '100%', sm: 400 }, bgcolor: 'background.default', borderLeft: 1, borderColor: 'divider', boxShadow: 6, p: 1.5 } } }}>
      {/* Sur PC, la page se pousse à gauche du volet ouvert : il ne recouvre ni les étapes ni les boutons de l'en-tête */}
      {volet && <GlobalStyles styles={{ '@media (min-width: 900px)': { main: { paddingRight: '424px !important' } } }} />}
      {volet && (
        <PanneauCommentaires key={`commentaires-${magasin}`} commun={commun} fils={fils} panne={!!erreur && !donnees} probleme={probleme}
          point={point} demande={demande} onPoint={setPoint} onFermer={fermer} />
      )}
    </Drawer>
  )
  return <Ctx.Provider value={ctx}>{children(panneau, ouverts.length)}</Ctx.Provider>
}

// Commentaire écrit en « Équipe seule » avant le 25/11/2026 : sa puce le dit à l'équipe
function PuceEquipeSeule() {
  return (
    <Chip size="small" icon={<LockOutlined />} label="Équipe seule"
      sx={{ fontSize: '0.75rem', fontWeight: 600, height: 24, bgcolor: 'rgba(234, 96, 41, 0.12)', color: 'warning.dark', '& .MuiChip-icon': { color: 'inherit' } }} />
  )
}

// Nouveau commentaire : texte et collègues prévenus, toujours lu par le franchisé
function NouveauCommentaire({ commun, sur, champ, compact, apres, aLaMain }: { commun: Commun; sur: Point; champ?: React.Ref<HTMLTextAreaElement>; compact?: boolean; apres?: () => void; aLaMain?: boolean }) {
  const [texte, setTexte] = useState('')
  const zone = useRef<HTMLTextAreaElement | null>(null)
  // Demandé depuis la bulle d'une ligne : le champ prend la main dès qu'il paraît (la marge se place après mesure)
  useEffect(() => { if (aLaMain) zone.current?.focus({ preventScroll: true }) }, [aLaMain])
  const lier = (el: HTMLTextAreaElement | null) => { zone.current = el; if (typeof champ === 'function') champ(el); else if (champ) (champ as React.MutableRefObject<HTMLTextAreaElement | null>).current = el }
  const [prevenir, setPrevenir] = useState<string[]>([])
  const { magasin, annee, autres, occupe, agir } = commun
  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      <TextField inputRef={lier} size="small" multiline minRows={2} maxRows={6} label={`Commenter : ${sur.libelle}`} value={texte}
        onChange={(e) => setTexte(e.target.value.slice(0, MAX_TEXTE))} />
      {autres.length > 0 && <Choix label="Prévenir" multiple options={autres.map((n) => ({ v: n, libelle: n }))} valeurs={prevenir} changer={setPrevenir} />}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="contained" startIcon={compact ? undefined : <AddCommentOutlined />} disabled={occupe || !texte.trim()} sx={{ minHeight: { xs: 48, lg: compact ? 36 : 48 } }}
          onClick={() => void agir(() => envoyerCommentaire(magasin, annee, { ancre: sur.ancre, libelle: sur.libelle, texte, mentions: prevenir }), () => { setTexte(''); setPrevenir([]); apres?.() })}>
          Commenter
        </Button>
        {apres && <Button onClick={apres} sx={{ minHeight: { xs: 48, lg: 36 } }}>Annuler</Button>}
      </Box>
    </Box>
  )
}

// Un commentaire et ses réponses, avec Répondre et Résolu
function CarteFil({ f, commun, avecPoint, onPoint }: { f: Fil; commun: Commun; avecPoint?: boolean; onPoint?: (p: Point) => void }) {
  const { magasin, annee, moi, equipeDuReseau, autres, occupe, agir } = commun
  const [reponse, setReponse] = useState<string | null>(null)
  const [prevenir, setPrevenir] = useState<string[]>([])
  const peutEcrire = !!moi && moi.role !== 'aucun'
  const libelle = f.ancreLibelle ?? ANCRE_BUDGET.libelle
  return (
    <Box component="li" aria-label={`Commentaire sur ${libelle}`}
      sx={{ border: 1, borderColor: 'divider', borderLeft: 4, borderLeftColor: f.resoluLe ? 'divider' : f.equipe ? 'warning.main' : 'secondary.main', borderRadius: 2, p: 1.25, display: 'grid', gap: 0.75, opacity: f.resoluLe ? 0.75 : 1, bgcolor: 'background.paper', listStyle: 'none' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
        {avecPoint && onPoint ? (
          <Button size="small" onClick={() => onPoint({ ancre: f.ancre, libelle })}
            sx={{ justifyContent: 'flex-start', p: 0, minHeight: { xs: 48, lg: 28 }, fontWeight: 700, color: 'warning.dark', textAlign: 'left', flex: 1, minWidth: 0 }}>
            {libelle}
          </Button>
        ) : <Typography variant="body2" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }}>{libelle}</Typography>}
        {equipeDuReseau && f.equipe && <PuceEquipeSeule />}
      </Box>
      {[f, ...f.reponses].map((m, i) => (
        <Box key={m.id} sx={{ ...(i ? { ml: 1.5, pl: 1.25, borderLeft: 2, borderColor: 'divider' } : {}), display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary">{`${qui(m.auteurRole, m.auteurNom)} · ${quand(m.creeLe)}`}</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.texte}</Typography>
            {m.mentions.length > 0 && equipeDuReseau && <Typography variant="body2" color="text.secondary">{`Prévenu${m.mentions.length > 1 ? 's' : ''} : ${m.mentions.join(', ')}`}</Typography>}
          </Box>
          {m.auteur === moi?.id && (
            <Tooltip title="Retirer">
              <IconButton aria-label={i ? 'Retirer ma réponse' : 'Retirer mon commentaire'} disabled={occupe} onClick={() => void agir(() => retirerMessage(m.id))} sx={{ width: { xs: 48, lg: 32 }, height: { xs: 48, lg: 32 } }}>
                <DeleteOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ))}
      {f.resoluLe && <Typography variant="body2" color="text.secondary">{`Résolu par ${qui(f.resoluParRole, f.resoluParNom)} · ${quand(f.resoluLe)}`}</Typography>}
      {peutEcrire && (reponse !== null ? (
        <Box sx={{ display: 'grid', gap: 1 }}>
          <TextField size="small" multiline minRows={2} autoFocus label="Ta réponse" value={reponse} onChange={(e) => setReponse(e.target.value.slice(0, MAX_TEXTE))} />
          {autres.length > 0 && <Choix label="Prévenir" multiple options={autres.map((n) => ({ v: n, libelle: n }))} valeurs={prevenir} changer={setPrevenir} />}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="contained" size="small" disabled={occupe || !reponse.trim()} sx={{ minHeight: { xs: 48, lg: 36 } }}
              onClick={() => void agir(() => envoyerCommentaire(magasin, annee, { ancre: f.ancre, libelle: f.ancreLibelle ?? '', texte: reponse, parent: f.id, equipe: f.equipe, mentions: prevenir }), () => { setReponse(null); setPrevenir([]) })}>Répondre</Button>
            <Button size="small" onClick={() => { setReponse(null); setPrevenir([]) }} sx={{ minHeight: { xs: 48, lg: 36 } }}>Annuler</Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {!f.resoluLe && <Button size="small" onClick={() => setReponse('')} sx={{ minHeight: { xs: 48, lg: 32 } }}>Répondre</Button>}
          <Button size="small" startIcon={f.resoluLe ? undefined : <CheckCircleOutlined />} disabled={occupe} sx={{ minHeight: { xs: 48, lg: 32 } }}
            onClick={() => void agir(() => resoudreCommentaire(f.id, !f.resoluLe))}>{f.resoluLe ? 'Rouvrir' : 'Résolu'}</Button>
        </Box>
      ))}
    </Box>
  )
}

// Marge des commentaires (PC large) : une colonne à droite de la page, chaque fil à hauteur de son point ; les fils dont le
// point n'est pas à l'écran (autre étape, carte repliée) se rangent en tête, sous « Ailleurs dans le budget »
const LARGEUR_MARGE = 320
function Marge({ fils, commun, panne, probleme, point, demande, onPoint, onFermer }: {
  fils: Fil[]; commun: Commun; panne: boolean; probleme: string | null
  point: Point | null; demande: number; onPoint: (p: Point | null) => void; onFermer: () => void
}) {
  const [positions, setPositions] = useState<Record<string, number>>({})
  const [depart, setDepart] = useState(0)
  const [hauteurs, setHauteurs] = useState<Record<string, number>>({})
  const [voirResolus, setVoirResolus] = useState(false)
  const [voirAilleurs, setVoirAilleurs] = useState(false)
  const [general, setGeneral] = useState(false)
  const [activite, setActivite] = useState(false)
  const champ = useRef<HTMLTextAreaElement>(null)
  // Positions des points commentables dans la page, relues quand la page bouge (contenu, largeur)
  useEffect(() => {
    let image = 0
    const mesurer = () => {
      cancelAnimationFrame(image)
      image = requestAnimationFrame(() => {
        const p: Record<string, number> = {}
        document.querySelectorAll<HTMLElement>('[data-ancre-commentaire]').forEach((e) => {
          const a = e.dataset.ancreCommentaire ?? ''
          const r = e.getBoundingClientRect()
          if (a && (r.width || r.height) && p[a] === undefined) p[a] = Math.round(r.top + window.scrollY)
        })
        const d = document.querySelector<HTMLElement>('[data-marge-depart]')
        setDepart(d ? Math.round(d.getBoundingClientRect().top + window.scrollY) : 0)
        setPositions((x) => (JSON.stringify(x) === JSON.stringify(p) ? x : p))
      })
    }
    mesurer()
    const taille = new ResizeObserver(mesurer)
    taille.observe(document.body)
    const changements = new MutationObserver(mesurer)
    changements.observe(document.querySelector('main') ?? document.body, { childList: true, subtree: true })
    window.addEventListener('resize', mesurer)
    return () => { cancelAnimationFrame(image); taille.disconnect(); changements.disconnect(); window.removeEventListener('resize', mesurer) }
  }, [])
  useEffect(() => {
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer() }
    window.addEventListener('keydown', echap)
    return () => window.removeEventListener('keydown', echap)
  }, [onFermer])
  // Un point demandé depuis sa bulle : le champ prend la main
  useEffect(() => { if (demande) champ.current?.focus({ preventScroll: true }) }, [demande])
  const mesurerCarte = useCallback((cle: string) => (e: HTMLElement | null) => {
    if (!e) return
    const h = Math.round(e.getBoundingClientRect().height)
    setHauteurs((x) => (x[cle] === h ? x : { ...x, [cle]: h }))
  }, [])
  // Les hauteurs bougent quand une réponse s'ouvre : relues à chaque rendu
  useLayoutEffect(() => {
    document.querySelectorAll<HTMLElement>('[data-carte-marge]').forEach((e) => {
      const cle = e.dataset.carteMarge ?? ''
      const h = Math.round(e.getBoundingClientRect().height)
      setHauteurs((x) => (x[cle] === h ? x : { ...x, [cle]: h }))
    })
  })

  const visibles = fils.filter((f) => voirResolus || !f.resoluLe)
  const placables = visibles.filter((f) => positions[f.ancre] !== undefined)
  const ailleurs = visibles.filter((f) => positions[f.ancre] === undefined)
  const nouveauIci = point && positions[point.ancre] !== undefined && point.ancre !== ANCRE_BUDGET.ancre ? point : null
  const total = fils.filter((f) => !f.resoluLe).length
  const resolus = fils.filter((f) => f.resoluLe).length

  // En tête de marge : compte, budget en général, ailleurs ; puis les fils à hauteur de leur point, sans se chevaucher
  const elements: { cle: string; haut: number; contenu: ReactNode }[] = [
    ...placables.map((f) => ({ cle: `f${f.id}`, haut: positions[f.ancre], contenu: <Box component="ul" sx={{ m: 0, p: 0 }}><CarteFil f={f} commun={commun} /></Box> })),
    ...(nouveauIci ? [{ cle: 'nouveau', haut: positions[nouveauIci.ancre], contenu: (
      <Card sx={{ p: 1.25, border: 2, borderColor: 'secondary.main' }}>
        <NouveauCommentaire key={`${nouveauIci.ancre}-${demande}`} commun={commun} sur={nouveauIci} champ={champ} compact aLaMain={demande > 0} apres={() => onPoint(null)} />
      </Card>
    ) }] : []),
  ].sort((a, b) => a.haut - b.haut || (a.cle === 'nouveau' ? 1 : -1))
  const enTete = (
    <Card component="section" aria-label="Commentaires" className="pas-a-l-impression" data-carte-marge="tete" ref={mesurerCarte('tete')}
      sx={{ p: 1.5, display: 'grid', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="h2" sx={{ fontSize: '1.125rem', flex: 1 }}>Commentaires</Typography>
        {total > 0 && <Chip size="small" color="warning" label={total > 1 ? `${total} ouverts` : '1 ouvert'} />}
        <Tooltip title="Fermer"><IconButton aria-label="Fermer les commentaires" onClick={onFermer} sx={{ width: 40, height: 40 }}><CloseOutlined /></IconButton></Tooltip>
      </Box>
      {panne && <Alert severity="warning">Les commentaires ne se chargent pas pour l’instant. Réessaie dans un moment.</Alert>}
      {probleme && <Alert severity="error">{probleme}</Alert>}
      {fils.length === 0 && !panne && <Typography variant="body2" color="text.secondary">Aucun commentaire sur ce budget.</Typography>}
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {!general && commun.moi && commun.moi.role !== 'aucun' && <Button size="small" startIcon={<AddCommentOutlined />} onClick={() => setGeneral(true)} sx={{ minHeight: 36 }}>Le budget en général</Button>}
        {ailleurs.length > 0 && <Button size="small" onClick={() => setVoirAilleurs((v) => !v)} aria-expanded={voirAilleurs} sx={{ minHeight: 36 }}>{`${voirAilleurs ? 'Masquer' : 'Voir'} ailleurs dans le budget (${ailleurs.length})`}</Button>}
        {resolus > 0 && <Button size="small" onClick={() => setVoirResolus((v) => !v)} sx={{ minHeight: 36 }}>{voirResolus ? 'Masquer les résolus' : `Voir les résolus (${resolus})`}</Button>}
        <Button size="small" onClick={() => setActivite((v) => !v)} aria-expanded={activite} sx={{ minHeight: 36 }}>{activite ? 'Masquer l’activité' : 'Voir l’activité'}</Button>
      </Box>
      {activite && <Activite magasin={commun.magasin} annee={commun.annee} fils={fils} />}
      {general && <NouveauCommentaire commun={commun} sur={ANCRE_BUDGET} compact apres={() => setGeneral(false)} />}
      {point && !nouveauIci && point.ancre !== ANCRE_BUDGET.ancre && <NouveauCommentaire key={`${point.ancre}-${demande}`} commun={commun} sur={point} champ={champ} compact aLaMain={demande > 0} apres={() => onPoint(null)} />}
      {voirAilleurs && ailleurs.length > 0 && (
        <Box component="ul" aria-label="Ailleurs dans le budget" sx={{ m: 0, p: 0, display: 'grid', gap: 1 }}>
          {ailleurs.map((f) => <CarteFil key={f.id} f={f} commun={commun} avecPoint onPoint={onPoint} />)}
        </Box>
      )}
    </Card>
  )
  let bas = depart + (hauteurs.tete ?? 0) + 12
  const places = elements.map((e) => {
    const y = Math.max(e.haut - 8, bas)
    bas = y + (hauteurs[e.cle] ?? 120) + 10
    return { ...e, y }
  })
  return createPortal(
    <>
      {/* La page laisse la place de la marge à droite */}
      <GlobalStyles styles={{ main: { paddingRight: `${LARGEUR_MARGE + 32}px !important` } }} />
      <Box role="complementary" aria-label="Marge des commentaires" className="pas-a-l-impression"
        sx={{ position: 'absolute', top: 0, right: 16, width: LARGEUR_MARGE, zIndex: 5 }}>
        <Box sx={{ position: 'absolute', top: depart, left: 0, right: 0 }}>{enTete}</Box>
        {places.map((e) => (
          <Box key={e.cle} data-carte-marge={e.cle} ref={mesurerCarte(e.cle)} sx={{ position: 'absolute', top: e.y, left: 0, right: 0, transition: 'top 120ms ease-out', '@media (prefers-reduced-motion: reduce)': { transition: 'none' } }}>
            {e.contenu}
          </Box>
        ))}
      </Box>
    </>,
    document.body,
  )
}

// Volet (téléphone, petit écran)
function PanneauCommentaires({ commun, fils, panne, probleme, point, demande, onPoint, onFermer }: {
  commun: Commun; fils: Fil[]; panne: boolean; probleme: string | null
  point: Point | null; demande: number; onPoint: (p: Point | null) => void; onFermer: () => void
}) {
  const [voirResolus, setVoirResolus] = useState(false)
  // Refonte vague 2 (Joseph, 09/11/2026, 20A) : le volet montre aussi ce qui a changé dans le budget (versions enregistrées)
  const [vue, setVue] = useState<'commentaires' | 'tout'>('commentaires')
  const champ = useRef<HTMLTextAreaElement>(null)
  const { magasin, annee, moi } = commun
  const peutEcrire = !!moi && moi.role !== 'aucun'
  useEffect(() => { if (demande) champ.current?.focus({ preventScroll: true }) }, [demande])
  useEffect(() => {
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer() }
    window.addEventListener('keydown', echap)
    return () => window.removeEventListener('keydown', echap)
  }, [onFermer])
  const sur = point ?? ANCRE_BUDGET
  const visibles = fils.filter((f) => (!point || f.ancre === point.ancre))
  const ouverts = visibles.filter((f) => !f.resoluLe), resolus = visibles.filter((f) => f.resoluLe)
  const total = fils.filter((f) => !f.resoluLe).length
  return (
    <Card component="section" aria-label="Commentaires" className="pas-a-l-impression" sx={{ p: 2, display: 'grid', gap: 1.5, scrollMarginTop: 90 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="h2" sx={{ fontSize: '1.125rem', flex: 1 }}>Commentaires</Typography>
        {total > 0 && <Chip size="small" color="warning" label={total > 1 ? `${total} ouverts` : '1 ouvert'} />}
        <Tooltip title="Fermer"><IconButton aria-label="Fermer les commentaires" onClick={onFermer} sx={{ width: 48, height: 48 }}><CloseOutlined /></IconButton></Tooltip>
      </Box>
      <ToggleButtonGroup exclusive size="small" value={vue} onChange={(_, v) => v && setVue(v)} aria-label="Afficher" sx={{ '& .MuiToggleButton-root': { minHeight: { xs: 48, lg: 36 }, px: 1.5, textTransform: 'none' } }}>
        <ToggleButton value="commentaires">Commentaires seuls</ToggleButton>
        <ToggleButton value="tout">Tout</ToggleButton>
      </ToggleButtonGroup>
      {vue === 'tout' ? <Activite magasin={magasin} annee={annee} fils={fils} /> : <>
      {panne && <Alert severity="warning">Les commentaires ne se chargent pas pour l’instant. Réessaie dans un moment.</Alert>}
      {point && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'warning.dark', flex: 1, minWidth: 0 }}>{`Sur : ${point.libelle}`}</Typography>
          <Button size="small" startIcon={<CloseOutlined />} onClick={() => onPoint(null)} sx={{ minHeight: { xs: 48, lg: 32 } }}>Tout voir</Button>
        </Box>
      )}
      {ouverts.length === 0 && resolus.length === 0 && !panne && (
        <Typography variant="body2" color="text.secondary">
          {point ? 'Aucun commentaire sur ce point.' : 'Aucun commentaire. Pour commenter un point précis, clique sur la bulle à côté de lui.'}
        </Typography>
      )}
      {ouverts.length > 0 && <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>{ouverts.map((f) => <CarteFil key={f.id} f={f} commun={commun} avecPoint={!point} onPoint={onPoint} />)}</Box>}
      {resolus.length > 0 && (
        <>
          <Button size="small" onClick={() => setVoirResolus((v) => !v)} sx={{ justifySelf: 'start', minHeight: { xs: 48, lg: 32 } }}>
            {voirResolus ? 'Masquer les résolus' : `Voir ${resolus.length > 1 ? `les ${resolus.length} résolus` : 'le résolu'}`}
          </Button>
          {voirResolus && <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>{resolus.map((f) => <CarteFil key={f.id} f={f} commun={commun} avecPoint={!point} onPoint={onPoint} />)}</Box>}
        </>
      )}
      {peutEcrire && (
        <>
          {probleme && <Alert severity="error">{probleme}</Alert>}
          <NouveauCommentaire key={`${sur.ancre}-${demande}`} commun={commun} sur={sur} champ={champ} />
        </>
      )}
      </>}
    </Card>
  )
}

// Fil d'activité : commentaires, réponses, points résolus et versions enregistrées du budget, du plus récent au plus ancien
function Activite({ magasin, annee, fils }: { magasin: string; annee: number; fils: Fil[] }) {
  const { donnees, erreur } = useChargement(() => chargerEchanges(magasin, annee), [magasin, annee])
  type Evt = { cle: string; quand: string; titre: string; detail?: string }
  const evts: Evt[] = []
  for (const f of fils) {
    const sur = f.ancreLibelle ?? ANCRE_BUDGET.libelle
    evts.push({ cle: `c${f.id}`, quand: f.creeLe, titre: `${qui(f.auteurRole, f.auteurNom)} a commenté : ${sur}`, detail: f.texte })
    for (const r of f.reponses) evts.push({ cle: `c${r.id}`, quand: r.creeLe, titre: `${qui(r.auteurRole, r.auteurNom)} a répondu : ${sur}`, detail: r.texte })
    if (f.resoluLe) evts.push({ cle: `r${f.id}`, quand: f.resoluLe, titre: `${qui(f.resoluParRole, f.resoluParNom)} a marqué résolu : ${sur}` })
  }
  for (const v of donnees?.versions ?? []) {
    evts.push({ cle: `v${v.id}`, quand: v.creeLe, titre: `${qui(v.auteurRole, v.auteurNom)} a enregistré le budget`, detail: `Statut : ${statutLibelle[v.statut] ?? v.statut}` })
  }
  evts.sort((a, b) => (a.quand < b.quand ? 1 : -1))
  return (
    <>
      {erreur && !donnees && <Alert severity="warning">Les modifications du budget ne se chargent pas pour l’instant. Les commentaires restent affichés.</Alert>}
      {evts.length === 0 ? (
        <LigneVide>Rien pour l’instant : les commentaires et les enregistrements du budget s’afficheront ici.</LigneVide>
      ) : (
        <Box component="ol" aria-label="Activité du budget" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>
          {evts.map((e) => (
            <Box key={e.cle} component="li" sx={{ borderLeft: 3, borderColor: e.cle.startsWith('v') ? 'primary.main' : 'warning.main', pl: 1.25, py: 0.25 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{e.titre}</Typography>
              {e.detail && <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{e.detail}</Typography>}
              <Typography variant="body2" color="text.secondary">{quand(e.quand)}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </>
  )
}

// Sans budget à commenter (autres espaces, magasin sans base), la page telle quelle
export function AvecCommentaires({ actif, magasin, annee, moi, children }: {
  actif: boolean; magasin: string; annee: number; moi: Profil | null
  children: (panneau: ReactNode, ouverts: number) => ReactNode
}) {
  if (!actif || !moi) return <>{children(null, 0)}</>
  return <CommentairesBudget magasin={magasin} annee={annee} moi={moi}>{children}</CommentairesBudget>
}
