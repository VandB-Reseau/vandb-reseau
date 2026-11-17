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
import Skeleton from '@mui/material/Skeleton'
import Snackbar from '@mui/material/Snackbar'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
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
import PrintOutlined from '@mui/icons-material/PrintOutlined'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import StarBorderRounded from '@mui/icons-material/StarBorderRounded'
import StarRounded from '@mui/icons-material/StarRounded'
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { useAuth } from '../auth/AuthContext'
import { useApercu } from '../auth/Apercu'
import type { Magasin, Reseau } from '../data/modele'
import { useEngagement, type Engagement } from '../data/engagement'
import {
  DECOUPAGES, PUBLICS, THEMES, connaitreThematiques, rapportsProposes, type Public, type RapportPropose, TYPES_PERIODE, axe, axesVisibles, calculer, definitionVide, dernierMoisClos, formater,
  indicateur, indicateursVisibles, libelleMoisLong, libellePeriode, normaliserDefinition, tonCellule, valeursAxe,
  type AxeId, type Cellule, type Contexte, type Definition, type FinanceMagasin, type Indicateur, type Resultat, type Theme,
} from '../data/rapports'
import { basculerFavori, basculerMasque, useListeRapports } from '../data/rapportsListe'
import { chargerRapports, enregistrerRapport, supprimerRapport, type RapportEnregistre } from '../data/rapportsBase'
import { chargerFinancesRapports } from '../data/rapportsFinances'
import { ZonePilotage } from '../pilotage/Pilotage'
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
  const [dialogue, setDialogue] = useState<null | 'enregistrer'>(null)

  const exporter = () => {
    const titre = enregistre?.titre ?? propose?.titre ?? 'Rapport'
    telecharger(nomFichier(`Pilotage - ${titre}`), classeur([feuilleRapport(titre, libellePeriode(def.periode, reseau.jour), resultat, def)]))
  }
  const copierLien = () => {
    const base = `${window.location.origin}${window.location.pathname}#/pilotage`
    const lien = selection.genre === 'base' && !modifie ? `${base}?rapport=${selection.id}` : selection.genre === 'propose' && !modifie ? `${base}?rapport=p-${selection.id}` : `${base}?d=${encodeURIComponent(JSON.stringify(def))}&titre=${encodeURIComponent(titreDepart)}`
    void navigator.clipboard?.writeText(lien).then(() => setMessage('Lien copié : chacun l’ouvre avec ses propres droits')).catch(() => setMessage('Lien copié'))
    if (!navigator.clipboard) setMessage('Lien copié')
  }
  const supprimer = async () => {
    if (!enregistre) return
    try { await supprimerRapport(enregistre.id); await recharger(); ouvrir(''); setMessage('Rapport supprimé') } catch { setMessage('Le rapport n’a pas pu être supprimé. Réessaie dans un instant.') }
  }

  const liste = (
    <ListeRapports proposes={proposes} role={profil?.role} enregistres={enregistres} indisponibles={indisponibles} selection={selection} ouvrir={ouvrir}
      nouveau={() => setParams({ d: JSON.stringify(definitionVide()), titre: 'Nouveau rapport' })} lectureSeule={lectureSeule} surPC={surPC} />
  )

  return (
    <>
      <Box sx={{ display: 'none' }} aria-hidden><ZonePilotage>{() => <ChargeurFinances surFin={surFin} />}</ZonePilotage></Box>
      <PageHeader titre="Pilotage" />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '250px minmax(0, 1fr)' }, gap: 3, alignItems: 'start' }}>
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
              <Button variant="outlined" startIcon={<LinkOutlined />} onClick={copierLien} sx={{ minHeight: 48 }}>Partager</Button>
              <Button variant="outlined" startIcon={<FileDownloadOutlined />} onClick={exporter} sx={{ minHeight: 48 }}>Excel</Button>
              {surPC && <Button variant="outlined" startIcon={<PrintOutlined />} onClick={() => window.print()} sx={{ minHeight: 48 }}>Imprimer</Button>}
              {cleRapport && <IconButton aria-label={favori ? 'Retirer de mes favoris' : 'Ajouter à mes favoris'} aria-pressed={favori} onClick={() => basculerFavori(cleRapport)} sx={{ width: 48, height: 48, color: favori ? 'warning.main' : undefined }}>{favori ? <StarRounded /> : <StarBorderRounded />}</IconButton>}
              {cleRapport && !enregistre?.mien && <IconButton aria-label={masque ? 'Réafficher dans ma liste' : 'Masquer de ma liste'} onClick={() => { basculerMasque(cleRapport); setMessage(masque ? 'Rapport réaffiché dans ta liste' : 'Rapport masqué de ta liste') }} sx={{ width: 48, height: 48 }}>{masque ? <VisibilityOutlined /> : <VisibilityOffOutlined />}</IconButton>}
              {enregistre && (enregistre.mien || (enregistre.modele && directeur)) && !lectureSeule && (
                <IconButton aria-label="Supprimer ce rapport" onClick={() => void supprimer()} sx={{ width: 48, height: 48 }}><DeleteOutlined /></IconButton>
              )}
            </Box>
          </Box>
          <Constructeur def={def} changer={changer} ctx={ctx} surPC={surPC} nouveau={titreDepart === 'Nouveau rapport'} />
          {finances === undefined && resultat.indicateurs.some((i) => i.theme === 'budget') && <Skeleton variant="rounded" height={8} sx={{ mb: 1 }} aria-label="Chargement des budgets" />}
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

interface Entree { cle: string; titre: string; sous?: string }
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
    ...proposesRanges.map((g) => ({ titre: g.titre, entrees: [...g.rapports.map((r) => ({ cle: `p-${r.id}`, titre: r.titre })),
      ...modelesDe(g.titre).map((r) => ({ cle: String(r.id), titre: r.titre}))] })),
    { titre: 'Mes rapports', entrees: (enregistres ?? []).filter((r) => r.mien && !r.modele).map((r) => ({ cle: String(r.id), titre: r.titre, sous: r.partage ? 'Partagé à l’équipe' : undefined })) },
    { titre: 'Partagés avec moi', entrees: (enregistres ?? []).filter((r) => !r.mien && !r.modele).map((r) => ({ cle: String(r.id), titre: r.titre, sous: r.auteur })) },
  ]
  const toutes = new Map(groupes.flatMap((g) => g.entrees).map((e) => [e.cle, e] as const))
  const favoris = liste.favoris.map((c) => toutes.get(c)).filter((e): e is Entree => !!e)
  const masques = liste.masques.map((c) => toutes.get(c)).filter((e): e is Entree => !!e)
  const a_part = new Set([...liste.favoris, ...liste.masques])
  return { favoris, masques, groupes: groupes.map((g) => ({ ...g, entrees: g.entrees.filter((e) => !a_part.has(e.cle)) })) }
}

function ListeRapports({ proposes, role, enregistres, indisponibles, selection, ouvrir, nouveau, lectureSeule, surPC }: {
  proposes: RapportPropose[]; role: string | undefined; enregistres: RapportEnregistre[] | null; indisponibles: boolean; selection: Selection; ouvrir: (cle: string) => void
  nouveau: () => void; lectureSeule: boolean; surPC: boolean
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
            <ListItemButton selected={actif === r.cle} onClick={() => ouvrir(r.cle)} sx={{ borderRadius: 1, minHeight: 48, pr: 6 }} aria-current={actif === r.cle ? 'page' : undefined}>
              <ListItemText primary={r.titre} secondary={r.sous} slotProps={{ primary: { variant: 'body2' }, secondary: { variant: 'caption' } }} />
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

// ── Résultat : graphes et tableau ───────────────────────────────────────
function Affichage({ resultat, def, changer, surPC }: { resultat: Resultat; def: Definition; changer: (d: Partial<Definition>) => void; surPC: boolean }) {
  if (!resultat.indicateurs.length) return <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Ajoute un indicateur pour voir le rapport.</Typography>
  if (!resultat.magasins) return <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Aucun magasin ne correspond à ces filtres. Retire un filtre pour élargir la sélection.</Typography>
  return (
    <>
      <Box className="pas-a-l-impression" sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <ToggleButtonGroup exclusive size="small" value={def.affichage} onChange={(_e, v) => v && changer({ affichage: v })} aria-label="Affichage du rapport">
          <ToggleButton value="tableau" sx={{ minHeight: 48, px: 2 }}>Tableau</ToggleButton>
          <ToggleButton value="graphes" sx={{ minHeight: 48, px: 2 }}>Graphes</ToggleButton>
          <ToggleButton value="deux" sx={{ minHeight: 48, px: 2 }}>Les deux</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      {def.affichage !== 'tableau' && <Graphes resultat={resultat} def={def} />}
      {def.affichage !== 'graphes' && <TableauRapport resultat={resultat} def={def} changer={changer} surPC={surPC} />}
    </>
  )
}

const COULEURS = { bon: '#1d6b3a', mauvais: '#a3162f', neutre: '#2f4f7a' }
const couleur = (i: Indicateur, c: Cellule) => { const t = tonCellule(i, c); return t ? COULEURS[t] : COULEURS.neutre }

function Graphes({ resultat, def }: { resultat: Resultat; def: Definition }) {
  const temps = def.colonnes !== 'aucun'
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5, mb: 2 }}>
      {resultat.indicateurs.map((i) => {
        if (i.agregat === 'texte') return <Repartition key={i.id} i={i} resultat={resultat} />
        if (temps && i.temporel) {
          // Évolution dans le temps : total de la sélection, colonne par colonne
          const points = resultat.colonnes.map((col) => ({ libelle: col.libelle, c: resultat.total.cellules[`${i.id}|${col.cle}`] }))
          const max = Math.max(...points.map((p) => Math.abs(p.c.valeur ?? 0))) || 1
          return (
            <Card key={i.id} variant="outlined" sx={{ p: 2 }} aria-label={`Graphe ${i.libelle}`}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{i.libelle}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 140 }}>
                {points.map((p) => (
                  <Box key={p.libelle} sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }} title={`${p.libelle} : ${formater(i.format, p.c)}`}>
                    <Box sx={{ width: '70%', height: `${Math.max(2, Math.abs(p.c.valeur ?? 0) / max * 100)}%`, bgcolor: p.c.valeur === null ? 'divider' : couleur(i, p.c), borderRadius: '3px 3px 0 0' }} />
                  </Box>
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                {points.map((p, k) => <Typography key={p.libelle} variant="caption" sx={{ flex: 1, minWidth: 0, textAlign: 'center', color: 'text.secondary', visibility: points.length > 8 && k % 2 ? 'hidden' : 'visible', whiteSpace: 'nowrap', overflow: 'hidden' }}>{p.libelle}</Typography>)}
              </Box>
            </Card>
          )
        }
        const col = i.temporel ? resultat.colonnes.at(-1)!.cle : resultat.colonnes[0].cle
        const avec = resultat.lignes.filter((l) => l.cellules[`${i.id}|${col}`]?.valeur !== null)
        const lignes = avec.slice(0, 15).map((l) => ({ libelle: l.libelle, c: l.cellules[`${i.id}|${col}`] }))
        const max = Math.max(...lignes.map((l) => Math.abs(l.c.valeur ?? 0))) || 1
        return (
          <Card key={i.id} variant="outlined" sx={{ p: 2 }} aria-label={`Graphe ${i.libelle}`}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{i.libelle}</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {lignes.map((l) => (
                <Box key={l.libelle} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 110px) minmax(0, 1fr) auto', gap: 1, alignItems: 'center' }}>
                  <Typography variant="body2" noWrap title={l.libelle}>{l.libelle}</Typography>
                  <Box sx={{ height: 10, bgcolor: 'action.hover', borderRadius: 5 }}>
                    <Box sx={{ height: 10, width: `${Math.abs(l.c.valeur ?? 0) / max * 100}%`, bgcolor: couleur(i, l.c), borderRadius: 5 }} />
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: l.c.valeur === null ? 'text.secondary' : couleur(i, l.c), textAlign: 'right', minWidth: 72 }}>{formater(i.format, l.c)}</Typography>
                </Box>
              ))}
              {!avec.length && <Typography variant="body2" color="text.secondary">Pas encore de chiffres sur cette période.</Typography>}
              {avec.length > 15 && <Typography variant="caption" color="text.secondary">Les 15 premiers sur {avec.length} ; le tableau les montre tous.</Typography>}
            </Box>
          </Card>
        )
      })}
    </Box>
  )
}

// Indicateur en texte (case de la nine box, statut du budget) : nombre de magasins par valeur
function Repartition({ i, resultat }: { i: Indicateur; resultat: Resultat }) {
  const comptes = new Map<string, number>()
  for (const l of resultat.lignes) {
    // Une ligne de plusieurs magasins compte pour sa valeur la plus fréquente
    const t = l.cellules[`${i.id}|${resultat.colonnes[0].cle}`]?.texte?.replace(/ \(\d+ sur \d+\)$/, '')
    if (t) comptes.set(t, (comptes.get(t) ?? 0) + 1)
  }
  const tri = [...comptes].sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...tri.map(([, n]) => n))
  return (
    <Card variant="outlined" sx={{ p: 2 }} aria-label={`Graphe ${i.libelle}`}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{i.libelle}</Typography>
      {!tri.length ? <Typography variant="body2" color="text.secondary">Pas encore de données.</Typography> : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {tri.map(([t, n]) => (
            <Box key={t} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 150px) minmax(0, 1fr) auto', gap: 1, alignItems: 'center' }}>
              <Typography variant="body2" noWrap title={t}>{t}</Typography>
              <Box sx={{ height: 10, bgcolor: 'action.hover', borderRadius: 5 }}><Box sx={{ height: 10, width: `${n / max * 100}%`, bgcolor: COULEURS.neutre, borderRadius: 5 }} /></Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{n}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Card>
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
  const cellule = (k: string, c: Cellule, i: Indicateur, gras = false) => (
    <TableCell key={k} align="right" sx={{ whiteSpace: 'nowrap', fontWeight: gras ? 700 : 400, color: tonCellule(i, c) ? couleur(i, c) : undefined }}>{formater(i.format, c)}</TableCell>
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
          {resultat.lignes.map((l) => (
            <TableRow key={l.cle} hover>
              <TableCell sx={{ minWidth: 140, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                {parMagasin ? <Link component={RouterLink} to={`/magasins/${encodeURIComponent(l.libelle)}`} underline="hover" sx={zone}>{l.libelle}</Link> : <>{l.libelle} <Typography component="span" variant="caption" color="text.secondary">({l.magasins.length})</Typography></>}
              </TableCell>
              {cols.map(({ i, cle }) => cellule(cle, l.cellules[cle], i))}
            </TableRow>
          ))}
          {resultat.lignes.length > 1 && (
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 700, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>{resultat.total.libelle}</TableCell>
              {cols.map(({ i, cle }) => cellule(cle, resultat.total.cellules[cle], i, true))}
            </TableRow>
          )}
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
  const entete: CelluleXlsx[] = [{ v: axe(def.lignes)?.libelle ?? 'Magasin', s: 'entete' }, ...cols.map(({ i, col }) => ({ v: temps && i.temporel ? `${i.libelle} ${col.libelle}` : i.libelle, s: 'enteteDroite' as const }))]
  return {
    nom: titre.slice(0, 31),
    lignes: [
      [{ v: titre, s: 'titre' as const }],
      [{ v: periode, s: 'discret' as const }],
      [],
      entete,
      ...r.lignes.map((l) => [l.libelle, ...cols.map(({ i, cle }) => valeur(i, l.cellules[cle]))]),
      [{ v: r.total.libelle, s: 'gras' as const }, ...cols.map(({ i, cle }) => valeur(i, r.total.cellules[cle]))],
    ],
    largeurs: [28, ...cols.map(() => 16)],
    figer: { lignes: 4, colonnes: 1 },
  }
}

