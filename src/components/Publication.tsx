// Fil d'actualité façon réseau social (propositions 204 à 211, Joseph 15/11/2026) : une carte par publication, l'auteur
// en tête, le texte qui se déplie sur place, la photo en grand, puis les mêmes gestes sous chaque publication.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import ListItemIcon from '@mui/material/ListItemIcon'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import CelebrationOutlined from '@mui/icons-material/CelebrationOutlined'
import TipsAndUpdatesOutlined from '@mui/icons-material/TipsAndUpdatesOutlined'
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import Snackbar from '@mui/material/Snackbar'
import { GrillePhotos, Initiales } from './Social'
import { useCreer } from './Creer'
import { DialogProposer } from './Propositions'
import { PublierCommunication } from '../pages/Communications'
import type { Reseau } from '../data/modele'
import { VisuelFil } from './MiseEnForme'
import { PieceJointe, useOuvrirCompteRendu } from './ApercuCompteRendu'
import { quand, type ElementFil, type GenreFil } from '../data/fil'

// Ce qui se publie : comptes rendus, bonnes pratiques, communications, temps forts et campagnes (204A). Le reste (tâches,
// messages, chiffres, journal) ne vit que dans le fil d'activité de la fiche magasin.
const PUBLICATIONS: GenreFil[] = ['visite', 'pratique', 'communication', 'animation']
export const estPublication = (e: ElementFil) => PUBLICATIONS.includes(e.genre) && !e.journal

const rolesAuteur: Record<string, string> = { directeur: 'Directeur de réseau', rr: 'Responsable Régional', coach: 'Coach', franchise: 'Franchisé' }
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Instant comparable à une date et heure ISO
export const instantFil = (s: string) => Date.parse(s.length === 10 ? `${s}T00:00:00` : s)

// Texte coupé à 4 lignes, « …voir plus » le déplie sur place (205A)
function TexteRepliable({ texte, secondaire }: { texte: string; secondaire?: boolean }) {
  const [ouvert, setOuvert] = useState(false)
  const [coupe, setCoupe] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (el && !ouvert) setCoupe(el.scrollHeight > el.clientHeight + 1)
  }, [texte, ouvert])
  return (
    <Box>
      <Typography ref={ref} {...(secondaire ? { variant: 'body2' as const, color: 'text.secondary' } : {})}
        sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere', ...(ouvert ? {} : { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }}>
        {texte}
      </Typography>
      {coupe && !ouvert && (
        <Button onClick={() => setOuvert(true)} color="inherit" sx={{ minHeight: 48, px: 0, fontWeight: 600, color: 'text.secondary' }}>…voir plus</Button>
      )}
    </Box>
  )
}

function Nouveau() {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: 'warning.dark', fontWeight: 600, fontSize: '0.8125rem', flexShrink: 0 }}>
      <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'currentColor' }} />Nouveau
    </Box>
  )
}

const iconeSansAuteur: Partial<Record<GenreFil, ReactNode>> = { communication: <CampaignOutlined />, pratique: <TipsAndUpdatesOutlined />, animation: <CelebrationOutlined /> }

// Une publication : qui (en gras), puis rôle ou type, lieu et moment ; le titre, le texte, la photo en grand
export function CartePublication({ e, jour, sansMagasin = false, nouveau = false, entete, children }: {
  e: ElementFil; jour: string; sansMagasin?: boolean; nouveau?: boolean; entete?: ReactNode; children?: ReactNode
}) {
  const ouvrirCR = useOuvrirCompteRendu()
  const cr = e.genre === 'visite' && e.visiteId ? () => ouvrirCR(e.visiteId!) : undefined
  const ouvrir = cr ? { onClick: cr } : { component: RouterLink, to: e.lien }
  const ou = e.genre === 'communication' || e.genre === 'animation' ? e.cible : sansMagasin ? '' : e.magasin
  const qui = e.auteur || (e.genre === 'animation' || e.genre === 'communication' ? 'V and B' : e.magasin)
  const nature = e.genre === 'communication' ? rolesAuteur[e.communication?.auteurRole ?? ''] ?? 'Communication' : majuscule(e.action)
  const sousTitre = [nature, ou, quand(e.instant, jour)].filter(Boolean).join(' · ')
  const libelle = e.communication?.titre ?? e.pratique?.titre ?? (e.genre === 'visite' ? `Compte rendu de ${e.magasin}` : e.titre)
  return (
    <Card component="article" aria-label={libelle} sx={{ overflow: 'hidden' }}>
      {entete}
      <ButtonBase {...ouvrir} sx={{ display: 'block', textAlign: 'left', width: '100%', px: 2, pt: 2, pb: e.titre ? 0.5 : 1, color: 'text.primary', '&:hover': { bgcolor: 'action.hover' } }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Initiales nom={qui} taille={48} icone={e.auteur ? undefined : iconeSansAuteur[e.genre]} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700 }} noWrap>{qui}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>{sousTitre}</Typography>
          </Box>
          {nouveau && <Nouveau />}
        </Box>
        {e.titre && <Typography sx={{ mt: 1.5, fontWeight: 600, fontSize: '1.125rem' }}>{e.titre}</Typography>}
      </ButtonBase>
      {e.texte && !e.valeur && <Box sx={{ px: 2, pb: 1 }}><TexteRepliable texte={e.texte} secondaire={e.genre === 'visite'} /></Box>}
      {e.visuel && (
        <ButtonBase {...ouvrir} aria-label={`Ouvrir ${libelle ?? 'la publication'}`} sx={{ display: 'block', width: '100%', mt: 0.5 }}>
          <VisuelFil piece={e.visuel.piece} url={e.visuel.url} alt={e.titre ?? ''} />
        </ButtonBase>
      )}
      {!!e.photos?.length && <Box sx={{ pt: 0.5, pb: cr ? 0 : 1 }}><GrillePhotos photos={e.photos} grand /></Box>}
      {cr && <Box sx={{ px: 2, pt: 1, pb: 1.5 }}><PieceJointe nom={`Compte rendu de ${e.magasin}`} libelle={`Ouvrir le compte rendu de ${e.magasin}`} onOuvrir={cr} /></Box>}
      {children}
    </Card>
  )
}

// Publication sans « J'aime » (temps fort, campagne, compte rendu avant la migration) : le même bandeau d'action
export function ActionsSimples({ lien, libelle = 'Voir le détail' }: { lien: string; libelle?: string }) {
  return (
    <Box sx={{ display: 'flex', mx: 1, mt: 0.5, borderTop: '1px solid', borderColor: 'divider', '& > *': { flex: 1, minHeight: 48 } }}>
      <Button component={RouterLink} to={lien} color="inherit" startIcon={<OpenInNewOutlined />} sx={{ minHeight: 48 }}>{libelle}</Button>
    </Box>
  )
}

// Troisième geste d'une communication pour le franchisé : « J'ai pris connaissance »
export function BoutonConnaissance({ pris, lectureSeule, prendre }: { pris: boolean; lectureSeule: boolean; prendre: () => void }) {
  return pris
    ? <Button disabled startIcon={<TaskAltOutlined />} sx={{ px: 1, minHeight: 48, '&.Mui-disabled': { color: 'success.dark' } }}>Pris connaissance</Button>
    : <Button onClick={prendre} disabled={lectureSeule} startIcon={<TaskAltOutlined />} color="primary" sx={{ px: 1, minHeight: 48, fontWeight: 700 }}>J’ai pris connaissance</Button>
}

// « Partager quelque chose » en tête du fil (207A) : bonne pratique pour tous (proposée par le franchisé), communication
// pour le Directeur et les RR
export function BarrePartager({ moi, franchise, communication, reseau, apres, compact = false }: {
  moi: string; franchise: boolean; communication: boolean; reseau: Reseau; apres?: () => Promise<void> | void; compact?: boolean
}) {
  // Joseph 16/11/2026 : on écrit et on publie depuis l'Accueil, sans être renvoyé vers Animation
  const creer = useCreer()
  const [ouvert, setOuvert] = useState<'proposer' | 'communication' | null>(null)
  const [message, setMessage] = useState('')
  const fermer = (m?: string) => { setOuvert(null); if (m) setMessage(m) }
  const pratique = () => (franchise ? setOuvert('proposer') : creer('pratique'))
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  const libelle = franchise ? 'Partager une réussite de mon magasin' : 'Partager une réussite du terrain'
  const fenetres = <>
    {ouvert === 'proposer' && <DialogProposer reseau={reseau} onFermer={fermer} />}
    {ouvert === 'communication' && <PublierCommunication apres={apres} onFermer={fermer} />}
    <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
  </>
  // Téléphone (maquette 278, Joseph 17/11/2026) : un seul champ ; Bonne pratique ou Communication se choisissent au toucher
  if (compact) return (
    <Box component="section" aria-label="Partager" sx={{ flex: 1, minWidth: 0 }}>
      <ButtonBase onClick={(ev) => (communication ? setAncre(ev.currentTarget) : pratique())} aria-haspopup={communication ? 'menu' : undefined}
        sx={{ width: '100%', minHeight: 48, borderRadius: 999, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', px: 2, justifyContent: 'flex-start', fontFamily: 'inherit', fontSize: '1rem', color: 'text.secondary', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {libelle}
      </ButtonBase>
      <Menu anchorEl={ancre} open={!!ancre} onClose={() => setAncre(null)} slotProps={{ list: { 'aria-label': 'Que partager ?' } }}>
        <MenuItem onClick={() => { setAncre(null); pratique() }} sx={{ minHeight: 48 }}><ListItemIcon><TipsAndUpdatesOutlined /></ListItemIcon>Bonne pratique</MenuItem>
        <MenuItem onClick={() => { setAncre(null); setOuvert('communication') }} sx={{ minHeight: 48 }}><ListItemIcon><CampaignOutlined /></ListItemIcon>Communication</MenuItem>
      </Menu>
      {fenetres}
    </Box>
  )
  return (
    <Card component="section" aria-label="Partager" sx={{ p: 1.5, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Initiales nom={moi || 'Moi'} taille={48} />
        <ButtonBase onClick={pratique} sx={{ flex: 1, minHeight: 48, borderRadius: 999, border: '1px solid', borderColor: 'divider', px: 2, justifyContent: 'flex-start', fontFamily: 'inherit', fontSize: '1rem', color: 'text.secondary', '&:hover': { bgcolor: 'action.hover' } }}>
          {libelle}
        </ButtonBase>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, mt: 1, pl: { sm: 7.5 }, flexWrap: 'wrap' }}>
        <Button onClick={pratique} startIcon={<TipsAndUpdatesOutlined />} color="inherit" sx={{ minHeight: 48 }}>{franchise ? 'Proposer une bonne pratique' : 'Bonne pratique'}</Button>
        {communication && <Button onClick={() => setOuvert('communication')} startIcon={<CampaignOutlined />} color="inherit" sx={{ minHeight: 48 }}>Communication</Button>}
      </Box>
      {fenetres}
    </Card>
  )
}

// Dernier passage sur le fil, gardé sur l'appareil (211A) : ce qui est arrivé depuis porte « Nouveau ». La première fois,
// rien n'est signalé. Le passage est noté en quittant l'écran, pour que les repères restent visibles pendant la lecture.
const CLE_VU = 'vandb-fil-vu'
export function useDernierPassage(actif: boolean): number {
  const [avant] = useState(() => {
    if (!actif) return 0
    try { const v = localStorage.getItem(CLE_VU); return v ? Date.parse(v) : 0 } catch { return 0 }
  })
  useEffect(() => {
    if (!actif) return
    const noter = () => { try { localStorage.setItem(CLE_VU, new Date().toISOString()) } catch { /* appareil sans stockage */ } }
    // Première visite : le passage est noté tout de suite
    if (!avant) noter()
    return noter
  }, [actif, avant])
  return avant
}

// Séparateur après la dernière nouveauté
export function AJour() {
  return (
    <Box role="separator" aria-label="Vous êtes à jour" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary', py: 0.5 }}>
      <Box sx={{ flex: 1, borderTop: '1px solid', borderColor: 'divider' }} />
      <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontWeight: 600 }}><TaskAltOutlined sx={{ fontSize: 18 }} />Vous êtes à jour</Typography>
      <Box sx={{ flex: 1, borderTop: '1px solid', borderColor: 'divider' }} />
    </Box>
  )
}

// Fil continu (209A) : la suite se charge quand le bas du fil approche ; le bouton reste pour le clavier
export function useSuiteAutomatique(charger: () => void, actif: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !actif || typeof IntersectionObserver === 'undefined') return
    const o = new IntersectionObserver((x) => { if (x.some((i) => i.isIntersecting)) charger() }, { rootMargin: '400px' })
    o.observe(el)
    return () => o.disconnect()
  }, [charger, actif])
  return ref
}
