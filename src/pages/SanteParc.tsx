import type { ReactNode } from 'react'
import { normaliser } from '../data/filtres'
import { memo, useCallback, useMemo, useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Snackbar from '@mui/material/Snackbar'
import Switch from '@mui/material/Switch'
import Tab from '@mui/material/Tab'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tabs from '@mui/material/Tabs'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { alpha, useTheme } from '@mui/material/styles'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import EventRepeatOutlined from '@mui/icons-material/EventRepeatOutlined'
import TableRowsOutlined from '@mui/icons-material/TableRowsOutlined'
import ViewAgendaOutlined from '@mui/icons-material/ViewAgendaOutlined'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined'
import SearchOffOutlined from '@mui/icons-material/SearchOffOutlined'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { Fenetre } from '../components/EditionEquipe'
import { RechercheFiltres } from '../components/RechercheFiltres'
import { FiltreMenu } from '../components/FiltreMenu'
import InputAdornment from '@mui/material/InputAdornment'
import SearchIcon from '@mui/icons-material/Search'
import { BoutonsNote, BoutonsOption, PastilleCase, couleursCoachs, useSaisieSante, type Saisie } from '../components/Sante'
import { coachA } from '../data/charge'
import { effacerToutesEvaluations, enregistrerDeploiements, enregistrerThematiques, importerHistorique } from '../data/chargement'
import { useReseau } from '../data/ReseauContext'
import { messageErreur } from '../components/EditionEquipe'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import { analyser, lireFichier, type ResultatImport } from '../data/import'
import { avancement, caseDe, nineBox, tousCriteres, type Evaluation, type IdCritere, type Thematique, type Ton } from '../data/sante'
import { dateCourte, lienFiche } from '../lib/format'
import { PastilleAlerte, PastilleAppel } from '../components/Chiffres'
import { analyser as analyserCA, completerChiffres, libellesChiffres, dernierAudit, formatPoints, formatPourcent, libelleAudit, libelleMois, libelleMoisCourt, moisPrecedent, suiviAlerte, type StatutAlerte } from '../data/chiffres'
import { analyserChiffres, type ResultatImportChiffres } from '../data/importChiffres'
import { enregistrerChiffres } from '../data/chargement'
import type { Magasin, Reseau } from '../data/modele'

// Filtres communs : recherche, Responsable Régional, Coach
function useFiltres(reseau: Reseau) {
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
  const theme = useTheme()
  const telephone = !useMediaQuery(theme.breakpoints.up('sm'), { noSsr: true })
  const champ = (
      <Autocomplete freeSolo options={options} groupBy={(o) => o.coach || 'Sans Coach'} getOptionLabel={(o) => (typeof o === 'string' ? o : o.nom)}
        inputValue={recherche} onInputChange={(_e, v) => setRecherche(v)} size="small"
        filterOptions={(os, { inputValue }) => { const q = inputValue.toLowerCase(); return os.filter((o) => !q || o.nom.toLowerCase().includes(q) || o.coach.toLowerCase().includes(q)) }}
        sx={{ width: { xs: '100%', md: 320 } }}
        renderInput={(p) => <TextField {...p} placeholder="Rechercher un magasin ou un Coach"
          slotProps={{ ...p.slotProps, htmlInput: { ...p.slotProps.htmlInput, 'aria-label': 'Rechercher un magasin ou un Coach' }, input: { ...p.slotProps.input, startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 999, minHeight: telephone ? 48 : 40 } }} />} />
  )
  const compter = (p: (m: Reseau['magasins'][number]) => boolean) => `${actifsMag.filter(p).length} magasins`
  const barre = (
    <RechercheFiltres recherche={champ} actifs={rrs.length + coachsChoisis.length} pc={(r, f) => <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>{r}{f}</Box>}>
      <FiltreMenu libelle="Responsable Régional" choisis={rrs} onChange={setRRs}
        options={[...reseau.rrs.map((r) => ({ valeur: r.id, libelle: r.nom, detail: compter((m) => m.rr?.id === r.id) })), { valeur: '__aucun__', libelle: 'Sans RR', detail: compter((m) => !m.rr) }]} />
      <FiltreMenu libelle="Coach" choisis={coachsChoisis} onChange={setCoachs}
        options={[...coachs.map((c) => ({ valeur: c, libelle: c, detail: compter((m) => coachA(m, reseau.jour) === c) })), { valeur: '__aucun__', libelle: 'Sans Coach', detail: compter((m) => !coachA(m, reseau.jour)) }]} />
      {(rrs.length > 0 || coachsChoisis.length > 0 || recherche) && <Button onClick={() => { setRRs([]); setCoachs([]); setRecherche('') }} sx={{ minHeight: 36 }}>Effacer les filtres</Button>}
    </RechercheFiltres>
  )
  return { magasins, barre }
}

const niveaux = ['faible', 'moyen', 'fort']
const SURVEILLER = ['redressement', 'relance', 'renforcer']
const SOLIDES = ['locomotive', 'grandir', 'potentiel']

// Nine box : chaque case donne un nombre, une part du parc et la répartition par Coach ;
// un clic ouvre la liste des magasins de la case, regroupés par Coach (lisible même avec des centaines de magasins)
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
                        bgcolor: liste.length ? alpha(c.couleur, 0.08 + intensite * 0.22) : 'action.hover', outline: `1px solid ${alpha(c.couleur, liste.length ? 0.45 : 0.15)}`,
                        transition: 'transform .15s, box-shadow .15s', '&:hover:not(:disabled), &:focus-visible': { transform: 'translateY(-2px)', boxShadow: 4 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.couleur, flexShrink: 0 }} />
                        <Typography sx={{ fontWeight: 700, fontSize: { xs: 12, md: 15 }, flex: 1, lineHeight: 1.2 }}>{c.libelle}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                        <Typography sx={{ fontSize: { xs: 32, md: 40 }, fontWeight: 800, lineHeight: 1 }}>{liste.length}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>{liste.length ? `${pct(liste.length)} % des classés` : 'aucun magasin'}</Typography>
                      </Box>
                      {liste.length > 0 && (
                        <Tooltip title={parCoach.map(([k, n]) => `${k || 'Sans Coach'} : ${n}`).join(' · ')}>
                          <Box sx={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', bgcolor: 'background.paper' }} aria-hidden>
                            {parCoach.map(([k, n]) => <Box key={k} sx={{ width: `${(n / liste.length) * 100}%`, bgcolor: couleurs.get(k) ?? 'grey.500' }} />)}
                          </Box>
                        </Tooltip>
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

// ── Lignes de tableau mémorisées : seule la ligne modifiée se redessine ──
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

// ── Saisie magasin par magasin, avec « Magasin suivant » ──
function FicheSaisie({ reseau, magasins, saisie, parties }: { reseau: Reseau; magasins: Magasin[]; saisie: Saisie; parties: ('notes' | 'deploiements')[] }) {
  const [aCompleter, setACompleter] = useState(false)
  const [nom, setNom] = useState('')
  const incomplet = (m: Magasin) => (parties.includes('notes') && tousCriteres.some((c) => reseau.evaluations[m.nom]?.notes[c.id] === undefined))
    || (parties.includes('deploiements') && reseau.deploiements.thematiques.some((t) => !reseau.deploiements.valeurs[m.nom]?.[t.id]))
  // La liste est figée tant que le filtre ne change pas, pour ne pas faire sauter le magasin en cours
  const liste = useMemo(() => (aCompleter ? magasins.filter(incomplet) : magasins), [magasins, aCompleter]) // eslint-disable-line react-hooks/exhaustive-deps
  const i = Math.max(0, liste.findIndex((m) => m.nom === nom))
  const m = liste[i]
  const aller = (k: number) => { setNom(liste[k]?.nom ?? ''); window.scrollTo({ top: 0 }) }
  const e = m && reseau.evaluations[m.nom]
  return (
    <>
      <FormControlLabel control={<Switch checked={aCompleter} onChange={(_e, v) => { setACompleter(v); setNom('') }} />} label="Seulement les magasins à compléter" sx={{ mb: 2, minHeight: 48 }} />
      {!m ? <EmptyState icone={<SearchOffOutlined />} titre="Rien à compléter" texte="Tous les magasins affichés sont renseignés." /> : (
        <Card>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 0.5 }}>
              <Link component={RouterLink} to={lienFiche(m.nom)} variant="h2" sx={{ flex: 1 }}>{m.nom}</Link>
              {parties.includes('notes') && <PastilleCase c={caseDe(e)} />}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Magasin {i + 1} sur {liste.length} · Coach {coachA(m, reseau.jour) || 'à désigner'}</Typography>
            {parties.includes('notes') && (
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                {tousCriteres.map((c) => (
                  <Box key={c.id}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{c.libelle}</Typography>
                    <BoutonsNote libelle={`${c.libelle} de ${m.nom}`} valeur={e?.notes[c.id]} onChange={(n) => saisie.noter([m.nom], c.id, n)} />
                  </Box>
                ))}
              </Box>
            )}
            {parties.length > 1 && <Divider sx={{ my: 2.5 }} />}
            {parties.includes('deploiements') && (
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                {reseau.deploiements.thematiques.map((t) => (
                  <Box key={t.id} sx={{ overflowX: 'auto' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{t.libelle}</Typography>
                    <BoutonsOption t={t} libelle={`${t.libelle} de ${m.nom}`} valeur={reseau.deploiements.valeurs[m.nom]?.[t.id] ?? ''} onChange={(v) => saisie.deployer([m.nom], t.id, v)} />
                  </Box>
                ))}
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
              <Button variant="outlined" startIcon={<ArrowBackOutlined />} disabled={i === 0} onClick={() => aller(i - 1)} sx={{ minHeight: 48 }}>Précédent</Button>
              <Box sx={{ flex: 1 }} />
              <Button variant="contained" endIcon={<ArrowForwardOutlined />} disabled={i >= liste.length - 1} onClick={() => aller(i + 1)} sx={{ minHeight: 48 }}>Magasin suivant</Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function ChoixMode({ mode, changer }: { mode: string; changer: (m: string) => void }) {
  return (
    <ToggleButtonGroup exclusive value={mode} onChange={(_e, v) => v && changer(v)} aria-label="Mode de saisie" sx={{ mb: 2, '& .MuiToggleButton-root': { minHeight: 48, textTransform: 'none', px: 2 } }}>
      <ToggleButton value="tableau"><TableRowsOutlined sx={{ mr: 1 }} />Tableau</ToggleButton>
      <ToggleButton value="fiche"><ViewAgendaOutlined sx={{ mr: 1 }} />Magasin par magasin</ToggleButton>
    </ToggleButtonGroup>
  )
}

function DialogEffacerNotes({ nombre, onFermer }: { nombre: number; onFermer: () => void }) {
  const { recharger } = useReseau()
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')
  const effacer = async () => {
    setEnvoi(true); setErreur('')
    try { await effacerToutesEvaluations(); await recharger(); onFermer() } catch (e) { setErreur(messageErreur(e)); setEnvoi(false) }
  }
  return (
    <Dialog open onClose={onFermer} aria-labelledby="titre-effacer-notes" maxWidth="xs" fullWidth>
      <DialogTitle id="titre-effacer-notes">Effacer toutes les notes ?</DialogTitle>
      <DialogContent>
        <Typography>Les notes nine box de {nombre} magasin{nombre > 1 ? 's' : ''}, historique compris, seront effacées. Tous les magasins redeviennent non classés. Les déploiements ne changent pas.</Typography>
        {erreur && <Alert severity="error" sx={{ mt: 2 }}>{erreur}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onFermer} sx={{ minHeight: 48 }}>Annuler</Button>
        <Button variant="contained" color="error" onClick={effacer} disabled={envoi} sx={{ minHeight: 48 }}>{envoi ? 'Effacement…' : 'Tout effacer'}</Button>
      </DialogActions>
    </Dialog>
  )
}

function VueEvaluer({ reseau, saisie, surPC, date }: { reseau: Reseau; saisie: Saisie & { version: number }; surPC: boolean; date: ReactNode }) {
  const { magasins, barre } = useFiltres(reseau)
  const [mode, setMode] = useState('tableau')
  const sel = useSelection()
  const cibles: Cible[] = tousCriteres.map((c) => ({ type: 'note', id: c.id, libelle: c.libelle }))
  const [effacer, setEffacer] = useState(false)
  const notes = Object.keys(reseau.evaluations).length
  return (
    <>
      {barre}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {date}
        {notes > 0 && <Button color="error" startIcon={<DeleteOutlined />} onClick={() => setEffacer(true)} sx={{ minHeight: 48, mb: 2 }}>Effacer toutes les notes</Button>}
      </Box>
      {effacer && <DialogEffacerNotes nombre={notes} onFermer={() => setEffacer(false)} />}
      {surPC && <ChoixMode mode={mode} changer={setMode} />}
      {magasins.length === 0 ? <EmptyState icone={<SearchOffOutlined />} titre="Aucun magasin" texte="Aucun magasin ne correspond à ces filtres." />
        : !surPC || mode === 'fiche' ? <FicheSaisie reseau={reseau} magasins={magasins} saisie={saisie} parties={['notes']} /> : (
          <>
            <TableContainer component={Card}>
              <Table size="small" aria-label="Évaluation des magasins">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox"><CaseTout magasins={magasins} {...sel} /></TableCell>
                    <TableCell>Magasin</TableCell>
                    {tousCriteres.map((c) => <TableCell key={c.id} sx={{ minWidth: 170 }}>{c.id === 'franchise' ? 'Franchisé' : c.libelle}</TableCell>)}
                    <TableCell>Case</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {magasins.map((m) => <LigneNotes key={m.nom} m={m} e={reseau.evaluations[m.nom]} coche={sel.choisis.has(m.nom)} basculer={sel.basculer} noter={saisie.noter} />)}
                </TableBody>
              </Table>
            </TableContainer>
            <BarreLot cibles={cibles} choisis={sel.choisis} vider={() => sel.setChoisis(new Set())} saisie={saisie} />
          </>
        )}
    </>
  )
}

function VueDeploiements({ reseau, saisie, surPC, date }: { reseau: Reseau; saisie: Saisie & { version: number }; surPC: boolean; date: ReactNode }) {
  const { magasins, barre } = useFiltres(reseau)
  const [mode, setMode] = useState('tableau')
  const sel = useSelection()
  const ths = reseau.deploiements.thematiques
  const cibles: Cible[] = ths.map((t) => ({ type: 'deploiement', t, libelle: t.libelle }))
  return (
    <>
      {barre}
      {date}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' }, mb: 3 }}>
        {ths.map((t) => <Avancement key={t.id} reseau={reseau} t={t} />)}
      </Box>
      {surPC && <ChoixMode mode={mode} changer={setMode} />}
      {magasins.length === 0 ? <EmptyState icone={<SearchOffOutlined />} titre="Aucun magasin" texte="Aucun magasin ne correspond à ces filtres." />
        : !surPC || mode === 'fiche' ? <FicheSaisie reseau={reseau} magasins={magasins} saisie={saisie} parties={['deploiements']} /> : (
          <>
            <TableContainer component={Card}>
              <Table size="small" aria-label="Déploiements par magasin">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox"><CaseTout magasins={magasins} {...sel} /></TableCell>
                    <TableCell>Magasin</TableCell>
                    {ths.map((t) => <TableCell key={t.id}>{t.libelle}</TableCell>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {magasins.map((m) => <LigneDeploiements key={m.nom} m={m} valeurs={reseau.deploiements.valeurs[m.nom]} ths={ths} coche={sel.choisis.has(m.nom)} basculer={sel.basculer} deployer={saisie.deployer} />)}
                </TableBody>
              </Table>
            </TableContainer>
            <BarreLot cibles={cibles} choisis={sel.choisis} vider={() => sel.setChoisis(new Set())} saisie={saisie} />
          </>
        )}
    </>
  )
}

// ── Import d'un fichier Excel ou CSV ──
function DialogImport({ reseau, date, onFermer }: { reseau: Reseau; date: string; onFermer: (m?: string) => void }) {
  const [res, setRes] = useState<ResultatImport | null>(null)
  const [nomFichier, setNomFichier] = useState('')
  const [erreur, setErreur] = useState('')
  const choisir = async (f: File | undefined) => {
    if (!f) return
    setNomFichier(f.name); setErreur(''); setRes(null)
    try {
      const r = analyser(await lireFichier(f), reseau, date)
      if (!r) setErreur('Aucune colonne de noms de magasins reconnue dans ce fichier. Vérifie que les noms sont écrits comme dans l’app.')
      else setRes(r)
    } catch { setErreur('Ce fichier ne peut pas être lu. Enregistre-le au format Excel (.xlsx) ou CSV puis réessaie.') }
  }
  const nbNotes = res ? res.notes.reduce((t, n) => t + Object.keys(n.notes).length, 0) : 0
  const dates = res ? [...new Set([...res.notes.map((n) => n.date), ...res.deploiements.map((d) => d.date)])].sort() : []
  const total = nbNotes + (res?.deploiements.length ?? 0)
  return (
    <Fenetre large titre="Importer depuis Excel" ouvert onFermer={onFermer} valide={total > 0}
      enregistrer={async () => {
        if (res!.notes.length) await importerHistorique(res!.notes, reseau.directeur.nom)
        if (res!.deploiements.length) await enregistrerDeploiements(res!.deploiements, date)
        return `${total} valeur${total > 1 ? 's' : ''} importée${total > 1 ? 's' : ''}`
      }}>
      <Button variant="outlined" component="label" startIcon={<UploadFileOutlined />} sx={{ alignSelf: 'flex-start', minHeight: 48 }}>
        {nomFichier || 'Choisir un fichier'}
        <input type="file" hidden accept=".xlsx,.csv,.txt" aria-label="Fichier à importer" onChange={(e) => choisir(e.target.files?.[0])} />
      </Button>
      {erreur && <Alert severity="warning">{erreur}</Alert>}
      {res && (
        <>
          <Alert severity={total ? 'success' : 'info'}>
            {total ? `${total} valeur${total > 1 ? 's' : ''} prête${total > 1 ? 's' : ''} à importer pour ${new Set([...res.notes.map((n) => n.magasin), ...res.deploiements.map((d) => d.magasin)]).size} magasins (colonne des magasins : « ${res.colonneMagasin} »). ${dates.length > 1 ? `${dates.length} dates, du ${dateCourte(dates[0])} au ${dateCourte(dates.at(-1)!)}, ajoutées à l’historique.` : `Datées du ${dateCourte(dates[0] ?? date)}.`}` : 'Aucune valeur reconnue dans ce fichier.'}
          </Alert>
          {res.criteres.length + res.thematiques.length > 0 && (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Colonnes reconnues</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {res.criteres.map((c) => <Chip key={c.entete} label={`${c.entete} → ${tousCriteres.find((x) => x.id === c.id)!.libelle}`} color="primary" variant="outlined" sx={{ fontSize: 13 }} />)}
                {res.thematiques.map((t) => <Chip key={t.entete} label={`${t.entete} → ${t.t.libelle}`} color="secondary" variant="outlined" sx={{ fontSize: 13 }} />)}
              </Box>
            </Box>
          )}
          {res.ignorees.length > 0 && <Typography variant="body2" color="text.secondary">Colonnes ignorées : {res.ignorees.join(', ')}. Pour en suivre une, ajoute-la d’abord comme thématique.</Typography>}
          {res.inconnus.length > 0 && <Typography variant="body2" color="text.secondary">Magasins non trouvés ({res.inconnus.length}) : {res.inconnus.slice(0, 12).join(', ')}{res.inconnus.length > 12 ? '…' : ''}</Typography>}
          {res.illisibles > 0 && <Typography variant="body2" color="text.secondary">{res.illisibles} case{res.illisibles > 1 ? 's' : ''} avec une valeur non reconnue, laissée{res.illisibles > 1 ? 's' : ''} de côté.</Typography>}
        </>
      )}
    </Fenetre>
  )
}

function Avancement({ reseau, t }: { reseau: Reseau; t: Thematique }) {
  const a = avancement(reseau, t)
  const pct = (n: number) => (a.total ? (n / a.total) * 100 : 0)
  return (
    <Card>
      <CardContent>
        <Typography variant="h3" component="h3">{t.libelle}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{a.positif} sur {a.total} · {a.partiel} en partie · {a.inconnu} non renseigné{a.inconnu > 1 ? 's' : ''}</Typography>
        <Box sx={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', bgcolor: 'action.hover' }} role="img" aria-label={`${t.libelle} : ${a.positif} magasins sur ${a.total}`}>
          <Box sx={{ width: `${pct(a.positif)}%`, bgcolor: 'success.main' }} />
          <Box sx={{ width: `${pct(a.partiel)}%`, bgcolor: 'warning.main' }} />
          <Box sx={{ width: `${pct(a.negatif)}%`, bgcolor: 'error.light' }} />
        </Box>
      </CardContent>
    </Card>
  )
}

const tons: { id: Ton; libelle: string }[] = [{ id: 'positif', libelle: 'Vert (fait)' }, { id: 'partiel', libelle: 'Orange (en partie)' }, { id: 'negatif', libelle: 'Rouge (non)' }]

export function DialogThematiques({ reseau, onFermer }: { reseau: Reseau; onFermer: (m?: string) => void }) {
  const [liste, setListe] = useState<Thematique[]>(() => reseau.deploiements.thematiques.map((t) => ({ ...t, options: t.options.map((o) => ({ ...o })) })))
  const changer = (i: number, f: (t: Thematique) => Thematique) => setListe((l) => l.map((t, j) => (j === i ? f(t) : t)))
  const valide = liste.every((t) => t.libelle.trim() && t.options.length > 0 && t.options.every((o) => o.libelle.trim()))
  const ajouter = () => setListe((l) => [...l, { id: `t${Date.now().toString(36)}`, libelle: '', options: [{ libelle: 'Oui', ton: 'positif' }, { libelle: 'Non', ton: 'negatif' }] }])
  return (
    <Fenetre large titre="Thématiques de déploiement" ouvert onFermer={onFermer} valide={valide}
      enregistrer={async () => { await enregistrerThematiques(liste.map((t) => ({ ...t, libelle: t.libelle.trim(), options: t.options.map((o) => ({ ...o, libelle: o.libelle.trim() })) }))); return 'Thématiques enregistrées' }}>
      {liste.map((t, i) => (
        <Card key={t.id} variant="outlined">
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField label="Thématique" value={t.libelle} onChange={(e) => changer(i, (x) => ({ ...x, libelle: e.target.value }))} sx={{ flex: 1 }} required />
              <Tooltip title="Supprimer la thématique"><IconButton onClick={() => setListe((l) => l.filter((_, j) => j !== i))} aria-label={`Supprimer la thématique ${t.libelle || "sans nom"}`}><DeleteOutlined /></IconButton></Tooltip>
            </Box>
            {t.options.map((o, k) => (
              <Box key={k} sx={{ display: 'flex', gap: 1, alignItems: 'center', pl: { sm: 2 }, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                <TextField size="small" label="Réponse possible" value={o.libelle} onChange={(e) => changer(i, (x) => ({ ...x, options: x.options.map((p, n) => (n === k ? { ...p, libelle: e.target.value } : p)) }))} sx={{ flex: 1, minWidth: 140, '& .MuiInputBase-root': { minHeight: 48 } }} />
                <TextField select size="small" label="Couleur" value={o.ton} onChange={(e) => changer(i, (x) => ({ ...x, options: x.options.map((p, n) => (n === k ? { ...p, ton: e.target.value as Ton } : p)) }))} sx={{ minWidth: 170, '& .MuiInputBase-root': { minHeight: 48 } }}>
                  {tons.map((x) => <MenuItem key={x.id} value={x.id}>{x.libelle}</MenuItem>)}
                </TextField>
                <IconButton onClick={() => changer(i, (x) => ({ ...x, options: x.options.filter((_, n) => n !== k) }))} aria-label={`Retirer la réponse ${o.libelle}`} disabled={t.options.length <= 1}><DeleteOutlined /></IconButton>
              </Box>
            ))}
            <Button startIcon={<AddOutlined />} onClick={() => changer(i, (x) => ({ ...x, options: [...x.options, { libelle: '', ton: 'partiel' }] }))} sx={{ alignSelf: 'flex-start', minHeight: 48 }}>Ajouter une réponse</Button>
          </CardContent>
        </Card>
      ))}
      <Button variant="outlined" startIcon={<AddOutlined />} onClick={ajouter} sx={{ alignSelf: 'flex-start', minHeight: 48 }}>Ajouter une thématique</Button>
    </Fenetre>
  )
}

// Date à laquelle les notes et déploiements saisis prennent effet
function ChampDate({ valeur, max, onChange }: { valeur: string; max: string; onChange: (v: string) => void }) {
  return (
    <TextField type="date" size="small" label="Date des changements" value={valeur} onChange={(e) => onChange(e.target.value || max)}
      slotProps={{ inputLabel: { shrink: true }, htmlInput: { max } }} sx={{ mb: 2, minWidth: 220, '& .MuiInputBase-root': { minHeight: 48 } }} />
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
  const [gestion, setGestion] = useState(false)
  const [importer, setImporter] = useState(false)
  const [importerChiffres, setImporterChiffres] = useState(false)
  const [date, setDate] = useState(reseau.jour)
  const saisie = useSaisieSante(reseau, setMessage, date)
  const actifs = reseau.magasins.filter((m) => m.statut !== 'avenir')
  const classes = actifs.filter((m) => caseDe(reseau.evaluations[m.nom])).length
  // Les boutons restent en place (masqués sur la nine box) pour que le titre ne bouge pas entre onglets
  const actions = (
    <Box sx={{ gap: 1, flexWrap: 'wrap', visibility: vue === 'ninebox' ? 'hidden' : 'visible', display: surPC ? 'flex' : 'none' }} aria-hidden={vue === 'ninebox'}>
      {surPC && <Button variant="outlined" startIcon={<UploadFileOutlined />} onClick={() => (vue === 'chiffres' ? setImporterChiffres(true) : setImporter(true))} sx={{ minHeight: 48 }}>Importer Excel</Button>}
      <Button variant="contained" startIcon={<TuneOutlined />} onClick={() => setGestion(true)} sx={{ minHeight: 48, visibility: vue === 'deploiements' ? 'visible' : 'hidden' }} tabIndex={vue === 'deploiements' ? 0 : -1} aria-hidden={vue !== 'deploiements'}>Gérer les thématiques</Button>
    </Box>
  )
  return (
    <>
      <PageHeader titre="Santé du parc" sousTitre={`${classes} magasin${classes > 1 ? 's' : ''} classé${classes > 1 ? 's' : ''} sur ${actifs.length}`} actions={actions} />
      <Tabs value={vue} onChange={(_e, v) => aller(v)} aria-label="Rubriques de la santé du parc" variant="scrollable" sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab value="ninebox" label="Nine box" sx={{ minHeight: 48 }} />
        <Tab value="evaluer" label="Évaluer" sx={{ minHeight: 48 }} />
        <Tab value="deploiements" label="Déploiements" sx={{ minHeight: 48 }} />
        <Tab value="chiffres" label="Chiffres" sx={{ minHeight: 48 }} />
      </Tabs>
      {vue === 'ninebox' && <VueNineBox reseau={reseau} evaluer={() => aller('evaluer')} surPC={surPC} />}
      {vue === 'evaluer' && <VueEvaluer reseau={reseau} saisie={saisie} surPC={surPC} date={<ChampDate valeur={date} max={reseau.jour} onChange={setDate} />} />}
      {vue === 'deploiements' && <VueDeploiements reseau={reseau} saisie={saisie} surPC={surPC} date={<ChampDate valeur={date} max={reseau.jour} onChange={setDate} />} />}
      {vue === 'chiffres' && <VueChiffres reseau={reseau} surPC={surPC} />}
      {importerChiffres && <DialogImportChiffres reseau={reseau} onFermer={(m) => { setImporterChiffres(false); if (m) setMessage(m) }} />}
      {gestion && <DialogThematiques reseau={reseau} onFermer={(m) => { setGestion(false); if (m) setMessage(m) }} />}
      {importer && <DialogImport reseau={reseau} date={date} onFermer={(m) => { setImporter(false); if (m) setMessage(m) }} />}
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </>
  )
}

// ── Chiffres : alerte de décrochage de chaque magasin (démarche coach) ──
const ordreAlerte: (StatutAlerte | null)[] = ['decroche', 'surveiller', 'ok', null]

function VueChiffres({ reseau, surPC }: { reseau: Reseau; surPC: boolean }) {
  const theme = useTheme()
  const { magasins, barre } = useFiltres(reseau)
  const [statuts, setStatuts] = useState<string[]>([])
  const lignes = useMemo(() => magasins.map((m) => {
    const a = analyserCA(reseau, m.nom)
    return { m, a, suivi: suiviAlerte(reseau, m.nom, a), coach: coachA(m, reseau.jour), hygiene: dernierAudit(reseau, m.nom, 'hygiene'), excellence: dernierAudit(reseau, m.nom, 'excellence') }
  }).sort((x, y) => ordreAlerte.indexOf(x.a?.statut ?? null) - ordreAlerte.indexOf(y.a?.statut ?? null) || (y.suivi?.retard ?? 0) - (x.suivi?.retard ?? 0) || (x.a?.evol3 ?? 0) - (y.a?.evol3 ?? 0) || x.m.nom.localeCompare(y.m.nom, 'fr')), [magasins, reseau])
  const compte = (st: StatutAlerte | null) => lignes.filter((l) => (l.a?.statut ?? null) === st).length
  const visibles = lignes.filter((l) => !statuts.length || statuts.includes(l.a?.statut ?? 'sans'))
  // Indicateurs de la démarche : délai entre l'alerte et le premier contact, audits conformes
  const suivis = lignes.map((l) => l.suivi).filter((x) => x !== null)
  const delais = suivis.map((x) => x.delai).filter((d) => d !== null)
  const enRetard = suivis.filter((x) => x.retard > 0).length
  const audits = lignes.flatMap((l) => [l.hygiene, l.excellence]).filter((x) => x && x.conforme !== null)
  const conformes = audits.filter((x) => x!.conforme).length
  const tuiles = [
    { id: 'decroche', titre: 'Décroche', n: compte('decroche'), couleur: theme.palette.error.main, detail: enRetard ? `${enRetard} appel${enRetard > 1 ? 's' : ''} en retard` : 'Aucun appel en retard' },
    { id: 'surveiller', titre: 'À surveiller', n: compte('surveiller'), couleur: theme.palette.warning.main, detail: 'Point au prochain échange' },
    { id: 'ok', titre: 'OK', n: compte('ok'), couleur: theme.palette.success.main, detail: 'Rythme normal' },
    { id: 'sans', titre: 'Sans chiffres', n: compte(null), couleur: theme.palette.text.secondary, detail: 'Moins de 15 mois de chiffres' },
  ]
  const indicateurs = [
    `Délai moyen avant le premier contact : ${delais.length ? `${(delais.reduce((a, b) => a + b, 0) / delais.length).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} j sur ${delais.length} alerte${delais.length > 1 ? 's' : ''}` : 'aucun contact encore'} (objectif ${reseau.seuils.delaiAppel} j)`,
    `Audits conformes : ${audits.length ? `${conformes} sur ${audits.length} (${Math.round((conformes / audits.length) * 100)} %)` : 'aucun résultat saisi'}`,
  ]
  return (
    <>
      {barre}
      <Box sx={{ mb: 2, mt: -1 }}>
        <FiltreMenu libelle="Alerte" choisis={statuts} onChange={setStatuts} options={tuiles.map((t) => ({ valeur: t.id, libelle: t.titre, detail: `${t.n} magasins` }))} />
      </Box>
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
      <Box sx={{ mb: 3 }}>{indicateurs.map((t) => <Typography key={t} variant="body2" color="text.secondary">{t}</Typography>)}</Box>
      {visibles.length === 0 ? <EmptyState icone={<SearchOffOutlined />} titre="Aucun magasin" texte="Aucun magasin ne correspond à ces filtres." /> : surPC ? (
        <TableContainer component={Paper}>
          <Table size="small" aria-label="Chiffres des magasins">
            <TableHead>
              <TableRow>
                {['Magasin', 'Coach', 'Chiffres à fin', 'CA 3 mois', 'CA 12 mois', 'Rupture', 'Alerte', 'Appel', 'Audit hygiène', 'Audit excellence'].map((h) => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {visibles.map(({ m, a, suivi, coach, hygiene, excellence }) => (
                <TableRow key={m.nom} hover>
                  <TableCell><Link component={RouterLink} to={lienFiche(m.nom)} sx={{ fontWeight: 600 }}>{m.nom}</Link></TableCell>
                  <TableCell>{coach || 'Sans Coach'}</TableCell>
                  <TableCell>{a ? libelleMoisCourt(a.mois) : '—'}</TableCell>
                  <TableCell>{formatPourcent(a?.evol3 ?? null)}</TableCell>
                  <TableCell>{formatPourcent(a?.evol12 ?? null)}</TableCell>
                  <TableCell>{formatPoints(a?.rupture ?? null)}</TableCell>
                  <TableCell><Tooltip title={a?.raisons.join(' · ') ?? ''}><span><PastilleAlerte statut={a?.statut ?? null} /></span></Tooltip></TableCell>
                  <TableCell><PastilleAppel s={suivi} /></TableCell>
                  <TableCell>{hygiene ? libelleAudit(hygiene) : '—'}</TableCell>
                  <TableCell>{excellence ? libelleAudit(excellence) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {visibles.map(({ m, a, suivi, coach }) => (
            <Card key={m.nom}>
              <Link component={RouterLink} to={lienFiche(m.nom)} underline="none" color="inherit" sx={{ display: 'block', p: 2, minHeight: 48 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontWeight: 700, flex: 1 }}>{m.nom}</Typography>
                  <PastilleAlerte statut={a?.statut ?? null} />
                </Box>
                <Typography variant="body2" color="text.secondary">{[coach || 'Sans Coach', a ? `CA 3 mois ${formatPourcent(a.evol3)} à fin ${libelleMois(a.mois)}` : 'aucun chiffre'].join(' · ')}</Typography>
                {suivi && <Box sx={{ mt: 1 }}><PastilleAppel s={suivi} /></Box>}
              </Link>
            </Card>
          ))}
        </Box>
      )}
    </>
  )
}

function DialogImportChiffres({ reseau, onFermer }: { reseau: Reseau; onFermer: (m?: string) => void }) {
  const [res, setRes] = useState<ResultatImportChiffres | null>(null)
  const [nomFichier, setNomFichier] = useState('')
  const [erreur, setErreur] = useState('')
  const choisir = async (f: File | undefined) => {
    if (!f) return
    setNomFichier(f.name); setErreur(''); setRes(null)
    try {
      const r = analyserChiffres(await lireFichier(f), reseau, moisPrecedent(reseau.jour))
      if (!r) setErreur('Aucune colonne de noms de magasins reconnue dans ce fichier. Vérifie que les noms sont écrits comme dans l’app.')
      else setRes(r)
    } catch { setErreur('Ce fichier ne peut pas être lu. Enregistre-le au format Excel (.xlsx) ou CSV puis réessaie.') }
  }
  const total = res?.lignes.length ?? 0
  const mois = res ? [...new Set(res.lignes.map((l) => l.mois))].sort() : []
  const nbMag = res ? new Set(res.lignes.map((l) => l.magasin)).size : 0
  return (
    <Fenetre large titre="Importer les chiffres mensuels" ouvert onFermer={onFermer} valide={total > 0}
      enregistrer={async () => { await enregistrerChiffres(res!.lignes.map((l) => completerChiffres(l, reseau.chiffres[l.magasin]?.find((c) => c.mois === l.mois)))); return `${total} mois de chiffres importé${total > 1 ? 's' : ''}` }}>
      <Button variant="outlined" component="label" startIcon={<UploadFileOutlined />} sx={{ alignSelf: 'flex-start', minHeight: 48 }}>
        {nomFichier || 'Choisir un fichier'}
        <input type="file" hidden accept=".xlsx,.csv,.txt" aria-label="Fichier de chiffres à importer" onChange={(e) => choisir(e.target.files?.[0])} />
      </Button>
      {erreur && <Alert severity="warning">{erreur}</Alert>}
      {res && (
        <>
          <Alert severity={total ? 'success' : 'info'}>
            {total ? `${total} ligne${total > 1 ? 's' : ''} prête${total > 1 ? 's' : ''} à importer pour ${nbMag} magasin${nbMag > 1 ? 's' : ''}, ${mois.length > 1 ? `${/^[aeiouo]/.test(libelleMois(mois[0])) ? 'd’' : 'de '}${libelleMois(mois[0])} à ${libelleMois(mois.at(-1)!)}` : libelleMois(mois[0])}.${res.colonneMois ? '' : ' Aucune colonne de mois : les chiffres sont rangés sur le mois dernier.'}` : 'Aucun chiffre reconnu dans ce fichier.'}
          </Alert>
          {res.colonnes.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {res.colonnes.map((c) => <Chip key={c.entete} label={`${c.entete} → ${libellesChiffres[c.id].libelle}`} color="primary" variant="outlined" sx={{ fontSize: 13 }} />)}
            </Box>
          )}
          {res.ignorees.length > 0 && <Typography variant="body2" color="text.secondary">Colonnes ignorées : {res.ignorees.join(', ')}.</Typography>}
          {res.inconnus.length > 0 && <Typography variant="body2" color="text.secondary">Magasins non trouvés ({res.inconnus.length}) : {res.inconnus.slice(0, 12).join(', ')}{res.inconnus.length > 12 ? '…' : ''}</Typography>}
          {res.illisibles > 0 && <Typography variant="body2" color="text.secondary">{res.illisibles} case{res.illisibles > 1 ? 's' : ''} avec une valeur non reconnue, laissée{res.illisibles > 1 ? 's' : ''} de côté.</Typography>}
        </>
      )}
    </Fenetre>
  )
}

