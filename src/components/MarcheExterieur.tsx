// Plan d'action « Marché extérieur » d'un magasin, en 6 étapes (Joseph, 16/11/2026) : magasin, repérage autour du
// magasin (Annuaire des entreprises), cibles, diagnostic sur 5 critères, matrice des opportunités, plan d'action.
// Onglet de la fiche magasin, pour l'équipe (Directeur partout, Coach et RR sur leurs magasins) et pour le franchisé
// (ses magasins, par ecrire_exterieur). Calculs dans src/data/marcheExterieur.ts.
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
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import { Fenetre } from './EditionEquipe'
import { ChampDate } from './ChampDate'
import { Pastille } from './Social'
import { useAuth } from '../auth/AuthContext'
import { useApercu } from '../auth/Apercu'
import { useReseau } from '../data/ReseauContext'
import { enregistrerExterieur, enregistrerExterieurFranchise } from '../data/chargement'
import { chiffresDuMagasin, formatEuros } from '../data/chiffres'
import {
  CATEGORIES, CRITERES, OFFRES, QUADRANTS, RAYONS, SEUIL, STATUTS, TAILLES, actionProposee, axes, chercher, cibleDepuis, estNotee,
  libelleCategorie, libelleDistance, nouvelId, ordrePlan, planVide, quadrant, synthese,
  type Categorie, type Cible, type Critere, type Offre, type PlanExterieur, type Quadrant, type StatutAction, type Trouvee,
} from '../data/marcheExterieur'
import { dateCourte } from '../lib/format'
import type { Magasin, Reseau } from '../data/modele'

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
const libelleStatut = (s: StatutAction) => STATUTS.find(([k]) => k === s)?.[1] ?? 'À faire'
const tonStatut = (s: StatutAction) => (s === 'fait' ? 'vert' : 'gris') as 'vert' | 'gris'
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
  const minuterie = useRef<number | undefined>(undefined)
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
    setPlan(p)
    enAttente.current = p
    window.clearTimeout(minuterie.current)
    if (aussitot) void vider()
    else minuterie.current = window.setTimeout(() => { void vider() }, 600)
  }
  const par = profil?.nom ?? ''
  const le = reseau.jour
  const s = synthese(plan)
  const vues = [
    <EtapeMagasin key="0" reseau={reseau} m={m} plan={plan} changer={changer} lecture={lecture} />,
    <EtapeReperage key="1" m={m} plan={plan} changer={changer} lecture={lecture} par={par} le={le} />,
    <EtapeCibles key="2" plan={plan} changer={changer} lecture={lecture} par={par} le={le} />,
    <EtapeDiagnostic key="3" plan={plan} changer={changer} lecture={lecture} />,
    <EtapeMatrice key="4" plan={plan} />,
    <EtapePlan key="5" m={m} plan={plan} changer={changer} lecture={lecture} />,
  ]
  const fait = [plan.objectif !== null, plan.cibles.some((c) => c.source === 'annuaire'), plan.cibles.length > 0, s.cibles > 0 && s.notees === s.cibles, s.notees > 0, s.actions > 0]
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <Frise etape={etape} fait={fait} allerA={allerA} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', minHeight: 24 }}>
        <Typography variant="body2" color="text.secondary">
          {[`${s.cibles} cible${s.cibles > 1 ? 's' : ''}`, `${s.notees} notée${s.notees > 1 ? 's' : ''}`, `${s.actions} action${s.actions > 1 ? 's' : ''}`, s.caVise > 0 && `${formatEuros(s.caVise)} HT visés`].filter(Boolean).join(' · ')}
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
      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
        {ETAPES.map((e, i) => {
          const actuelle = i === etape
          const ok = fait[i] && !actuelle
          return (
            <li key={e.libelle}>
              <ButtonBase onClick={() => allerA(i)} aria-current={actuelle ? 'step' : undefined} aria-label={`Étape ${i + 1} : ${e.libelle}${ok ? ', faite' : ''}`}
                sx={{ width: '100%', minHeight: 56, px: { xs: 0.5, md: 1.5 }, py: 1, gap: 1.25, justifyContent: surPC ? 'flex-start' : 'center', borderBottom: '3px solid', borderColor: actuelle ? 'secondary.main' : ok ? 'success.main' : 'divider', fontFamily: 'inherit', textAlign: 'left', borderRadius: '8px 8px 0 0', '&:hover': { bgcolor: 'action.hover' } }}>
                <Box component="span" aria-hidden sx={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.875rem', border: '2px solid', fontVariantNumeric: 'tabular-nums',
                  borderColor: actuelle ? 'secondary.main' : ok ? 'success.main' : 'divider', bgcolor: actuelle ? 'secondary.main' : ok ? 'success.main' : 'background.paper', color: actuelle ? 'secondary.contrastText' : ok ? '#fff' : 'text.primary' }}>
                  {ok ? <Check sx={{ fontSize: 18 }} /> : i + 1}
                </Box>
                {surPC && (
                  <Box component="span" sx={{ minWidth: 0 }}>
                    <Box component="span" sx={{ display: 'block', fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.25 }}>{e.libelle}</Box>
                    <Box component="span" sx={{ display: 'block', fontSize: '0.75rem', color: 'text.secondary' }}>{e.sous}</Box>
                  </Box>
                )}
              </ButtonBase>
            </li>
          )
        })}
      </Box>
      {!surPC && <Typography sx={{ mt: 1, fontWeight: 700 }}>{`${etape + 1}. ${ETAPES[etape].libelle}`}</Typography>}
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
      <Typography sx={{ fontWeight: 800, fontSize: '1.375rem', fontVariantNumeric: 'tabular-nums' }}>{valeur}</Typography>
    </Box>
  )
}

// ── 1 · Magasin ─────────────────────────────────────────────────────
function EtapeMagasin({ reseau, m, plan, changer, lecture }: { reseau: Reseau; m: Magasin; plan: PlanExterieur; changer: (p: PlanExterieur, aussitot?: boolean) => void; lecture: boolean }) {
  const [objectif, setObjectif] = useState(plan.objectif !== null ? String(plan.objectif) : '')
  const mois = chiffresDuMagasin(reseau, m.nom).filter((c) => c.caExt !== null).slice(-12)
  const caExt = mois.reduce((t, c) => t + (c.caExt ?? 0), 0)
  const s = synthese(plan)
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
        <TextField label="Objectif de CA extérieur sur un an (€ HT)" value={objectif} disabled={lecture} slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          onChange={(e) => { setObjectif(e.target.value); const n = nombreOuNull(e.target.value); if (n === null || n >= 0) changer({ ...plan, objectif: n }) }} />
      </Box>
      <Box sx={{ display: 'grid', gap: 1.5, mt: 2.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
        <Indicateur libelle={mois.length ? `CA extérieur, ${mois.length} dernier${mois.length > 1 ? 's' : ''} mois` : 'CA extérieur'} valeur={mois.length ? formatEuros(caExt) : '—'} />
        <Indicateur libelle="Objectif sur un an" valeur={plan.objectif !== null ? formatEuros(plan.objectif) : '—'} />
        <Indicateur libelle="Cibles retenues" valeur={String(s.cibles)} />
        <Indicateur libelle="CA visé par le plan" valeur={s.caVise ? formatEuros(s.caVise) : '—'} />
      </Box>
    </>
  )
}

// ── 2 · Repérage ────────────────────────────────────────────────────
type EtatRecherche = { etat: 'repos' } | { etat: 'chargement'; fait: number } | { etat: 'pret'; liste: Trouvee[]; echecs: number }
const CLE_CACHE = 'vandb-reperage-exterieur'
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

function EtapeReperage({ m, plan, changer, lecture, par, le }: { m: Magasin; plan: PlanExterieur; changer: (p: PlanExterieur, aussitot?: boolean) => void; lecture: boolean; par: string; le: string }) {
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const [taille, setTaille] = useState(20)
  const [filtre, setFiltre] = useState<Categorie | 'tous'>('tous')
  const cle = m.lat !== null && m.lon !== null ? `${m.lat.toFixed(4)},${m.lon.toFixed(4)}|${plan.rayon}|${taille}` : ''
  const [recherche, setRecherche] = useState<EtatRecherche>(() => { const l = cle ? lireCache(cle) : null; return l ? { etat: 'pret', liste: l, echecs: 0 } : { etat: 'repos' } })
  useEffect(() => { const l = cle ? lireCache(cle) : null; setRecherche(l ? { etat: 'pret', liste: l, echecs: 0 } : { etat: 'repos' }) }, [cle])
  const lancer = async () => {
    if (m.lat === null || m.lon === null) return
    setRecherche({ etat: 'chargement', fait: 0 })
    const liste: Trouvee[] = []
    let echecs = 0
    for (const [i, c] of CATEGORIES.entries()) {
      try { liste.push(...await chercher(c.cle, m.lat, m.lon, plan.rayon, taille)) } catch { echecs++ }
      setRecherche({ etat: 'chargement', fait: i + 1 })
    }
    const vus = new Set<string>()
    const uniques = liste.filter((t) => !vus.has(t.id) && (vus.add(t.id), true)).sort((a, b) => a.distance - b.distance)
    if (echecs < CATEGORIES.length) ecrireCache(cle, uniques)
    setRecherche({ etat: 'pret', liste: uniques, echecs })
  }
  const retenues = new Set(plan.cibles.map((c) => c.id))
  const basculer = (t: Trouvee) => changer(retenues.has(t.id)
    ? { ...plan, cibles: plan.cibles.filter((c) => c.id !== t.id) }
    : { ...plan, cibles: [...plan.cibles, cibleDepuis(t, par, le)] }, true)
  if (m.lat === null || m.lon === null || m.positionApprochee) {
    return (
      <>
        <Titre>Repérage autour du magasin</Titre>
        <Alert severity="info">La position exacte du magasin n’est pas connue : complète son adresse sur la fiche pour chercher autour de lui. Les cibles s’ajoutent aussi à la main, à l’étape suivante.</Alert>
      </>
    )
  }
  const liste = recherche.etat === 'pret' ? recherche.liste : []
  const vues = filtre === 'tous' ? liste : liste.filter((t) => t.categorie === filtre)
  return (
    <>
      <Titre action={!lecture && (
        <Button variant={recherche.etat === 'pret' ? 'outlined' : 'contained'} startIcon={<SearchOutlined />} onClick={lancer} disabled={recherche.etat === 'chargement'} sx={{ minHeight: 48 }}>
          {recherche.etat === 'pret' ? 'Relancer la recherche' : `Chercher dans un rayon de ${plan.rayon} km`}
        </Button>
      )}>Repérage autour du magasin</Titre>
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
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }} role="group" aria-label="Filtrer par type">
            {[{ cle: 'tous' as const, pluriel: 'Tous' }, ...CATEGORIES].map((c) => {
              const n = c.cle === 'tous' ? liste.length : liste.filter((t) => t.categorie === c.cle).length
              return <Chip key={c.cle} label={`${c.pluriel} · ${n}`} onClick={() => setFiltre(c.cle)} color={filtre === c.cle ? 'secondary' : 'default'} variant={filtre === c.cle ? 'filled' : 'outlined'} aria-pressed={filtre === c.cle} sx={{ minHeight: 48, borderRadius: 999, fontWeight: 600 }} />
            })}
          </Box>
          {!vues.length ? <Typography color="text.secondary">Rien trouvé de ce type dans ce rayon. Élargis le rayon à l’étape 1, ou ajoute la cible à la main.</Typography> : surPC ? (
            <TableContainer>
              <Table size="small" aria-label="Repérage autour du magasin">
                <TableHead><TableRow><TableCell padding="checkbox">Retenir</TableCell><TableCell>Nom</TableCell><TableCell>Type</TableCell><TableCell>Activité</TableCell><TableCell>Adresse</TableCell><TableCell align="right">Distance</TableCell></TableRow></TableHead>
                <TableBody>
                  {vues.map((t) => (
                    <TableRow key={t.id} hover selected={retenues.has(t.id)}>
                      <TableCell padding="checkbox"><Checkbox checked={retenues.has(t.id)} onChange={() => basculer(t)} disabled={lecture} slotProps={{ input: { 'aria-label': `Retenir ${t.nom}` } }} /></TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t.nom}</TableCell>
                      <TableCell><Pastille ton="type">{libelleCategorie(t.categorie)}</Pastille></TableCell>
                      <TableCell>{t.detail}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{t.adresse}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{libelleDistance(t.distance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box component="ul" aria-label="Repérage autour du magasin" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {vues.map((t) => (
                <Box component="li" key={t.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Checkbox checked={retenues.has(t.id)} onChange={() => basculer(t)} disabled={lecture} slotProps={{ input: { 'aria-label': `Retenir ${t.nom}` } }} sx={{ width: 48, height: 48 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }}>{t.nom}</Typography>
                    <Typography variant="body2" color="text.secondary">{[libelleCategorie(t.categorie), t.detail, libelleDistance(t.distance)].filter(Boolean).join(' · ')}</Typography>
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
  const [message, setMessage] = useState('')
  return (
    <>
      <Titre action={!lecture && <Button variant="outlined" startIcon={<AddOutlined />} onClick={() => setEdition(null)} sx={{ minHeight: 48 }}>Ajouter une cible</Button>}>
        {`Mes cibles · ${plan.cibles.length}`}
      </Titre>
      {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}
      {!plan.cibles.length ? (
        <Typography color="text.secondary">Aucune cible retenue. Coche des noms au repérage, ou ajoute une cible à la main : un business club, un client que tu connais déjà.</Typography>
      ) : surPC ? (
        <TableContainer>
          <Table size="small" aria-label="Mes cibles">
            <TableHead><TableRow><TableCell>Cible</TableCell><TableCell>Type</TableCell><TableCell>Contact</TableCell><TableCell align="right">Distance</TableCell><TableCell>Diagnostic</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {plan.cibles.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell><Typography sx={{ fontWeight: 600 }}>{c.nom}</Typography><Typography variant="body2" color="text.secondary">{c.detail}</Typography></TableCell>
                  <TableCell><Pastille ton="type">{libelleCategorie(c.categorie)}</Pastille></TableCell>
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
                <Typography variant="body2" color="text.secondary">{[libelleCategorie(c.categorie), c.contact, libelleDistance(c.distance)].filter(Boolean).join(' · ')}</Typography>
              </Box>
              {!lecture && <IconButton onClick={() => setEdition(c)} aria-label={`Modifier ${c.nom}`} sx={{ width: 48, height: 48 }}><EditOutlined /></IconButton>}
            </Box>
          ))}
        </Box>
      )}
      {edition !== undefined && <FenetreCible cible={edition} plan={plan} changer={changer} par={par} le={le} onFermer={(msg) => { setEdition(undefined); if (msg) setMessage(msg) }} />}
    </>
  )
}

function FenetreCible({ cible: c, plan, changer, par, le, onFermer }: { cible: Cible | null; plan: PlanExterieur; changer: (p: PlanExterieur, aussitot?: boolean) => void; par: string; le: string; onFermer: (msg?: string) => void }) {
  const [nom, setNom] = useState(c?.nom ?? '')
  const [categorie, setCategorie] = useState<Categorie>(c?.categorie ?? 'club')
  const [detail, setDetail] = useState(c?.detail ?? '')
  const [contact, setContact] = useState(c?.contact ?? '')
  const enregistrer = async () => {
    const base: Cible = c ?? { id: nouvelId(), nom: '', categorie, detail: '', adresse: '', distance: null, siren: '', source: 'saisie', contact: '', notes: {}, action: '', qui: '', echeance: '', caVise: null, statut: 'a_faire', offre: '', par, le }
    const ligne: Cible = { ...base, nom: nom.trim().slice(0, 160), categorie, detail: detail.trim().slice(0, 200), contact: contact.trim().slice(0, 200) }
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
      <TextField label="Contact (nom, téléphone, email)" value={contact} onChange={(e) => setContact(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
    </Fenetre>
  )
}

// ── 4 · Diagnostic ──────────────────────────────────────────────────
function EtapeDiagnostic({ plan, changer, lecture }: { plan: PlanExterieur; changer: (p: PlanExterieur, aussitot?: boolean) => void; lecture: boolean }) {
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const [choisie, setChoisie] = useState(() => (plan.cibles.find((c) => !estNotee(c)) ?? plan.cibles[0])?.id ?? '')
  const c = plan.cibles.find((x) => x.id === choisie) ?? plan.cibles[0]
  if (!c) return <><Titre>Diagnostic</Titre><Typography color="text.secondary">Aucune cible à noter. Retiens des cibles au repérage ou ajoute-les à la main.</Typography></>
  const noter = (k: Critere, v: number | null) => {
    const notes = { ...c.notes }
    if (v === null) delete notes[k]; else notes[k] = v
    changer({ ...plan, cibles: plan.cibles.map((x) => (x.id === c.id ? { ...x, notes } : x)) })
  }
  const a = axes(c)
  const q = quadrant(c)
  const i = plan.cibles.indexOf(c)
  const suivante = plan.cibles[i + 1]
  return (
    <>
      <Titre>Diagnostic</Titre>
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '280px minmax(0, 1fr)' }, alignItems: 'start' }}>
        {surPC ? (
          <Box component="ul" aria-label="Cibles à noter" sx={{ listStyle: 'none', m: 0, p: 0, borderRight: '1px solid', borderColor: 'divider', pr: 1.5 }}>
            {plan.cibles.map((x) => (
              <li key={x.id}>
                <ButtonBase onClick={() => setChoisie(x.id)} aria-current={x.id === c.id ? 'true' : undefined}
                  sx={{ width: '100%', minHeight: 48, px: 1.5, gap: 1, justifyContent: 'space-between', borderRadius: 2, fontFamily: 'inherit', fontSize: '0.875rem', textAlign: 'left', fontWeight: x.id === c.id ? 700 : 500, bgcolor: x.id === c.id ? 'action.selected' : undefined }}>
                  <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.nom}</Box>
                  <Pastille ton={tonQuadrant(quadrant(x))}>{estNotee(x) ? libelleQuadrant(quadrant(x)) : `${Object.keys(x.notes).length}/5`}</Pastille>
                </ButtonBase>
              </li>
            ))}
          </Box>
        ) : (
          <TextField select label="Cible" value={c.id} onChange={(e) => setChoisie(e.target.value)} slotProps={{ select: { native: true } }}>
            {plan.cibles.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
          </TextField>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h3" sx={{ fontWeight: 700, fontSize: '1.125rem' }}>{c.nom}</Typography>
          <Typography variant="body2" color="text.secondary">{[libelleCategorie(c.categorie), c.detail].filter(Boolean).join(' · ')}</Typography>
          {CRITERES.map((k) => (
            <Box key={k.cle} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}>
              <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }} id={`critere-${k.cle}`}>{k.libelle}</Typography>
                <Typography variant="body2" color="text.secondary">{k.question}</Typography>
              </Box>
              <ToggleButtonGroup exclusive value={c.notes[k.cle] ?? null} onChange={(_e, v: number | null) => noter(k.cle, v)} aria-labelledby={`critere-${k.cle}`} disabled={lecture} size="small">
                {[1, 2, 3, 4, 5].map((v) => <ToggleButton key={v} value={v} aria-label={`${k.libelle} : ${v} sur 5`} sx={{ width: 48, height: 48, fontWeight: 800 }}>{v}</ToggleButton>)}
              </ToggleButtonGroup>
            </Box>
          ))}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mt: 2 }}>
            {a ? <>
              <Typography variant="body2">{`Valeur directe ${virgule(a.direct)} / 5`}</Typography>
              <Typography variant="body2">{`Valeur relais ${virgule(a.relais)} / 5`}</Typography>
              <Pastille ton={tonQuadrant(q)}>{libelleQuadrant(q)}</Pastille>
            </> : <Typography variant="body2" color="text.secondary">{`${5 - Object.keys(c.notes).length} critère${5 - Object.keys(c.notes).length > 1 ? 's' : ''} à noter`}</Typography>}
            {suivante && <Button onClick={() => setChoisie(suivante.id)} endIcon={<ArrowForward />} sx={{ ml: 'auto', minHeight: 48 }}>Cible suivante</Button>}
          </Box>
        </Box>
      </Box>
    </>
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
function EtapePlan({ m, plan, changer, lecture }: { m: Magasin; plan: PlanExterieur; changer: (p: PlanExterieur, aussitot?: boolean) => void; lecture: boolean }) {
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const [edition, setEdition] = useState<Cible | null>(null)
  const lignes = ordrePlan(plan.cibles)
  const s = synthese(plan)
  const lien = (o: Offre) => `/magasins/${encodeURIComponent(m.nom)}?vue=simulateurs&partie=simulateurs&sim=${o}`
  const chiffrer = (c: Cible) => (c.offre ? <Button component={RouterLink} to={lien(c.offre)} size="small" sx={{ minHeight: 48 }} aria-label={`Chiffrer ${c.nom} : ${OFFRES.find(([k]) => k === c.offre)?.[1]}`}>Chiffrer</Button> : null)
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
      {surPC ? (
        <TableContainer>
          <Table size="small" aria-label="Plan d’action">
            <TableHead><TableRow><TableCell>Cible</TableCell><TableCell>Case</TableCell><TableCell>Action</TableCell><TableCell>Qui</TableCell><TableCell>Échéance</TableCell><TableCell align="right">CA visé</TableCell><TableCell>Statut</TableCell><TableCell /><TableCell /></TableRow></TableHead>
            <TableBody>
              {lignes.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{c.nom}</TableCell>
                  <TableCell><Pastille ton={tonQuadrant(quadrant(c))}>{libelleQuadrant(quadrant(c))}</Pastille></TableCell>
                  <TableCell>{c.action || <Typography component="span" variant="body2" color="text.secondary">{quadrant(c) === 'plus_tard' ? 'Rien cette année' : 'À définir'}</Typography>}</TableCell>
                  <TableCell>{c.qui}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{c.echeance ? dateCourte(c.echeance) : ''}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{c.caVise !== null ? formatEuros(c.caVise) : ''}</TableCell>
                  <TableCell>{c.action && <Pastille ton={tonStatut(c.statut)}>{libelleStatut(c.statut)}</Pastille>}</TableCell>
                  <TableCell>{chiffrer(c)}</TableCell>
                  <TableCell align="right">{!lecture && <IconButton onClick={() => setEdition(c)} aria-label={`Action pour ${c.nom}`} sx={{ width: 48, height: 48 }}><EditOutlined /></IconButton>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box component="ul" aria-label="Plan d’action" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {lignes.map((c) => (
            <Box component="li" key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}><Typography sx={{ fontWeight: 600 }}>{c.nom}</Typography><Pastille ton={tonQuadrant(quadrant(c))}>{libelleQuadrant(quadrant(c))}</Pastille></Box>
                <Typography variant="body2">{c.action || (quadrant(c) === 'plus_tard' ? 'Rien cette année' : 'Action à définir')}</Typography>
                <Typography variant="body2" color="text.secondary">{[c.qui, c.echeance && dateCourte(c.echeance), c.caVise !== null && formatEuros(c.caVise), c.action && libelleStatut(c.statut)].filter(Boolean).join(' · ')}</Typography>
                {chiffrer(c)}
              </Box>
              {!lecture && <IconButton onClick={() => setEdition(c)} aria-label={`Action pour ${c.nom}`} sx={{ width: 48, height: 48 }}><EditOutlined /></IconButton>}
            </Box>
          ))}
        </Box>
      )}
      {edition && <FenetreAction cible={edition} plan={plan} changer={changer} onFermer={() => setEdition(null)} />}
    </>
  )
}

function FenetreAction({ cible: c, plan, changer, onFermer }: { cible: Cible; plan: PlanExterieur; changer: (p: PlanExterieur, aussitot?: boolean) => void; onFermer: (msg?: string) => void }) {
  const propose = actionProposee(c)
  const [action, setAction] = useState(c.action || propose.action)
  const [qui, setQui] = useState(c.qui || 'Franchisé')
  const [echeance, setEcheance] = useState(c.echeance)
  const [ca, setCa] = useState(c.caVise !== null ? String(c.caVise) : '')
  const [offre, setOffre] = useState<Offre>(c.action ? c.offre : propose.offre)
  const [statut, setStatut] = useState<StatutAction>(c.statut)
  const n = nombreOuNull(ca)
  const valide = (!ca.trim() || (n !== null && n >= 0)) && (!echeance || /^\d{4}-\d{2}-\d{2}$/.test(echeance))
  const enregistrer = async () => {
    const ligne: Cible = { ...c, action: action.trim().slice(0, 300), qui: qui.trim().slice(0, 80), echeance, caVise: n, offre, statut }
    changer({ ...plan, cibles: plan.cibles.map((x) => (x.id === c.id ? ligne : x)) }, true)
    return 'Action enregistrée.'
  }
  return (
    <Fenetre titre={`Action pour ${c.nom}`} ouvert onFermer={onFermer} valide={valide} enregistrer={enregistrer} sansRechargement>
      <TextField label="Action" value={action} onChange={(e) => setAction(e.target.value)} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 300 } }} />
      <TextField select label="Qui" value={qui} onChange={(e) => setQui(e.target.value)}>
        {['Franchisé', 'Coach', 'Responsable Régional', 'Directeur de réseau', ...(['Franchisé', 'Coach', 'Responsable Régional', 'Directeur de réseau'].includes(qui) ? [] : [qui])].map((x) => <MenuItem key={x} value={x} sx={{ minHeight: 48 }}>{x}</MenuItem>)}
      </TextField>
      <ChampDate label="Échéance" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
      <TextField label="CA visé sur un an (€ HT)" value={ca} onChange={(e) => setCa(e.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
      <TextField select label="Chiffrer avec" value={offre} onChange={(e) => setOffre(e.target.value as Offre)}>
        {OFFRES.map(([k, l]) => <MenuItem key={k || 'aucun'} value={k} sx={{ minHeight: 48 }}>{l}</MenuItem>)}
      </TextField>
      <TextField select label="Statut" value={statut} onChange={(e) => setStatut(e.target.value as StatutAction)}>
        {STATUTS.map(([k, l]) => <MenuItem key={k} value={k} sx={{ minHeight: 48 }}>{l}</MenuItem>)}
      </TextField>
    </Fenetre>
  )
}
