import { useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import Tab from '@mui/material/Tab'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tabs from '@mui/material/Tabs'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import SearchOffOutlined from '@mui/icons-material/SearchOffOutlined'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { Fenetre } from '../components/EditionEquipe'
import { PastilleCase, SelectDeploiement, SelectNote, useSaisieSante } from '../components/Sante'
import { coachA } from '../data/charge'
import { enregistrerThematiques } from '../data/chargement'
import { avancement, caseDe, critereManagement, criteresResultats, nineBox, tousCriteres, type Thematique, type Ton } from '../data/sante'
import { lienFiche } from '../lib/format'
import type { Magasin, Reseau } from '../data/modele'

type Saisie = ReturnType<typeof useSaisieSante>

// Filtres communs : Responsable Régional, Coach, recherche
function useFiltres(reseau: Reseau) {
  const [rr, setRR] = useState('')
  const [coach, setCoach] = useState('')
  const [recherche, setRecherche] = useState('')
  const magasins = reseau.magasins
    .filter((m) => m.statut !== 'avenir')
    .filter((m) => (!rr || m.rr?.id === rr) && (!coach || coachA(m, reseau.jour) === coach) && (!recherche || `${m.nom} ${m.ville}`.toLowerCase().includes(recherche.toLowerCase())))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  const coachs = [...new Set(reseau.magasins.map((m) => coachA(m, reseau.jour)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  const barre = (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '2fr 1fr 1fr' }, mb: 2 }}>
      <TextField label="Rechercher un magasin" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      <TextField select label="Responsable Régional" value={rr} onChange={(e) => setRR(e.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
        <MenuItem value="">Tous les Responsables Régionaux</MenuItem>
        {reseau.rrs.map((r) => <MenuItem key={r.id} value={r.id}>{r.nom}</MenuItem>)}
      </TextField>
      <TextField select label="Coach" value={coach} onChange={(e) => setCoach(e.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
        <MenuItem value="">Tous les Coachs</MenuItem>
        {coachs.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
      </TextField>
    </Box>
  )
  return { magasins, barre }
}

const texteSur = (couleur: string) => (['#f6c544', '#8bc34a'].includes(couleur) ? '#1d1d1b' : '#fff')
const niveaux = ['Faible', 'Moyen', 'Fort']

function VueNineBox({ reseau, saisie, evaluer }: { reseau: Reseau; saisie: Saisie; evaluer: () => void }) {
  const { magasins, barre } = useFiltres(reseau)
  const classes = magasins.map((m) => ({ m, c: caseDe(saisie.evaluation(m.nom)) }))
  const nonClasses = classes.filter((x) => !x.c).length
  return (
    <>
      {barre}
      {nonClasses > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography sx={{ flex: 1, minWidth: 220 }}>{nonClasses} magasin{nonClasses > 1 ? 's' : ''} sur {magasins.length} pas encore classé{nonClasses > 1 ? 's' : ''} : il faut au moins un critère de résultats et le niveau du franchisé.</Typography>
            <Button variant="outlined" onClick={evaluer} sx={{ minHeight: 48 }}>Évaluer les magasins</Button>
          </CardContent>
        </Card>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'auto 1fr 1fr 1fr' }, gap: 1.5 }} role="table" aria-label="Nine box">
        {[3, 2, 1].map((mg) => (
          <Box key={mg} sx={{ display: 'contents' }} role="row">
            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', px: 0.5 }}>
              <Typography variant="body2" color="text.secondary">Management {niveaux[mg - 1].toLowerCase()}</Typography>
            </Box>
            {[1, 2, 3].map((rs) => {
              const c = nineBox.find((x) => x.resultats === rs && x.management === mg)!
              const liste = classes.filter((x) => x.c?.id === c.id).map((x) => x.m)
              return (
                <Card key={c.id} role="cell" aria-label={`${c.libelle} : ${liste.length} magasin${liste.length > 1 ? 's' : ''}`} sx={{ borderTop: `6px solid ${c.couleur}`, minHeight: { md: 180 } }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography variant="h3" component="h2" sx={{ flex: 1 }}>{c.libelle}</Typography>
                      <Box component="span" sx={{ bgcolor: c.couleur, color: texteSur(c.couleur), borderRadius: 4, px: 1.25, fontWeight: 700, fontSize: 14 }}>{liste.length}</Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Résultats {niveaux[rs - 1].toLowerCase()} · management {niveaux[mg - 1].toLowerCase()} · rythme {c.rythme}</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {liste.map((m) => <Link key={m.nom} component={RouterLink} to={lienFiche(m.nom)} sx={{ fontSize: 14, minHeight: 32, display: 'inline-flex', alignItems: 'center' }}>{m.nom}</Link>)}
                    </Box>
                  </CardContent>
                </Card>
              )
            })}
          </Box>
        ))}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, textAlign: { md: 'center' } }}>Colonnes : résultats (moyenne de CA marché extérieur, paniers et flux cave et bar), de faible à fort. Lignes : niveau du franchisé.</Typography>
    </>
  )
}

function VueEvaluer({ reseau, saisie, surPC }: { reseau: Reseau; saisie: Saisie; surPC: boolean }) {
  const { magasins, barre } = useFiltres(reseau)
  if (!surPC) return (
    <>
      {barre}
      {magasins.length === 0 && <EmptyState icone={<SearchOffOutlined />} titre="Aucun magasin" texte="Aucun magasin ne correspond à ces filtres." />}
      {magasins.map((m) => (
        <Card key={m.nom} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <Link component={RouterLink} to={lienFiche(m.nom)} variant="h3" sx={{ flex: 1 }}>{m.nom}</Link>
              <PastilleCase c={caseDe(saisie.evaluation(m.nom))} />
            </Box>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr' }}>
              {tousCriteres.map((c) => <SelectNote key={c.id} libelle={`${c.libelle} de ${m.nom}`} valeur={saisie.evaluation(m.nom)?.notes[c.id]} onChange={(n) => saisie.noter(m.nom, c.id, n)} />)}
            </Box>
          </CardContent>
        </Card>
      ))}
    </>
  )
  return (
    <>
      {barre}
      <TableContainer component={Card}>
        <Table size="small" aria-label="Évaluation des magasins">
          <TableHead>
            <TableRow>
              <TableCell>Magasin</TableCell>
              {criteresResultats.map((c) => <TableCell key={c.id}>{c.libelle}</TableCell>)}
              <TableCell>Franchisé</TableCell>
              <TableCell>Case</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {magasins.map((m) => (
              <TableRow key={m.nom} hover>
                <TableCell><Link component={RouterLink} to={lienFiche(m.nom)}>{m.nom}</Link></TableCell>
                {[...criteresResultats, critereManagement].map((c) => (
                  <TableCell key={c.id}><SelectNote compact libelle={`${c.libelle} de ${m.nom}`} valeur={saisie.evaluation(m.nom)?.notes[c.id]} onChange={(n) => saisie.noter(m.nom, c.id, n)} /></TableCell>
                ))}
                <TableCell><PastilleCase c={caseDe(saisie.evaluation(m.nom))} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {magasins.length === 0 && <EmptyState icone={<SearchOffOutlined />} titre="Aucun magasin" texte="Aucun magasin ne correspond à ces filtres." />}
    </>
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

function VueDeploiements({ reseau, saisie, surPC, gerer }: { reseau: Reseau; saisie: Saisie; surPC: boolean; gerer: () => void }) {
  const { magasins, barre } = useFiltres(reseau)
  const ths = reseau.deploiements.thematiques
  return (
    <>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' }, mb: 3 }}>
        {ths.map((t) => <Avancement key={t.id} reseau={reseau} t={t} />)}
      </Box>
      {barre}
      {magasins.length === 0 && <EmptyState icone={<SearchOffOutlined />} titre="Aucun magasin" texte="Aucun magasin ne correspond à ces filtres." />}
      {surPC ? (
        <TableContainer component={Card}>
          <Table size="small" aria-label="Déploiements par magasin">
            <TableHead>
              <TableRow>
                <TableCell>Magasin</TableCell>
                {ths.map((t) => <TableCell key={t.id}>{t.libelle}</TableCell>)}
                <TableCell padding="checkbox"><Tooltip title="Gérer les thématiques"><IconButton onClick={gerer} aria-label="Gérer les thématiques"><TuneOutlined /></IconButton></Tooltip></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {magasins.map((m) => (
                <TableRow key={m.nom} hover>
                  <TableCell><Link component={RouterLink} to={lienFiche(m.nom)}>{m.nom}</Link></TableCell>
                  {ths.map((t) => <TableCell key={t.id}><SelectDeploiement compact t={t} libelle={`${t.libelle} de ${m.nom}`} valeur={saisie.etat(m.nom, t.id)} onChange={(v) => saisie.deployer(m.nom, t.id, v)} /></TableCell>)}
                  <TableCell />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : magasins.map((m: Magasin) => (
        <Card key={m.nom} sx={{ mb: 2 }}>
          <CardContent>
            <Link component={RouterLink} to={lienFiche(m.nom)} variant="h3" sx={{ display: 'block', mb: 2 }}>{m.nom}</Link>
            <Box sx={{ display: 'grid', gap: 2 }}>
              {ths.map((t) => <SelectDeploiement key={t.id} t={t} libelle={`${t.libelle} de ${m.nom}`} valeur={saisie.etat(m.nom, t.id)} onChange={(v) => saisie.deployer(m.nom, t.id, v)} />)}
            </Box>
          </CardContent>
        </Card>
      ))}
    </>
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
      <Typography variant="body2" color="text.secondary">Supprimer une thématique efface aussi les états saisis pour elle dans tous les magasins.</Typography>
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

export function SanteParc() {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const [params, setParams] = useSearchParams()
  const vue = ['evaluer', 'deploiements'].includes(params.get('vue') ?? '') ? params.get('vue')! : 'ninebox'
  const [message, setMessage] = useState('')
  const [gestion, setGestion] = useState(false)
  return (
    <AvecReseau>
      {(reseau) => <Contenu reseau={reseau} vue={vue} surPC={surPC} aller={(v) => setParams({ vue: v }, { replace: true })} message={message} setMessage={setMessage} gestion={gestion} setGestion={setGestion} />}
    </AvecReseau>
  )
}

function Contenu({ reseau, vue, surPC, aller, message, setMessage, gestion, setGestion }: {
  reseau: Reseau; vue: string; surPC: boolean; aller: (v: string) => void; message: string; setMessage: (m: string) => void; gestion: boolean; setGestion: (b: boolean) => void
}) {
  const saisie = useSaisieSante(reseau, setMessage)
  const actifs = reseau.magasins.filter((m) => m.statut !== 'avenir')
  const classes = actifs.filter((m) => caseDe(saisie.evaluation(m.nom))).length
  return (
    <>
      <PageHeader titre="Santé du parc" sousTitre={`${classes} magasin${classes > 1 ? 's' : ''} classé${classes > 1 ? 's' : ''} sur ${actifs.length} · notes saisies à la main en attendant le lien avec la BI`}
        actions={vue === 'deploiements' ? <Button variant="contained" startIcon={<TuneOutlined />} onClick={() => setGestion(true)} sx={{ minHeight: 48 }}>Gérer les thématiques</Button> : undefined} />
      <Tabs value={vue} onChange={(_e, v) => aller(v)} aria-label="Rubriques de la santé du parc" variant="scrollable" sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab value="ninebox" label="Nine box" sx={{ minHeight: 48 }} />
        <Tab value="evaluer" label="Évaluer" sx={{ minHeight: 48 }} />
        <Tab value="deploiements" label="Déploiements" sx={{ minHeight: 48 }} />
      </Tabs>
      {vue === 'ninebox' && <VueNineBox reseau={reseau} saisie={saisie} evaluer={() => aller('evaluer')} />}
      {vue === 'evaluer' && <VueEvaluer reseau={reseau} saisie={saisie} surPC={surPC} />}
      {vue === 'deploiements' && <VueDeploiements reseau={reseau} saisie={saisie} surPC={surPC} gerer={() => setGestion(true)} />}
      {gestion && <DialogThematiques reseau={reseau} onFermer={(m) => { setGestion(false); if (m) setMessage(m) }} />}
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </>
  )
}

