import { useAuth } from '../auth/AuthContext'
import { CarteLignes, Initiales, LigneCompacte, TitreSection } from './Social'
import { useDroits } from '../auth/Droits'
import { useMemo, useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
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
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import SearchOffOutlined from '@mui/icons-material/SearchOffOutlined'
import { EmptyState } from './EmptyState'
import { Fenetre } from './EditionEquipe'
import { FiltreMenu } from './FiltreMenu'
import { RechercheFiltres } from './RechercheFiltres'
import { BoutonAction, ChampRecherche } from './Outils'
import { useReseau } from '../data/ReseauContext'
import { enregistrerCampagne, enregistrerConstats } from '../data/chargement'
import { coachA } from '../data/charge'
import {
  MAX_POINTS, bilan, bilanPar, campagnesDuMagasin, executionMagasin, libellePerimetre, libellesExecution, libellesPhase, magasinsConcernes, perimetres, perimetresRegion, phase,
  type Bilan, type Campagne, type Execution, type Perimetre, type Phase,
} from '../data/campagnes'
import type { Magasin, Reseau } from '../data/modele'
import { magasinsDu } from '../data/perimetre'
import { dateCourte, lienFiche } from '../lib/format'

const couleursExecution: Record<Execution, 'success' | 'warning' | 'error' | 'default'> = { fait: 'success', partiel: 'warning', non: 'error', aConstater: 'default' }

// Constat d'un point : fait, pas fait, ou rien (à constater) en cliquant de nouveau sur le choix
export function ChoixConstat({ libelle, valeur, onChange }: { libelle: string; valeur: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
    <ToggleButtonGroup exclusive size="small" value={valeur === null ? null : valeur ? 'oui' : 'non'} aria-label={libelle}
      onChange={(_e, v: string | null) => onChange(v === null ? null : v === 'oui')}>
      <ToggleButton value="oui" color="success" aria-label={`${libelle} : fait`} sx={{ minHeight: 48, minWidth: 56 }}>Fait</ToggleButton>
      <ToggleButton value="non" color="error" aria-label={`${libelle} : pas fait`} sx={{ minHeight: 48, minWidth: 56 }}>Non</ToggleButton>
    </ToggleButtonGroup>
  )
}

const constatDe = (reseau: Reseau, c: Campagne, magasin: string, point: string): boolean | null => {
  const k = reseau.campagnes.constats[c.id]?.[magasin]?.[point]
  return k ? k.fait : null
}

// Saisie des constats d'un magasin (visite) : enregistrés avec la visite
export function useSaisieCampagnes(reseau: Reseau, magasin: string, jour: string) {
  const campagnes = magasin ? campagnesDuMagasin(reseau, magasin, jour) : []
  const [changes, setChanges] = useState<Record<string, boolean | null>>({})
  const valeur = (c: Campagne, p: string) => (`${magasin}|${c.id}|${p}` in changes ? changes[`${magasin}|${c.id}|${p}`] : constatDe(reseau, c, magasin, p))
  const changer = (c: Campagne, p: string, v: boolean | null) => setChanges((x) => ({ ...x, [`${magasin}|${c.id}|${p}`]: v }))
  const lot = (date: string, par: string) => Object.entries(changes).filter(([k]) => k.startsWith(`${magasin}|`))
    .map(([k, fait]) => { const [m, campagne, point] = k.split('|'); return { campagne, magasin: m, point, fait, date, par } })
  return { campagnes, valeur, changer, lot }
}

export function SaisieCampagnes({ s }: { s: ReturnType<typeof useSaisieCampagnes> }) {
  if (!s.campagnes.length) return null
  return (
    <Box>
      <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>Campagnes en cours</Typography>
      <ListeConstats campagnes={s.campagnes} valeur={s.valeur} changer={s.changer} />
    </Box>
  )
}

function ListeConstats({ campagnes, valeur, changer }: { campagnes: Campagne[]; valeur: (c: Campagne, p: string) => boolean | null; changer: (c: Campagne, p: string, v: boolean | null) => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {campagnes.map((c) => (
        <Box key={c.id}>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>{c.nom}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Du {dateCourte(c.debut)} au {dateCourte(c.fin)}</Typography>
          {c.points.map((p) => (
            <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ flex: '1 1 160px' }}>{p.libelle}</Typography>
              <ChoixConstat libelle={`${c.nom}, ${p.libelle}`} valeur={valeur(c, p.id)} onChange={(v) => changer(c, p.id, v)} />
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

// Constats enregistrés aussitôt (fiche magasin, tableau d'une campagne) ; l'affichage suit le clic sans attendre la base
function useConstatsDirects(reseau: Reseau, signaler: (m: string) => void) {
  const { recharger } = useReseau()
  const [encours, setEncours] = useState<Record<string, boolean | null>>({})
  const valeur = (c: Campagne, magasin: string, p: string) => (`${c.id}|${magasin}|${p}` in encours ? encours[`${c.id}|${magasin}|${p}`] : constatDe(reseau, c, magasin, p))
  const changer = async (c: Campagne, magasin: string, p: string, fait: boolean | null) => {
    const k = `${c.id}|${magasin}|${p}`
    setEncours((x) => ({ ...x, [k]: fait }))
    try { await enregistrerConstats([{ campagne: c.id, magasin, point: p, fait, date: reseau.jour, par: reseau.directeur.nom }]); await recharger() }
    catch { signaler('Le constat n’a pas pu être enregistré. Vérifie ta connexion et réessaie.') }
    finally { setEncours((x) => { const y = { ...x }; delete y[k]; return y }) }
  }
  return { valeur, changer }
}

// Fiche magasin : campagnes en cours du magasin
export function ConstatsMagasin({ reseau, magasin, signaler }: { reseau: Reseau; magasin: string; signaler: (m: string) => void }) {
  const d = useConstatsDirects(reseau, signaler)
  return <ListeConstats campagnes={campagnesDuMagasin(reseau, magasin, reseau.jour)} valeur={(c, p) => d.valeur(c, magasin, p)} changer={(c, p, v) => d.changer(c, magasin, p, v)} />
}

// ── Liste des campagnes ──

export function BarreExecution({ b, libelle }: { b: Bilan; libelle: string }) {
  const pct = (n: number) => (b.total ? (n / b.total) * 100 : 0)
  return (
    <Box sx={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', bgcolor: 'action.hover' }} role="img" aria-label={`${libelle} : ${b.fait} magasins sur ${b.total} exécutés`}>
      <Box sx={{ width: `${pct(b.fait)}%`, bgcolor: 'success.main' }} />
      <Box sx={{ width: `${pct(b.partiel)}%`, bgcolor: 'warning.main' }} />
      <Box sx={{ width: `${pct(b.non)}%`, bgcolor: 'error.light' }} />
    </Box>
  )
}

// Ce que le compte peut faire des campagnes : le Directeur toutes, un Responsable Régional celles de sa région
function useDroitsCampagnes() {
  const { referentiels } = useDroits()
  const { profil } = useAuth()
  const monRR = profil?.role === 'rr' ? profil.perimetre.rr?.[0] : undefined
  return { referentiels, monRR, creer: referentiels || !!monRR, modifier: (c: Campagne) => referentiels || (!!monRR && c.rr === monRR) }
}

const nomRR = (reseau: Reseau, id?: string) => reseau.rrs.find((r) => r.id === id)?.nom ?? 'Responsable Régional'
// Campagne d'un Responsable Régional : sa région, ou tout le réseau quand il la lance exceptionnellement
const origine = (reseau: Reseau, c: Campagne) => `${c.perimetre === 'tous' ? 'Lancée par' : 'Région de'} ${nomRR(reseau, c.rr)}`

const resumeBilan = (b: Bilan) => `${b.fait} sur ${b.total} exécuté${b.fait > 1 ? 's' : ''} · ${b.constates} constaté${b.constates > 1 ? 's' : ''}`

function CarteCampagne({ reseau, c, ouvrir }: { reseau: Reseau; c: Campagne; ouvrir: () => void }) {
  const b = bilan(reseau.campagnes, c, magasinsConcernes(reseau, c))
  return (
    <Card>
      <CardActionArea onClick={ouvrir} aria-label={`Ouvrir la campagne ${c.nom}`}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography variant="h4" component="h3" sx={{ flex: 1 }}>{c.nom}</Typography>
            <Typography variant="h4" component="p" aria-label="Taux d’exécution">{b.taux === null ? '—' : `${b.taux} %`}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">Du {dateCourte(c.debut)} au {dateCourte(c.fin)} · {c.points.length} point{c.points.length > 1 ? 's' : ''}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{resumeBilan(b)}</Typography>
          {c.rr && <Chip size="small" variant="outlined" label={origine(reseau, c)} sx={{ mb: 1, fontSize: 13 }} />}
          <BarreExecution b={b} libelle={c.nom} />
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

export function VueCampagnes({ reseau }: { reseau: Reseau }) {
  const [params, setParams] = useSearchParams()
  const [edition, setEdition] = useState<Campagne | null | undefined>(undefined)
  const [message, setMessage] = useState('')
  const choisie = reseau.campagnes.liste.find((c) => c.id === params.get('campagne'))
  const ouvrir = (id: string | null) => setParams((p) => { const n = new URLSearchParams(p); if (id) n.set('campagne', id); else n.delete('campagne'); return n })
  const droits = useDroitsCampagnes()
  const nouvelle = droits.creer ? <BoutonAction libelle="Nouvelle campagne" onClick={() => setEdition(null)} /> : null
  // Hors Directeur : seules les campagnes qui touchent au moins un de ses magasins
  const liste = reseau.campagnes.liste.filter((c) => droits.referentiels || magasinsConcernes(reseau, c).length > 0)
  const parPhase = (ph: Phase) => liste.filter((c) => phase(c, reseau.jour) === ph).sort((a, b) => (ph === 'terminee' ? b.fin.localeCompare(a.fin) : a.debut.localeCompare(b.debut)))
  return (
    <>
      {choisie
        ? <DetailCampagne reseau={reseau} c={choisie} retour={() => ouvrir(null)} modifier={() => setEdition(choisie)} signaler={setMessage} />
        : !liste.length
        ? <EmptyState icone={<CampaignOutlined />} titre="Aucune campagne" texte="Les campagnes commerciales et leur exécution en magasin apparaîtront ici." action={droits.creer ? <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setEdition(null)} sx={{ minHeight: 48 }}>Nouvelle campagne</Button> : undefined} />
        : (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>{nouvelle}</Box>
            {(['encours', 'avenir', 'terminee'] as Phase[]).map((ph) => parPhase(ph).length > 0 && (
              <Box key={ph} component="section" aria-label={libellesPhase[ph]} sx={{ mb: 3 }}>
                <Typography variant="overline" component="h2" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>{libellesPhase[ph]}</Typography>
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: 'repeat(3, 1fr)' } }}>
                  {parPhase(ph).map((c) => <CarteCampagne key={c.id} reseau={reseau} c={c} ouvrir={() => ouvrir(c.id)} />)}
                </Box>
              </Box>
            ))}
          </>
        )}
      {edition !== undefined && <DialogCampagne reseau={reseau} campagne={edition} onFermer={(m, id) => { setEdition(undefined); if (m) setMessage(m); if (id !== undefined) ouvrir(id) }} />}
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </>
  )
}

// ── Une campagne : exécution par Responsable Régional, par Coach, par magasin ──

// Une ligne par Responsable Régional ou par Coach : exécutés sur le total, taux en grand
function LignesBilan({ titre, lignes }: { titre: string; lignes: { nom: string; b: Bilan }[] }) {
  return (
    <Box>
      <TitreSection>{`Par ${titre}`}</TitreSection>
      <CarteLignes label={`Exécution par ${titre}`}>
        {lignes.map((l) => (
          <LigneCompacte key={l.nom} avatar={<Initiales nom={l.nom} />} titre={l.nom}
            detail={`${l.b.fait} exécuté${l.b.fait > 1 ? 's' : ''} sur ${l.b.total} · ${l.b.constates} constaté${l.b.constates > 1 ? 's' : ''}`}
            fin={<Typography sx={{ fontWeight: 700, fontSize: '1.125rem' }}>{l.b.taux === null ? '—' : `${l.b.taux} %`}</Typography>} />
        ))}
      </CarteLignes>
    </Box>
  )
}

const ordreExecution: Execution[] = ['aConstater', 'non', 'partiel', 'fait']

function DetailCampagne({ reseau, c, retour, modifier, signaler }: { reseau: Reseau; c: Campagne; retour: () => void; modifier: () => void; signaler: (m: string) => void }) {
  const droits = useDroitsCampagnes()
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const d = useConstatsDirects(reseau, signaler)
  const [recherche, setRecherche] = useState('')
  const [rrs, setRRs] = useState<string[]>([])
  const [coachs, setCoachs] = useState<string[]>([])
  const [etats, setEtats] = useState<string[]>([])
  const concernes = useMemo(() => magasinsConcernes(reseau, c), [reseau, c])
  const b = bilan(reseau.campagnes, c, concernes)
  const visibles = concernes.filter((m) => (!rrs.length || rrs.includes(m.rr?.id ?? '')) && (!coachs.length || coachs.includes(coachA(m, reseau.jour)))
    && (!etats.length || etats.includes(executionMagasin(reseau.campagnes, c, m.nom)))
    && (!recherche || `${m.nom} ${m.ville} ${coachA(m, reseau.jour)}`.toLowerCase().includes(recherche.toLowerCase())))
    .sort((x, y) => x.nom.localeCompare(y.nom, 'fr'))
  const nomsCoachs = [...new Set(concernes.map((m) => coachA(m, reseau.jour)).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'fr'))
  const actifs = rrs.length + coachs.length + etats.length
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <IconButton onClick={retour} aria-label="Retour aux campagnes"><ArrowBackOutlined /></IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h2" component="h2">{c.nom}</Typography>
          <Typography variant="body2" color="text.secondary">Du {dateCourte(c.debut)} au {dateCourte(c.fin)} · {libellePerimetre(c)}{c.rr ? ` · ${origine(reseau, c)}` : ''}</Typography>
        </Box>
        {droits.modifier(c) && <Button startIcon={<EditOutlined />} onClick={modifier} sx={{ minHeight: 48 }}>Modifier</Button>}
      </Box>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            <Typography variant="h2" component="p">{b.taux === null ? '—' : `${b.taux} %`}</Typography>
            <Typography variant="body1" color="text.secondary">d’exécution · {resumeBilan(b)}</Typography>
          </Box>
          <BarreExecution b={b} libelle={c.nom} />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
            {ordreExecution.slice().reverse().map((e) => <Chip key={e} size="small" color={couleursExecution[e]} variant="outlined" label={`${libellesExecution[e]} : ${b[e]}`} sx={{ fontSize: 13 }} />)}
          </Box>
        </CardContent>
      </Card>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, mb: 3 }}>
        <LignesBilan titre="Responsable Régional" lignes={bilanPar(reseau, c, concernes, 'rr')} />
        <LignesBilan titre="Coach" lignes={bilanPar(reseau, c, concernes, 'coach')} />
      </Box>
      <RechercheFiltres actifs={actifs} recherche={<ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher un magasin ou un Coach" />}>
        <FiltreMenu libelle="Responsable Régional" choisis={rrs} onChange={setRRs} options={reseau.rrs.filter((r) => concernes.some((m) => m.rr?.id === r.id)).map((r) => ({ valeur: r.id, libelle: r.nom }))} />
        <FiltreMenu libelle="Coach" choisis={coachs} onChange={setCoachs} options={nomsCoachs.map((n) => ({ valeur: n, libelle: n }))} />
        <FiltreMenu libelle="Exécution" choisis={etats} onChange={setEtats} options={ordreExecution.map((e) => ({ valeur: e, libelle: libellesExecution[e], detail: `${b[e]} magasins` }))} />
        {(actifs > 0 || recherche) && <Button onClick={() => { setRRs([]); setCoachs([]); setEtats([]); setRecherche('') }} sx={{ minHeight: 36 }}>Effacer les filtres</Button>}
      </RechercheFiltres>
      {!visibles.length ? <EmptyState icone={<SearchOffOutlined />} titre="Aucun magasin" texte="Aucun magasin ne correspond à ces filtres." />
        : surPC ? (
          <TableContainer component={Card}>
            <Table size="small" className="colonne-fixe" aria-label={`Constats de la campagne ${c.nom}`}>
              <TableHead>
                <TableRow>
                  <TableCell>Magasin</TableCell><TableCell>Coach</TableCell>
                  {c.points.map((p) => <TableCell key={p.id}>{p.libelle}</TableCell>)}
                  <TableCell>Exécution</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibles.map((m) => {
                  const e = executionMagasin(reseau.campagnes, c, m.nom)
                  return (
                    <TableRow key={m.nom}>
                      <TableCell><Link component={RouterLink} to={lienFiche(m.nom)}>{m.nom}</Link></TableCell>
                      <TableCell>{coachA(m, reseau.jour) || '—'}</TableCell>
                      {c.points.map((p) => <TableCell key={p.id}><ChoixConstat libelle={`${m.nom}, ${p.libelle}`} valeur={d.valeur(c, m.nom, p.id)} onChange={(v) => d.changer(c, m.nom, p.id, v)} /></TableCell>)}
                      <TableCell><Chip size="small" color={couleursExecution[e]} variant="outlined" label={libellesExecution[e]} sx={{ fontSize: 13 }} /></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {visibles.map((m) => {
              const e = executionMagasin(reseau.campagnes, c, m.nom)
              return (
                <Card key={m.nom} component="section" aria-label={m.nom}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Link component={RouterLink} to={lienFiche(m.nom)} sx={{ fontWeight: 600 }}>{m.nom}</Link>
                        <Typography variant="body2" color="text.secondary">{coachA(m, reseau.jour) || 'Sans Coach'}</Typography>
                      </Box>
                      <Chip size="small" color={couleursExecution[e]} variant="outlined" label={libellesExecution[e]} sx={{ fontSize: 13 }} />
                    </Box>
                    {c.points.map((p) => (
                      <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                        <Typography variant="body2" sx={{ flex: 1 }}>{p.libelle}</Typography>
                        <ChoixConstat libelle={`${m.nom}, ${p.libelle}`} valeur={d.valeur(c, m.nom, p.id)} onChange={(v) => d.changer(c, m.nom, p.id, v)} />
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              )
            })}
          </Box>
        )}
    </>
  )
}

// ── Créer ou modifier une campagne ──
const SUPPRIMEE = 'Campagne supprimée.'

function DialogCampagne({ reseau, campagne, onFermer }: { reseau: Reseau; campagne: Campagne | null; onFermer: (m?: string, id?: string | null) => void }) {
  const droits = useDroitsCampagnes()
  // Campagne régionale : celle d'un Responsable Régional, ou toute campagne qu'il crée
  const rr = campagne ? campagne.rr : droits.referentiels ? undefined : droits.monRR
  const regionale = !!rr
  const choixPerimetre = regionale ? perimetresRegion : perimetres
  const magasinsPossibles = rr ? magasinsDu(reseau, { type: 'rr', id: rr }) : reseau.magasins
  const [id] = useState(() => campagne?.id ?? `c${Date.now().toString(36)}`)
  const [nom, setNom] = useState(campagne?.nom ?? '')
  const [debut, setDebut] = useState(campagne?.debut ?? reseau.jour)
  const [fin, setFin] = useState(campagne?.fin ?? '')
  const [points, setPoints] = useState(campagne?.points.length ? campagne.points.map((p) => ({ ...p })) : [{ id: 'p1', libelle: '' }])
  const [perimetre, setPerimetre] = useState<Perimetre>(campagne?.perimetre ?? choixPerimetre[0].id)
  const [magasins, setMagasins] = useState<string[]>(campagne?.magasins ?? [])
  const datesOk = /^\d{4}-\d{2}-\d{2}$/.test(debut) && /^\d{4}-\d{2}-\d{2}$/.test(fin) && fin >= debut
  const remplis = points.filter((p) => p.libelle.trim())
  const valide = !!nom.trim() && datesOk && remplis.length > 0 && (perimetre !== 'choix' || magasins.length > 0)
  const constats = Object.keys(reseau.campagnes.constats[id] ?? {}).length
  const nouveauPoint = () => { const n = Math.max(0, ...points.map((p) => Number(p.id.slice(1)) || 0)) + 1; setPoints((x) => [...x, { id: `p${n}`, libelle: '' }]) }
  return (
    <Fenetre large titre={campagne ? `Modifier ${campagne.nom}` : 'Nouvelle campagne'} ouvert valide={valide}
      onFermer={(m) => onFermer(m, m === SUPPRIMEE ? null : m ? id : undefined)}
      enregistrer={async () => {
        await enregistrerCampagne(id, { id, nom: nom.trim(), debut, fin, points: remplis.map((p) => ({ id: p.id, libelle: p.libelle.trim() })), perimetre, magasins: perimetre === 'choix' ? magasins : [], ...(rr ? { rr } : {}) }, regionale)
        return campagne ? 'Campagne mise à jour.' : 'Campagne créée.'
      }}
      supprimer={campagne ? async () => { await enregistrerCampagne(id, null, regionale); return SUPPRIMEE } : undefined}
      libelleSuppression={campagne ? `Supprimer la campagne ${campagne.nom}${constats ? ` et les constats de ses ${constats} magasin${constats > 1 ? 's' : ''}` : ''} ?` : undefined}>
      <TextField label="Nom de la campagne" value={nom} onChange={(e) => setNom(e.target.value)} required autoFocus={!campagne} />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField type="date" label="Début" value={debut} onChange={(e) => setDebut(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} required />
        <TextField type="date" label="Fin" value={fin} onChange={(e) => setFin(e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: debut } }} required
          error={!!fin && fin < debut} helperText={fin && fin < debut ? 'La fin doit suivre le début.' : ' '} />
      </Box>
      <Box>
        <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>Points à constater</Typography>
        {points.map((p, i) => (
          <Box key={p.id} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5 }}>
            <TextField label={`Point ${i + 1}`} value={p.libelle} onChange={(e) => setPoints((x) => x.map((y) => (y.id === p.id ? { ...y, libelle: e.target.value } : y)))} sx={{ flex: 1 }} />
            <IconButton aria-label={`Retirer le point ${i + 1}`} disabled={points.length <= 1} onClick={() => setPoints((x) => x.filter((y) => y.id !== p.id))}><CloseOutlined /></IconButton>
          </Box>
        ))}
        {points.length < MAX_POINTS && <Button startIcon={<AddOutlined />} onClick={nouveauPoint} sx={{ minHeight: 48 }}>Ajouter un point</Button>}
      </Box>
      <TextField select label="Magasins concernés" value={perimetre} onChange={(e) => setPerimetre(e.target.value as Perimetre)}>
        {choixPerimetre.map((p) => <MenuItem key={p.id} value={p.id}>{p.libelle}</MenuItem>)}
      </TextField>
      {perimetre === 'choix' && (
        <Autocomplete multiple options={magasinsPossibles.map((m) => m.nom)} value={magasins} onChange={(_e, v) => setMagasins(v)} disableCloseOnSelect
          renderInput={(p) => <TextField {...p} label="Magasins" />} noOptionsText="Aucun magasin ne correspond" />
      )}
      {perimetre !== 'choix' && <Typography variant="body2" color="text.secondary">{magasinsConcernes(reseau, { id, nom, debut, fin, points, perimetre, magasins, rr }).length} magasins</Typography>}
    </Fenetre>
  )
}

const lienCampagne = (c: Campagne) => `/plus/sante?vue=campagnes&campagne=${encodeURIComponent(c.id)}`

// État des lieux des campagnes d'un magasin : à constater pour celles en cours, exécution des précédentes
export function CampagnesMagasin({ reseau, magasin, signaler }: { reseau: Reseau; magasin: string; signaler: (m: string) => void }) {
  const encours = campagnesDuMagasin(reseau, magasin, reseau.jour)
  const autres = reseau.campagnes.liste.filter((c) => phase(c, reseau.jour) !== 'encours' && magasinsConcernes(reseau, c).some((m) => m.nom === magasin))
    .sort((a, b) => b.debut.localeCompare(a.debut))
  if (!encours.length && !autres.length) return <Typography variant="body2" color="text.secondary">Aucune campagne ne concerne ce magasin.</Typography>
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {encours.length > 0 && <ConstatsMagasin reseau={reseau} magasin={magasin} signaler={signaler} />}
      {autres.length > 0 && (
        <Box>
          <Typography variant="subtitle2" component="h3" sx={{ mb: 0.5 }}>Autres campagnes</Typography>
          {autres.map((c) => {
            const e = executionMagasin(reseau.campagnes, c, magasin)
            const ph = phase(c, reseau.jour)
            return (
              <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Link component={RouterLink} to={lienCampagne(c)} sx={{ fontWeight: 500 }}>{c.nom}</Link>
                  <Typography variant="body2" color="text.secondary">Du {dateCourte(c.debut)} au {dateCourte(c.fin)}</Typography>
                </Box>
                <Chip size="small" label={ph === 'avenir' ? 'À venir' : libellesExecution[e]} color={ph === 'avenir' ? 'default' : couleursExecution[e]} variant={ph === 'avenir' ? 'outlined' : 'filled'} sx={{ fontSize: 12, fontWeight: 600 }} />
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}

// Campagnes en cours et terminées sur un portefeuille de magasins (Coach, Responsable Régional)
export function BilanCampagnes({ reseau, magasins }: { reseau: Reseau; magasins: Magasin[] }) {
  const noms = new Set(magasins.map((m) => m.nom))
  const liste = reseau.campagnes.liste.filter((c) => phase(c, reseau.jour) !== 'avenir')
    .map((c) => ({ c, ms: magasinsConcernes(reseau, c).filter((m) => noms.has(m.nom)) })).filter((x) => x.ms.length)
    .sort((a, b) => b.c.debut.localeCompare(a.c.debut))
  if (!liste.length) return <Typography variant="body2" color="text.secondary">Aucune campagne en cours ou passée sur ces magasins.</Typography>
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {liste.map(({ c, ms }) => {
        const b = bilan(reseau.campagnes, c, ms)
        const aFaire = ms.filter((m) => executionMagasin(reseau.campagnes, c, m.nom) !== 'fait')
        return (
          <Box key={c.id}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Link component={RouterLink} to={lienCampagne(c)} variant="body1" sx={{ fontWeight: 600, flex: 1 }}>{c.nom}</Link>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>{b.taux === null ? '—' : `${b.taux} %`}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{libellesPhase[phase(c, reseau.jour)]} · {resumeBilan(b)}</Typography>
            <BarreExecution b={b} libelle={c.nom} />
            {phase(c, reseau.jour) === 'encours' && aFaire.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                {aFaire.map((m) => {
                  const e = executionMagasin(reseau.campagnes, c, m.nom)
                  return <Chip key={m.nom} size="small" component={RouterLink} to={`${lienFiche(m.nom)}?vue=campagnes`} clickable label={`${m.nom} · ${libellesExecution[e]}`} color={couleursExecution[e]} variant="outlined" sx={{ fontSize: 12, minHeight: 32 }} />
                })}
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
