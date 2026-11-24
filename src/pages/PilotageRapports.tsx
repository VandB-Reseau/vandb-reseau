import { useCallback, useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined'
import Skeleton from '@mui/material/Skeleton'
import Snackbar from '@mui/material/Snackbar'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { brand } from '../theme/theme'
import TableSortLabel from '@mui/material/TableSortLabel'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DragIndicatorOutlined from '@mui/icons-material/DragIndicatorOutlined'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import StarBorderRounded from '@mui/icons-material/StarBorderRounded'
import StarRounded from '@mui/icons-material/StarRounded'
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import AlignHorizontalLeftOutlined from '@mui/icons-material/AlignHorizontalLeftOutlined'
import BarChartOutlined from '@mui/icons-material/BarChartOutlined'
import ShowChartOutlined from '@mui/icons-material/ShowChartOutlined'
import PieChartOutlineOutlined from '@mui/icons-material/PieChartOutlineOutlined'
import LeaderboardOutlined from '@mui/icons-material/LeaderboardOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import SendOutlined from '@mui/icons-material/SendOutlined'
import { Indicateur as CarteIndicateur, grilleIndicateurs, sensDe } from '../components/Indicateur'
import { MiniCourbe } from '../components/Social'
import { useMessagerie } from '../data/MessagerieContext'
import { contacts, type Contact } from '../data/messagerie'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { useAuth } from '../auth/AuthContext'
import { useApercu } from '../auth/Apercu'
import type { Magasin, Reseau } from '../data/modele'
import { useEngagement, type Engagement } from '../data/engagement'
import {
  COMPARAISONS, apercuRapport, comparable, ecartFavorable, ecartReference, formaterEcart, tendance, magasinsRetenus, type Comparaison, type Periode,
  DECOUPAGES, PUBLICS, THEMES, connaitreThematiques, rapportsProposes, type Public, type RapportPropose, TYPES_PERIODE, axe, axesVisibles, calculer, definitionVide, dernierMoisClos, formater,
  indicateur, indicateursVisibles, libelleMoisLong, libellePeriode, normaliserDefinition, tonCellule, valeursAxe,
  type AxeId, type Cellule, type Contexte, type Definition, TYPES_GRAPHE, type TypeGraphe, type FinanceMagasin, type Indicateur, type Resultat, type Theme,
} from '../data/rapports'
import { basculerFavori, basculerMasque, useListeRapports } from '../data/rapportsListe'
import { chargerRapports, enregistrerRapport, supprimerRapport, type RapportEnregistre } from '../data/rapportsBase'
import { chargerFinancesRapports } from '../data/rapportsFinances'
import { ZonePilotage } from '../pilotage/ZonePilotage'
import { anneeSuivi } from '../pilotage/data/annees'
import { classeur, nomFichier, telecharger, type Cellule as CelluleXlsx } from '../pilotage/lib/xlsx'
import { decalerMois } from '../data/chiffres'

// Onglet « Pilotage » (Joseph, 17/11/2026) : rapports proposés par le siège, rapports de chacun (Coach compris),
// indicateurs de tous les sujets en parallèle, glisser-déposer, tableau croisé et graphes, export Excel et impression.
// Le franchisé a l'onglet sur ses seuls magasins, sans la nine box ni les axes de l'équipe.

type Selection = { genre: 'propose'; id: string } | { genre: 'base'; id: number } | { genre: 'libre' }

// Budgets chargés dans la zone du pilotage (leur propre connexion), sans rien afficher
function ChargeurFinances({ surFin }: { surFin: (f: Map<string, FinanceMagasin> | null) => void }) {
  useEffect(() => {
    let actif = true
    chargerFinancesRapports(anneeSuivi()).then((f) => { if (actif) surFin(f) }).catch(() => { if (actif) surFin(null) })
    return () => { actif = false }
  }, [surFin])
  return null
}

export function PilotageRapports() {
  return <AvecReseau>{(reseau) => <Rapports reseau={reseau} />}</AvecReseau>
}

const lireDefinitionAdresse = (v: string | null, equipe: boolean): Definition | null => {
  if (!v) return null
  try { return normaliserDefinition(JSON.parse(v), equipe) } catch { return null }
}

function Rapports({ reseau }: { reseau: Reseau }) {
  const { profil } = useAuth()
  const { apercu, equipe: apercuEquipe } = useApercu()
  const equipe = profil?.role !== 'franchise'
  const lectureSeule = !!apercu || !!apercuEquipe
  const directeur = profil?.role === 'directeur' && !lectureSeule
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const [params, setParams] = useSearchParams()

  const [finances, setFinances] = useState<Map<string, FinanceMagasin> | null | undefined>(undefined)
  const surFin = useCallback((f: Map<string, FinanceMagasin> | null) => setFinances(f), [])
  const [enregistres, setEnregistres] = useState<RapportEnregistre[] | null>(null)
  const [indisponibles, setIndisponibles] = useState(false)
  const recharger = useCallback(() => chargerRapports(equipe).then((l) => { setEnregistres(l); setIndisponibles(false) }).catch(() => { setEnregistres([]); setIndisponibles(true) }), [equipe])
  useEffect(() => { void recharger() }, [recharger])

  connaitreThematiques(reseau.deploiements.thematiques)
  const proposes = rapportsProposes(profil?.role)
  const listePerso = useListeRapports()
  const choix = params.get('rapport') ?? ''
  const parDefaut = listePerso.favoris.find((c) => /^\d+$/.test(c) ? enregistres?.some((r) => String(r.id) === c) : proposes.some((r) => `p-${r.id}` === c))
    ?? `p-${(groupesProposes(proposes, profil?.role).flatMap((g) => g.rapports).find((r) => !listePerso.masques.includes(`p-${r.id}`)) ?? proposes[0]).id}`
  const cleChoisie = choix || (params.get('d') ? '' : parDefaut)
  const selection: Selection = cleChoisie.startsWith('p-') && proposes.some((r) => `p-${r.id}` === cleChoisie) ? { genre: 'propose', id: cleChoisie.slice(2) }
    : /^\d+$/.test(cleChoisie) ? { genre: 'base', id: Number(cleChoisie) } : { genre: 'libre' }
  const enregistre = selection.genre === 'base' ? enregistres?.find((r) => r.id === selection.id) ?? null : null
  const propose = selection.genre === 'propose' ? proposes.find((r) => r.id === selection.id) ?? null : null
  const depart = useMemo(() => lireDefinitionAdresse(params.get('d'), equipe)
    ?? (enregistre ? enregistre.definition : propose ? normaliserDefinition(propose.definition, equipe) : definitionVide()), [params, equipe, enregistre, propose])
  const titreDepart = enregistre?.titre ?? propose?.titre ?? params.get('titre') ?? 'Nouveau rapport'

  // Définition en cours : repart de celle du rapport choisi à chaque changement de rapport
  const [def, setDef] = useState<Definition>(depart)
  const cleDepart = JSON.stringify(depart) + titreDepart
  const [vu, setVu] = useState(cleDepart)
  if (vu !== cleDepart) { setVu(cleDepart); setDef(depart) }
  const modifie = JSON.stringify(def) !== JSON.stringify(depart)
  const changer = (d: Partial<Definition>) => setDef((x) => ({ ...x, ...d }))

  // Engagement du franchisé (équipe seule) : repères de sa fiche, calculés une fois par franchisé sur tous ses magasins
  const calculEngagement = useEngagement(reseau)
  const engagement = useMemo(() => {
    if (!calculEngagement || !equipe) return null
    const parFranchise = new Map<string, string[]>()
    for (const m of reseau.magasins) if (m.responsable?.nom) parFranchise.set(m.responsable.nom, [...parFranchise.get(m.responsable.nom) ?? [], m.nom])
    const cache = new Map<string, Engagement>()
    return (m: Magasin) => {
      const nom = m.responsable?.nom
      if (!nom) return null
      if (!cache.has(nom)) cache.set(nom, calculEngagement(nom, parFranchise.get(nom) ?? [m.nom]))
      return cache.get(nom)!
    }
  }, [calculEngagement, equipe, reseau])
  const ctx: Contexte = useMemo(() => ({ reseau, finances: finances ?? null, jour: reseau.jour, equipe, engagement }), [reseau, finances, equipe, engagement])
  const resultat = useMemo(() => calculer(ctx, def), [ctx, def])

  const cleRapport = selection.genre === 'propose' ? `p-${selection.id}` : selection.genre === 'base' && enregistre ? String(selection.id) : ''
  const favori = listePerso.favoris.includes(cleRapport)
  const masque = listePerso.masques.includes(cleRapport)
  const ouvrir = (cle: string) => setParams(cle ? { rapport: cle } : {}, { replace: false })
  const [message, setMessage] = useState('')
  const [dialogue, setDialogue] = useState<null | 'enregistrer' | 'envoyer'>(null)

  const exporter = () => {
    const titre = enregistre?.titre ?? propose?.titre ?? 'Rapport'
    telecharger(nomFichier(`Pilotage - ${titre}`), classeur([feuilleRapport(titre, libellePeriode(def.periode, reseau.jour), resultat, def)]))
  }
  const lienRapport = () => {
    const base = `${window.location.origin}${window.location.pathname}#/pilotage`
    return selection.genre === 'base' && !modifie ? `${base}?rapport=${selection.id}` : selection.genre === 'propose' && !modifie ? `${base}?rapport=p-${selection.id}` : `${base}?d=${encodeURIComponent(JSON.stringify(def))}&titre=${encodeURIComponent(titreDepart)}`
  }
  // 384 (Joseph, 24/11/2026) : PDF propre par l'impression du navigateur (cartes, graphes, tableau ; menus et boutons masqués),
  // le titre du rapport donne le nom du fichier
  const exporterPdf = () => {
    const avant = document.title
    document.title = `Pilotage - ${titreDepart}`
    const remettre = () => { document.title = avant; window.removeEventListener('afterprint', remettre) }
    window.addEventListener('afterprint', remettre)
    window.print()
  }
  const copierLien = () => {
    const lien = lienRapport()
    void navigator.clipboard?.writeText(lien).then(() => setMessage('Lien copié : chacun l’ouvre avec ses propres droits')).catch(() => setMessage('Lien copié'))
    if (!navigator.clipboard) setMessage('Lien copié')
  }
  const supprimer = async () => {
    if (!enregistre) return
    try { await supprimerRapport(enregistre.id); await recharger(); ouvrir(''); setMessage('Rapport supprimé') } catch { setMessage('Le rapport n’a pas pu être supprimé. Réessaie dans un instant.') }
  }

  const liste = (
    <ListeRapports proposes={proposes} role={profil?.role} enregistres={enregistres} indisponibles={indisponibles} selection={selection} ouvrir={ouvrir} ctx={ctx}
      nouveau={() => setParams({ d: JSON.stringify(definitionVide()), titre: 'Nouveau rapport' })} lectureSeule={lectureSeule} surPC={surPC} />
  )

  return (
    <>
      <Box sx={{ display: 'none' }} aria-hidden><ZonePilotage>{() => <ChargeurFinances surFin={surFin} />}</ZonePilotage></Box>
      <PageHeader titre="Pilotage" />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '280px minmax(0, 1fr)' }, gap: 3, alignItems: 'start' }}>
        {surPC ? <Box className="pas-a-l-impression">{liste}</Box> : liste}
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <Typography variant="h2" component="h2">{titreDepart}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {libellePeriode(def.periode, reseau.jour)} · {resultat.magasins} magasin{resultat.magasins > 1 ? 's' : ''}{modifie ? ' · modifié' : ''}
                {(propose || enregistre?.modele) && ' · proposé par le siège'}{enregistre?.modele && directeur && enregistre.publics.length < PUBLICS.length ? ` · ${PUBLICS.filter((p) => enregistre.publics.includes(p.cle)).map((p) => p.libelle.toLowerCase()).join(', ')}` : ''}{enregistre && !enregistre.mien && !enregistre.modele ? ` · de ${enregistre.auteur}` : ''}
              </Typography>
            </Box>
            <Box className="pas-a-l-impression" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {!lectureSeule && <Button variant="contained" startIcon={<SaveOutlined />} onClick={() => setDialogue('enregistrer')} sx={{ minHeight: 48 }}>Enregistrer</Button>}
              {cleRapport && <IconButton aria-label={favori ? 'Retirer de mes favoris' : 'Ajouter à mes favoris'} aria-pressed={favori} onClick={() => basculerFavori(cleRapport)} sx={{ width: 48, height: 48, color: favori ? 'warning.main' : undefined }}>{favori ? <StarRounded /> : <StarBorderRounded />}</IconButton>}
              {/* 328 (18/11/2026) : Enregistrer et le favori en vue, le reste dans « ⋯ » */}
              <MenuAutresRapport actions={[
                { libelle: 'Partager le lien', icone: <LinkOutlined />, onClick: copierLien },
                ...(equipe && !lectureSeule ? [{ libelle: 'Envoyer à mes RR ou Coachs', icone: <SendOutlined />, onClick: () => setDialogue('envoyer') }] : []),
                { libelle: 'Exporter en PDF', icone: <PictureAsPdfOutlined />, onClick: exporterPdf },
                { libelle: 'Exporter en Excel', icone: <FileDownloadOutlined />, onClick: exporter },
                ...(cleRapport && !enregistre?.mien ? [{ libelle: masque ? 'Réafficher dans ma liste' : 'Masquer de ma liste', icone: masque ? <VisibilityOutlined /> : <VisibilityOffOutlined />, onClick: () => { basculerMasque(cleRapport); setMessage(masque ? 'Rapport réaffiché dans ta liste' : 'Rapport masqué de ta liste') } }] : []),
                ...(enregistre && (enregistre.mien || (enregistre.modele && directeur)) && !lectureSeule ? [{ libelle: 'Supprimer ce rapport', icone: <DeleteOutlined />, onClick: () => void supprimer() }] : []),
              ]} />
            </Box>
          </Box>
          <BarreRapide def={def} changer={changer} ctx={ctx} surPC={surPC} />
          {finances === undefined && (resultat.indicateurs.some((i) => i.theme === 'budget') || def.comparer === 'budget') && <Skeleton variant="rounded" height={8} sx={{ mb: 1 }} aria-label="Chargement des budgets" />}
          <CartesChiffres resultat={resultat} def={def} ctx={ctx} />
          <Constructeur def={def} changer={changer} ctx={ctx} surPC={surPC} nouveau={titreDepart === 'Nouveau rapport'} />
          <Affichage resultat={resultat} def={def} changer={changer} surPC={surPC} />
        </Box>
      </Box>
      {dialogue === 'enregistrer' && (
        <DialogueEnregistrer
          titre={enregistre?.mien ? enregistre.titre : titreDepart === 'Nouveau rapport' ? '' : enregistre?.mien ? titreDepart : `${titreDepart} (ma version)`}
          existant={enregistre?.mien ? enregistre : null} equipe={equipe && !lectureSeule} directeur={directeur}
          fermer={() => setDialogue(null)}
          enregistrer={async (r) => {
            const id = await enregistrerRapport({ ...r, definition: def })
            await recharger()
            setDialogue(null)
            setParams({ rapport: String(id) })
            setMessage(r.modele ? 'Rapport proposé par le siège' : 'Rapport enregistré')
          }}
        />
      )}
      {dialogue === 'envoyer' && (
        <DialogueEnvoyer reseau={reseau} titre={titreDepart} periode={libellePeriode(def.periode, reseau.jour)} lien={lienRapport()} fermer={() => setDialogue(null)}
          envoye={(n) => { setDialogue(null); setMessage(n > 1 ? `Rapport envoyé à ${n} personnes` : 'Rapport envoyé') }} />
      )}
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </>
  )
}

// ── Liste des rapports ──────────────────────────────────────────────────
const TITRE_SIEGE = 'Proposés par le siège'
// Rapports proposés rangés : ceux de son public d'abord (« Pour bien démarrer »), les trois publics pour le Directeur
function groupesProposes(proposes: RapportPropose[], role: string | undefined) {
  const generaux = { titre: TITRE_SIEGE, rapports: proposes.filter((r) => !r.pour) }
  const publics = role === 'directeur'
    ? PUBLICS.map((p) => ({ titre: p.libelle, rapports: proposes.filter((r) => r.pour?.includes(p.cle)) }))
    : [{ titre: 'Pour bien démarrer', rapports: proposes.filter((r) => r.pour) }]
  return (role === 'directeur' ? [generaux, ...publics] : [...publics, generaux]).filter((g) => g.rapports.length)
}

interface Entree { cle: string; titre: string; sous?: string; def?: Definition }
function MenuAutresRapport({ actions }: { actions: { libelle: string; icone: ReactNode; onClick: () => void }[] }) {
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  return (
    <>
      <IconButton aria-label="Autres actions" aria-haspopup="menu" aria-expanded={!!ancre} onClick={(e) => setAncre(e.currentTarget)} sx={{ width: 48, height: 48 }}><MoreHorizOutlined /></IconButton>
      <Menu anchorEl={ancre} open={!!ancre} onClose={() => setAncre(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        {actions.map((a) => <MenuItem key={a.libelle} onClick={() => { setAncre(null); a.onClick() }} sx={{ minHeight: 48 }}><ListItemIcon>{a.icone}</ListItemIcon>{a.libelle}</MenuItem>)}
      </Menu>
    </>
  )
}

// Tous les rapports du compte rangés par groupe ; favoris en tête, masqués à part (rapportsListe.ts)
function rangerRapports(proposes: RapportPropose[], role: string | undefined, enregistres: RapportEnregistre[] | null, liste: { favoris: string[]; masques: string[] }) {
  // Modèles publiés : pour tous dans « Proposés par le siège », sinon avec les rapports de leur public
  const modeles = (enregistres ?? []).filter((r) => r.modele)
  const pourTous = (r: RapportEnregistre) => r.publics.length === PUBLICS.length
  const modelesDe = (titre: string) => modeles.filter((r) => (titre === TITRE_SIEGE ? pourTous(r)
    : !pourTous(r) && (titre === 'Pour bien démarrer' || r.publics.includes(PUBLICS.find((p) => p.libelle === titre)?.cle as Public))))
  const proposesRanges = groupesProposes(proposes, role)
  for (const t of [TITRE_SIEGE, role === 'directeur' ? '' : 'Pour bien démarrer', ...(role === 'directeur' ? PUBLICS.map((p) => p.libelle) : [])]) {
    if (t && !proposesRanges.some((g) => g.titre === t) && modelesDe(t).length) proposesRanges.push({ titre: t, rapports: [] })
  }
  const groupes: { titre: string; entrees: Entree[] }[] = [
    ...proposesRanges.map((g) => ({ titre: g.titre, entrees: [...g.rapports.map((r) => ({ cle: `p-${r.id}`, titre: r.titre, def: r.definition })),
      ...modelesDe(g.titre).map((r) => ({ cle: String(r.id), titre: r.titre, def: r.definition }))] })),
    { titre: 'Mes rapports', entrees: (enregistres ?? []).filter((r) => r.mien && !r.modele).map((r) => ({ cle: String(r.id), titre: r.titre, sous: r.partage ? 'Partagé à l’équipe' : undefined, def: r.definition })) },
    { titre: 'Partagés avec moi', entrees: (enregistres ?? []).filter((r) => !r.mien && !r.modele).map((r) => ({ cle: String(r.id), titre: r.titre, sous: r.auteur, def: r.definition })) },
  ]
  const toutes = new Map(groupes.flatMap((g) => g.entrees).map((e) => [e.cle, e] as const))
  const favoris = liste.favoris.map((c) => toutes.get(c)).filter((e): e is Entree => !!e)
  const masques = liste.masques.map((c) => toutes.get(c)).filter((e): e is Entree => !!e)
  const a_part = new Set([...liste.favoris, ...liste.masques])
  return { favoris, masques, groupes: groupes.map((g) => ({ ...g, entrees: g.entrees.filter((e) => !a_part.has(e.cle)) })) }
}

// 377 (Joseph, 24/11/2026) : chaque rapport en carte, avec son chiffre clé et sa courbe des 12 derniers mois
function ApercuEntree({ def, ctx }: { def: Definition; ctx: Contexte }) {
  const a = useMemo(() => { try { return apercuRapport(ctx, normaliserDefinition(def, ctx.equipe)) } catch { return null } }, [def, ctx])
  if (!a) return null
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" noWrap component="div" title={a.libelle}>{a.libelle}</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', fontVariantNumeric: 'tabular-nums', color: a.ton === 'bon' ? 'success.dark' : a.ton === 'mauvais' ? 'error.main' : 'text.primary' }} noWrap>{a.valeur}</Typography>
      </Box>
      <MiniCourbe valeurs={a.serie} couleur={brand.vertFonce} largeur={72} hauteur={28} />
    </Box>
  )
}

function ListeRapports({ proposes, role, enregistres, indisponibles, selection, ouvrir, nouveau, lectureSeule, surPC, ctx }: {
  proposes: RapportPropose[]; role: string | undefined; enregistres: RapportEnregistre[] | null; indisponibles: boolean; selection: Selection; ouvrir: (cle: string) => void
  nouveau: () => void; lectureSeule: boolean; surPC: boolean; ctx: Contexte
}) {
  const liste = useListeRapports()
  const { favoris, masques, groupes } = rangerRapports(proposes, role, enregistres, liste)
  const [voirMasques, setVoirMasques] = useState(false)
  const actif = selection.genre === 'propose' ? `p-${selection.id}` : selection.genre === 'base' ? String(selection.id) : ''
  const visibles = groupes.filter((g) => g.entrees.length && (g.titre !== 'Mes rapports' && g.titre !== 'Partagés avec moi' || (enregistres !== null && !indisponibles)))
  if (!surPC) {
    // Téléphone : un choix déroulant, le reste de la page pour les chiffres
    const option = (e: Entree, g: string) => <MenuItem key={`${g}-${e.cle}`} value={e.cle} sx={{ minHeight: 48 }}>{e.titre}</MenuItem>
    return (
      <TextField select label="Rapport" value={actif} onChange={(e) => (e.target.value === 'nouveau' ? nouveau() : ouvrir(e.target.value))} fullWidth sx={{ '& .MuiInputBase-root': { minHeight: 48 }, '& .MuiSelect-nativeInput': { height: '100%' } }}>
        {selection.genre === 'libre' && <MenuItem value="">Rapport en cours</MenuItem>}
        {favoris.length > 0 && <ListSubheader>Mes favoris</ListSubheader>}
        {favoris.map((e) => option(e, 'favoris'))}
        {visibles.flatMap((g) => [<ListSubheader key={g.titre}>{g.titre}</ListSubheader>, ...g.entrees.map((e) => option(e, g.titre))])}
        {masques.length > 0 && <ListSubheader>Masqués</ListSubheader>}
        {masques.map((e) => option(e, 'masques'))}
        {!lectureSeule && <MenuItem value="nouveau" sx={{ minHeight: 48 }}>Nouveau rapport</MenuItem>}
      </TextField>
    )
  }
  const groupe = (titre: string, l: Entree[], action: 'favori' | 'reafficher' = 'favori') => (
    <List dense disablePadding aria-label={titre} subheader={<ListSubheader disableSticky sx={{ px: 1, lineHeight: '32px', fontWeight: 700, bgcolor: 'transparent' }}>{titre}</ListSubheader>}>
      {l.map((r) => {
        const fav = liste.favoris.includes(r.cle)
        return (
          <ListItem key={r.cle} disablePadding secondaryAction={action === 'reafficher'
            ? <IconButton edge="end" aria-label={`Réafficher ${r.titre}`} onClick={() => basculerMasque(r.cle)} sx={{ width: 40, height: 40 }}><VisibilityOutlined fontSize="small" /></IconButton>
            : <IconButton edge="end" aria-label={fav ? `Retirer ${r.titre} de mes favoris` : `Ajouter ${r.titre} à mes favoris`} aria-pressed={fav} onClick={() => basculerFavori(r.cle)} sx={{ width: 40, height: 40, color: fav ? 'warning.main' : 'text.secondary' }}>{fav ? <StarRounded fontSize="small" /> : <StarBorderRounded fontSize="small" />}</IconButton>}>
            <ListItemButton selected={actif === r.cle} onClick={() => ouvrir(r.cle)} aria-label={r.titre} aria-current={actif === r.cle ? 'page' : undefined}
              sx={{ borderRadius: '10px', minHeight: 48, pr: 6, mb: 0.75, border: 1, borderColor: actif === r.cle ? 'secondary.main' : 'divider', alignItems: 'flex-start', flexDirection: 'column' }}>
              <ListItemText primary={r.titre} secondary={r.sous} sx={{ my: 0, width: '100%' }} slotProps={{ primary: { variant: 'body2', sx: { fontWeight: 600 } }, secondary: { variant: 'caption' } }} />
              {r.def && action === 'favori' && <Box sx={{ width: '100%' }}><ApercuEntree def={r.def} ctx={ctx} /></Box>}
            </ListItemButton>
          </ListItem>
        )
      })}
    </List>
  )
  return (
    <Card variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {!lectureSeule && <Button variant="outlined" startIcon={<AddOutlined />} onClick={nouveau} sx={{ minHeight: 48 }}>Nouveau rapport</Button>}
      {favoris.length > 0 && groupe('Mes favoris', favoris)}
      {visibles.filter((g) => g.titre !== 'Mes rapports' && g.titre !== 'Partagés avec moi').map((g) => <Box key={g.titre}>{groupe(g.titre, g.entrees)}</Box>)}
      {enregistres === null ? <Skeleton variant="rounded" height={88} /> : indisponibles ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>Les rapports enregistrés ne sont pas encore disponibles.</Typography>
      ) : (
        <>
          {(groupes.find((g) => g.titre === 'Mes rapports')!.entrees.length > 0 || !(enregistres ?? []).some((r) => r.mien && !r.modele)) && groupe('Mes rapports', groupes.find((g) => g.titre === 'Mes rapports')!.entrees)}
          {!(enregistres ?? []).some((r) => r.mien && !r.modele) && <Typography variant="body2" color="text.secondary" sx={{ px: 1, mt: -1 }}>Aucun rapport enregistré pour l’instant.</Typography>}
          {visibles.filter((g) => g.titre === 'Partagés avec moi').map((g) => <Box key={g.titre}>{groupe(g.titre, g.entrees)}</Box>)}
        </>
      )}
      {masques.length > 0 && (
        <>
          <Button onClick={() => setVoirMasques((v) => !v)} aria-expanded={voirMasques} endIcon={voirMasques ? <ExpandLessOutlined /> : <ExpandMoreOutlined />} sx={{ minHeight: 48, justifyContent: 'space-between', color: 'text.secondary' }}>
            Rapports masqués ({masques.length})
          </Button>
          {voirMasques && groupe('Rapports masqués', masques, 'reafficher')}
        </>
      )}
    </Card>
  )
}

// ── Constructeur : champs à glisser, zones, période ─────────────────────
const TYPE_GLISSE = 'application/x-vandb-champ'
// Replié par défaut : le rapport s'affiche d'abord, la construction s'ouvre pour le modifier (Joseph, 17/11/2026) ;
// ouverte d'office sur un nouveau rapport, qui est à construire
function Constructeur({ def, changer, ctx, surPC, nouveau }: { def: Definition; changer: (d: Partial<Definition>) => void; ctx: Contexte; surPC: boolean; nouveau: boolean }) {
  const [ouvert, setOuvert] = useState(nouveau)
  useEffect(() => { if (nouveau) setOuvert(true) }, [nouveau])
  const [survol, setSurvol] = useState<string | null>(null)
  const inds = indicateursVisibles(ctx.equipe)
  const axes = axesVisibles(ctx.equipe)
  const ajouterIndicateur = (id: string, avant?: string) => {
    const sans = def.indicateurs.filter((x) => x !== id)
    const i = avant ? sans.indexOf(avant) : -1
    changer({ indicateurs: (i < 0 ? [...sans, id] : [...sans.slice(0, i), id, ...sans.slice(i)]).slice(0, 12) })
  }
  const retirerIndicateur = (id: string) => changer({ indicateurs: def.indicateurs.filter((x) => x !== id) })
  const deposer = (zone: 'lignes' | 'indicateurs' | 'filtres', avant?: string) => (e: DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setSurvol(null)
    const [genre, id] = (e.dataTransfer.getData(TYPE_GLISSE) || e.dataTransfer.getData('text/plain')).split(':')
    if (genre === 'indicateur' && zone === 'indicateurs' && indicateur(id)) ajouterIndicateur(id, avant)
    if (genre === 'axe' && zone === 'lignes' && axe(id)) changer({ lignes: id as AxeId })
    if (genre === 'axe' && zone === 'filtres' && axe(id) && id !== 'reseau') setFiltreOuvert(id as AxeId)
  }
  const survoler = (zone: string) => ({
    onDragOver: (e: DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (survol !== zone) setSurvol(zone) },
    onDragLeave: () => setSurvol((s) => (s === zone ? null : s)),
  })
  const glisser = (valeur: string) => ({ draggable: true, onDragStart: (e: DragEvent) => { e.dataTransfer.setData(TYPE_GLISSE, valeur); e.dataTransfer.setData('text/plain', valeur); e.dataTransfer.effectAllowed = 'copy' } })
  const [menuInd, setMenuInd] = useState<HTMLElement | null>(null)
  const [menuFiltre, setMenuFiltre] = useState<HTMLElement | null>(null)
  const [filtreOuvert, setFiltreOuvert] = useState<AxeId | null>(null)
  const filtres = Object.entries(def.filtres).filter(([, l]) => l?.length) as [AxeId, string[]][]
  const moisPossibles = useMemo(() => Array.from({ length: 24 }, (_, i) => decalerMois(dernierMoisClos(ctx.jour), -i)), [ctx.jour])
  const zone = (cle: string, titre: string, contenu: ReactNode, onDrop: (e: DragEvent) => void, action?: ReactNode) => (
    <Box role="group" aria-label={titre} onDrop={onDrop} {...survoler(cle)}
      sx={{ border: '2px dashed', borderColor: survol === cle ? 'primary.main' : 'divider', bgcolor: survol === cle ? 'action.hover' : 'background.paper', borderRadius: 2, p: 1.25, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'text.secondary', flex: 1 }}>{titre}</Typography>
        {action}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>{contenu}</Box>
    </Box>
  )
  return (
    <Card variant="outlined" className="pas-a-l-impression" sx={{ mb: 2, overflow: 'hidden' }}>
      <Button fullWidth onClick={() => setOuvert((o) => !o)} startIcon={<TuneOutlined />} endIcon={ouvert ? <ExpandLessOutlined /> : <ExpandMoreOutlined />} aria-expanded={ouvert}
        sx={{ justifyContent: 'flex-start', '& .MuiButton-endIcon': { ml: 'auto' }, px: 2, minHeight: 48, color: 'text.primary', fontWeight: 600 }}>
        Modifier le rapport
      </Button>
      {ouvert && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '260px minmax(0, 1fr)' }, borderTop: 1, borderColor: 'divider' }}>
          {surPC && <Champs inds={inds} axes={axes} def={def} glisser={glisser} ajouter={ajouterIndicateur} choisirLignes={(id) => changer({ lignes: id })} />}
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
              {zone('lignes', 'Lignes', (
                <TextField select size="small" value={def.lignes} onChange={(e) => changer({ lignes: e.target.value as AxeId })} aria-label="Regrouper les lignes par" sx={{ minWidth: 220, '& .MuiInputBase-root': { minHeight: 48 }, '& .MuiSelect-nativeInput': { height: '100%' } }}>
                  {axes.map((a) => <MenuItem key={a.id} value={a.id} sx={{ minHeight: 48 }}>{a.libelle}</MenuItem>)}
                </TextField>
              ), deposer('lignes'))}
              {zone('colonnes', 'Colonnes', (
                <ToggleButtonGroup exclusive size="small" value={def.colonnes} onChange={(_e, v) => v && changer({ colonnes: v })} aria-label="Colonnes du tableau">
                  {DECOUPAGES.map((d) => <ToggleButton key={d.cle} value={d.cle} sx={{ minHeight: 48, px: 1.5 }}>{d.libelle}</ToggleButton>)}
                </ToggleButtonGroup>
              ), (e) => e.preventDefault())}
            </Box>
            {zone('indicateurs', `Indicateurs (${def.indicateurs.length})`, (
              <>
                {def.indicateurs.map((id) => { const i = indicateur(id); return i ? (
                  <Chip key={id} label={i.libelle} onDelete={() => retirerIndicateur(id)} {...glisser(`indicateur:${id}`)} onDrop={deposer('indicateurs', id)}
                    icon={surPC ? <DragIndicatorOutlined /> : undefined} color="primary" variant="outlined" sx={{ height: 48, cursor: surPC ? 'grab' : 'default', fontSize: 14 }} />
                ) : null })}
              </>
            ), deposer('indicateurs'), (
              <Button size="small" startIcon={<AddOutlined />} onClick={(e) => setMenuInd(e.currentTarget)} sx={{ minHeight: 48 }} disabled={def.indicateurs.length >= 12}>Ajouter</Button>
            ))}
            {zone('filtres', 'Filtres', (
              <>
                {filtres.map(([a, l]) => (
                  <Chip key={a} label={`${axe(a)?.libelle} : ${l.length > 2 ? `${l.slice(0, 2).join(', ')} +${l.length - 2}` : l.join(', ')}`} onClick={() => setFiltreOuvert(a)}
                    onDelete={() => { const f = { ...def.filtres }; delete f[a]; changer({ filtres: f }) }} sx={{ height: 48, fontSize: 14 }} />
                ))}
                {!filtres.length && <Typography variant="body2" color="text.secondary">Tous les magasins</Typography>}
              </>
            ), deposer('filtres'), (
              <Button size="small" startIcon={<AddOutlined />} onClick={(e) => setMenuFiltre(e.currentTarget)} sx={{ minHeight: 48 }}>Filtrer</Button>
            ))}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField select size="small" label="Période" value={def.periode.type} onChange={(e) => changer({ periode: { ...def.periode, type: e.target.value as Definition['periode']['type'] } })} sx={{ minWidth: 190, '& .MuiInputBase-root': { minHeight: 48 }, '& .MuiSelect-nativeInput': { height: '100%' } }}>
                {TYPES_PERIODE.map((t) => <MenuItem key={t.cle} value={t.cle} sx={{ minHeight: 48 }}>{t.libelle}</MenuItem>)}
              </TextField>
              <TextField select size="small" label={def.periode.type === 'mois' ? 'Mois' : 'Jusqu’au mois de'} value={def.periode.mois ?? ''} onChange={(e) => changer({ periode: { ...def.periode, mois: e.target.value || undefined } })} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }} sx={{ minWidth: 220, '& .MuiInputBase-root': { minHeight: 48 }, '& .MuiSelect-nativeInput': { height: '100%' } }}>
                <MenuItem value="" sx={{ minHeight: 48 }}>Dernier mois clos</MenuItem>
                {moisPossibles.map((m) => <MenuItem key={m} value={m} sx={{ minHeight: 48 }}>{libelleMoisLong(m)}</MenuItem>)}
              </TextField>
            </Box>
          </Box>
        </Box>
      )}
      <Menu anchorEl={menuInd} open={!!menuInd} onClose={() => setMenuInd(null)} slotProps={{ paper: { sx: { maxHeight: 420 } } }}>
        {THEMES.filter((t) => ctx.equipe || !t.equipeSeule).flatMap((t) => [
          <ListSubheader key={t.cle}>{t.libelle}</ListSubheader>,
          ...inds.filter((i) => i.theme === t.cle).map((i) => (
            <MenuItem key={i.id} disabled={def.indicateurs.includes(i.id)} onClick={() => { ajouterIndicateur(i.id); setMenuInd(null) }} sx={{ minHeight: 48 }}>{i.libelle}</MenuItem>
          )),
        ])}
      </Menu>
      <Menu anchorEl={menuFiltre} open={!!menuFiltre} onClose={() => setMenuFiltre(null)}>
        {axes.filter((a) => a.id !== 'reseau').map((a) => <MenuItem key={a.id} onClick={() => { setFiltreOuvert(a.id); setMenuFiltre(null) }} sx={{ minHeight: 48 }}>{a.libelle}</MenuItem>)}
      </Menu>
      {filtreOuvert && (
        <DialogueFiltre axe={filtreOuvert} valeurs={valeursAxe(ctx, filtreOuvert)} choisies={def.filtres[filtreOuvert] ?? []}
          fermer={() => setFiltreOuvert(null)} valider={(l) => { const f = { ...def.filtres }; if (l.length) f[filtreOuvert] = l; else delete f[filtreOuvert]; changer({ filtres: f }); setFiltreOuvert(null) }} />
      )}
    </Card>
  )
}

// Champs à glisser (PC) : indicateurs par thème, puis axes
function Champs({ inds, axes, def, glisser, ajouter, choisirLignes }: {
  inds: Indicateur[]; axes: ReturnType<typeof axesVisibles>; def: Definition; glisser: (v: string) => object; ajouter: (id: string) => void; choisirLignes: (id: AxeId) => void
}) {
  const [theme, setTheme] = useState<Theme | 'axes'>('ventes')
  const themes = THEMES.filter((t) => inds.some((i) => i.theme === t.cle))
  const champ = (cle: string, libelle: string, actif: boolean, onClick: () => void, valeur: string) => (
    <Box key={cle} component="button" type="button" onClick={onClick} {...glisser(valeur)}
      sx={{ display: 'flex', alignItems: 'center', gap: 0.75, width: '100%', minHeight: 48, px: 1, border: 1, borderColor: actif ? 'primary.main' : 'divider', borderRadius: 1,
        bgcolor: actif ? 'action.selected' : 'background.paper', color: 'text.primary', font: 'inherit', fontSize: 14, textAlign: 'left', cursor: 'grab' }}>
      <DragIndicatorOutlined fontSize="small" sx={{ color: 'text.secondary' }} />{libelle}
    </Box>
  )
  return (
    <Box component="aside" aria-label="Champs du rapport" sx={{ borderRight: 1, borderColor: 'divider', p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75, maxHeight: 520, overflowY: 'auto', bgcolor: 'background.default' }}>
      {themes.map((t) => (
        <Box key={t.cle}>
          <Button fullWidth onClick={() => setTheme(theme === t.cle ? 'axes' : t.cle)} aria-expanded={theme === t.cle} endIcon={theme === t.cle ? <ExpandLessOutlined /> : <ExpandMoreOutlined />}
            sx={{ justifyContent: 'space-between', minHeight: 48, color: 'text.primary', fontWeight: 600 }}>
            {t.libelle}
          </Button>
          {theme === t.cle && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 0.5 }}>
              {inds.filter((i) => i.theme === t.cle).map((i) => champ(i.id, i.libelle, def.indicateurs.includes(i.id), () => ajouter(i.id), `indicateur:${i.id}`))}
            </Box>
          )}
        </Box>
      ))}
      <Divider sx={{ my: 0.5 }} />
      <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', px: 1 }}>Axes et typologies</Typography>
      {axes.map((a) => champ(`axe-${a.id}`, a.libelle, def.lignes === a.id, () => choisirLignes(a.id), `axe:${a.id}`))}
    </Box>
  )
}

function DialogueFiltre({ axe: a, valeurs, choisies, fermer, valider }: { axe: AxeId; valeurs: string[]; choisies: string[]; fermer: () => void; valider: (l: string[]) => void }) {
  const [l, setL] = useState(choisies)
  const [q, setQ] = useState('')
  const vues = valeurs.filter((v) => v.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <Dialog open onClose={fermer} maxWidth="xs" fullWidth>
      <DialogTitle>{axe(a)?.libelle}</DialogTitle>
      <DialogContent>
        {valeurs.length > 8 && <TextField size="small" fullWidth label="Chercher" value={q} onChange={(e) => setQ(e.target.value)} sx={{ mb: 1, mt: 0.5 }} />}
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {vues.map((v) => (
            <FormControlLabel key={v} label={v} sx={{ minHeight: 48 }}
              control={<Checkbox checked={l.includes(v)} onChange={(e) => setL((x) => (e.target.checked ? [...x, v] : x.filter((y) => y !== v)))} />} />
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setL([])} sx={{ minHeight: 48 }}>Tout retirer</Button>
        <Button onClick={fermer} sx={{ minHeight: 48 }}>Annuler</Button>
        <Button variant="contained" onClick={() => valider(l)} sx={{ minHeight: 48 }}>Appliquer</Button>
      </DialogActions>
    </Dialog>
  )
}

function DialogueEnregistrer({ titre: initial, existant, equipe, directeur, fermer, enregistrer }: {
  titre: string; existant: RapportEnregistre | null; equipe: boolean; directeur: boolean; fermer: () => void
  enregistrer: (r: { id: number | null; titre: string; modele: boolean; partage: boolean; publics: Public[] }) => Promise<void>
}) {
  const [publics, setPublics] = useState<Public[]>(existant?.modele ? existant.publics : ['rr', 'coach', 'franchise'])
  const [titre, setTitre] = useState(initial)
  const [modele, setModele] = useState(existant?.modele ?? false)
  const [partage, setPartage] = useState(existant?.partage ?? false)
  const [copie, setCopie] = useState(!existant)
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const valider = async () => {
    if (!titre.trim()) { setErreur('Donne un titre au rapport.'); return }
    if (directeur && modele && !publics.length) { setErreur('Choisis au moins un public.'); return }
    setEnvoi(true); setErreur('')
    try { await enregistrer({ id: existant && !copie ? existant.id : null, titre, modele: directeur && modele, partage: equipe && !modele && partage, publics: directeur && modele ? publics : ['rr', 'coach', 'franchise'] }) } catch { setErreur('Le rapport n’a pas pu être enregistré. Réessaie dans un instant.'); setEnvoi(false) }
  }
  return (
    <Dialog open onClose={fermer} maxWidth="xs" fullWidth>
      <DialogTitle>Enregistrer le rapport</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <TextField autoFocus label="Titre" value={titre} onChange={(e) => setTitre(e.target.value.slice(0, 120))} error={!!erreur && !titre.trim()} sx={{ mt: 1 }} />
        {existant && <FormControlLabel sx={{ minHeight: 48 }} control={<Checkbox checked={copie} onChange={(e) => setCopie(e.target.checked)} />} label="Enregistrer comme un nouveau rapport" />}
        {equipe && !modele && <FormControlLabel sx={{ minHeight: 48 }} control={<Checkbox checked={partage} onChange={(e) => setPartage(e.target.checked)} />} label="Partager avec l’équipe" />}
        {directeur && <FormControlLabel sx={{ minHeight: 48 }} control={<Checkbox checked={modele} onChange={(e) => setModele(e.target.checked)} />} label="Proposer comme rapport du siège" />}
        {directeur && modele && (
          <Box role="group" aria-label="Proposer à" sx={{ pl: 4, display: 'flex', flexDirection: 'column' }}>
            {PUBLICS.map((p) => (
              <FormControlLabel key={p.cle} sx={{ minHeight: 48 }} label={p.libelle}
                control={<Checkbox checked={publics.includes(p.cle)} onChange={(e) => setPublics((l) => (e.target.checked ? PUBLICS.map((x) => x.cle).filter((c) => c === p.cle || l.includes(c)) : l.filter((c) => c !== p.cle)))} />} />
            ))}
          </Box>
        )}
        {erreur && <Typography variant="body2" color="error">{erreur}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={fermer} sx={{ minHeight: 48 }}>Annuler</Button>
        <Button variant="contained" onClick={() => void valider()} disabled={envoi} sx={{ minHeight: 48 }}>Enregistrer</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Choix rapides (379, 380, 381) : période et magasins en pastilles, comparaison en un bouton ──
const periodesRapides = (jour: string): { libelle: string; p: Periode }[] => [
  { libelle: 'Mois dernier', p: { type: 'mois' } },
  { libelle: 'Depuis janvier', p: { type: 'cumul' } },
  { libelle: '12 mois glissants', p: { type: 'douze' } },
  { libelle: 'Quadrimestre', p: { type: 'quadrimestre' } },
  { libelle: 'Année dernière', p: { type: 'annee', mois: `${Number(dernierMoisClos(jour).slice(0, 4)) - 1}-12` } },
]
const AXES_RAPIDES: AxeId[] = ['rr', 'coach', 'groupe', 'typologie', 'anciennete', 'contrat']
const stylePastille = (actif: boolean) => ({ height: { xs: 48, md: 36 }, fontSize: 14, fontWeight: actif ? 700 : 400, flexShrink: 0 })

function BarreRapide({ def, changer, ctx, surPC }: { def: Definition; changer: (d: Partial<Definition>) => void; ctx: Contexte; surPC: boolean }) {
  const [menu, setMenu] = useState<{ ancre: HTMLElement; axe: AxeId } | null>(null)
  const axes = useMemo(() => {
    const visibles = axesVisibles(ctx.equipe).map((a) => a.id)
    return AXES_RAPIDES.filter((a) => visibles.includes(a)).map((a) => ({ id: a, valeurs: valeursAxe(ctx, a) })).filter((a) => a.valeurs.length > 1)
  }, [ctx])
  const filtres = Object.entries(def.filtres).filter(([, l]) => l?.length) as [AxeId, string[]][]
  const memePeriode = (p: Periode) => p.type === def.periode.type && (p.mois ?? '') === (def.periode.mois ?? '')
  const rangee = { display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: surPC ? 'wrap' : 'nowrap', overflowX: surPC ? 'visible' : 'auto', pb: surPC ? 0 : 0.5, minWidth: 0 } as const
  const titre = { fontSize: '0.8125rem', fontWeight: 700, color: 'text.secondary', minWidth: surPC ? 64 : 'auto', flexShrink: 0 } as const
  const indicateurs = def.indicateurs.map(indicateur).filter((i): i is Indicateur => !!i)
  return (
    <Box className="pas-a-l-impression" sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
      <Box role="group" aria-label="Choisir les dates" sx={rangee}>
        <Typography sx={titre}>Période</Typography>
        {periodesRapides(ctx.jour).map((x) => { const actif = memePeriode(x.p); return (
          <Chip key={x.libelle} label={x.libelle} clickable color={actif ? 'secondary' : 'default'} variant={actif ? 'filled' : 'outlined'} aria-pressed={actif}
            onClick={() => changer({ periode: x.p })} sx={stylePastille(actif)} />
        ) })}
      </Box>
      {axes.length > 0 && (
        <Box role="group" aria-label="Choisir les magasins" sx={rangee}>
          <Typography sx={titre}>Magasins</Typography>
          <Chip label="Tous les magasins" clickable color={!filtres.length ? 'secondary' : 'default'} variant={!filtres.length ? 'filled' : 'outlined'} aria-pressed={!filtres.length}
            onClick={() => changer({ filtres: {} })} sx={stylePastille(!filtres.length)} />
          {axes.map((a) => {
            const l = def.filtres[a.id] ?? []
            const libelle = axe(a.id)?.libelle ?? a.id
            return (
              <Chip key={a.id} clickable color={l.length ? 'secondary' : 'default'} variant={l.length ? 'filled' : 'outlined'} aria-haspopup="menu"
                label={l.length ? `${libelle} : ${l.length > 1 ? `${l[0]} +${l.length - 1}` : l[0]}` : libelle}
                onDelete={l.length ? () => { const f = { ...def.filtres }; delete f[a.id]; changer({ filtres: f }) } : undefined}
                onClick={(e) => setMenu({ ancre: e.currentTarget, axe: a.id })} sx={stylePastille(l.length > 0)} />
            )
          })}
        </Box>
      )}
      <Box sx={{ ...rangee, flexWrap: 'wrap' }}>
        <Typography sx={titre}>Comparer à</Typography>
        <ToggleButtonGroup exclusive size="small" value={def.comparer ?? 'aucune'} aria-label="Comparer à"
          onChange={(_e, v: Comparaison | null) => v && changer({ comparer: v === 'aucune' ? undefined : v })}>
          {COMPARAISONS.map((c) => (
            <ToggleButton key={c.cle} value={c.cle} disabled={c.cle === 'budget' && !indicateurs.some((i) => comparable(i, 'budget'))}
              title={c.cle === 'budget' && !indicateurs.some((i) => comparable(i, 'budget')) ? 'Le budget se compare au CA HT : ajoute cet indicateur' : undefined}
              sx={{ minHeight: { xs: 48, md: 36 }, px: 1.5, textTransform: 'none' }}>{c.libelle}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <Menu anchorEl={menu?.ancre} open={!!menu} onClose={() => setMenu(null)} slotProps={{ paper: { sx: { maxHeight: 420 } } }}>
        {menu && [
          <MenuItem key="" selected={!(def.filtres[menu.axe]?.length)} sx={{ minHeight: 48 }}
            onClick={() => { const f = { ...def.filtres }; delete f[menu.axe]; changer({ filtres: f }); setMenu(null) }}>Tous</MenuItem>,
          ...(axes.find((a) => a.id === menu.axe)?.valeurs ?? []).map((v) => (
            <MenuItem key={v} selected={def.filtres[menu.axe]?.length === 1 && def.filtres[menu.axe]![0] === v} sx={{ minHeight: 48 }}
              onClick={() => { changer({ filtres: { ...def.filtres, [menu.axe]: [v] } }); setMenu(null) }}>{v}</MenuItem>
          )),
        ]}
      </Menu>
    </Box>
  )
}

// ── 378 : une carte par indicateur chiffré, total de la sélection, écart à la référence, courbe sur 12 mois ──
function CartesChiffres({ resultat, def, ctx }: { resultat: Resultat; def: Definition; ctx: Contexte }) {
  const comp: Comparaison = def.comparer ?? 'n1'
  // Téléphone : deux cartes par ligne, la courbe prendrait la place du chiffre
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const cartes = useMemo(() => {
    const inds = resultat.indicateurs.filter((i) => i.agregat !== 'texte')
    if (!inds.length || !resultat.magasins) return []
    // Total de toute la période (même avec des colonnes par mois) et sa référence
    const d: Definition = { ...def, lignes: 'reseau', colonnes: 'aucun', comparer: comp, tri: null }
    const r = calculer(ctx, d)
    const magasins = magasinsRetenus(ctx, d)
    return inds.map((i) => {
      const k = `${i.id}|${r.colonnes[0].cle}`
      const c = r.total.cellules[k]
      const e = ecartReference(i, c, r.total.refs?.[k])
      return { i, c, ref: r.total.refs?.[k], e, serie: tendance(ctx, d, i, magasins) }
    })
  }, [resultat, def, ctx, comp])
  if (!cartes.length) return null
  const court = COMPARAISONS.find((x) => x.cle === comp)!.court
  return (
    <Box role="list" aria-label="Chiffres clés du rapport" sx={{ ...grilleIndicateurs, mb: 2 }}>
      {cartes.map(({ i, c, ref, e, serie }) => (
        <Box role="listitem" key={i.id} sx={{ minWidth: 0, display: 'grid' }}>
          <CarteIndicateur libelle={i.libelle} valeur={formater(i.format, c)}
            couleur={tonCellule(i, c) === 'bon' ? brand.vertFonce : tonCellule(i, c) === 'mauvais' ? brand.brique : undefined}
            evolution={e === null ? null : { texte: formaterEcart(i, e), sens: sensDe(e, 0.0005), bon: ecartFavorable(i, e), reference: `vs ${court} : ${formater(i.format, ref!)}` }}
            fin={surPC && serie.filter((x) => x !== null).length > 1 ? <MiniCourbe valeurs={serie} couleur={brand.vertFonce} largeur={80} hauteur={32} label={`${i.libelle} sur 12 mois`} /> : undefined} />
        </Box>
      ))}
    </Box>
  )
}

// ── 384 : envoyer le lien du rapport aux RR ou aux Coachs, par la messagerie de l'app ──
const estRR = (c: Contact) => c.cle.startsWith('rr:')
const estCoach = (c: Contact) => c.cle.startsWith('coach:')
function DialogueEnvoyer({ reseau, titre, periode, lien, fermer, envoye }: { reseau: Reseau; titre: string; periode: string; lien: string; fermer: () => void; envoye: (n: number) => void }) {
  const { profil } = useAuth()
  const { messagerie, envoyer } = useMessagerie()
  const personnes = useMemo(() => contacts(reseau, profil, messagerie).filter((c) => estRR(c) || estCoach(c)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')), [reseau, profil, messagerie])
  const [choisis, setChoisis] = useState<string[]>([])
  const [texte, setTexte] = useState(`Je te partage le rapport « ${titre} » (${periode.charAt(0).toLowerCase()}${periode.slice(1)}) : ${lien}`)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')
  const groupes = [{ titre: 'Responsables Régionaux', l: personnes.filter(estRR) }, { titre: 'Coachs', l: personnes.filter(estCoach) }].filter((g) => g.l.length)
  const valider = async () => {
    if (!choisis.length) { setErreur('Choisis au moins une personne.'); return }
    setEnvoi(true); setErreur('')
    let n = 0
    for (const cle of choisis) {
      const c = personnes.find((x) => x.cle === cle)
      try { await envoyer(cle, texte, [], c?.magasins[0]?.nom ?? null); n++ } catch { /* compté plus bas */ }
    }
    if (n === choisis.length) envoye(n)
    else { setEnvoi(false); setErreur(n ? `Envoyé à ${n} personne${n > 1 ? 's' : ''} sur ${choisis.length}. Réessaie pour les autres dans un instant.` : 'Le message n’a pas pu partir. Réessaie dans un instant.') }
  }
  return (
    <Dialog open onClose={fermer} maxWidth="xs" fullWidth>
      <DialogTitle>Envoyer le rapport</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {!groupes.length && <Typography variant="body2" color="text.secondary">Aucun Responsable Régional ni Coach sur tes magasins pour l’instant. Copie le lien avec « Partager le lien ».</Typography>}
        {groupes.map((g) => {
          const tous = g.l.every((c) => choisis.includes(c.cle))
          return (
            <Box key={g.titre} role="group" aria-label={g.titre} sx={{ display: 'flex', flexDirection: 'column' }}>
              <FormControlLabel sx={{ minHeight: 48 }} label={<Typography sx={{ fontWeight: 700 }}>{`Tous les ${g.titre === 'Coachs' ? 'Coachs' : 'Responsables Régionaux'} (${g.l.length})`}</Typography>}
                control={<Checkbox checked={tous} indeterminate={!tous && g.l.some((c) => choisis.includes(c.cle))} onChange={(e) => setChoisis((x) => (e.target.checked ? [...new Set([...x, ...g.l.map((c) => c.cle)])] : x.filter((k) => !g.l.some((c) => c.cle === k))))} />} />
              {g.l.map((c) => (
                <FormControlLabel key={c.cle} sx={{ minHeight: 48, pl: 3 }} label={c.nom}
                  control={<Checkbox checked={choisis.includes(c.cle)} onChange={(e) => setChoisis((x) => (e.target.checked ? [...x, c.cle] : x.filter((k) => k !== c.cle)))} />} />
              ))}
            </Box>
          )
        })}
        {groupes.length > 0 && <TextField label="Message" multiline minRows={3} value={texte} onChange={(e) => setTexte(e.target.value.slice(0, 2000))} sx={{ mt: 1 }} />}
        {erreur && <Typography variant="body2" color="error">{erreur}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={fermer} sx={{ minHeight: 48 }}>Annuler</Button>
        {groupes.length > 0 && <Button variant="contained" startIcon={<SendOutlined />} onClick={() => void valider()} disabled={envoi || !texte.trim()} sx={{ minHeight: 48 }}>Envoyer{choisis.length ? ` (${choisis.length})` : ''}</Button>}
      </DialogActions>
    </Dialog>
  )
}

// ── Résultat : graphes et tableau ───────────────────────────────────────
function Affichage({ resultat, def, changer, surPC }: { resultat: Resultat; def: Definition; changer: (d: Partial<Definition>) => void; surPC: boolean }) {
  if (!resultat.indicateurs.length) return <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Ajoute un indicateur pour voir le rapport.</Typography>
  if (!resultat.magasins) return <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Aucun magasin ne correspond à ces filtres. Retire un filtre pour élargir la sélection.</Typography>
  return (
    <>
      <Box className="pas-a-l-impression" sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        <ToggleButtonGroup exclusive size="small" value={def.affichage} onChange={(_e, v) => v && changer({ affichage: v })} aria-label="Affichage du rapport">
          <ToggleButton value="tableau" sx={{ minHeight: 48, px: 2 }}>Tableau</ToggleButton>
          <ToggleButton value="graphes" sx={{ minHeight: 48, px: 2 }}>Graphes</ToggleButton>
          <ToggleButton value="deux" sx={{ minHeight: 48, px: 2 }}>Les deux</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      {def.affichage !== 'tableau' && <Graphes resultat={resultat} def={def} changer={changer} />}
      {def.affichage !== 'graphes' && <TableauRapport resultat={resultat} def={def} changer={changer} surPC={surPC} />}
    </>
  )
}

const COULEURS = { bon: brand.vertFonce, mauvais: brand.brique, neutre: brand.anthracite }
const couleur = (i: Indicateur, c: Cellule) => { const t = tonCellule(i, c); return t ? COULEURS[t] : COULEURS.neutre }
// Parts du camembert : couleurs bien distinctes, la dernière (gris) pour « Autres »
const PARTS = ['#2f4f7a', '#a3162f', '#1d6b3a', '#b26a00', '#5b3f8c', '#1f7a7a', '#8c4a2f', '#6b6b6b']

// ref : chiffre de comparaison (381), dessiné en pointillés
interface Point { libelle: string; valeur: number | null; affiche: string; couleur: string; ref?: number | null; refAffiche?: string }
type Dessin = Exclude<TypeGraphe, 'auto'>
const ICONES_GRAPHE: Record<Dessin, ReactNode> = {
  barres: <AlignHorizontalLeftOutlined fontSize="small" />, colonnes: <BarChartOutlined fontSize="small" />, courbe: <ShowChartOutlined fontSize="small" />,
  camembert: <PieChartOutlineOutlined fontSize="small" />, topflop: <LeaderboardOutlined fontSize="small" />,
}
const libelleGraphe = (t: Dessin) => TYPES_GRAPHE.find((g) => g.cle === t)!.libelle

function Graphes({ resultat, def, changer }: { resultat: Resultat; def: Definition; changer: (d: Partial<Definition>) => void }) {
  const temps = def.colonnes !== 'aucun'
  const court = COMPARAISONS.find((x) => x.cle === def.comparer)?.court
  // 382 : type choisi pour cet indicateur, sinon celui du rapport, sinon automatique
  const choisir = (id: string) => (t: Dessin) => changer({ graphes: { ...def.graphes, [id]: t } })
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5, mb: 2 }}>
      {resultat.indicateurs.map((i) => {
        const voulu = def.graphes?.[i.id] ?? def.graphe ?? 'auto'
        if (i.agregat === 'texte') {
          const type: Dessin = voulu === 'auto' || voulu === 'topflop' || voulu === 'courbe' ? 'barres' : voulu
          return <Repartition key={i.id} i={i} resultat={resultat} type={type} choisir={choisir(i.id)} />
        }
        const ref = (c: Cellule | undefined) => (c && c.valeur !== null ? { ref: c.valeur, refAffiche: formater(i.format, c) } : {})
        if (temps && i.temporel) {
          // Évolution dans le temps : total de la sélection, colonne par colonne
          const points = resultat.colonnes.map((col) => { const k = `${i.id}|${col.cle}`; const c = resultat.total.cellules[k]; return { libelle: col.libelle, valeur: c.valeur, affiche: formater(i.format, c), couleur: couleur(i, c), ...ref(resultat.total.refs?.[k]) } })
          const type: Dessin = voulu === 'auto' || voulu === 'topflop' ? 'colonnes' : voulu
          return <DessinGraphe key={i.id} titre={i.libelle} points={points} type={type} vide="Pas encore de chiffres sur cette période." choix={['colonnes', 'courbe', 'barres']} choisir={choisir(i.id)} reference={court} />
        }
        const col = i.temporel ? resultat.colonnes.at(-1)!.cle : resultat.colonnes[0].cle
        const k = `${i.id}|${col}`
        const avec = resultat.lignes.filter((l) => l.cellules[k]?.valeur !== null)
        const points = avec.map((l) => { const c = l.cellules[k]; return { libelle: l.libelle, valeur: c.valeur, affiche: formater(i.format, c), couleur: couleur(i, c), ...ref(l.refs?.[k]) } })
        const topflop = avec.length >= 6
        const type: Dessin = voulu === 'auto' || (voulu === 'topflop' && !topflop) ? 'barres' : voulu
        // Le camembert regroupe le reste dans « Autres » ; le Top / Flop prend tout ; les autres graphes montrent les 15 premiers
        const montres = type === 'camembert' || type === 'topflop' ? points : points.slice(0, 15)
        return (
          <DessinGraphe key={i.id} titre={i.libelle} points={montres} type={type} vide="Pas encore de chiffres sur cette période." inverse={i.inverse}
            note={type !== 'camembert' && type !== 'topflop' && avec.length > 15 ? `Les 15 premiers sur ${avec.length} ; le tableau les montre tous.` : undefined}
            formatAutres={(v) => formater(i.format, { valeur: v, texte: null })} reference={court}
            choix={['barres', 'colonnes', 'courbe', 'camembert', ...(topflop ? ['topflop' as const] : [])]} choisir={choisir(i.id)} />
        )
      })}
    </Box>
  )
}

// Indicateur en texte (case de la nine box, statut du budget) : nombre de magasins par valeur
function Repartition({ i, resultat, type, choisir }: { i: Indicateur; resultat: Resultat; type: Dessin; choisir: (t: Dessin) => void }) {
  const comptes = new Map<string, number>()
  for (const l of resultat.lignes) {
    // Une ligne de plusieurs magasins compte pour sa valeur la plus fréquente
    const t = l.cellules[`${i.id}|${resultat.colonnes[0].cle}`]?.texte?.replace(/ \(\d+ sur \d+\)$/, '')
    if (t) comptes.set(t, (comptes.get(t) ?? 0) + 1)
  }
  const points = [...comptes].sort((a, b) => b[1] - a[1]).map(([t, n]) => ({ libelle: t, valeur: n, affiche: String(n), couleur: COULEURS.neutre }))
  return <DessinGraphe titre={i.libelle} points={points} type={type} vide="Pas encore de données." formatAutres={String} choix={['barres', 'colonnes', 'camembert']} choisir={choisir} />
}

const styleCarte = { p: 2, display: 'flex', flexDirection: 'column', borderRadius: '14px' } as const

function DessinGraphe({ titre, points, type, vide, note, formatAutres, choix, choisir, reference, inverse }: {
  titre: string; points: Point[]; type: Dessin; vide: string; note?: string; formatAutres?: (v: number) => string
  choix: Dessin[]; choisir: (t: Dessin) => void; reference?: string; inverse?: boolean
}) {
  const avec = points.filter((p) => p.valeur !== null)
  const negatif = avec.some((p) => (p.valeur ?? 0) < 0)
  // Un camembert n'a pas de sens avec des valeurs négatives : barres à la place, en le disant
  const effectif = type === 'camembert' && negatif ? 'barres' : type
  const avecRef = effectif !== 'camembert' && effectif !== 'topflop' && points.some((p) => p.ref != null)
  return (
    <Card variant="outlined" sx={styleCarte} aria-label={`Graphe ${titre}`}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1, minWidth: 140 }}>{titre}</Typography>
        {choix.length > 1 && (
          <ToggleButtonGroup className="pas-a-l-impression" exclusive size="small" value={type} aria-label={`Dessin de ${titre}`} onChange={(_e, v: Dessin | null) => v && choisir(v)}>
            {choix.map((t) => (
              <ToggleButton key={t} value={t} aria-label={libelleGraphe(t)} title={libelleGraphe(t)} sx={{ width: { xs: 48, md: 36 }, height: { xs: 48, md: 36 }, p: 0 }}>{ICONES_GRAPHE[t]}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
      </Box>
      {!avec.length ? <Typography variant="body2" color="text.secondary">{vide}</Typography>
        : effectif === 'barres' ? <Barres points={points} />
        : effectif === 'colonnes' ? <Batons points={points} />
        : effectif === 'courbe' ? <Courbe points={points} />
        : effectif === 'topflop' ? <TopFlop points={avec} inverse={!!inverse} />
        : <Camembert points={avec} formatAutres={formatAutres ?? String} />}
      {type === 'camembert' && negatif && <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>Des valeurs sont négatives : le camembert ne peut pas les montrer, les barres prennent le relais.</Typography>}
      {avecRef && reference && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box component="span" aria-hidden sx={{ width: 18, borderTop: '2px dashed', borderColor: 'text.secondary' }} />Pointillés : {reference}
        </Typography>
      )}
      {note && <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75 }}>{note}</Typography>}
    </Card>
  )
}

function Barres({ points }: { points: Point[] }) {
  const max = Math.max(...points.flatMap((p) => [Math.abs(p.valeur ?? 0), Math.abs(p.ref ?? 0)])) || 1
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }} data-graphe="barres">
      {points.map((p) => (
        <Box key={p.libelle} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 130px) minmax(0, 1fr) auto', gap: 1, alignItems: 'center' }} title={p.refAffiche ? `${p.libelle} : ${p.affiche} (référence ${p.refAffiche})` : undefined}>
          <Typography variant="body2" noWrap title={p.libelle}>{p.libelle}</Typography>
          <Box sx={{ position: 'relative', height: 10, bgcolor: 'action.hover', borderRadius: 5 }}>
            <Box sx={{ height: 10, width: `${Math.abs(p.valeur ?? 0) / max * 100}%`, bgcolor: p.couleur, borderRadius: 5 }} />
            {p.ref != null && <Box data-reference aria-hidden sx={{ position: 'absolute', top: -4, bottom: -4, left: `calc(${Math.abs(p.ref) / max * 100}% - 1px)`, borderLeft: '2px dashed', borderColor: 'text.primary' }} />}
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 600, color: p.valeur === null ? 'text.secondary' : p.couleur, textAlign: 'right', minWidth: 72 }}>{p.affiche}</Typography>
        </Box>
      ))}
    </Box>
  )
}

function Etiquettes({ points }: { points: Point[] }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
      {points.map((p, k) => <Typography key={p.libelle} variant="caption" title={p.libelle} sx={{ flex: 1, minWidth: 0, textAlign: 'center', color: 'text.secondary', visibility: points.length > 8 && k % 2 ? 'hidden' : 'visible', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.libelle}</Typography>)}
    </Box>
  )
}

function Batons({ points }: { points: Point[] }) {
  const max = Math.max(...points.flatMap((p) => [Math.abs(p.valeur ?? 0), Math.abs(p.ref ?? 0)])) || 1
  return (
    <Box data-graphe="colonnes">
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 140 }}>
        {points.map((p) => (
          <Box key={p.libelle} sx={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }} title={`${p.libelle} : ${p.affiche}${p.refAffiche ? ` (référence ${p.refAffiche})` : ''}`}>
            <Box sx={{ width: '70%', height: `${Math.max(2, Math.abs(p.valeur ?? 0) / max * 100)}%`, bgcolor: p.valeur === null ? 'divider' : p.couleur, borderRadius: '3px 3px 0 0' }} />
            {p.ref != null && <Box data-reference aria-hidden sx={{ position: 'absolute', bottom: 0, width: '84%', height: `${Math.max(2, Math.abs(p.ref) / max * 100)}%`, border: '2px dashed', borderBottom: 0, borderColor: 'text.primary', borderRadius: '3px 3px 0 0' }} />}
          </Box>
        ))}
      </Box>
      <Etiquettes points={points} />
    </Box>
  )
}

function Courbe({ points }: { points: Point[] }) {
  const L = 600, H = 160, marge = 10
  const vals = points.flatMap((p) => [p.valeur ?? 0, p.ref ?? 0])
  const haut = Math.max(0, ...vals), bas = Math.min(0, ...vals)
  const ecart = haut - bas || 1
  const x = (k: number) => (k + 0.5) / points.length * L
  const y = (v: number) => marge + (haut - v) / ecart * (H - 2 * marge)
  // Le trait s'interrompt sur une période sans chiffre
  const traits = (f: (p: Point) => number | null | undefined) => {
    const l: string[] = []
    let courant: string[] = []
    points.forEach((p, k) => { const v = f(p); if (v == null) { if (courant.length) l.push(courant.join(' ')); courant = [] } else courant.push(`${x(k)},${y(v)}`) })
    if (courant.length) l.push(courant.join(' '))
    return l
  }
  return (
    <Box data-graphe="courbe">
      <Box component="svg" viewBox={`0 0 ${L} ${H}`} sx={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={points.map((p) => `${p.libelle} ${p.affiche}`).join(', ')}>
        <line x1={0} x2={L} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity={0.2} />
        {traits((p) => p.ref).map((t) => <polyline key={`r${t}`} data-reference points={t} fill="none" stroke={COULEURS.neutre} strokeOpacity={0.7} strokeWidth={2} strokeDasharray="6 5" />)}
        {traits((p) => p.valeur).map((t) => <polyline key={t} points={t} fill="none" stroke={COULEURS.neutre} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />)}
        {points.map((p, k) => p.valeur !== null && <circle key={p.libelle} cx={x(k)} cy={y(p.valeur)} r={5} fill={p.couleur}><title>{`${p.libelle} : ${p.affiche}${p.refAffiche ? ` (référence ${p.refAffiche})` : ''}`}</title></circle>)}
      </Box>
      <Etiquettes points={points} />
    </Box>
  )
}

// 383 : les 5 meilleurs et les 5 moins bons côte à côte (« meilleur » = plus bas pour un indicateur inversé)
function TopFlop({ points, inverse }: { points: Point[]; inverse: boolean }) {
  const tries = [...points].sort((a, b) => (inverse ? -1 : 1) * ((b.valeur ?? 0) - (a.valeur ?? 0)))
  const n = Math.min(5, Math.floor(tries.length / 2))
  const top = tries.slice(0, n), flop = tries.slice(-n).reverse()
  const bloc = (titre: string, l: Point[], teinte: string) => (
    <Box role="group" aria-label={titre} sx={{ minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 700, color: teinte, mb: 0.75 }}>{titre}</Typography>
      <Barres points={l.map((p) => ({ ...p, couleur: teinte, ref: undefined }))} />
    </Box>
  )
  return (
    <Box data-graphe="topflop" sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
      {bloc(`Les ${n} meilleurs`, top, COULEURS.bon)}
      {bloc(`Les ${n} moins bons`, flop, COULEURS.mauvais)}
    </Box>
  )
}

function Camembert({ points, formatAutres }: { points: Point[]; formatAutres: (v: number) => string }) {
  // 7 parts au plus, le reste regroupé dans « Autres »
  const tries = [...points].sort((a, b) => (b.valeur ?? 0) - (a.valeur ?? 0))
  const parts = tries.length > 8 ? [...tries.slice(0, 7), { libelle: `Autres (${tries.length - 7})`, valeur: tries.slice(7).reduce((s, p) => s + (p.valeur ?? 0), 0), affiche: '', couleur: '' }] : tries
  const total = parts.reduce((s, p) => s + (p.valeur ?? 0), 0)
  const R = 80, C = 90
  let angle = -Math.PI / 2
  const arcs = parts.map((p, k) => {
    const part = total ? (p.valeur ?? 0) / total : 0
    const debut = angle
    angle += part * 2 * Math.PI
    const grand = part > 0.5 ? 1 : 0
    const d = part >= 0.9999 ? null : `M ${C} ${C} L ${C + R * Math.cos(debut)} ${C + R * Math.sin(debut)} A ${R} ${R} 0 ${grand} 1 ${C + R * Math.cos(angle)} ${C + R * Math.sin(angle)} Z`
    return { ...p, d, part, teinte: PARTS[k % PARTS.length], texte: p.affiche || formatAutres(p.valeur ?? 0) }
  })
  return (
    <Box data-graphe="camembert" sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      {!total ? <Typography variant="body2" color="text.secondary">Tout est à zéro sur cette période.</Typography> : (
        <Box component="svg" viewBox="0 0 180 180" sx={{ width: 160, height: 160, flexShrink: 0 }} role="img" aria-label={arcs.map((a) => `${a.libelle} ${Math.round(a.part * 100)} %`).join(', ')}>
          {arcs.map((a) => a.part <= 0 ? null : a.d ? <path key={a.libelle} d={a.d} fill={a.teinte} stroke="#fff" strokeWidth={1.5}><title>{`${a.libelle} : ${a.texte}`}</title></path>
            : <circle key={a.libelle} cx={C} cy={C} r={R} fill={a.teinte}><title>{`${a.libelle} : ${a.texte}`}</title></circle>)}
        </Box>
      )}
      <Box sx={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {arcs.map((a) => (
          <Box key={a.libelle} sx={{ display: 'grid', gridTemplateColumns: '12px minmax(0, 1fr) auto auto', gap: 1, alignItems: 'center' }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: a.teinte }} />
            <Typography variant="body2" noWrap title={a.libelle}>{a.libelle}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>{a.texte}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right', minWidth: 44 }}>{Math.round(a.part * 100)} %</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function TableauRapport({ resultat, def, changer, surPC }: { resultat: Resultat; def: Definition; changer: (d: Partial<Definition>) => void; surPC: boolean }) {
  const temps = def.colonnes !== 'aucun'
  // Colonnes : indicateur × période (une seule période sans découpage) ; un indicateur « à date » n'a qu'une colonne
  const cols = resultat.indicateurs.flatMap((i) => (temps && i.temporel ? resultat.colonnes : [resultat.colonnes[0]]).map((col) => ({ i, col, cle: `${i.id}|${col.cle}` })))
  const tri = def.tri
  const trier = (cle: string) => changer({ tri: { cle, sens: tri?.cle === cle && tri.sens === 'desc' ? 'asc' : 'desc' } })
  const parMagasin = def.lignes === 'magasin'
  // Téléphone : en-têtes à trier et liens assez grands pour le doigt
  const zone = surPC ? undefined : { minHeight: 48, display: 'inline-flex', alignItems: 'center' }
  // 381 : sous le chiffre, l'écart à la référence (an dernier ou budget) et la référence
  const cellule = (k: string, c: Cellule, i: Indicateur, gras = false, ref?: Cellule) => {
    const e = ecartReference(i, c, ref)
    return (
      <TableCell key={k} align="right" sx={{ whiteSpace: 'nowrap', fontWeight: gras ? 700 : 400, color: tonCellule(i, c) ? couleur(i, c) : undefined }}>
        {formater(i.format, c)}
        {e !== null && (
          <Box component="span" data-ecart sx={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: e === 0 ? 'text.secondary' : ecartFavorable(i, e) ? 'success.dark' : 'error.main' }}>
            {formaterEcart(i, e)} <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>vs {formater(i.format, ref!)}</Box>
          </Box>
        )}
      </TableCell>
    )
  }
  // 321 (18/11/2026) : les lignes sans aucun chiffre se rangent en bas, repliées, au lieu de rangées de tirets
  const [voirVides, setVoirVides] = useState(false)
  const vide = (l: Resultat['lignes'][number]) => cols.every(({ cle }) => { const c = l.cellules[cle]; return !c || (c.valeur === null && !c.texte) })
  const pleines = resultat.lignes.filter((l) => !vide(l))
  const vides = resultat.lignes.filter(vide)
  const affichees = pleines.length && vides.length ? [...pleines, ...(voirVides ? vides : [])] : resultat.lignes
  const basculeVides = pleines.length > 0 && vides.length > 0 && (
    <Button onClick={() => setVoirVides((v) => !v)} aria-expanded={voirVides} sx={{ minHeight: 48 }}>{voirVides ? `Masquer les ${vides.length} sans chiffres` : `Afficher les ${vides.length} sans chiffres`}</Button>
  )
  return (
    <TableContainer component={Card} variant="outlined" sx={{ maxHeight: surPC ? '70vh' : undefined }}>
      <Table size="small" stickyHeader aria-label="Tableau du rapport">
        <TableHead>
          {temps && (
            <TableRow>
              <TableCell />
              {resultat.indicateurs.map((i) => <TableCell key={i.id} align="left" colSpan={i.temporel ? resultat.colonnes.length : 1} sx={{ fontWeight: 700, borderLeft: 1, borderColor: 'divider' }}>{i.libelle}</TableCell>)}
            </TableRow>
          )}
          <TableRow>
            <TableCell sx={{ fontWeight: 700, minWidth: 140, top: temps ? 37 : 0, left: 0, zIndex: 3 }}>
              <TableSortLabel sx={zone} active={tri?.cle === 'libelle'} direction={tri?.cle === 'libelle' ? tri.sens : 'asc'} onClick={() => trier('libelle')}>{axe(def.lignes)?.libelle ?? 'Magasin'}</TableSortLabel>
            </TableCell>
            {cols.map(({ i, col, cle }) => (
              <TableCell key={cle} align="right" sx={{ fontWeight: 700, top: temps ? 37 : 0, whiteSpace: temps ? 'nowrap' : 'normal', minWidth: temps ? 80 : 110 }}>
                <TableSortLabel sx={zone} active={tri?.cle === cle} direction={tri?.cle === cle ? tri.sens : 'desc'} onClick={() => trier(cle)}>{temps ? (i.temporel ? col.libelle : 'À date') : i.libelle}</TableSortLabel>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {affichees.map((l) => (
            <TableRow key={l.cle} hover>
              <TableCell sx={{ minWidth: 140, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                {parMagasin ? <Link component={RouterLink} to={`/magasins/${encodeURIComponent(l.libelle)}`} underline="hover" sx={zone}>{l.libelle}</Link> : <>{l.libelle} <Typography component="span" variant="caption" color="text.secondary">({l.magasins.length})</Typography></>}
              </TableCell>
              {cols.map(({ i, cle }) => cellule(cle, l.cellules[cle], i, false, l.refs?.[cle]))}
            </TableRow>
          ))}
          {resultat.lignes.length > 1 && (
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 700, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>{resultat.total.libelle}</TableCell>
              {cols.map(({ i, cle }) => cellule(cle, resultat.total.cellules[cle], i, true, resultat.total.refs?.[cle]))}
            </TableRow>
          )}
          {basculeVides && <TableRow><TableCell colSpan={cols.length + 1}>{basculeVides}</TableCell></TableRow>}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

// ── Export Excel : la sélection telle qu'affichée, nombres gardés en nombres ─
function feuilleRapport(titre: string, periode: string, r: Resultat, def: Definition) {
  const temps = def.colonnes !== 'aucun'
  const cols = r.indicateurs.flatMap((i) => (temps && i.temporel ? r.colonnes : [r.colonnes[0]]).map((col) => ({ i, col, cle: `${i.id}|${col.cle}` })))
  const valeur = (i: Indicateur, c: Cellule): CelluleXlsx => {
    if (c.texte !== null) return c.texte
    if (c.valeur === null) return null
    if (i.format === 'pct' || i.format === 'ecart') return { v: c.valeur, s: 'pct' }
    if (i.format === 'euros') return { v: Math.round(c.valeur), s: 'euros' }
    if (i.format === 'euros2') return { v: c.valeur, s: 'euros2' }
    return Math.round(c.valeur * 10) / 10
  }
  // 381 : avec une comparaison, la référence et l'écart suivent chaque colonne comparable
  const comp = def.comparer && def.comparer !== 'aucune' ? def.comparer : null
  const court = COMPARAISONS.find((x) => x.cle === comp)?.court ?? ''
  const avecRef = (i: Indicateur) => !!comp && comparable(i, comp)
  const ecartXlsx = (i: Indicateur, c: Cellule, ref?: Cellule): CelluleXlsx => { const e = ecartReference(i, c, ref); return e === null ? null : i.format === 'pct' ? Math.round(e * 1000) / 10 : { v: e, s: 'pct' } }
  const cellules = (i: Indicateur, cle: string, l: Resultat['total']): CelluleXlsx[] => [valeur(i, l.cellules[cle]), ...(avecRef(i) ? [l.refs?.[cle] ? valeur(i, l.refs[cle]) : null, ecartXlsx(i, l.cellules[cle], l.refs?.[cle])] : [])]
  const nomCol = (i: Indicateur, col: Resultat['colonnes'][number]) => (temps && i.temporel ? `${i.libelle} ${col.libelle}` : i.libelle)
  const entete: CelluleXlsx[] = [{ v: axe(def.lignes)?.libelle ?? 'Magasin', s: 'entete' }, ...cols.flatMap(({ i, col }) => [
    { v: nomCol(i, col), s: 'enteteDroite' as const },
    ...(avecRef(i) ? [{ v: `${nomCol(i, col)} : ${court}`, s: 'enteteDroite' as const }, { v: `${nomCol(i, col)} : écart${i.format === 'pct' ? ' (points)' : ''}`, s: 'enteteDroite' as const }] : []),
  ])]
  return {
    nom: titre.slice(0, 31),
    lignes: [
      [{ v: titre, s: 'titre' as const }],
      [{ v: periode, s: 'discret' as const }],
      [],
      entete,
      ...r.lignes.map((l) => [l.libelle, ...cols.flatMap(({ i, cle }) => cellules(i, cle, l))]),
      [{ v: r.total.libelle, s: 'gras' as const }, ...cols.flatMap(({ i, cle }) => cellules(i, cle, r.total))],
    ],
    largeurs: [28, ...cols.flatMap(({ i }) => (avecRef(i) ? [16, 16, 16] : [16]))],
    figer: { lignes: 4, colonnes: 1 },
  }
}

