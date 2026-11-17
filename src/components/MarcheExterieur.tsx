// Plan d'action « Marché extérieur » d'un magasin, en 6 étapes (Joseph, 16/11/2026) : magasin, repérage autour du
// magasin (Annuaire des entreprises), cibles, diagnostic sur 5 critères, matrice des opportunités, plan d'action.
// Onglet de la fiche magasin, pour l'équipe (Directeur partout, Coach et RR sur leurs magasins) et pour le franchisé
// (ses magasins, par ecrire_exterieur). Calculs dans src/data/marcheExterieur.ts.
import { styleChiffre } from '../theme/theme'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowBack from '@mui/icons-material/ArrowBack'
import ArrowForward from '@mui/icons-material/ArrowForward'
import Check from '@mui/icons-material/Check'
import EditOutlined from '@mui/icons-material/EditOutlined'
import Favorite from '@mui/icons-material/Favorite'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import { Fenetre } from './EditionEquipe'
import { geolocaliser } from '../data/geolocalisation'
import { EffacerTriFiltres, Entete, LigneSansResultat, useTableau, type ColonneTri } from './TableauTri'
import { useMessageAnnulable } from './Annulable'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutlined'
import { ChampDate } from './ChampDate'
import { Pastille } from './Social'
import { useAuth } from '../auth/AuthContext'
import { useApercu } from '../auth/Apercu'
import { useReseau } from '../data/ReseauContext'
import { enregistrerExterieur, enregistrerExterieurFranchise } from '../data/chargement'
import { chiffresDuMagasin, formatEuros } from '../data/chiffres'
import {
  CATEGORIES, CRITERES, OFFRES, QUADRANTS, RAYONS, SEUIL, TAILLES, actionProposee, axes, chercher, cibleDepuis, codesPostauxAutour, trierParPotentiel, estNotee,
  libelleCA, libelleCategorie, libelleDistance, nouvelId, ordrePlan, planVide, quadrant, synthese, tachesDuPlan,
  type Categorie, type Cible, type Critere, type Offre, type PlanExterieur, type Quadrant, type Trouvee,
} from '../data/marcheExterieur'
import type { ActionLibre, Magasin, Reseau } from '../data/modele'
import Stack from '@mui/material/Stack'
import { LigneAction, ChampPorteur, useChangerStatut, useEcritureActions } from './Actions'
import { cleLibre, clesDesPorteurs, porteursDe, type ActionSuivie } from '../data/actions'
import { enregistrerActionLibre, supprimerActionLibre } from '../data/chargement'
import { tacheExterieurFranchise } from '../data/espaceFranchise'
import { mesCles } from '../data/messagerie'
import { notifierTache } from '../lib/notifications'
const formatNombre = (n: number) => n.toLocaleString('fr-FR')

const ETAPES = [
  { libelle: 'Magasin', sous: 'Point de départ' },
  { libelle: 'Repérage', sous: 'Autour du magasin' },
  { libelle: 'Cibles', sous: 'Sélection' },
  { libelle: 'Diagnostic', sous: '5 critères' },
  { libelle: 'Matrice', sous: 'Où agir d’abord' },
  { libelle: 'Plan d’action', sous: 'Qui, quoi, quand' },
]
const tonQuadrant = (q: Quadrant | null) => (q ? QUADRANTS.find((x) => x.cle === q)!.ton : 'gris')
const libelleQuadrant = (q: Quadrant | null) => (q ? QUADRANTS.find((x) => x.cle === q)!.libelle : 'À noter')
const virgule = (n: number) => n.toFixed(1).replace('.', ',')
const nombreOuNull = (v: string) => { const n = Number(v.replace(/\s/g, '').replace('€', '').replace(',', '.')); return v.trim() && Number.isFinite(n) ? n : null }

export function MarcheExterieur({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const { profil } = useAuth()
  const { apercu } = useApercu()
  const { recharger } = useReseau()
  const lecture = !!apercu
  const [params, setParams] = useSearchParams()
  const etape = Math.min(5, Math.max(0, Number(params.get('etape') ?? '1') - 1 || 0))
  const allerA = (i: number) => { setParams((p) => { const n = new URLSearchParams(p); n.set('etape', String(i + 1)); return n }, { replace: true }); window.scrollTo?.({ top: 0 }) }
  const [plan, setPlan] = useState<PlanExterieur>(() => reseau.exterieur?.[m.nom] ?? planVide())
  const [etat, setEtat] = useState<'' | 'envoi' | 'ok' | 'erreur'>('')
  const ecrire = profil?.role === 'franchise' ? enregistrerExterieurFranchise : enregistrerExterieur
  const enAttente = useRef<PlanExterieur | null>(null)
  const touche = useRef(false)
  const minuterie = useRef<number | undefined>(undefined)
  // Le réseau gardé sur l'appareil s'affiche d'abord, puis la base répond : tant que rien n'est saisi ici, le plan suit
  // la version lue (sinon une version ancienne resterait à l'écran, et serait réenregistrée à la première saisie)
  const lu = reseau.exterieur?.[m.nom]
  useEffect(() => { if (!touche.current) setPlan(lu ?? planVide()) }, [lu])
  const vider = useCallback(async () => {
    window.clearTimeout(minuterie.current)
    const p = enAttente.current
    if (!p) return
    enAttente.current = null
    setEtat('envoi')
    try { await ecrire(m.nom, p); setEtat('ok'); void recharger() } catch { setEtat('erreur'); enAttente.current ??= p }
  }, [ecrire, m.nom, recharger])
  useEffect(() => () => { void vider() }, [vider])
  // Chaque changement est gardé : tout de suite (ajout, retrait) ou après une courte pause (notes, réglages)
  const changer = (p: PlanExterieur, aussitot = false) => {
    if (lecture) return
    touche.current = true
    setPlan(p)
    enAttente.current = p
    window.clearTimeout(minuterie.current)
    if (aussitot) void vider()
    else minuterie.current = window.setTimeout(() => { void vider() }, 600)
  }
  const par = profil?.nom ?? ''
  const le = reseau.jour
  const s = synthese(plan, reseau.actionsLibres?.[m.nom])
  const vues = [
    <EtapeMagasin key="0" reseau={reseau} m={m} plan={plan} changer={changer} lecture={lecture} />,
    <EtapeReperage key="1" m={m} plan={plan} changer={changer} lecture={lecture} par={par} le={le} />,
    <EtapeCibles key="2" plan={plan} changer={changer} lecture={lecture} par={par} le={le} />,
    <EtapeDiagnostic key="3" plan={plan} changer={changer} lecture={lecture} />,
    <EtapeMatrice key="4" plan={plan} />,
    <EtapePlan key="5" reseau={reseau} m={m} plan={plan} changer={changer} lecture={lecture} />,
  ]
  const fait = [plan.objectif !== null, plan.cibles.some((c) => c.source === 'annuaire'), plan.cibles.length > 0, s.cibles > 0 && s.notees === s.cibles, s.notees > 0, s.actions > 0]
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <Frise etape={etape} fait={fait} allerA={allerA} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', minHeight: 24 }}>
        <Typography variant="body2" color="text.secondary">
          {[`${s.cibles} cible${s.cibles > 1 ? 's' : ''}`, `${s.notees} notée${s.notees > 1 ? 's' : ''}`, `${s.actions} action${s.actions > 1 ? 's' : ''}`, s.sousContrat > 0 && `${s.sousContrat} sous contrat`, s.caVise > 0 && `${formatEuros(s.caVise)} HT visés`].filter(Boolean).join(' · ')}
        </Typography>
        <Typography role="status" variant="body2" sx={{ ml: 'auto', color: etat === 'erreur' ? 'error.main' : 'text.secondary', fontWeight: etat === 'erreur' ? 600 : 400 }}>
          {etat === 'envoi' ? 'Enregistrement…' : etat === 'ok' ? 'Enregistré' : etat === 'erreur' ? 'Pas enregistré : vérifie la connexion, la saisie sera renvoyée au prochain changement.' : ''}
        </Typography>
      </Box>
      <Paper variant="outlined" component="section" aria-label={ETAPES[etape].libelle} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, minWidth: 0 }}>
        {vues[etape]}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 3, flexWrap: 'wrap' }}>
          {etape > 0 ? <Button startIcon={<ArrowBack />} onClick={() => allerA(etape - 1)} sx={{ minHeight: 48 }}>{ETAPES[etape - 1].libelle}</Button> : <span />}
          {etape < 5 && <Button variant="contained" endIcon={<ArrowForward />} onClick={() => allerA(etape + 1)} sx={{ minHeight: 48 }}>{ETAPES[etape + 1].libelle}</Button>}
        </Box>
      </Paper>
    </Box>
  )
}

// ── Frise des 6 étapes ─────────────────────────────────────────────
function Frise({ etape, fait, allerA }: { etape: number; fait: boolean[]; allerA: (i: number) => void }) {
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  return (
    <Box component="nav" aria-label="Étapes du plan marché extérieur">
      {/* Titres des étapes, sans numéros (Joseph, 17/11/2026) ; sur téléphone la frise défile */}
      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: surPC ? 'grid' : 'flex', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', overflowX: surPC ? undefined : 'auto', scrollbarWidth: 'none' }}>
        {ETAPES.map((e, i) => {
          const actuelle = i === etape
          const ok = fait[i] && !actuelle
          return (
            <li key={e.libelle}>
              <ButtonBase onClick={() => allerA(i)} aria-current={actuelle ? 'step' : undefined} aria-label={`Étape ${e.libelle}${ok ? ', faite' : ''}`}
                sx={{ width: '100%', minHeight: 56, px: { xs: 1.25, md: 1.5 }, py: 1, gap: 0.75, justifyContent: 'flex-start', borderBottom: '3px solid', borderColor: actuelle ? 'secondary.main' : ok ? 'success.main' : 'divider', fontFamily: 'inherit', textAlign: 'left', borderRadius: '8px 8px 0 0', '&:hover': { bgcolor: 'action.hover' } }}>
                {ok && <Check aria-hidden sx={{ fontSize: 18, color: 'success.main', flexShrink: 0 }} />}
                <Box component="span" sx={{ minWidth: 0 }}>
                  <Box component="span" sx={{ display: 'block', fontWeight: actuelle ? 800 : 600, fontSize: '0.875rem', lineHeight: 1.25, whiteSpace: 'nowrap', color: actuelle ? 'text.primary' : 'text.secondary' }}>{e.libelle}</Box>
                  {surPC && <Box component="span" sx={{ display: 'block', fontSize: '0.75rem', color: 'text.secondary' }}>{e.sous}</Box>}
                </Box>
              </ButtonBase>
            </li>
          )
        })}
      </Box>
    </Box>
  )
}

function Titre({ children, action }: { children: string; action?: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
      <Typography component="h2" variant="h6" sx={{ fontWeight: 700, mr: 'auto' }}>{children}</Typography>
      {action}
    </Box>
  )
}
function Indicateur({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 2, py: 1.5 }}>
      <Typography variant="body2" color="text.secondary">{libelle}</Typography>
      <Typography sx={styleChiffre}>{valeur}</Typography>
    </Box>
  )
}

// ── 1 · Magasin ─────────────────────────────────────────────────────
// Autre point de départ du repérage (Joseph, 17/11/2026) : l'adresse d'un concurrent, d'une zone d'activité…
function AutreCentre({ plan, changer, lecture }: { plan: PlanExterieur; changer: (p: PlanExterieur, aussitot?: boolean) => void; lecture: boolean }) {
  const [saisie, setSaisie] = useState('')
  const [etat, setEtat] = useState<'repos' | 'cherche' | 'introuvable'>('repos')
  if (plan.centre) {
    return (
      <Box sx={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Pastille ton="orange">{`Repérage centré sur ${plan.centre.adresse}`}</Pastille>
        {!lecture && <Button onClick={() => { const { centre: _c, ...reste } = plan; changer({ ...reste, centre: null }, true) }} sx={{ minHeight: 48 }}>Revenir au magasin</Button>}
      </Box>
    )
  }
  if (lecture) return null
  const placer = async () => {
    const adresse = saisie.trim()
    if (!adresse) return
    setEtat('cherche')
    const p = await geolocaliser({ adresse, codePostal: '', ville: '', pays: 'France' }).catch(() => null)
    if (!p) { setEtat('introuvable'); return }
    changer({ ...plan, centre: { adresse: adresse.slice(0, 200), lat: p.lat, lon: p.lon } }, true)
    setSaisie(''); setEtat('repos')
  }
  return (
    <Box sx={{ gridColumn: '1 / -1', display: 'flex', gap: 1.5, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <TextField label="Chercher autour d’une autre adresse" value={saisie} onChange={(e) => { setSaisie(e.target.value); setEtat('repos') }}
        onKeyDown={(e) => { if (e.key === 'Enter') void placer() }} sx={{ flex: '1 1 320px' }}
        error={etat === 'introuvable'} helperText={etat === 'introuvable' ? 'Adresse introuvable. Ajoute le code postal et la ville.' : 'Un concurrent, une zone d’activité : avec le code postal et la ville.'}
        slotProps={{ htmlInput: { maxLength: 200 } }} />
      <Button variant="outlined" onClick={() => void placer()} disabled={!saisie.trim() || etat === 'cherche'} sx={{ minHeight: 56 }}>
        {etat === 'cherche' ? 'Recherche…' : 'Centrer ici'}
      </Button>
    </Box>
  )
}

function EtapeMagasin({ reseau, m, plan, changer, lecture }: { reseau: Reseau; m: Magasin; plan: PlanExterieur; changer: (p: PlanExterieur, aussitot?: boolean) => void; lecture: boolean }) {
  const [objectif, setObjectif] = useState(plan.objectif !== null ? String(plan.objectif) : '')
  const mois = chiffresDuMagasin(reseau, m.nom).filter((c) => c.caExt !== null).slice(-12)
  const caExt = mois.reduce((t, c) => t + (c.caExt ?? 0), 0)
  const s = synthese(plan, reseau.actionsLibres?.[m.nom])
  const adresse = [m.adresse || [m.codePostal, m.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return (
    <>
      <Titre>{`Point de départ de ${m.nom}`}</Titre>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
        <TextField label="Adresse du magasin" value={adresse || 'Adresse à compléter sur la fiche'} slotProps={{ input: { readOnly: true } }} />
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }} id="libelle-rayon">Rayon de recherche</Typography>
          <ToggleButtonGroup exclusive value={plan.rayon} onChange={(_e, v: number | null) => v && changer({ ...plan, rayon: v })} aria-labelledby="libelle-rayon" disabled={lecture}>
            {RAYONS.map((r) => <ToggleButton key={r} value={r} sx={{ minHeight: 48, minWidth: 72 }}>{`${r} km`}</ToggleButton>)}
          </ToggleButtonGroup>
        </Box>
        <AutreCentre plan={plan} changer={changer} lecture={lecture} />
        <TextField label="Objectif de CA extérieur sur un an (€ HT)" value={objectif} disabled={lecture} slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          onChange={(e) => { setObjectif(e.target.value); const n = nombreOuNull(e.target.value); if (n === null || n >= 0) changer({ ...plan, objectif: n }) }} />
      </Box>
      <Box sx={{ display: 'grid', gap: 1.5, mt: 2.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' } }}>
        <Indicateur libelle={mois.length ? `CA extérieur, ${mois.length} dernier${mois.length > 1 ? 's' : ''} mois` : 'CA extérieur'} valeur={mois.length ? formatEuros(caExt) : '—'} />
        <Indicateur libelle="Objectif sur un an" valeur={plan.objectif !== null ? formatEuros(plan.objectif) : '—'} />
        <Indicateur libelle="Cibles retenues" valeur={String(s.cibles)} />
        <Indicateur libelle={s.sousContrat ? `CA sous contrat, ${s.sousContrat} cible${s.sousContrat > 1 ? 's' : ''}` : 'CA sous contrat'} valeur={s.caContrat ? formatEuros(s.caContrat) : '—'} />
        <Indicateur libelle="CA visé par le plan" valeur={s.caVise ? formatEuros(s.caVise) : '—'} />
      </Box>
    </>
  )
}

// ── 2 · Repérage ────────────────────────────────────────────────────
const TRANCHE_COURTE = (t: Trouvee) => t.libelleEffectif.replace(' sur le site', '')
type EtatRecherche = { etat: 'repos' } | { etat: 'chargement'; fait: number } | { etat: 'pret'; liste: Trouvee[]; echecs: number }
const CLE_CACHE = 'vandb-reperage-exterieur-3'
const JOURS_CACHE = 30
function lireCache(cle: string): Trouvee[] | null {
  try {
    const x = (JSON.parse(localStorage.getItem(CLE_CACHE) ?? '{}') as Record<string, { le: number; liste: Trouvee[] }>)[cle]
    return x && Array.isArray(x.liste) && Date.now() - x.le < JOURS_CACHE * 86400000 ? x.liste : null
  } catch { return null }
}
function ecrireCache(cle: string, liste: Trouvee[]) {
  try {
    const tout = JSON.parse(localStorage.getItem(CLE_CACHE) ?? '{}') as Record<string, unknown>
    tout[cle] = { le: Date.now(), liste }
    localStorage.setItem(CLE_CACHE, JSON.stringify(tout))
  } catch { /* stockage indisponible : recherche refaite la prochaine fois */ }
}

// Cibles conseillées (Joseph, 17/11/2026) : un cœur et la raison sous le nom ; toutes restent listées
function NomConseil({ t, cible }: { t: Trouvee; cible?: Cible }) {
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        {t.conseil && <Favorite titleAccess={`Conseillée : ${t.conseil}`} sx={{ fontSize: 18, color: 'secondary.main', flexShrink: 0 }} />}
        <Typography component="span" sx={{ fontWeight: 600 }}>{t.nom}</Typography>
      </Box>
      {t.conseil && <Typography variant="body2" sx={{ color: 'secondary.dark' }}>{t.conseil}</Typography>}
      {cible?.contrat && <Box sx={{ mt: 0.5 }}><Contrat c={cible} /></Box>}
    </>
  )
}

// Tri et filtres par colonne (Joseph, 17/11/2026), comme les autres tableaux : clic sur le titre, entonnoir au survol
type OrdreReperage = 'pertinence' | 'effectif' | 'ca' | 'distance' | 'nom'
const ORDRES_REPERAGE: [OrdreReperage, string][] = [['pertinence', 'Conseillées d’abord'], ['effectif', 'Effectif du site'], ['ca', 'Chiffre d’affaires'], ['distance', 'Distance'], ['nom', 'Nom']]
function ordonner(l: Trouvee[], o: OrdreReperage): Trouvee[] {
  if (o === 'pertinence') return l
  const x = [...l]
  if (o === 'effectif') return x.sort((a, b) => (b.effectif ?? -1) - (a.effectif ?? -1) || a.distance - b.distance)
  if (o === 'ca') return x.sort((a, b) => (b.ca?.montant ?? -1) - (a.ca?.montant ?? -1) || a.distance - b.distance)
  if (o === 'distance') return x.sort((a, b) => a.distance - b.distance)
  return x.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}
const COLONNES_REPERAGE: ColonneTri<Trouvee>[] = [
  { cle: 'nom', libelle: 'Nom', valeur: (t) => t.nom, filtre: false },
  { cle: 'type', libelle: 'Type', valeur: (t) => libelleCategorie(t.categorie) },
  { cle: 'activite', libelle: 'Activité', valeur: (t) => t.activite },
  { cle: 'effectif', libelle: 'Effectif du site', valeur: (t) => t.effectif, filtre: 'nombre', unite: 'salariés', premier: 'desc' },
  { cle: 'ca', libelle: 'Chiffre d’affaires', valeur: (t) => t.ca?.montant ?? null, nombre: (t) => (t.ca ? t.ca.montant / 1000 : null), filtre: 'nombre', unite: 'k€', premier: 'desc' },
  { cle: 'adresse', libelle: 'Adresse', valeur: (t) => t.adresse, filtre: false },
  { cle: 'distance', libelle: 'Distance', valeur: (t) => t.distance, nombre: (t) => t.distance / 1000, filtre: 'nombre', unite: 'km', premier: 'asc' },
]
function TableauReperage({ vues, retenues, basculer, lecture, parId }: { vues: Trouvee[]; retenues: Set<string>; basculer: (t: Trouvee) => void; lecture: boolean; parId: Map<string, Cible> }) {
  const t = useTableau(vues, COLONNES_REPERAGE, { memoire: 'reperage-exterieur' })
  return (
    <>
      <EffacerTriFiltres t={t} sx={{ mb: 1 }} />
      <TableContainer>
        <Table size="small" aria-label="Repérage autour du magasin">
          <TableHead><TableRow>
            <TableCell padding="checkbox" sx={{ whiteSpace: 'nowrap', minWidth: 80 }}>Retenir</TableCell>
            <Entete t={t} cle="nom" />
            <Entete t={t} cle="type" /><Entete t={t} cle="activite" /><Entete t={t} cle="effectif" />
            <Entete t={t} cle="ca" align="right" /><Entete t={t} cle="adresse" /><Entete t={t} cle="distance" align="right" />
          </TableRow></TableHead>
          <TableBody>
            <LigneSansResultat t={t} colSpan={8} quoi="Aucune cible ne correspond" />
            {t.lignes.map((x) => (
              <TableRow key={x.id} hover selected={retenues.has(x.id)}>
                <TableCell padding="checkbox"><Checkbox checked={retenues.has(x.id)} onChange={() => basculer(x)} disabled={lecture} slotProps={{ input: { 'aria-label': `Retenir ${x.nom}` } }} /></TableCell>
                <TableCell><NomConseil t={x} cible={parId.get(x.id)} /></TableCell>
                <TableCell><Pastille ton="type">{libelleCategorie(x.categorie)}</Pastille></TableCell>
                <TableCell>{x.activite}</TableCell>
                <TableCell sx={{ color: x.effectif === null ? 'text.secondary' : undefined, fontWeight: (x.effectif ?? 0) >= 100 ? 700 : undefined }}>{x.effectif === null ? ['Non publié', x.taille && `entreprise : ${x.taille}`].filter(Boolean).join(' · ') : TRANCHE_COURTE(x)}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: x.ca ? undefined : 'text.secondary', fontWeight: (x.ca?.montant ?? 0) >= 500_000 ? 700 : undefined }}>{x.ca ? libelleCA(x.ca) : 'Non publié'}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{x.adresse}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{libelleDistance(x.distance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  )
}

function EtapeReperage({ m, plan, changer, lecture, par, le }: { m: Magasin; plan: PlanExterieur; changer: (p: PlanExterieur, aussitot?: boolean) => void; lecture: boolean; par: string; le: string }) {
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const [taille, setTaille] = useState(20)
  const [filtre, setFiltre] = useState<Categorie | 'tous'>('tous')
  // Filtres de la liste (Joseph, 16/11/2026) : effectif du site, distance, nom
  const [effectifMin, setEffectifMin] = useState(0)
  const [distanceMax, setDistanceMax] = useState(0)
  const [nomCherche, setNomCherche] = useState('')
  const [conseillees, setConseillees] = useState(false)
  const [ordre, setOrdre] = useState<OrdreReperage>('pertinence')
  const ici = plan.centre ?? (m.lat !== null && m.lon !== null && !m.positionApprochee ? { lat: m.lat, lon: m.lon, adresse: '' } : null)
  const lieu = plan.centre ? `Repérage autour de ${plan.centre.adresse}` : 'Repérage autour du magasin'
  const cle = ici ? `${ici.lat.toFixed(4)},${ici.lon.toFixed(4)}|${plan.rayon}|${taille}` : ''
  const [recherche, setRecherche] = useState<EtatRecherche>(() => { const l = cle ? lireCache(cle) : null; return l ? { etat: 'pret', liste: l, echecs: 0 } : { etat: 'repos' } })
  useEffect(() => { const l = cle ? lireCache(cle) : null; setRecherche(l ? { etat: 'pret', liste: l, echecs: 0 } : { etat: 'repos' }) }, [cle])
  const lancer = async () => {
    if (!ici) return
    setRecherche({ etat: 'chargement', fait: 0 })
    let codes: string[]
    try { codes = await codesPostauxAutour(ici.lat, ici.lon, plan.rayon) } catch { setRecherche({ etat: 'pret', liste: [], echecs: CATEGORIES.length }); return }
    const liste: Trouvee[] = []
    let echecs = 0
    for (const [i, c] of CATEGORIES.entries()) {
      try { liste.push(...await chercher(c.cle, codes, ici.lat, ici.lon, plan.rayon, taille)) } catch { echecs++ }
      setRecherche({ etat: 'chargement', fait: i + 1 })
    }
    const vus = new Set<string>()
    const uniques = liste.filter((t) => !vus.has(t.id) && (vus.add(t.id), true)).sort(trierParPotentiel)
    if (echecs < CATEGORIES.length) ecrireCache(cle, uniques)
    setRecherche({ etat: 'pret', liste: uniques, echecs })
  }
  const retenues = new Set(plan.cibles.map((c) => c.id))
  const parId = new Map(plan.cibles.map((c) => [c.id, c]))
  const basculer = (t: Trouvee) => changer(retenues.has(t.id)
    ? { ...plan, cibles: plan.cibles.filter((c) => c.id !== t.id) }
    : { ...plan, cibles: [...plan.cibles, cibleDepuis(t, par, le)] }, true)
  if (!ici) {
    return (
      <>
        <Titre>Repérage autour du magasin</Titre>
        <Alert severity="info">La position exacte du magasin n’est pas connue : complète son adresse sur la fiche pour chercher autour de lui. Les cibles s’ajoutent aussi à la main, à l’étape suivante.</Alert>
      </>
    )
  }
  const liste = recherche.etat === 'pret' ? recherche.liste : []
  const mot = nomCherche.trim().toLowerCase()
  const filtrees = liste.filter((t) => (!effectifMin || (t.effectif ?? -1) >= effectifMin) && (!distanceMax || t.distance <= distanceMax * 1000) && (!mot || t.nom.toLowerCase().includes(mot) || t.activite.toLowerCase().includes(mot)) && (!conseillees || !!t.conseil))
  const vues = filtre === 'tous' ? filtrees : filtrees.filter((t) => t.categorie === filtre)
  return (
    <>
      <Titre action={!lecture && (
        <Button variant={recherche.etat === 'pret' ? 'outlined' : 'contained'} startIcon={<SearchOutlined />} onClick={lancer} disabled={recherche.etat === 'chargement'} sx={{ minHeight: 48 }}>
          {recherche.etat === 'pret' ? 'Relancer la recherche' : `Chercher dans un rayon de ${plan.rayon} km`}
        </Button>
      )}>{lieu}</Titre>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        <TextField select label="Entreprises : taille minimale" value={taille} onChange={(e) => setTaille(Number(e.target.value))} sx={{ minWidth: 240 }} slotProps={{ select: { native: true } }}>
          {TAILLES.map((t) => <option key={t} value={t}>{`${t} salariés et plus`}</option>)}
        </TextField>
        <Typography variant="body2" color="text.secondary">Source : Annuaire des entreprises de l’État</Typography>
      </Box>
      {recherche.etat === 'repos' && <Typography color="text.secondary">Aucune recherche faite pour ce rayon. Lance la recherche : entreprises, traiteurs et salles, associations et clubs, organisations patronales, cafés, hôtels et restaurants.</Typography>}
      {recherche.etat === 'chargement' && <Typography role="status" color="text.secondary">{`Recherche en cours… ${recherche.fait} sur ${CATEGORIES.length}`}</Typography>}
      {recherche.etat === 'pret' && recherche.echecs === CATEGORIES.length && (
        <Alert severity="warning">L’Annuaire des entreprises ne répond pas pour le moment. Réessaie dans quelques minutes, ou ajoute tes cibles à la main à l’étape suivante.</Alert>
      )}
      {recherche.etat === 'pret' && recherche.echecs > 0 && recherche.echecs < CATEGORIES.length && (
        <Alert severity="info" sx={{ mb: 2 }}>Une partie de la recherche n’a pas abouti. Relance-la dans quelques minutes pour compléter la liste.</Alert>
      )}
      {recherche.etat === 'pret' && recherche.echecs < CATEGORIES.length && (
        <>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 1.5 }}>
            <TextField label="Chercher un nom ou une activité" value={nomCherche} onChange={(e) => setNomCherche(e.target.value)} sx={{ flex: '1 1 240px', maxWidth: 360 }} />
            <TextField select label="Effectif du site" value={effectifMin} onChange={(e) => setEffectifMin(Number(e.target.value))} sx={{ minWidth: 200 }} slotProps={{ select: { native: true } }}>
              <option value={0}>Tous, publié ou non</option>
              {[10, 20, 50, 100, 250, 500].map((t) => <option key={t} value={t}>{`${t} salariés et plus`}</option>)}
            </TextField>
            <TextField select label="Distance" value={distanceMax} onChange={(e) => setDistanceMax(Number(e.target.value))} sx={{ minWidth: 160 }} slotProps={{ select: { native: true } }}>
              <option value={0}>{`Tout le rayon (${plan.rayon} km)`}</option>
              {[1, 2, 5, 10].filter((d) => d < plan.rayon).map((d) => <option key={d} value={d}>{`À moins de ${d} km`}</option>)}
            </TextField>
            {!surPC && (
              <TextField select label="Trier par" value={ordre} onChange={(e) => setOrdre(e.target.value as OrdreReperage)} sx={{ minWidth: 200 }} slotProps={{ select: { native: true } }}>
                {ORDRES_REPERAGE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </TextField>
            )}
            <Chip icon={<Favorite />} label={`Conseillées · ${liste.filter((t) => t.conseil).length}`} onClick={() => setConseillees((x) => !x)} color={conseillees ? 'secondary' : 'default'} variant={conseillees ? 'filled' : 'outlined'} aria-pressed={conseillees} sx={{ minHeight: 48, borderRadius: 999, fontWeight: 600 }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }} role="group" aria-label="Filtrer par type">
            {[{ cle: 'tous' as const, pluriel: 'Tous' }, ...CATEGORIES].map((c) => {
              const n = c.cle === 'tous' ? filtrees.length : filtrees.filter((t) => t.categorie === c.cle).length
              return <Chip key={c.cle} label={`${c.pluriel} · ${n}`} onClick={() => setFiltre(c.cle)} color={filtre === c.cle ? 'secondary' : 'default'} variant={filtre === c.cle ? 'filled' : 'outlined'} aria-pressed={filtre === c.cle} sx={{ minHeight: 48, borderRadius: 999, fontWeight: 600 }} />
            })}
          </Box>
          {!vues.length ? <Typography color="text.secondary">{filtrees.length < liste.length ? 'Rien ne correspond à ces filtres. Desserre-les, ou ajoute la cible à la main.' : 'Rien trouvé de ce type dans ce rayon. Élargis le rayon à l’étape 1, ou ajoute la cible à la main.'}</Typography> : surPC ? (
            <TableauReperage vues={vues} retenues={retenues} basculer={basculer} lecture={lecture} parId={parId} />
          ) : (
            <Box component="ul" aria-label="Repérage autour du magasin" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {ordonner(vues, ordre).map((t) => (
                <Box component="li" key={t.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Checkbox checked={retenues.has(t.id)} onChange={() => basculer(t)} disabled={lecture} slotProps={{ input: { 'aria-label': `Retenir ${t.nom}` } }} sx={{ width: 48, height: 48 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <NomConseil t={t} cible={parId.get(t.id)} />
                    <Typography variant="body2" color="text.secondary">{[libelleCategorie(t.categorie), t.activite, t.effectif === null ? 'effectif non publié' : TRANCHE_COURTE(t), t.ca && `CA ${libelleCA(t.ca)}`, libelleDistance(t.distance)].filter(Boolean).join(' · ')}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </>
      )}
    </>
  )
}

// ── 3 · Cibles ──────────────────────────────────────────────────────
function EtapeCibles({ plan, changer, lecture, par, le }: { plan: PlanExterieur; changer: (p: PlanExterieur, aussitot?: boolean) => void; lecture: boolean; par: string; le: string }) {
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const [edition, setEdition] = useState<Cible | null | undefined>(undefined)
  const { signaler, bandeau } = useMessageAnnulable()
  return (
    <>
      <Titre action={!lecture && <Button variant="outlined" startIcon={<AddOutlined />} onClick={() => setEdition(null)} sx={{ minHeight: 48 }}>Ajouter une cible</Button>}>
        {`Mes cibles · ${plan.cibles.length}`}
      </Titre>
      {!plan.cibles.length ? (
        <Typography color="text.secondary">Aucune cible retenue. Coche des noms au repérage, ou ajoute une cible à la main : un business club, un client que tu connais déjà.</Typography>
      ) : surPC ? (
        <TableContainer>
          <Table size="small" aria-label="Mes cibles">
            <TableHead><TableRow><TableCell>Cible</TableCell><TableCell>Type</TableCell><TableCell align="right">Salariés, licenciés</TableCell><TableCell>Contact</TableCell><TableCell align="right">Distance</TableCell><TableCell>Diagnostic</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {plan.cibles.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell><Typography sx={{ fontWeight: 600 }}>{c.nom}</Typography><Typography variant="body2" color="text.secondary">{c.detail}</Typography>{c.contrat && <Box sx={{ mt: 0.5 }}><Contrat c={c} /></Box>}</TableCell>
                  <TableCell><Pastille ton="type">{libelleCategorie(c.categorie)}</Pastille></TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{c.membres !== null ? formatNombre(c.membres) : <Typography component="span" variant="body2" color="text.secondary">À compléter</Typography>}</TableCell>
                  <TableCell>{c.contact || <Typography component="span" variant="body2" color="text.secondary">À compléter</Typography>}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{libelleDistance(c.distance)}</TableCell>
                  <TableCell><Pastille ton={tonQuadrant(quadrant(c))}>{libelleQuadrant(quadrant(c))}</Pastille></TableCell>
                  <TableCell align="right">{!lecture && <IconButton onClick={() => setEdition(c)} aria-label={`Modifier ${c.nom}`} sx={{ width: 48, height: 48 }}><EditOutlined /></IconButton>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box component="ul" aria-label="Mes cibles" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {plan.cibles.map((c) => (
            <Box component="li" key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{c.nom}</Typography>
                <Typography variant="body2" color="text.secondary">{[libelleCategorie(c.categorie), c.membres !== null ? `${formatNombre(c.membres)} membres ou salariés` : '', c.contact, libelleDistance(c.distance)].filter(Boolean).join(' · ')}</Typography>
                {c.contrat && <Box sx={{ mt: 0.5 }}><Contrat c={c} /></Box>}
              </Box>
              {!lecture && <IconButton onClick={() => setEdition(c)} aria-label={`Modifier ${c.nom}`} sx={{ width: 48, height: 48 }}><EditOutlined /></IconButton>}
            </Box>
          ))}
        </Box>
      )}
      {edition !== undefined && <FenetreCible cible={edition} plan={plan} changer={changer} par={par} le={le} onFermer={(msg) => { setEdition(undefined); if (msg) signaler(msg) }} />}
      {bandeau}
    </>
  )
}

// Cible déjà sous contrat (Joseph, 17/11/2026) : visible du coach au repérage, aux cibles et au plan
function Contrat({ c }: { c: Pick<Cible, 'contrat'> }) {
  if (!c.contrat) return null
  return <Pastille ton="vert">{['Contrat en cours', c.contrat.ca !== null && `${formatEuros(c.contrat.ca)} HT par an`, !c.contrat.ecrit && 'non écrit'].filter(Boolean).join(' · ')}</Pastille>
}

function FenetreCible({ cible: c, plan, changer, par, le, onFermer }: { cible: Cible | null; plan: PlanExterieur; changer: (p: PlanExterieur, aussitot?: boolean) => void; par: string; le: string; onFermer: (msg?: string) => void }) {
  const [nom, setNom] = useState(c?.nom ?? '')
  const [categorie, setCategorie] = useState<Categorie>(c?.categorie ?? 'club')
  const [detail, setDetail] = useState(c?.detail ?? '')
  const [contact, setContact] = useState(c?.contact ?? '')
  const [membres, setMembres] = useState(c?.membres != null ? String(c.membres) : '')
  const [enContrat, setEnContrat] = useState(!!c?.contrat)
  const [caContrat, setCaContrat] = useState(c?.contrat?.ca != null ? String(c.contrat.ca) : '')
  const [ecrit, setEcrit] = useState(!!c?.contrat?.ecrit)
  const enregistrer = async () => {
    const base: Cible = c ?? { id: nouvelId(), nom: '', categorie, detail: '', adresse: '', distance: null, siren: '', source: 'saisie', contact: '', membres: null, contrat: null, notes: {}, action: '', qui: '', echeance: '', caVise: null, statut: 'a_faire', offre: '', par, le }
    const ca = caContrat.trim() ? Number(caContrat.replace(',', '.')) : NaN
    const ligne: Cible = { ...base, contrat: enContrat ? { ca: Number.isFinite(ca) && ca >= 0 ? Math.round(ca) : null, ecrit } : null, nom: nom.trim().slice(0, 160), categorie, detail: detail.trim().slice(0, 200), contact: contact.trim().slice(0, 200), membres: membres.trim() && Number.isFinite(Number(membres)) && Number(membres) >= 0 ? Math.round(Number(membres)) : null }
    changer({ ...plan, cibles: c ? plan.cibles.map((x) => (x.id === c.id ? ligne : x)) : [...plan.cibles, ligne] }, true)
    return c ? 'Cible enregistrée.' : 'Cible ajoutée.'
  }
  const retirer = async () => { changer({ ...plan, cibles: plan.cibles.filter((x) => x.id !== c!.id) }, true); return 'Cible retirée.' }
  return (
    <Fenetre titre={c ? `Modifier ${c.nom}` : 'Ajouter une cible'} ouvert onFermer={onFermer} valide={!!nom.trim()} enregistrer={enregistrer} sansRechargement
      supprimer={c ? retirer : undefined} libelleSuppression={c ? `Retirer « ${c.nom} » des cibles ? Son diagnostic et son action partent avec.` : undefined}>
      <TextField label="Nom" value={nom} onChange={(e) => setNom(e.target.value)} required slotProps={{ htmlInput: { maxLength: 160 } }} />
      <TextField select label="Type" value={categorie} onChange={(e) => setCategorie(e.target.value as Categorie)}>
        {CATEGORIES.map((x) => <MenuItem key={x.cle} value={x.cle} sx={{ minHeight: 48 }}>{x.libelle}</MenuItem>)}
      </TextField>
      <TextField label="Activité, taille" value={detail} onChange={(e) => setDetail(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
      <TextField label="Salariés, licenciés ou adhérents" value={membres} onChange={(e) => setMembres(e.target.value.replace(/[^\d]/g, ''))} slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 7 } }} />
      <TextField label="Contact (nom, téléphone, email)" value={contact} onChange={(e) => setContact(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
      <FormControlLabel control={<Switch checked={enContrat} onChange={(e) => setEnContrat(e.target.checked)} />} label="Contrat en cours" sx={{ minHeight: 48, ml: 0 }} />
      {enContrat && <>
        <TextField label="CA annuel du contrat (€ HT)" value={caContrat} onChange={(e) => setCaContrat(e.target.value.replace(/[^\d]/g, ''))} slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 9 } }} />
        <FormControlLabel control={<Checkbox checked={ecrit} onChange={(e) => setEcrit(e.target.checked)} />} label="Contrat écrit" sx={{ minHeight: 48, ml: 0 }} />
      </>}
    </Fenetre>
  )
}

// ── 4 · Diagnostic ──────────────────────────────────────────────────
// Joseph (17/11/2026) : la liste des cibles avec leurs notes ; on choisit celle à noter ou à reprendre, on peut la retirer
const NOTE_COURTE: Record<Critere, string> = { potentiel: 'Potentiel', visibilite: 'Visibilité', prescription: 'Prescription', recurrence: 'Bénéfice', cause: 'Cause' }
function EtapeDiagnostic({ plan, changer, lecture }: { plan: PlanExterieur; changer: (p: PlanExterieur, aussitot?: boolean) => void; lecture: boolean }) {
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const [edition, setEdition] = useState<Cible | null>(null)
  const { signaler, bandeau } = useMessageAnnulable()
  if (!plan.cibles.length) return <><Titre>Diagnostic</Titre><Typography color="text.secondary">Aucune cible à noter. Retiens des cibles au repérage ou ajoute-les à la main.</Typography></>
  const retirer = (c: Cible) => {
    const avant = plan
    changer({ ...plan, cibles: plan.cibles.filter((x) => x.id !== c.id) }, true)
    signaler(`${c.nom} retirée des cibles.`, () => changer(avant, true))
  }
  const restantes = plan.cibles.filter((c) => !estNotee(c)).length
  const etat = (c: Cible) => <Pastille ton={tonQuadrant(quadrant(c))}>{estNotee(c) ? libelleQuadrant(quadrant(c)) : `${Object.keys(c.notes).length}/5 noté${Object.keys(c.notes).length > 1 ? 's' : ''}`}</Pastille>
  const bouton = (c: Cible) => (
    <Button variant={estNotee(c) ? 'text' : 'outlined'} startIcon={estNotee(c) ? <EditOutlined /> : <TuneOutlined />} onClick={() => setEdition(c)} aria-label={`${estNotee(c) ? 'Modifier le diagnostic de' : 'Noter'} ${c.nom}`} sx={{ minHeight: 48, whiteSpace: 'nowrap' }}>
      {estNotee(c) ? 'Modifier' : 'Noter'}
    </Button>
  )
  return (
    <>
      <Titre>{restantes ? `Diagnostic · ${restantes} cible${restantes > 1 ? 's' : ''} à noter` : 'Diagnostic · toutes les cibles sont notées'}</Titre>
      {surPC ? (
        <TableContainer>
          <Table size="small" aria-label="Diagnostic des cibles">
            <TableHead><TableRow><TableCell>Cible</TableCell>{CRITERES.map((k) => <TableCell key={k.cle} align="center">{NOTE_COURTE[k.cle]}</TableCell>)}<TableCell>Case de la matrice</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {plan.cibles.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell><Typography sx={{ fontWeight: 600 }}>{c.nom}</Typography><Typography variant="body2" color="text.secondary">{libelleCategorie(c.categorie)}</Typography></TableCell>
                  {CRITERES.map((k) => <TableCell key={k.cle} align="center" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: c.notes[k.cle] ? 'text.primary' : 'text.secondary' }}>{c.notes[k.cle] ?? '—'}</TableCell>)}
                  <TableCell>{etat(c)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {!lecture && <>{bouton(c)}<IconButton onClick={() => retirer(c)} aria-label={`Retirer ${c.nom}`} sx={{ width: 48, height: 48 }}><DeleteOutline /></IconButton></>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box component="ul" aria-label="Diagnostic des cibles" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {plan.cibles.map((c) => (
            <Box component="li" key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{c.nom}</Typography>
                <Box sx={{ mt: 0.5 }}>{etat(c)}</Box>
              </Box>
              {!lecture && bouton(c)}
            </Box>
          ))}
        </Box>
      )}
      {edition && <FenetreDiagnostic cible={edition} plan={plan} changer={changer} onFermer={(msg) => { setEdition(null); if (msg) signaler(msg) }} />}
      {bandeau}
    </>
  )
}

function FenetreDiagnostic({ cible: c, plan, changer, onFermer }: { cible: Cible; plan: PlanExterieur; changer: (p: PlanExterieur, aussitot?: boolean) => void; onFermer: (msg?: string) => void }) {
  const [notes, setNotes] = useState<Partial<Record<Critere, number>>>(c.notes)
  const essai: Cible = { ...c, notes }
  const a = axes(essai)
  const q = quadrant(essai)
  const noter = (k: Critere, v: number | null) => setNotes((n) => { const x = { ...n }; if (v === null) delete x[k]; else x[k] = v; return x })
  const enregistrer = async () => { changer({ ...plan, cibles: plan.cibles.map((x) => (x.id === c.id ? { ...x, notes } : x)) }, true); return `Diagnostic de ${c.nom} enregistré.` }
  const retirer = async () => { changer({ ...plan, cibles: plan.cibles.filter((x) => x.id !== c.id) }, true); return `${c.nom} retirée des cibles.` }
  const reste = 5 - Object.keys(notes).length
  return (
    <Fenetre titre={`Diagnostic de ${c.nom}`} ouvert onFermer={onFermer} valide enregistrer={enregistrer} sansRechargement
      supprimer={retirer} libelleSuppression={`Retirer « ${c.nom} » des cibles ? Son diagnostic et son action partent avec.`}>
      <Typography variant="body2" color="text.secondary">{[libelleCategorie(c.categorie), c.detail].filter(Boolean).join(' · ')}</Typography>
      {CRITERES.map((k) => (
        <Box key={k.cle} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontWeight: 700 }} id={`critere-${k.cle}`}>{k.libelle}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{k.question}</Typography>
          <ToggleButtonGroup exclusive value={notes[k.cle] ?? null} onChange={(_e, v: number | null) => noter(k.cle, v)} aria-labelledby={`critere-${k.cle}`} size="small">
            {[1, 2, 3, 4, 5].map((v) => <ToggleButton key={v} value={v} aria-label={`${k.libelle} : ${v} sur 5`} sx={{ width: 48, height: 48, fontWeight: 800 }}>{v}</ToggleButton>)}
          </ToggleButtonGroup>
        </Box>
      ))}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        {a ? <>
          <Typography variant="body2">{`Valeur directe ${virgule(a.direct)} / 5`}</Typography>
          <Typography variant="body2">{`Valeur relais ${virgule(a.relais)} / 5`}</Typography>
          <Pastille ton={tonQuadrant(q)}>{libelleQuadrant(q)}</Pastille>
        </> : <Typography variant="body2" color="text.secondary">{`${reste} critère${reste > 1 ? 's' : ''} à noter`}</Typography>}
      </Box>
    </Fenetre>
  )
}

// ── 5 · Matrice ─────────────────────────────────────────────────────
function EtapeMatrice({ plan }: { plan: PlanExterieur }) {
  const theme = useTheme()
  const notees = plan.cibles.filter(estNotee)
  const couleur: Record<Quadrant, string> = { priorite: '#c24119', client: theme.palette.warning.main, relais: theme.palette.success.main, plus_tard: theme.palette.text.disabled }
  const W = 560, H = 420, G = 52, D = 16
  const sx = (v: number) => G + ((v - 1) / 4) * (W - G - D)
  const sy = (v: number) => H - G - ((v - 1) / 4) * (H - G - D)
  // Deux cibles au même point : décalées en cercle pour rester lisibles
  const points = useMemo(() => {
    const groupes = new Map<string, Cible[]>()
    for (const c of notees) { const a = axes(c)!; const k = `${a.relais}|${a.direct}`; groupes.set(k, [...(groupes.get(k) ?? []), c]) }
    return [...groupes.values()].flatMap((g) => g.map((c, i) => { const a = axes(c)!; const ang = (2 * Math.PI * i) / g.length; const r = g.length > 1 ? 12 : 0; return { c, x: sx(a.relais) + r * Math.cos(ang), y: sy(a.direct) + r * Math.sin(ang) } }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan])
  if (!notees.length) return <><Titre>Matrice des opportunités</Titre><Typography color="text.secondary">Aucune cible notée sur les 5 critères. Le diagnostic place chaque cible dans la matrice.</Typography></>
  return (
    <>
      <Titre>Matrice des opportunités</Titre>
      {notees.length < plan.cibles.length && <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{`${plan.cibles.length - notees.length} cible${plan.cibles.length - notees.length > 1 ? 's' : ''} pas encore notée${plan.cibles.length - notees.length > 1 ? 's' : ''}, hors matrice.`}</Typography>}
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.4fr) minmax(0, 1fr)' }, alignItems: 'start' }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Box component="svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Matrice des opportunités : valeur relais en abscisse, valeur directe en ordonnée" sx={{ width: '100%', minWidth: 340, maxWidth: W, display: 'block', '& text': { fill: theme.palette.text.secondary, fontFamily: 'inherit' } }}>
            <rect x={sx(SEUIL)} y={sy(5)} width={sx(5) - sx(SEUIL)} height={sy(SEUIL) - sy(5)} fill={theme.palette.action.selected} />
            <rect x={sx(1)} y={sy(5)} width={sx(5) - sx(1)} height={sy(1) - sy(5)} fill="none" stroke={theme.palette.divider} />
            <line x1={sx(SEUIL)} x2={sx(SEUIL)} y1={sy(1)} y2={sy(5)} stroke={theme.palette.divider} strokeWidth={2} />
            <line x1={sx(1)} x2={sx(5)} y1={sy(SEUIL)} y2={sy(SEUIL)} stroke={theme.palette.divider} strokeWidth={2} />
            {[1, 2, 3, 4, 5].map((v) => <g key={v}><text x={sx(v)} y={H - G + 18} fontSize={12} textAnchor="middle">{v}</text><text x={G - 10} y={sy(v) + 4} fontSize={12} textAnchor="end">{v}</text></g>)}
            <text x={(W + G) / 2} y={H - 8} fontSize={12} textAnchor="middle">Valeur relais : visibilité, prescription, cause</text>
            <text transform={`translate(14 ${(H - G) / 2}) rotate(-90)`} fontSize={12} textAnchor="middle">Valeur directe : potentiel, récurrence</text>
            <text x={sx(5) - 8} y={sy(5) + 18} fontSize={12} textAnchor="end" fontWeight={700} style={{ fill: theme.palette.text.primary }}>Priorité</text>
            <text x={sx(1) + 8} y={sy(5) + 18} fontSize={12} fontWeight={700}>Client à signer</text>
            <text x={sx(5) - 8} y={sy(1) - 8} fontSize={12} textAnchor="end" fontWeight={700}>Partenaire relais</text>
            <text x={sx(1) + 8} y={sy(1) - 8} fontSize={12} fontWeight={700}>Plus tard</text>
            {points.map(({ c, x, y }) => (
              <g key={c.id}>
                <title>{c.nom}</title>
                <circle cx={x} cy={y} r={8} fill={couleur[quadrant(c)!]} stroke={theme.palette.background.paper} strokeWidth={2} />
                <text x={x + 11} y={y + 4} fontSize={12} style={{ fill: theme.palette.text.primary }}>{c.nom.length > 22 ? `${c.nom.slice(0, 21)}…` : c.nom}</text>
              </g>
            ))}
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {QUADRANTS.map((qd) => {
            const l = ordrePlan(notees).filter((c) => quadrant(c) === qd.cle)
            return (
              <Box key={qd.cle} component="section" aria-label={qd.libelle} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Pastille ton={qd.ton}>{qd.libelle}</Pastille><Typography variant="body2" color="text.secondary">{`${l.length} · ${qd.sens}`}</Typography></Box>
                {!!l.length && <Typography variant="body2" sx={{ mt: 0.5 }}>{l.map((c) => c.nom).join(', ')}</Typography>}
              </Box>
            )
          })}
        </Box>
      </Box>
    </>
  )
}

// ── 6 · Plan d'action ───────────────────────────────────────────────
// Joseph (17/11/2026) : plusieurs actions par cible, chacune une tâche du magasin (liste Tâches, cochée partout pareil) ;
// le CA visé et le simulateur restent sur la cible
function EtapePlan({ reseau, m, plan, changer, lecture }: { reseau: Reseau; m: Magasin; plan: PlanExterieur; changer: (p: PlanExterieur, aussitot?: boolean) => void; lecture: boolean }) {
  const [objectif, setObjectif] = useState<Cible | null>(null)
  const [tache, setTache] = useState<{ cible: Cible; a: ActionLibre | null } | null>(null)
  const [enCours, setEnCours] = useState('')
  const { signaler, bandeau } = useMessageAnnulable()
  const { recharger } = useReseau()
  const ecriture = useEcritureActions(reseau)
  const changerStatut = useChangerStatut(reseau, signaler)
  const taches = tachesDuPlan(reseau.actionsLibres?.[m.nom], plan)
  const lignes = ordrePlan(plan.cibles)
  const s = synthese(plan, reseau.actionsLibres?.[m.nom])
  const lien = (o: Offre) => `/magasins/${encodeURIComponent(m.nom)}?vue=simulateurs&partie=simulateurs&sim=${o}`
  const suivie = (a: ActionLibre): ActionSuivie => ({ visite: null, libre: a, magasin: m.nom, date: a.creeLe, index: -1, a, cle: cleLibre(a.id) })
  const cocher = async (x: ActionSuivie, faite: boolean) => {
    setEnCours(x.cle)
    try { await ecriture.cocher(x, faite); await recharger(); signaler(faite ? 'Tâche marquée faite.' : 'Tâche remise en cours.') }
    catch { signaler('La tâche n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.') }
    finally { setEnCours('') }
  }
  const ecrire = !lecture && !ecriture.lectureSeule
  if (!lignes.length) return <><Titre>Plan d’action</Titre><Typography color="text.secondary">Aucune cible. Le plan se construit à partir des cibles retenues et notées.</Typography></>
  return (
    <>
      <Titre>Plan d’action</Titre>
      <Box sx={{ display: 'grid', gap: 1.5, mb: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
        <Indicateur libelle="Actions" valeur={String(s.actions)} />
        <Indicateur libelle="Faites" valeur={String(s.faites)} />
        <Indicateur libelle="CA visé (€ HT, un an)" valeur={s.caVise ? formatEuros(s.caVise) : '—'} />
        <Indicateur libelle="Part de l’objectif" valeur={plan.objectif ? `${Math.round((s.caVise / plan.objectif) * 100)} %` : '—'} />
      </Box>
      <Stack spacing={1.5}>
        {lignes.map((c) => {
          const q = quadrant(c)
          const siennes = taches.filter((t) => t.exterieur?.cible === c.id).map(suivie)
          return (
            <Box key={c.id} component="section" aria-label={`Actions pour ${c.nom}`} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: { xs: 1.5, md: 2 } }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography component="h3" sx={{ fontWeight: 700, fontSize: '1rem', mr: 0.5 }}>{c.nom}</Typography>
                <Pastille ton={tonQuadrant(q)}>{libelleQuadrant(q)}</Pastille>
                <Contrat c={c} />
                <Typography variant="body2" color="text.secondary" sx={{ ml: { md: 'auto' } }}>{c.caVise !== null ? `${formatEuros(c.caVise)} HT visés sur un an` : 'CA visé à fixer'}</Typography>
                {c.offre && <Button component={RouterLink} to={lien(c.offre)} size="small" sx={{ minHeight: 48 }} aria-label={`Chiffrer ${c.nom} : ${OFFRES.find(([k]) => k === c.offre)?.[1]}`}>Chiffrer</Button>}
                {!lecture && <IconButton onClick={() => setObjectif(c)} aria-label={`CA visé pour ${c.nom}`} sx={{ width: 48, height: 48 }}><EditOutlined /></IconButton>}
              </Box>
              {siennes.length ? (
                <Box component="ul" aria-label={`Tâches pour ${c.nom}`} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                  {siennes.map((x) => (
                    <LigneAction key={x.cle} reseau={reseau} x={x} avecPorteur enCours={enCours === x.cle} sansPriorite sansExterieur
                      cocher={ecrire ? (f) => void cocher(x, f) : undefined} changerStatut={ecrire ? changerStatut?.(x) : undefined}
                      modifier={ecrire ? () => setTache({ cible: c, a: x.libre }) : undefined} />
                  ))}
                </Box>
              ) : <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{q === 'plus_tard' ? 'Rien prévu cette année.' : 'Aucune action pour l’instant.'}</Typography>}
              {ecrire && <Button startIcon={<AddOutlined />} onClick={() => setTache({ cible: c, a: null })} sx={{ minHeight: 48, mt: 0.5, ml: -1 }} aria-label={`Ajouter une action pour ${c.nom}`}>Ajouter une action</Button>}
            </Box>
          )
        })}
      </Stack>
      {objectif && <FenetreObjectif cible={objectif} plan={plan} changer={changer} onFermer={(msg) => { setObjectif(null); if (msg) signaler(msg) }} />}
      {tache && <FenetreTache reseau={reseau} magasin={m.nom} cible={tache.cible} a={tache.a} premiere={!taches.some((t) => t.exterieur?.cible === tache.cible.id)} onFermer={(msg) => { setTache(null); if (msg) signaler(msg) }} />}
      {bandeau}
    </>
  )
}

// CA visé sur un an et simulateur pour chiffrer : propres à la cible
function FenetreObjectif({ cible: c, plan, changer, onFermer }: { cible: Cible; plan: PlanExterieur; changer: (p: PlanExterieur, aussitot?: boolean) => void; onFermer: (msg?: string) => void }) {
  const [ca, setCa] = useState(c.caVise !== null ? String(c.caVise) : '')
  const [offre, setOffre] = useState<Offre>(c.offre || (c.caVise === null ? actionProposee(c).offre : ''))
  const n = nombreOuNull(ca)
  const valide = !ca.trim() || (n !== null && n >= 0)
  const enregistrer = async () => {
    changer({ ...plan, cibles: plan.cibles.map((x) => (x.id === c.id ? { ...x, caVise: n, offre } : x)) }, true)
    return 'CA visé enregistré.'
  }
  return (
    <Fenetre titre={`CA visé pour ${c.nom}`} ouvert onFermer={onFermer} valide={valide} enregistrer={enregistrer} sansRechargement>
      <TextField label="CA visé sur un an (€ HT)" value={ca} onChange={(e) => setCa(e.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
      <TextField select label="Chiffrer avec" value={offre} onChange={(e) => setOffre(e.target.value as Offre)}>
        {OFFRES.map(([k, l]) => <MenuItem key={k || 'aucun'} value={k} sx={{ minHeight: 48 }}>{l}</MenuItem>)}
      </TextField>
    </Fenetre>
  )
}

// Une tâche du magasin rattachée à la cible ; le franchisé passe par la base (0049)
function FenetreTache({ reseau, magasin, cible: c, a, premiere, onFermer }: { reseau: Reseau; magasin: string; cible: Cible; a: ActionLibre | null; premiere: boolean; onFermer: (msg?: string) => void }) {
  const { profil } = useAuth()
  const { franchise } = useEcritureActions(reseau)
  const [texte, setTexte] = useState(a?.action ?? (premiere ? actionProposee(c).action : ''))
  const [porteur, setPorteur] = useState(a?.porteur ?? '')
  const [echeance, setEcheance] = useState(a?.echeance ?? '')
  const propre = texte.trim().replace(/\s+/g, ' ').slice(0, 1000)
  const exterieur = { cible: c.id, nom: c.nom }
  const enregistrer = async () => {
    if (franchise) {
      await tacheExterieurFranchise(magasin, { id: a?.id, ...exterieur, action: propre, porteur: porteur.trim(), echeance })
      return a ? 'Tâche mise à jour.' : 'Tâche ajoutée à la liste du magasin.'
    }
    const l: Omit<ActionLibre, 'id'> & { id?: string } = { ...(a ?? {}), id: a?.id, action: propre, porteur: porteur.trim(), echeance, creeLe: a?.creeLe || reseau.jour, ...(a?.auteur || profil?.nom ? { auteur: a?.auteur || profil?.nom } : {}), exterieur }
    const id = await enregistrerActionLibre(magasin, l)
    if (!a) {
      const cles = clesDesPorteurs(reseau, magasin, porteursDe(l)).filter((k) => !mesCles(profil).includes(k))
      notifierTache(magasin, id, cles)
    }
    return a ? 'Tâche mise à jour.' : 'Tâche ajoutée à la liste du magasin.'
  }
  const supprimer = a ? async () => {
    if (franchise) await tacheExterieurFranchise(magasin, { id: a.id, ...exterieur, action: '', porteur: '', echeance: '', supprimer: true })
    else await supprimerActionLibre(magasin, a.id)
    return 'Tâche supprimée.'
  } : undefined
  return (
    <Fenetre titre={a ? `Modifier l’action pour ${c.nom}` : `Action pour ${c.nom}`} ouvert onFermer={onFermer} valide={!!propre && (!echeance || /^\d{4}-\d{2}-\d{2}$/.test(echeance))}
      enregistrer={enregistrer} supprimer={supprimer} libelleSuppression={a ? `Supprimer la tâche « ${a.action} » ?` : undefined}>
      <TextField label="Action" value={texte} onChange={(e) => setTexte(e.target.value)} multiline minRows={2} autoFocus={!a} slotProps={{ htmlInput: { maxLength: 1000 } }} />
      <ChampPorteur reseau={reseau} magasin={magasin} valeur={porteur} changer={setPorteur} />
      <ChampDate label="Échéance" value={echeance} onChange={(e) => setEcheance(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
    </Fenetre>
  )
}
