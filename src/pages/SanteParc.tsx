import type { ReactNode } from 'react'
import { normaliser } from '../data/filtres'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Snackbar from '@mui/material/Snackbar'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { alpha, useTheme, type SxProps, type Theme } from '@mui/material/styles'
import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined'
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined'
import FilterAlt from '@mui/icons-material/FilterAlt'
import FilterAltOutlined from '@mui/icons-material/FilterAltOutlined'
import SwapVertOutlined from '@mui/icons-material/SwapVertOutlined'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import EventRepeatOutlined from '@mui/icons-material/EventRepeatOutlined'
import SearchOffOutlined from '@mui/icons-material/SearchOffOutlined'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { RechercheFiltres } from '../components/RechercheFiltres'
import { Onglets } from '../components/Onglets'
import GridViewOutlined from '@mui/icons-material/GridViewOutlined'
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined'
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined'
import QueryStatsOutlined from '@mui/icons-material/QueryStatsOutlined'
import { FiltreMenu, type Option } from '../components/FiltreMenu'
import InputAdornment from '@mui/material/InputAdornment'
import SearchIcon from '@mui/icons-material/Search'
import { BoutonsNote, BoutonsOption, LibelleCritere, NotesParAxe, PastilleCase, couleursCoachs, texteSur, useSaisieSante, type Saisie } from '../components/Sante'
import { coachA } from '../data/charge'
import { avancement, caseDe, couleurTon, criteresAxe, libelleAxe, libelleNote, nineBox, tonDe, tousCriteres, type Evaluation, type IdCritere, type Thematique } from '../data/sante'
import { lienFiche } from '../lib/format'
import { PastilleAlerte } from '../components/Chiffres'
import { CarteLignes, ChoixAffichage, Initiales, LigneCompacte, MiniCourbe, Pastille, Puces, TitreSection, useAffichage, useParTranches } from '../components/Social'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import { analyser as analyserCA, dernierAudit, formatEuros, formatPourcent, formatValeur, libelleAudit, libelleMois, libelleMoisCourt, courbeCA, formatKEuros, type StatutAlerte } from '../data/chiffres'
import type { Magasin, Reseau } from '../data/modele'

// Filtres communs : recherche, Responsable Régional, Coach
function useFiltres(reseau: Reseau, enPlus?: ReactNode) {
  const [rrs, setRRs] = useState<string[]>([])
  const [coachsChoisis, setCoachs] = useState<string[]>([])
  const [recherche, setRecherche] = useState('')
  const magasins = useMemo(() => reseau.magasins
    .filter((m) => m.statut !== 'avenir')
    .filter((m) => (!rrs.length || rrs.includes(m.rr?.id ?? '__aucun__')) && (!coachsChoisis.length || coachsChoisis.includes(coachA(m, reseau.jour) || '__aucun__'))
      && (!recherche || `${m.nom} ${m.ville} ${coachA(m, reseau.jour)}`.toLowerCase().includes(recherche.toLowerCase())))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')), [reseau, rrs, coachsChoisis, recherche])
  const actifsMag = reseau.magasins.filter((m) => m.statut !== 'avenir')
  const coachs = [...new Set(actifsMag.map((m) => coachA(m, reseau.jour)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  // Propositions : les magasins, rangés par Coach
  const options = useMemo(() => reseau.magasins.filter((m) => m.statut !== 'avenir').map((m) => ({ nom: m.nom, coach: coachA(m, reseau.jour) }))
    .sort((a, b) => (a.coach || '~').localeCompare(b.coach || '~', 'fr') || a.nom.localeCompare(b.nom, 'fr')), [reseau])
  const champ = (
      <Autocomplete freeSolo options={options} groupBy={(o) => o.coach || 'Sans Coach'} getOptionLabel={(o) => (typeof o === 'string' ? o : o.nom)}
        inputValue={recherche} onInputChange={(_e, v) => setRecherche(v)} size="small"
        filterOptions={(os, { inputValue }) => { const q = inputValue.toLowerCase(); return os.filter((o) => !q || o.nom.toLowerCase().includes(q) || o.coach.toLowerCase().includes(q)) }}
        sx={{ width: { xs: '100%', sm: 320 } }}
        renderInput={(p) => <TextField {...p} placeholder="Rechercher un magasin ou un Coach"
          slotProps={{ ...p.slotProps, htmlInput: { ...p.slotProps.htmlInput, 'aria-label': 'Rechercher un magasin ou un Coach' }, input: { ...p.slotProps.input, startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 999, minHeight: 48 } }} />} />
  )
  const compter = (p: (m: Reseau['magasins'][number]) => boolean) => `${actifsMag.filter(p).length} magasins`
  // enPlus : filtres propres à l'onglet, posés juste après le Coach ; actions : à droite de la barre
  const barreDe = (enPlus?: ReactNode, actifsEnPlus = 0, actions?: ReactNode) => (
    <RechercheFiltres recherche={champ} actifs={rrs.length + coachsChoisis.length + actifsEnPlus} actions={actions}>
      <FiltreMenu libelle="Responsable Régional" choisis={rrs} onChange={setRRs}
        options={[...reseau.rrs.map((r) => ({ valeur: r.id, libelle: r.nom, detail: compter((m) => m.rr?.id === r.id) })), { valeur: '__aucun__', libelle: 'Sans RR', detail: compter((m) => !m.rr) }]} />
      <FiltreMenu libelle="Coach" choisis={coachsChoisis} onChange={setCoachs}
        options={[...coachs.map((c) => ({ valeur: c, libelle: c, detail: compter((m) => coachA(m, reseau.jour) === c) })), { valeur: '__aucun__', libelle: 'Sans Coach', detail: compter((m) => !coachA(m, reseau.jour)) }]} />
      {enPlus}
      {(rrs.length > 0 || coachsChoisis.length > 0 || recherche) && <Button onClick={() => { setRRs([]); setCoachs([]); setRecherche('') }} sx={{ minHeight: 36 }}>Effacer les filtres</Button>}
    </RechercheFiltres>
  )
  return { magasins, barre: barreDe(enPlus), barreDe }
}

const niveaux = ['faible', 'moyen', 'fort']
const SURVEILLER = ['redressement', 'relance', 'renforcer']
const SOLIDES = ['locomotive', 'grandir', 'potentiel']

// Nine box : chaque case donne un nombre, une part du parc et la répartition par Coach ;
// un clic ouvre la liste des magasins de la case, regroupés par Coach (lisible même avec des centaines de magasins)
// Initiales d'un Coach (« Inès EXEMPLE » → « IE »), « SC » sans Coach
const initialesCoach = (nom: string) => (nom ? nom.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('') : 'SC')

function VueNineBox({ reseau, evaluer, surPC }: { reseau: Reseau; evaluer: () => void; surPC: boolean }) {
  const theme = useTheme()
  const { magasins, barre } = useFiltres(reseau)
  const [ouverte, setOuverte] = useState<string | null>(null)
  const [cherche, setCherche] = useState('')
  const classes = useMemo(() => magasins.map((m) => ({ m, c: caseDe(reseau.evaluations[m.nom]), coach: coachA(m, reseau.jour) })), [magasins, reseau])
  const couleurs = couleursCoachs(reseau.magasins.map((m) => coachA(m, reseau.jour)).filter(Boolean))
  const nbClasses = classes.filter((x) => x.c).length
  const compte = (ids: string[]) => classes.filter((x) => x.c && ids.includes(x.c.id)).length
  const nonClasses = classes.length - nbClasses
  const pct = (n: number, total = nbClasses) => (total ? Math.round((n / total) * 100) : 0)
  const maxCase = Math.max(1, ...nineBox.map((c) => compte([c.id])))
  const tuiles = [
    { titre: 'À surveiller', n: compte(SURVEILLER), detail: 'Redressement, relance, management à renforcer', couleur: theme.palette.error.main },
    { titre: 'Solides', n: compte(SOLIDES), detail: 'Locomotive, à faire grandir, potentiel à activer', couleur: theme.palette.success.main },
    { titre: 'Non classés', n: nonClasses, detail: 'Il manque des notes', couleur: theme.palette.text.secondary, action: nonClasses > 0 },
  ]
  const caseOuverte = nineBox.find((c) => c.id === ouverte)
  const dansCase = caseOuverte ? classes.filter((x) => x.c?.id === caseOuverte.id && (!cherche || normaliser(`${x.m.nom} ${x.m.ville} ${coachA(x.m, reseau.jour)}`).includes(normaliser(cherche)))) : []
  const groupes = [...dansCase.reduce((g, x) => g.set(x.coach || '', [...(g.get(x.coach || '') ?? []), x.m]), new Map<string, Magasin[]>())].sort((a, b) => b[1].length - a[1].length)

  return (
    <>
      {barre}
      <Box sx={{ display: 'grid', gap: { xs: 1, sm: 2 }, gridTemplateColumns: 'repeat(3, 1fr)', mb: 3 }}>
        {tuiles.map((t) => !surPC ? (
          <Card key={t.titre} sx={{ borderTop: `4px solid ${t.couleur}` }}>
            <Box component={t.action ? 'button' : 'div'} type={t.action ? 'button' : undefined} onClick={t.action ? evaluer : undefined}
              sx={{ all: 'unset', boxSizing: 'border-box', width: '100%', p: 1.5, minHeight: 48, display: 'block', textAlign: 'center', cursor: t.action ? 'pointer' : 'default' }}>
              <Typography sx={{ fontSize: 24, fontWeight: 800, color: t.couleur, lineHeight: 1.1 }}>{t.n}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.titre}</Typography>
            </Box>
          </Card>
        ) : (
          <Card key={t.titre}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 56, height: 56, borderRadius: 3, bgcolor: alpha(t.couleur, 0.12), color: t.couleur, display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 700, flexShrink: 0 }}>{t.n}</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h4" component="p">{t.titre}</Typography>
                <Typography variant="body2" color="text.secondary">{t.action ? t.detail : `${pct(t.n)} % des magasins classés`}</Typography>
              </Box>
              {t.action && <Button onClick={evaluer} sx={{ minHeight: 48 }}>Évaluer</Button>}
            </CardContent>
          </Card>
        ))}
      </Box>
      <Card sx={{ p: { xs: 1.5, md: 3 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, 1fr)', md: '28px repeat(3, 1fr)' }, gap: { xs: 1, md: 2 } }} role="table" aria-label="Nine box">
          {[3, 2, 1].map((mg) => (
            <Box key={mg} sx={{ display: 'contents' }} role="row">
              <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: 600, letterSpacing: 0.5 }}>Franchisé {niveaux[mg - 1]}</Typography>
              </Box>
              {[1, 2, 3].map((rs) => {
                const c = nineBox.find((x) => x.resultats === rs && x.management === mg)!
                const liste = classes.filter((x) => x.c?.id === c.id)
                const parCoach = [...liste.reduce((g, x) => g.set(x.coach || '', (g.get(x.coach || '') ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])
                const intensite = liste.length / maxCase
                return (
                  <Box key={c.id} role="cell" aria-label={`${c.libelle} : ${liste.length} magasin${liste.length > 1 ? 's' : ''}`}>
                    <Box component="button" type="button" onClick={() => { setOuverte(c.id); setCherche('') }} disabled={!liste.length} aria-label={`Voir les ${liste.length} magasins : ${c.libelle}`}
                      sx={{ all: 'unset', boxSizing: 'border-box', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: { xs: 0.5, md: 1 }, p: { xs: 1, md: 2 }, borderRadius: { xs: 3, md: 4 }, minHeight: { xs: 96, md: 168 }, cursor: liste.length ? 'pointer' : 'default',
                        bgcolor: liste.length ? alpha(c.couleur, 0.08 + intensite * 0.22) : 'action.hover', outline: liste.length ? `1px solid ${alpha(c.couleur, 0.45)}` : '1px solid transparent', color: liste.length ? undefined : 'text.secondary',
                        transition: 'transform .15s, box-shadow .15s', '&:hover:not(:disabled), &:focus-visible': { transform: 'translateY(-2px)', boxShadow: 4 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.couleur, flexShrink: 0 }} />
                        <Typography sx={{ fontWeight: 700, fontSize: { xs: 12, md: 15 }, flex: 1, lineHeight: 1.2 }}>{c.libelle}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                        {liste.length ? <Typography sx={{ fontSize: { xs: 32, md: 40 }, fontWeight: 800, lineHeight: 1 }}>{liste.length}</Typography>
                          : <Typography sx={{ fontSize: { xs: 16, md: 20 }, fontWeight: 600, lineHeight: 1, color: 'text.secondary' }}>0</Typography>}
                        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>{liste.length ? `${pct(liste.length)} % des classés` : 'aucun magasin'}</Typography>
                      </Box>
                      {/* Coachs en initiales sous le chiffre (plus de barre ni de bulle qui recouvrait le libellé au téléphone) */}
                      {liste.length > 0 && couleurs.size > 1 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1, rowGap: 0.25 }}>
                          {parCoach.slice(0, 3).map(([k, n]) => (
                            <Typography key={k} component="span" title={`${k || 'Sans Coach'} : ${n}`} sx={{ fontSize: 12, fontWeight: 700, color: k ? couleurs.get(k) : 'text.secondary', whiteSpace: 'nowrap' }}>
                              {initialesCoach(k)} {n}
                            </Typography>
                          ))}
                          {parCoach.length > 3 && <Typography component="span" sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>+{parCoach.length - 3}</Typography>}
                        </Box>
                      )}
                      <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.75, color: 'text.secondary', mt: 'auto' }}>
                        <EventRepeatOutlined sx={{ fontSize: 18 }} />
                        <Typography variant="body2">{c.rythme}</Typography>
                      </Box>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          ))}
          <Box sx={{ display: { xs: 'none', md: 'block' } }} />
          {niveaux.map((n) => <Typography key={n} variant="body2" color="text.secondary" sx={{ textAlign: 'center', fontWeight: 600, fontSize: { xs: 12, md: 14 } }}>Résultats {n}s</Typography>)}
        </Box>
      </Card>

      <Drawer anchor={surPC ? 'right' : 'bottom'} open={!!caseOuverte} onClose={() => setOuverte(null)} sx={{ zIndex: (t) => t.zIndex.appBar + 10 }}
        slotProps={{ paper: { sx: { width: surPC ? 440 : '100%', top: surPC ? 72 : undefined, height: surPC ? 'calc(100% - 72px)' : undefined, maxHeight: surPC ? undefined : '85dvh', borderRadius: surPC ? '16px 0 0 16px' : '16px 16px 0 0' } } }}>
        {caseOuverte && (
          <Box role="dialog" aria-label={caseOuverte.libelle} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ p: 2.5, bgcolor: alpha(caseOuverte.couleur, 0.18), display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h2" component="h2">{caseOuverte.libelle}</Typography>
                <Typography variant="body2" color="text.secondary">{dansCase.length} magasin{dansCase.length > 1 ? 's' : ''} · rythme conseillé {caseOuverte.rythme}</Typography>
              </Box>
              <IconButton onClick={() => setOuverte(null)} aria-label="Fermer"><CloseOutlined /></IconButton>
            </Box>
            <Box sx={{ p: 2, pb: 1 }}>
              <TextField fullWidth size="small" label="Chercher un magasin ou un Coach" value={cherche} onChange={(e) => setCherche(e.target.value)} sx={{ '& .MuiInputBase-root': { minHeight: 48 } }} />
            </Box>
            <Box sx={{ overflowY: 'auto', px: 2, pb: 2 }}>
              {groupes.map(([coach, ms]) => (
                <Box key={coach} sx={{ mt: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: couleurs.get(coach) ?? 'grey.500' }} />
                    <Typography sx={{ fontWeight: 700, flex: 1 }}>{coach || 'Sans Coach'}</Typography>
                    <Typography variant="body2" color="text.secondary">{ms.length}</Typography>
                  </Box>
                  {ms.map((m) => (
                    <Link key={m.nom} component={RouterLink} to={lienFiche(m.nom)} underline="none" color="inherit"
                      sx={{ display: 'flex', alignItems: 'center', minHeight: 44, px: 1.5, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}>
                      <Typography sx={{ flex: 1 }}>{m.nom}</Typography>
                      {normaliser(m.ville) !== normaliser(m.nom) && !normaliser(m.nom).startsWith(normaliser(m.ville)) && <Typography variant="body2" color="text.secondary">{m.ville}</Typography>}
                    </Link>
                  ))}
                </Box>
              ))}
              {dansCase.length === 0 && <Typography color="text.secondary" sx={{ mt: 2 }}>Aucun magasin ne correspond.</Typography>}
            </Box>
          </Box>
        )}
      </Drawer>
    </>
  )
}

// ── Sélection de plusieurs magasins et saisie groupée ──
function useSelection() {
  const [choisis, setChoisis] = useState<Set<string>>(new Set())
  const basculer = useCallback((nom: string) => setChoisis((s) => { const n = new Set(s); if (n.has(nom)) n.delete(nom); else n.add(nom); return n }), [])
  return { choisis, setChoisis, basculer }
}

function CaseTout({ magasins, choisis, setChoisis }: { magasins: Magasin[]; choisis: Set<string>; setChoisis: (s: Set<string>) => void }) {
  const tous = magasins.length > 0 && magasins.every((m) => choisis.has(m.nom))
  return <Checkbox checked={tous} indeterminate={!tous && choisis.size > 0} onChange={() => setChoisis(tous ? new Set() : new Set(magasins.map((m) => m.nom)))} slotProps={{ input: { 'aria-label': 'Sélectionner tous les magasins affichés' } }} />
}

type Cible = { type: 'note'; id: IdCritere; libelle: string } | { type: 'deploiement'; t: Thematique; libelle: string }

function BarreLot({ cibles, choisis, vider, saisie }: { cibles: Cible[]; choisis: Set<string>; vider: () => void; saisie: Saisie }) {
  const [i, setI] = useState(0)
  if (choisis.size === 0) return null
  const c = cibles[Math.min(i, cibles.length - 1)]
  const liste = [...choisis]
  return (
    <Paper elevation={6} role="region" aria-label="Saisie groupée"
      sx={{ position: 'sticky', bottom: { xs: 88, md: 16 }, zIndex: 5, mt: 2, p: 2, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', border: '2px solid', borderColor: 'secondary.main' }}>
      <Typography sx={{ fontWeight: 700 }}>{choisis.size} magasin{choisis.size > 1 ? 's' : ''} sélectionné{choisis.size > 1 ? 's' : ''}</Typography>
      <TextField select size="small" label="Appliquer à" value={i} onChange={(e) => setI(Number(e.target.value))} sx={{ minWidth: 220, '& .MuiInputBase-root': { minHeight: 48 } }}>
        {cibles.map((x, k) => <MenuItem key={k} value={k}>{x.libelle}</MenuItem>)}
      </TextField>
      {c.type === 'note'
        ? <BoutonsNote libelle={`${c.libelle} pour la sélection`} valeur={undefined} onChange={(n) => saisie.noter(liste, c.id, n)} />
        : <BoutonsOption t={c.t} libelle={`${c.libelle} pour la sélection`} valeur="" onChange={(v) => saisie.deployer(liste, c.t.id, v)} />}
      <Box sx={{ flex: 1 }} />
      <Button startIcon={<CloseOutlined />} onClick={vider} sx={{ minHeight: 48 }}>Tout désélectionner</Button>
    </Paper>
  )
}

// ── Tri et filtre par colonne du tableau (PC) ──
// rang : plus haut = meilleur ; null = non renseigné, toujours en bas de liste
// alpha : tri par ordre alphabétique (A à Z au premier clic) ; recherche : champ de recherche dans le filtre
interface Colonne { id: string; libelle: string; rang: (m: Magasin) => number | string | null; valeur: (m: Magasin) => string; options: Option[]; alpha?: boolean; recherche?: boolean }
type Tri = { id: string; sens: 'desc' | 'asc' } | null
const SANS_VALEUR = '__sans__'

function trierFiltrer(liste: Magasin[], colonnes: Colonne[], tri: Tri, filtres: Record<string, string[]>) {
  const actives = colonnes.filter((c) => filtres[c.id]?.length)
  let l = actives.length ? liste.filter((m) => actives.every((c) => filtres[c.id].includes(c.valeur(m)))) : liste
  const c = tri && colonnes.find((x) => x.id === tri.id)
  if (c) {
    const sens = tri.sens === 'desc' ? -1 : 1
    l = [...l].sort((a, b) => {
      const ra = c.rang(a), rb = c.rang(b)
      if (ra === null || rb === null) return ra === rb ? 0 : ra === null ? 1 : -1
      return (typeof ra === 'string' || typeof rb === 'string' ? String(ra).localeCompare(String(rb), 'fr') : ra - rb) * sens
    })
  }
  return l
}

function EnTeteColonne({ col, sens, trier, filtre, filtrer, compte, children }: {
  col: Colonne; sens: 'desc' | 'asc' | null; trier: () => void; filtre: string[]; filtrer: (v: string[]) => void; compte: (valeur: string) => number; children: ReactNode
}) {
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  const [q, setQ] = useState('')
  const actif = filtre.length > 0
  const options = q ? col.options.filter((o) => normaliser(o.libelle).includes(normaliser(q))) : col.options
  const titreTri = col.alpha ? (sens === 'asc' ? 'De A à Z' : sens === 'desc' ? 'De Z à A' : 'Trier') : sens === 'desc' ? 'Du plus haut au plus bas' : sens === 'asc' ? 'Du plus bas au plus haut' : 'Trier'
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
      <Tooltip title={titreTri}>
        <IconButton aria-label={`Trier par ${col.libelle}`} onClick={trier} color={sens ? 'secondary' : 'default'} sx={{ width: 40, height: 40, my: -1 }}>
          {sens === 'asc' ? <ArrowUpwardOutlined fontSize="small" /> : sens === 'desc' ? <ArrowDownwardOutlined fontSize="small" /> : <SwapVertOutlined fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Tooltip title="Filtrer">
        <IconButton aria-label={`Filtrer ${col.libelle}`} onClick={(e) => setAncre(e.currentTarget)} color={actif ? 'secondary' : 'default'} sx={{ width: 40, height: 40, my: -1 }}>
          {actif ? <FilterAlt fontSize="small" /> : <FilterAltOutlined fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Menu anchorEl={ancre} open={!!ancre} onClose={() => { setAncre(null); setQ('') }} autoFocus={!col.recherche} slotProps={{ paper: { sx: { maxHeight: 420, minWidth: 240 } } }}>
        {col.recherche && (
          <Box sx={{ px: 1.5, pb: 1 }} onKeyDown={(e) => { if (e.key !== 'Escape') e.stopPropagation() }}>
            <TextField size="small" fullWidth autoFocus placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)}
              slotProps={{ htmlInput: { 'aria-label': `Rechercher dans ${col.libelle}` }, input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} />
          </Box>
        )}
        {options.map((o) => (
          <MenuItem key={o.valeur} dense sx={{ minHeight: 44 }} onClick={() => filtrer(filtre.includes(o.valeur) ? filtre.filter((x) => x !== o.valeur) : [...filtre, o.valeur])}>
            <Checkbox checked={filtre.includes(o.valeur)} size="small" sx={{ p: 0.5, mr: 1 }} tabIndex={-1} />
            <ListItemText primary={o.libelle} />
            {!col.alpha && <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>{compte(o.valeur)}</Typography>}
          </MenuItem>
        ))}
        {actif && <MenuItem onClick={() => { filtrer([]); setAncre(null) }} sx={{ justifyContent: 'center', minHeight: 44 }}><Button size="small">Tout afficher</Button></MenuItem>}
      </Menu>
    </Box>
  )
}

// Cellule d'en-tête du tableau : titre, tri et filtre de la colonne
type EnTete = (id: string, contenu: ReactNode, sx?: SxProps<Theme>) => ReactNode

// ── Tableau (PC, à la demande) : seule la ligne modifiée se redessine ──
const LigneNotes = memo(function LigneNotes({ m, e, coche, basculer, noter }: { m: Magasin; e: Evaluation | undefined; coche: boolean; basculer: (n: string) => void; noter: Saisie['noter'] }) {
  return (
    <TableRow hover selected={coche}>
      <TableCell padding="checkbox"><Checkbox checked={coche} onChange={() => basculer(m.nom)} slotProps={{ input: { 'aria-label': `Sélectionner ${m.nom}` } }} /></TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}><Link component={RouterLink} to={lienFiche(m.nom)}>{m.nom}</Link></TableCell>
      {tousCriteres.map((c) => <TableCell key={c.id}><BoutonsNote compact libelle={`${c.libelle} de ${m.nom}`} valeur={e?.notes[c.id]} onChange={(n) => noter([m.nom], c.id, n)} /></TableCell>)}
      <TableCell><PastilleCase c={caseDe(e)} /></TableCell>
    </TableRow>
  )
})

const LigneDeploiements = memo(function LigneDeploiements({ m, valeurs, ths, coche, basculer, deployer }: { m: Magasin; valeurs: Record<string, string> | undefined; ths: Thematique[]; coche: boolean; basculer: (n: string) => void; deployer: Saisie['deployer'] }) {
  return (
    <TableRow hover selected={coche}>
      <TableCell padding="checkbox"><Checkbox checked={coche} onChange={() => basculer(m.nom)} slotProps={{ input: { 'aria-label': `Sélectionner ${m.nom}` } }} /></TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}><Link component={RouterLink} to={lienFiche(m.nom)}>{m.nom}</Link></TableCell>
      {ths.map((t) => <TableCell key={t.id}><BoutonsOption compact t={t} libelle={`${t.libelle} de ${m.nom}`} valeur={valeurs?.[t.id] ?? ''} onChange={(v) => deployer([m.nom], t.id, v)} /></TableCell>)}
    </TableRow>
  )
})

// ── Lignes : un point coloré par critère ou par thématique, la saisie s'ouvre en panneau ──
// Au-delà de 10 points (jusqu'à une vingtaine de thématiques), des points plus petits sur deux rangées de 10
function Points({ couleurs, label }: { couleurs: (string | null)[]; label: string }) {
  const serre = couleurs.length > 10
  const taille = serre ? 9 : 12
  return (
    <Box role="img" aria-label={label} sx={{ display: { xs: 'none', sm: 'grid' }, gridTemplateColumns: `repeat(${Math.min(couleurs.length, 10)}, ${taille}px)`, gap: serre ? '4px' : 0.5, flexShrink: 0 }}>
      {couleurs.map((c, i) => <Box key={i} sx={{ width: taille, height: taille, borderRadius: '50%', bgcolor: c ?? 'transparent', border: c ? 0 : '1.5px solid', borderColor: 'divider' }} />)}
    </Box>
  )
}

const LigneSaisie = memo(function LigneSaisie({ m, detail, fin, coche, basculer, ouvrir, selection }: { m: Magasin; detail: string; fin: ReactNode; coche: boolean; basculer: (n: string) => void; ouvrir: (n: string) => void; selection: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: coche ? 'action.selected' : undefined }}>
      {selection && <Checkbox checked={coche} onChange={() => basculer(m.nom)} sx={{ ml: 0.5, width: 48, height: 48 }} slotProps={{ input: { 'aria-label': `Sélectionner ${m.nom}` } }} />}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex' }}>
        <LigneCompacte onClick={() => ouvrir(m.nom)} label={`Saisir ${m.nom}`} avatar={<Initiales nom={m.nom} />} titre={m.nom} detail={detail} fin={fin} />
      </Box>
    </Box>
  )
})

// Panneau de saisie d'un magasin, avec « Précédent » et « Magasin suivant » dans la liste affichée
function PanneauSaisie({ reseau, liste, nom, aller, fermer, saisie, partie, surPC }: { reseau: Reseau; liste: Magasin[]; nom: string | null; aller: (nom: string) => void; fermer: () => void; saisie: Saisie; partie: 'notes' | 'deploiements'; surPC: boolean }) {
  const i = liste.findIndex((m) => m.nom === nom)
  const m = i >= 0 ? liste[i] : null
  const e = m ? reseau.evaluations[m.nom] : undefined
  return (
    <Drawer anchor={surPC ? 'right' : 'bottom'} open={!!m} onClose={fermer} sx={{ zIndex: (t) => t.zIndex.appBar + 10 }}
      slotProps={{ paper: { sx: { width: surPC ? 520 : '100%', top: surPC ? 72 : undefined, height: surPC ? 'calc(100% - 72px)' : undefined, maxHeight: surPC ? undefined : '90dvh', borderRadius: surPC ? '16px 0 0 16px' : '16px 16px 0 0' } } }}>
      {m && (
        <Box role="dialog" aria-label={m.nom} sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Initiales nom={m.nom} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Link component={RouterLink} to={lienFiche(m.nom)} color="inherit" sx={{ fontWeight: 600, display: 'block' }} noWrap>{m.nom}</Link>
              <Typography variant="body2" color="text.secondary" noWrap>{coachA(m, reseau.jour) || 'Sans Coach'} · {i + 1} sur {liste.length}</Typography>
            </Box>
            {partie === 'notes' && <PastilleCase c={caseDe(e)} />}
            <IconButton onClick={fermer} aria-label="Fermer" sx={{ width: 48, height: 48 }}><CloseOutlined /></IconButton>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2 }}>
            {partie === 'notes'
              ? <NotesParAxe integre={!m.franchise} notes={e?.notes} noter={(id, n) => saisie.noter([m.nom], id, n)} libelleMagasin={m.nom} colonnes={1} />
              : reseau.deploiements.thematiques.map((t) => (
                <Box key={t.id} sx={{ mb: 2, overflowX: 'auto' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{t.libelle}</Typography>
                  <BoutonsOption t={t} libelle={`${t.libelle} de ${m.nom}`} valeur={reseau.deploiements.valeurs[m.nom]?.[t.id] ?? ''} onChange={(v) => saisie.deployer([m.nom], t.id, v)} />
                </Box>
              ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button variant="outlined" startIcon={<ArrowBackOutlined />} disabled={i === 0} onClick={() => aller(liste[i - 1].nom)} sx={{ minHeight: 48 }}>Précédent</Button>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" endIcon={<ArrowForwardOutlined />} disabled={i >= liste.length - 1} onClick={() => aller(liste[i + 1].nom)} sx={{ minHeight: 48 }}>Magasin suivant</Button>
          </Box>
        </Box>
      )}
    </Drawer>
  )
}

type Etat = 'tous' | 'completer'

// Liste commune d'Évaluer et de Déploiements : puces « Tous / À compléter », lignes par tranches, tableau à la demande sur PC
type Tableau = (p: { visibles: Magasin[]; sel: ReturnType<typeof useSelection>; entete: EnTete }) => ReactNode

function ListeSaisie({ reseau, magasins, incomplet, partie, saisie, surPC, ligne, tableau, cibles, colonnes }: {
  reseau: Reseau; magasins: Magasin[]; incomplet: (m: Magasin) => boolean; partie: 'notes' | 'deploiements'; saisie: Saisie; surPC: boolean
  ligne: (m: Magasin) => { detail: string; fin: ReactNode }; tableau: Tableau; cibles: Cible[]; colonnes: Colonne[]
}) {
  const [etat, setEtat] = useState<Etat>('tous')
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [affichage, setAffichage] = useAffichage(partie === 'notes' ? 'evaluer' : 'deploiements')
  const sel = useSelection()
  const aCompleter = useMemo(() => magasins.filter(incomplet), [magasins, reseau.evaluations, reseau.deploiements]) // eslint-disable-line react-hooks/exhaustive-deps
  // La liste du panneau reste figée tant qu'il est ouvert, pour ne pas faire sauter le magasin en cours
  const [figee, setFigee] = useState<Magasin[]>([])
  const tableauVisible = surPC && affichage === 'tableau'
  // Tri et filtres par colonne : tableau seulement
  const [tri, setTri] = useState<Tri>(null)
  const [filtres, setFiltres] = useState<Record<string, string[]>>({})
  const base = etat === 'completer' ? aCompleter : magasins
  // Première colonne : le magasin, trié de A à Z et filtré par nom
  const toutes = useMemo<Colonne[]>(() => [{ id: 'magasin', libelle: 'Magasin', alpha: true, recherche: true,
    options: base.map((m) => ({ valeur: m.nom, libelle: m.nom })), rang: (m) => m.nom, valeur: (m) => m.nom }, ...colonnes], [base, colonnes])
  const liste = useMemo(() => (tableauVisible ? trierFiltrer(base, toutes, tri, filtres) : base), [base, toutes, tri, filtres, tableauVisible])
  const filtresActifs = Object.values(filtres).some((f) => f.length > 0)
  const { visibles, suite } = useParTranches(liste, `${etat}|${liste.length}|${magasins.map((m) => m.nom).join(',').length}|${tableauVisible ? JSON.stringify(filtres) : ''}`)
  const ouvrir = useCallback((nom: string) => { setFigee(liste); setOuvert(nom) }, [liste])
  const entete: EnTete = (id, contenu, sx) => {
    const col = toutes.find((c) => c.id === id)
    if (!col) return <TableCell key={id} sx={sx}>{contenu}</TableCell>
    const sens = tri?.id === id ? tri.sens : null
    return (
      <TableCell key={id} sx={sx} aria-sort={sens === 'desc' ? 'descending' : sens === 'asc' ? 'ascending' : undefined}>
        <EnTeteColonne col={col} sens={sens} trier={() => { const premier = col.alpha ? 'asc' : 'desc'; setTri(sens === null ? { id, sens: premier } : sens === premier ? { id, sens: premier === 'asc' ? 'desc' : 'asc' } : null) }}
          filtre={filtres[id] ?? []} filtrer={(v) => setFiltres((f) => ({ ...f, [id]: v }))} compte={(v) => base.filter((m) => col.valeur(m) === v).length}>
          {contenu}
        </EnTeteColonne>
      </TableCell>
    )
  }
  // « Voir plus » reste sous le tableau ; le cadre défile jusqu'aux lignes ajoutées
  const cadre = useRef<HTMLDivElement>(null)
  const avant = useRef(visibles.length)
  useEffect(() => {
    const n = avant.current
    avant.current = visibles.length
    if (!tableauVisible || visibles.length <= n || n === 0) return
    const zone = cadre.current?.querySelector<HTMLElement>('.MuiTableContainer-root')
    const ligne = zone?.querySelectorAll<HTMLElement>('tbody tr')[n]
    const entete = zone?.querySelector('thead')
    if (zone && ligne) zone.scrollTop += ligne.getBoundingClientRect().top - zone.getBoundingClientRect().top - (entete?.getBoundingClientRect().height ?? 0)
  }, [visibles.length, tableauVisible])
  // Tous les magasins écartés par les filtres : message sous le tableau, hors de la zone qui défile
  const aucun = tableauVisible && base.length > 0 && liste.length === 0 && (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Typography sx={{ mb: 1 }}>Aucun magasin ne correspond à ces filtres.</Typography>
      <Button variant="outlined" onClick={() => setFiltres({})} sx={{ minHeight: 48 }}>Effacer les filtres</Button>
    </Box>
  )
  return (
    <>
      <Puces label="Magasins à afficher" valeur={etat} onChange={setEtat} options={[
        { v: 'tous', libelle: `Tous · ${magasins.length}` },
        { v: 'completer', libelle: `À compléter · ${aCompleter.length}` },
      ]} />
      <TitreSection nombre={liste.length} action={<>
        {surPC && tableauVisible && (tri || filtresActifs) && <Button onClick={() => { setTri(null); setFiltres({}) }} sx={{ minHeight: 40 }}>Effacer tri et filtres</Button>}
        {surPC && <ChoixAffichage valeur={affichage} onChange={setAffichage} />}
      </>}>Magasins</TitreSection>
      {base.length === 0 ? <EmptyState icone={<SearchOffOutlined />} titre={etat === 'completer' ? 'Rien à compléter' : 'Aucun magasin'} texte={etat === 'completer' ? 'Tous les magasins affichés sont renseignés.' : 'Aucun magasin ne correspond à ces filtres.'} />
        : tableauVisible ? <Box ref={cadre}>{tableau({ visibles, sel, entete })}</Box> : (
          <CarteLignes label={partie === 'notes' ? 'Évaluation des magasins' : 'Déploiements par magasin'}>
            {visibles.map((m) => { const l = ligne(m); return <LigneSaisie key={m.nom} m={m} detail={l.detail} fin={l.fin} coche={sel.choisis.has(m.nom)} basculer={sel.basculer} ouvrir={ouvrir} selection={surPC} /> })}
          </CarteLignes>
        )}
      {aucun}
      {suite}
      <BarreLot cibles={cibles} choisis={sel.choisis} vider={() => sel.setChoisis(new Set())} saisie={saisie} />
      <PanneauSaisie reseau={reseau} liste={figee} nom={ouvert} aller={setOuvert} fermer={() => setOuvert(null)} saisie={saisie} partie={partie} surPC={surPC} />
    </>
  )
}

const rangTon = { positif: 3, partiel: 2, negatif: 1 } as const
const couleurNotePoint: Record<number, string> = { 0: 'info.main', 1: 'error.main', 2: 'warning.main', 3: 'success.main' }

function VueEvaluer({ reseau, saisie, surPC, date }: { reseau: Reseau; saisie: Saisie & { version: number }; surPC: boolean; date: ReactNode }) {
  const { magasins, barre } = useFiltres(reseau, date)
  const cibles: Cible[] = tousCriteres.map((c) => ({ type: 'note', id: c.id, libelle: c.libelle }))
  const incomplet = (m: Magasin) => tousCriteres.some((c) => reseau.evaluations[m.nom]?.notes[c.id] === undefined)
  const colonnes = useMemo<Colonne[]>(() => {
    const options: Option[] = [...([3, 2, 1, 0] as const).map((n) => ({ valeur: String(n), libelle: libelleNote[n] })), { valeur: SANS_VALEUR, libelle: 'Non noté' }]
    const cases = [...nineBox].sort((a, b) => b.resultats + b.management - (a.resultats + a.management) || b.resultats - a.resultats)
    return [
      // « Non concerné » n'est pas une note basse : rangé avec les non notés
      ...tousCriteres.map((c) => ({ id: c.id, libelle: c.libelle, options,
        rang: (m: Magasin) => reseau.evaluations[m.nom]?.notes[c.id] || null,
        valeur: (m: Magasin) => String(reseau.evaluations[m.nom]?.notes[c.id] ?? SANS_VALEUR) })),
      { id: 'case', libelle: 'Case', options: [...cases.map((c) => ({ valeur: c.id, libelle: c.libelle })), { valeur: SANS_VALEUR, libelle: 'Non classé' }],
        rang: (m: Magasin) => { const c = caseDe(reseau.evaluations[m.nom]); return c ? (c.resultats + c.management) * 10 + c.resultats : null },
        valeur: (m: Magasin) => caseDe(reseau.evaluations[m.nom])?.id ?? SANS_VALEUR },
    ]
  }, [reseau.evaluations])
  return (
    <>
      {barre}
      <ListeSaisie reseau={reseau} magasins={magasins} incomplet={incomplet} partie="notes" saisie={saisie} surPC={surPC} cibles={cibles} colonnes={colonnes}
        ligne={(m) => {
          const e = reseau.evaluations[m.nom]
          const n = tousCriteres.filter((c) => e?.notes[c.id] !== undefined).length
          const c = caseDe(e)
          return {
            detail: [coachA(m, reseau.jour) || 'Sans Coach', `${n} note${n > 1 ? 's' : ''} sur ${tousCriteres.length}`].join(' · '),
            fin: <>
              <Points label={`${n} notes sur ${tousCriteres.length}`} couleurs={tousCriteres.map((x) => { const v = e?.notes[x.id]; return v === undefined ? null : couleurNotePoint[v] })} />
              {c ? <Box component="span" sx={{ flexShrink: 0, px: 1.25, py: 0.5, borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', bgcolor: c.couleur, color: texteSur(c.couleur) }}>{c.libelle}</Box> : <Pastille ton="gris">Non classé</Pastille>}
            </>,
          }
        }}
        tableau={({ visibles, sel, entete }) => (
          <TableContainer component={Card}>
            <Table size="small" className="deux-colonnes-fixes" aria-label="Évaluation des magasins">
              <TableHead>
                <TableRow>
                  <TableCell colSpan={2} />
                  {(['resultats', 'franchise'] as const).map((axe) => <TableCell key={axe} colSpan={criteresAxe(axe).length} sx={{ fontWeight: 700, borderLeft: 1, borderColor: 'divider' }}>{libelleAxe(axe)}</TableCell>)}
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell padding="checkbox"><CaseTout magasins={visibles} {...sel} /></TableCell>
                  {entete('magasin', 'Magasin', { minWidth: 200 })}
                  {tousCriteres.map((c) => entete(c.id, <LibelleCritere c={c} />, { minWidth: 220 }))}
                  {entete('case', 'Case', { minWidth: 170 })}
                </TableRow>
              </TableHead>
              <TableBody>
                {visibles.map((m) => <LigneNotes key={m.nom} m={m} e={reseau.evaluations[m.nom]} coche={sel.choisis.has(m.nom)} basculer={sel.basculer} noter={saisie.noter} />)}
              </TableBody>
            </Table>
          </TableContainer>
        )} />
    </>
  )
}

function VueDeploiements({ reseau, saisie, surPC, date }: { reseau: Reseau; saisie: Saisie & { version: number }; surPC: boolean; date: ReactNode }) {
  const { magasins, barre } = useFiltres(reseau, date)
  const ths = reseau.deploiements.thematiques
  const cibles: Cible[] = ths.map((t) => ({ type: 'deploiement', t, libelle: t.libelle }))
  const incomplet = (m: Magasin) => ths.some((t) => !reseau.deploiements.valeurs[m.nom]?.[t.id])
  const colonnes = useMemo<Colonne[]>(() => ths.map((t) => ({ id: t.id, libelle: t.libelle,
    options: [...t.options.map((o) => ({ valeur: o.libelle, libelle: o.libelle })), { valeur: SANS_VALEUR, libelle: 'Non renseigné' }],
    rang: (m: Magasin) => { const ton = tonDe(t, reseau.deploiements.valeurs[m.nom]?.[t.id]); return ton ? rangTon[ton] : null },
    valeur: (m: Magasin) => { const v = reseau.deploiements.valeurs[m.nom]?.[t.id]; return v && t.options.some((o) => o.libelle === v) ? v : SANS_VALEUR },
  })), [ths, reseau.deploiements.valeurs])
  if (!ths.length) return <>{barre}<EmptyState icone={<RocketLaunchOutlined />} titre="Aucune thématique de déploiement" texte="Les thématiques se créent dans les Paramètres." /></>
  return (
    <>
      {barre}
      <AvancementThematiques reseau={reseau} ths={ths} surPC={surPC} />
      <Box sx={{ mt: 2 }} />
      <ListeSaisie reseau={reseau} magasins={magasins} incomplet={incomplet} partie="deploiements" saisie={saisie} surPC={surPC} cibles={cibles} colonnes={colonnes}
        ligne={(m) => {
          const v = reseau.deploiements.valeurs[m.nom]
          const tonsM = ths.map((t) => tonDe(t, v?.[t.id]))
          const faits = tonsM.filter((x) => x === 'positif').length
          return {
            detail: [coachA(m, reseau.jour) || 'Sans Coach', `${faits} sur ${ths.length} déployé${faits > 1 ? 's' : ''}`].join(' · '),
            fin: <Points label={`${faits} thématiques déployées sur ${ths.length}`} couleurs={tonsM.map((x) => (x ? `${couleurTon[x]}.main` : null))} />,
          }
        }}
        tableau={({ visibles, sel, entete }) => (
          <TableContainer component={Card}>
            <Table size="small" className="deux-colonnes-fixes" aria-label="Déploiements par magasin">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox"><CaseTout magasins={visibles} {...sel} /></TableCell>
                  {entete('magasin', 'Magasin', { minWidth: 200 })}
                  {ths.map((t) => entete(t.id, t.libelle, { minWidth: 200 }))}
                </TableRow>
              </TableHead>
              <TableBody>
                {visibles.map((m) => <LigneDeploiements key={m.nom} m={m} valeurs={reseau.deploiements.valeurs[m.nom]} ths={ths} coche={sel.choisis.has(m.nom)} basculer={sel.basculer} deployer={saisie.deployer} />)}
              </TableBody>
            </Table>
          </TableContainer>
        )} />
    </>
  )
}

// Une ligne par thématique : nombre de magasins déployés et barre d'avancement
function Avancement({ reseau, t }: { reseau: Reseau; t: Thematique }) {
  const a = avancement(reseau, t)
  const pct = (n: number) => (a.total ? (n / a.total) * 100 : 0)
  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.75 }}>
        <Typography sx={{ fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>{t.libelle}</Typography>
        <Typography sx={{ fontWeight: 700 }}>{a.total ? Math.round(pct(a.positif)) : 0} %</Typography>
      </Box>
      <Box sx={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', bgcolor: 'action.hover' }} role="img" aria-label={`${t.libelle} : ${a.positif} magasins sur ${a.total}`}>
        <Box sx={{ width: `${pct(a.positif)}%`, bgcolor: 'success.main' }} />
        <Box sx={{ width: `${pct(a.partiel)}%`, bgcolor: 'warning.main' }} />
        <Box sx={{ width: `${pct(a.negatif)}%`, bgcolor: 'error.light' }} />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{a.positif} sur {a.total} · {a.partiel} en partie · {a.inconnu} non renseigné{a.inconnu > 1 ? 's' : ''}</Typography>
    </Box>
  )
}

// Avancement de chaque thématique : en grille sur PC ; sur téléphone, les 5 premières puis le reste à la demande
const AVANCEMENT_TELEPHONE = 5
function AvancementThematiques({ reseau, ths, surPC }: { reseau: Reseau; ths: Thematique[]; surPC: boolean }) {
  const [tout, setTout] = useState(false)
  const visibles = surPC || tout ? ths : ths.slice(0, AVANCEMENT_TELEPHONE)
  return (
    <>
      <TitreSection nombre={ths.length}>Avancement</TitreSection>
      <Card component="section" aria-label="Avancement des déploiements" sx={{ overflow: 'hidden', border: 0 }}>
        <Box sx={{ mt: '-1px', '& > *': { borderTop: '1px solid', borderColor: 'divider' }, display: 'grid', columnGap: 2, gridTemplateColumns: { xs: '1fr', md: ths.length > 4 ? 'repeat(2, 1fr)' : '1fr', xl: ths.length > 8 ? 'repeat(3, 1fr)' : ths.length > 4 ? 'repeat(2, 1fr)' : '1fr' } }}>
          {visibles.map((t) => <Avancement key={t.id} reseau={reseau} t={t} />)}
        </Box>
        {visibles.length < ths.length && (
          <Button fullWidth onClick={() => setTout(true)} endIcon={<ExpandMoreOutlined />} sx={{ minHeight: 48, borderTop: '1px solid', borderColor: 'divider', borderRadius: 0 }}>
            Voir les {ths.length} thématiques
          </Button>
        )}
      </Card>
    </>
  )
}

// Date à laquelle les notes et déploiements saisis prennent effet
function ChampDate({ valeur, max, onChange }: { valeur: string; max: string; onChange: (v: string) => void }) {
  return (
    <TextField type="date" size="small" label="Date des changements" value={valeur} onChange={(e) => onChange(e.target.value || max)}
      slotProps={{ inputLabel: { shrink: true }, htmlInput: { max } }} sx={{ minWidth: 200, '& .MuiInputBase-root': { minHeight: 48 } }} />
  )
}

export function SanteParc() {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const [params, setParams] = useSearchParams()
  const vue = ['evaluer', 'deploiements', 'chiffres'].includes(params.get('vue') ?? '') ? params.get('vue')! : 'ninebox'
  return (
    <AvecReseau>
      {(reseau) => <Contenu reseau={reseau} vue={vue} surPC={surPC} aller={(v) => setParams({ vue: v }, { replace: true })} />}
    </AvecReseau>
  )
}

function Contenu({ reseau, vue, surPC, aller }: { reseau: Reseau; vue: string; surPC: boolean; aller: (v: string) => void }) {
  const [message, setMessage] = useState('')
  const [date, setDate] = useState(reseau.jour)
  const saisie = useSaisieSante(reseau, setMessage, date)
  const actifs = reseau.magasins.filter((m) => m.statut !== 'avenir')
  const classes = actifs.filter((m) => caseDe(reseau.evaluations[m.nom])).length
  const champDate = <ChampDate valeur={date} max={reseau.jour} onChange={setDate} />
  return (
    <>
      <PageHeader titre="Santé du parc" sousTitre={`${classes} magasin${classes > 1 ? 's' : ''} classé${classes > 1 ? 's' : ''} sur ${actifs.length}`} />
      <Onglets valeur={vue} onChange={aller} libelle="Rubriques de la santé du parc" rubriques={[
        { vue: 'ninebox', libelle: 'Nine box', icone: <GridViewOutlined /> },
        { vue: 'evaluer', libelle: 'Évaluer', icone: <FactCheckOutlined /> },
        { vue: 'deploiements', libelle: 'Déploiements', icone: <RocketLaunchOutlined /> },
        { vue: 'chiffres', libelle: 'Chiffres', icone: <QueryStatsOutlined /> },
      ]} />
      {vue === 'ninebox' && <VueNineBox reseau={reseau} evaluer={() => aller('evaluer')} surPC={surPC} />}
      {vue === 'evaluer' && <VueEvaluer reseau={reseau} saisie={saisie} surPC={surPC} date={champDate} />}
      {vue === 'deploiements' && <VueDeploiements reseau={reseau} saisie={saisie} surPC={surPC} date={champDate} />}
      {vue === 'chiffres' && <VueChiffres reseau={reseau} surPC={surPC} />}
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </>
  )
}

// ── Chiffres : les chiffres de la fiche magasin et l'alerte de décrochage ──
const ordreAlerte: (StatutAlerte | null)[] = ['decroche', 'surveiller', 'ok', null]

function VueChiffres({ reseau, surPC }: { reseau: Reseau; surPC: boolean }) {
  const theme = useTheme()
  const { magasins, barreDe } = useFiltres(reseau)
  const [statuts, setStatuts] = useState<string[]>([])
  const [affichage, setAffichage] = useAffichage('chiffres')
  const lignes = useMemo(() => magasins.map((m) => ({ m, a: analyserCA(reseau, m.nom), coach: coachA(m, reseau.jour), hygiene: dernierAudit(reseau, m.nom, 'hygiene'), excellence: dernierAudit(reseau, m.nom, 'excellence') }))
    .sort((x, y) => ordreAlerte.indexOf(x.a?.statut ?? null) - ordreAlerte.indexOf(y.a?.statut ?? null) || (x.a?.ecart ?? 0) - (y.a?.ecart ?? 0) || x.m.nom.localeCompare(y.m.nom, 'fr')), [magasins, reseau])
  const compte = (st: StatutAlerte | null) => lignes.filter((l) => (l.a?.statut ?? null) === st).length
  const visibles = lignes.filter((l) => !statuts.length || statuts.includes(l.a?.statut ?? 'sans'))
  const audits = lignes.flatMap((l) => [l.hygiene, l.excellence]).filter((x) => x && x.conforme !== null)
  const conformes = audits.filter((x) => x!.conforme).length
  const { seuilDecroche, seuilSurveiller, moisReference } = reseau.seuils
  const sansChiffres = lignes.filter((l) => !l.a).length
  const tuiles = [
    { id: 'decroche', titre: 'Décroche', n: compte('decroche'), couleur: theme.palette.error.main, detail: `CA sous −${seuilDecroche} %` },
    { id: 'surveiller', titre: 'À surveiller', n: compte('surveiller'), couleur: theme.palette.warning.main, detail: `CA sous −${seuilSurveiller} %` },
    { id: 'ok', titre: 'OK', n: compte('ok'), couleur: theme.palette.success.main, detail: `CA au-dessus de −${seuilSurveiller} %` },
    { id: 'sans', titre: 'Sans comparaison', n: compte(null), couleur: theme.palette.text.secondary, detail: sansChiffres ? `Dont ${sansChiffres} sans chiffres` : 'Mois de comparaison manquant' },
  ]
  const reference = moisReference === 1 ? 'mois précédent' : 'même mois l’an dernier'
  const enTetes = ['Magasin', 'Coach', 'Mois', 'CA cumulé', `Écart vs ${reference}`, 'Flux cumulé', 'Panier moyen', 'Marge', 'CA marché extérieur', 'Alerte', 'Audits']
  return (
    <>
      {barreDe(<FiltreMenu libelle="Alerte" choisis={statuts} onChange={setStatuts} options={tuiles.map((t) => ({ valeur: t.id, libelle: t.titre, detail: `${t.n} magasins` }))} />,
        statuts.length, surPC ? <ChoixAffichage valeur={affichage} onChange={setAffichage} /> : undefined)}
      <Box sx={{ display: 'grid', gap: { xs: 1, sm: 2 }, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, mb: 2 }}>
        {tuiles.map((t) => (
          <Card key={t.id} sx={{ borderTop: `4px solid ${t.couleur}` }}>
            <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
              <Typography sx={{ fontSize: { xs: 24, md: 32 }, fontWeight: 800, color: t.couleur, lineHeight: 1.1 }}>{t.n}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.titre}</Typography>
              <Typography variant="body2" color="text.secondary">{t.detail}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {`Audits conformes : ${audits.length ? `${conformes} sur ${audits.length} (${Math.round((conformes / audits.length) * 100)} %)` : 'aucun résultat saisi'}`}
      </Typography>
      {visibles.length === 0 ? <EmptyState icone={<SearchOffOutlined />} titre="Aucun magasin" texte="Aucun magasin ne correspond à ces filtres." /> : surPC && affichage === 'tableau' ? (
        <TableContainer component={Paper}>
          <Table size="small" className="colonne-fixe" aria-label="Chiffres des magasins">
            <TableHead>
              <TableRow>
                {enTetes.map((h) => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {visibles.map(({ m, a, coach, hygiene, excellence }) => (
                <TableRow key={m.nom} hover>
                  <TableCell><Link component={RouterLink} to={lienFiche(m.nom)} sx={{ fontWeight: 600 }}>{m.nom}</Link></TableCell>
                  <TableCell>{coach || 'Sans Coach'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{a ? libelleMoisCourt(a.mois) : '—'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatEuros(a?.ca ?? null)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{a?.ecart === null || !a ? '—' : <Tooltip title={`${libelleMois(a.reference)} : ${formatEuros(a.caReference)}`}><span>{formatPourcent(a.ecart)}</span></Tooltip>}</TableCell>
                  <TableCell>{formatValeur('tickets', a?.chiffre.tickets ?? null)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatValeur('panier', a?.chiffre.panier ?? null)}</TableCell>
                  <TableCell>{formatValeur('marge', a?.chiffre.marge ?? null)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatEuros(a?.chiffre.caExt ?? null)}</TableCell>
                  <TableCell><PastilleAlerte statut={a?.statut ?? null} /></TableCell>
                  <TableCell>{[hygiene && `Hygiène : ${libelleAudit(hygiene)}`, excellence && `Excellence : ${libelleAudit(excellence)}`].filter(Boolean).join(' · ') || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <LignesChiffres reseau={reseau} lignes={visibles} />
      )}
    </>
  )
}

// Une ligne par magasin : mini-courbe sur 12 mois, chiffre du mois en grand, écart en couleur ; les magasins sans chiffres sont repliés
function LignesChiffres({ reseau, lignes }: { reseau: Reseau; lignes: { m: Magasin; a: ReturnType<typeof analyserCA>; coach: string }[] }) {
  const theme = useTheme()
  const [ouvert, setOuvert] = useState(false)
  const [nb, setNb] = useState(50)
  const avec = lignes.filter((l) => l.a)
  const sans = lignes.filter((l) => !l.a)
  const couleur = (a: NonNullable<ReturnType<typeof analyserCA>>) => a.statut === 'decroche' ? theme.palette.error.main : a.statut === 'surveiller' ? theme.palette.warning.dark : a.statut === 'ok' ? theme.palette.success.main : theme.palette.text.secondary
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <CarteLignes label="Chiffres des magasins">
        {avec.slice(0, nb).map(({ m, a, coach }) => (
          <LigneCompacte key={m.nom} lien={lienFiche(m.nom)} avatar={<Initiales nom={m.nom} />} titre={m.nom}
            detail={[coach || 'Sans Coach', libelleMois(a!.mois)].join(' · ')}
            fin={<>
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}><MiniCourbe valeurs={courbeCA(reseau, m.nom, a!.mois)} couleur={couleur(a!)} label={`Chiffre d'affaires de ${m.nom} sur 12 mois`} /></Box>
              <Box sx={{ textAlign: 'right', minWidth: 72 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.2 }}>{formatKEuros(a!.ca)}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: couleur(a!) }}>{formatPourcent(a!.ecart)}</Typography>
              </Box>
            </>} />
        ))}
        {sans.length > 0 && (
          <LigneCompacte onClick={() => setOuvert(!ouvert)} label={ouvert ? 'Replier les magasins sans chiffres' : 'Voir les magasins sans chiffres'}
            avatar={<Initiales nom="sans" icone={<QueryStatsOutlined />} couleur={theme.palette.text.secondary} />}
            titre={`${sans.length} magasin${sans.length > 1 ? 's' : ''} sans chiffres`} fin={ouvert ? <ExpandLessOutlined /> : <ExpandMoreOutlined />} />
        )}
        {ouvert && sans.map(({ m, coach }) => (
          <LigneCompacte key={m.nom} lien={lienFiche(m.nom)} avatar={<Initiales nom={m.nom} />} titre={m.nom} detail={coach || 'Sans Coach'} />
        ))}
      </CarteLignes>
      {nb < avec.length && <Button variant="outlined" onClick={() => setNb(nb + 50)} sx={{ alignSelf: 'center', minHeight: 48 }}>Afficher {Math.min(50, avec.length - nb)} magasins de plus</Button>}
    </Box>
  )
}
