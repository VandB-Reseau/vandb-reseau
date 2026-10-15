import { useMemo, useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Link from '@mui/material/Link'
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
import EditOutlined from '@mui/icons-material/EditOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import { RechercheFiltres } from '../components/RechercheFiltres'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { DialogVisite, visiteurs } from '../components/DialogVisite'
import { PastilleSignature, PastilleTypeVisite } from '../components/PastilleVisite'
import { anneeDe, anneesDisponibles, lienCompteRendu, semestresDisponibles, suiviRythme, type LigneRythme } from '../data/visites'
import { nineBox } from '../data/sante'
import { PastilleCase } from '../components/Sante'
import { FiltreMenu } from '../components/FiltreMenu'
import Chip from '@mui/material/Chip'
import InputAdornment from '@mui/material/InputAdornment'
import SearchIcon from '@mui/icons-material/Search'
import { dateCourte, lienCoach, lienFiche } from '../lib/format'
import { nomsVisiteurs, typesVisite, type Reseau, type Visite } from '../data/modele'

type Edition = { visite: Visite | null; magasins: string[] } | null

type Etat = 'retard' | 'ajour'

function VueRythme({ reseau, saisir, surPC }: { reseau: Reseau; saisir: (magasins: string[]) => void; surPC: boolean }) {
  const annees = anneesDisponibles(reseau)
  const [cle, setCle] = useState(anneeDe(reseau.jour).cle)
  const [texte, setTexte] = useState('')
  const [coachs, setCoachs] = useState<string[]>([])
  const [cases, setCases] = useState<string[]>([])
  const [etats, setEtats] = useState<string[]>([])
  const a = annees.find((x) => x.cle === cle) ?? annees[0]
  const toutes = suiviRythme(reseau, a)
  const t = texte.trim().toLowerCase()
  const lignes = toutes
    .filter((l) => !coachs.length || coachs.includes(l.coach || '__aucun__'))
    .filter((l) => !cases.length || cases.includes(l.case?.id ?? '__aucune__'))
    .filter((l) => !etats.length || etats.includes(l.retard ? 'retard' : 'ajour'))
    .filter((l) => !t || `${l.magasin.nom} ${l.magasin.ville} ${l.magasin.departement} ${l.coach}`.toLowerCase().includes(t))
    .sort((x, y) => y.retard - x.retard || x.prochaine.localeCompare(y.prochaine) || x.magasin.nom.localeCompare(y.magasin.nom, 'fr'))
  const faites = lignes.reduce((n, l) => n + Math.min(l.faites, l.objectif), 0)
  const objectif = lignes.reduce((n, l) => n + l.objectif, 0)
  const enRetard = lignes.filter((l) => l.retard > 0)
  const taux = objectif ? Math.round((faites / objectif) * 100) : 0
  const listeCoachs = [...new Set(toutes.map((l) => l.coach).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'fr'))
  const parCoach = [...new Set(lignes.map((l) => l.coach))].map((c) => {
    const ls = lignes.filter((l) => l.coach === c)
    return { coach: c, ls, faites: ls.reduce((n, l) => n + Math.min(l.faites, l.objectif), 0), objectif: ls.reduce((n, l) => n + l.objectif, 0), jours: ls.reduce((n, l) => n + l.jours, 0), retard: ls.filter((l) => l.retard > 0) }
  }).sort((x, y) => y.retard.length - x.retard.length || x.coach.localeCompare(y.coach, 'fr'))
  const actifs = coachs.length + cases.length + etats.length
  const mag = (p: (l: LigneRythme) => boolean) => { const n = toutes.filter(p).length; return `${n} magasin${n > 1 ? 's' : ''}` }
  const jours = (n: number) => `${String(Math.round(n * 10) / 10).replace('.', ',')} j`
  const visites = (l: LigneRythme) => `${l.faites} sur ${l.objectif}`

  return (
    <>
      <RechercheFiltres actifs={actifs}
        recherche={<ChampRecherche valeur={texte} onChange={setTexte} libelle="Magasin, ville, Coach…" />}
        pc={(r, f) => <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>{r}{f}</Box>}>
        <FiltreMenu unique libelle="Année" choisis={[a.cle]} onChange={(v) => setCle(v[0])} options={annees.map((x) => ({ valeur: x.cle, libelle: x.court }))} />
        <FiltreMenu libelle="Coach" choisis={coachs} onChange={setCoachs}
          options={[...listeCoachs.map((c) => ({ valeur: c, libelle: c, detail: `${mag((l) => l.coach === c)}` })), { valeur: '__aucun__', libelle: 'Sans Coach', detail: `${mag((l) => !l.coach)}` }]} />
        <FiltreMenu libelle="Nine box" choisis={cases} onChange={setCases}
          options={[...nineBox.map((c) => ({ valeur: c.id, libelle: c.libelle, detail: `${c.rythme} · ${mag((l) => l.case?.id === c.id)}` })), { valeur: '__aucune__', libelle: 'Non classé', detail: `2 visites · ${mag((l) => !l.case)}` }]} />
        <FiltreMenu libelle="État" choisis={etats} onChange={setEtats}
          options={[{ valeur: 'retard' satisfies Etat, libelle: 'En retard', detail: `${mag((l) => l.retard > 0)}` }, { valeur: 'ajour' satisfies Etat, libelle: 'À jour', detail: `${mag((l) => !l.retard)}` }]} />
        {(actifs > 0 || texte) && <Button onClick={() => { setCoachs([]); setCases([]); setEtats([]); setTexte('') }} sx={{ minHeight: 36 }}>Effacer les filtres</Button>}
      </RechercheFiltres>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
            <Typography variant="h2" component="p">{faites} sur {objectif}</Typography>
            <Typography variant="body1" color="text.secondary">visites faites en {a.court} · {enRetard.length} magasin{enRetard.length > 1 ? 's' : ''} en retard</Typography>
          </Box>
          <LinearProgress variant="determinate" value={taux} color={enRetard.length ? 'primary' : 'success'} aria-label={`Visites faites ${taux} %`} sx={{ height: 10, borderRadius: 5, bgcolor: 'action.hover' }} />
        </CardContent>
      </Card>

      {lignes.length === 0 ? (
        <EmptyState icone={<EventNoteOutlined />} titre="Aucun magasin" texte="Aucun magasin ne correspond à ces filtres." />
      ) : (
        <>
          <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>Par Coach</Typography>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: '1fr 1fr 1fr' }, mb: 3 }}>
            {parCoach.map((g) => (
              <Card key={g.coach} component="section" aria-label={g.coach || 'Sans Coach'}>
                <CardContent sx={{ p: 2, pb: '12px !important' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h4" component="h3" sx={{ flex: 1, minWidth: 0 }} noWrap>
                      {g.coach ? <Link component={RouterLink} to={lienCoach(g.coach)} color="inherit">{g.coach}</Link> : 'Sans Coach'}
                    </Typography>
                    {g.retard.length > 0 && <Button size="small" startIcon={<AddOutlined />} onClick={() => saisir(g.retard.map((l) => l.magasin.nom))} sx={{ minHeight: 48 }}>Tournée</Button>}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {g.faites} visites sur {g.objectif} · {jours(g.jours)} de visite sur l’année · {g.retard.length ? `${g.retard.length} magasin${g.retard.length > 1 ? 's' : ''} en retard` : 'à jour'}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>Par magasin ({lignes.length})</Typography>
          {surPC ? (
            <Card>
              <TableContainer>
                <Table aria-label="Rythme de visite par magasin" size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Magasin</TableCell><TableCell>Coach</TableCell><TableCell>Nine box</TableCell><TableCell>Visites de l’année</TableCell><TableCell>Dernière visite</TableCell><TableCell>Prochaine visite</TableCell><TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lignes.map((l) => (
                      <TableRow key={l.magasin.nom} hover>
                        <TableCell><Link component={RouterLink} to={lienFiche(l.magasin.nom)} sx={{ fontWeight: 600 }}>{l.magasin.nom}</Link></TableCell>
                        <TableCell>{l.coach || <Typography variant="body2" color="text.secondary">Sans Coach</Typography>}</TableCell>
                        <TableCell><PastilleCase c={l.case} /></TableCell>
                        <TableCell sx={{ minWidth: 140 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{visites(l)}</Typography>
                          <LinearProgress variant="determinate" value={Math.min(100, (l.faites / l.objectif) * 100)} color={l.faites >= l.objectif ? 'success' : 'primary'} aria-hidden sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover' }} />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{l.derniere ? dateCourte(l.derniere.date) : <Typography variant="body2" color="text.secondary">Jamais visité</Typography>}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}><Echeance l={l} /></TableCell>
                        <TableCell sx={{ py: 0 }}><Tooltip title="Saisir une visite"><IconButton aria-label={`Saisir une visite pour ${l.magasin.nom}`} onClick={() => saisir([l.magasin.nom])}><AddOutlined /></IconButton></Tooltip></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {lignes.map((l) => (
                <Card key={l.magasin.nom}>
                  <CardContent sx={{ pb: '12px !important' }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Link component={RouterLink} to={lienFiche(l.magasin.nom)} variant="h4" sx={{ display: 'block' }}>{l.magasin.nom}</Link>
                        <Typography variant="body2" color="text.secondary">{l.coach ? `Coach ${l.coach}` : 'Sans Coach'} · {l.derniere ? `dernière visite le ${dateCourte(l.derniere.date)}` : 'jamais visité'}</Typography>
                      </Box>
                      <IconButton aria-label={`Saisir une visite pour ${l.magasin.nom}`} onClick={() => saisir([l.magasin.nom])}><AddOutlined /></IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1, alignItems: 'center' }}>
                      <PastilleCase c={l.case} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{visites(l)} en {a.court}</Typography>
                      <Echeance l={l} />
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </>
      )}
    </>
  )
}

function Echeance({ l }: { l: LigneRythme }) {
  return l.retard
    ? <Chip size="small" color="warning" label={`${l.retard} j de retard`} sx={{ fontSize: 12, fontWeight: 600 }} />
    : <Typography variant="body2" color="text.secondary" component="span">avant le {dateCourte(l.prochaine)}</Typography>
}

function ChampRecherche({ valeur, onChange, libelle }: { valeur: string; onChange: (v: string) => void; libelle: string }) {
  return (
    <TextField size="small" placeholder={libelle} value={valeur} onChange={(e) => onChange(e.target.value)}
      slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }, htmlInput: { 'aria-label': libelle } }}
      sx={{ width: { xs: '100%', md: 320 }, '& .MuiOutlinedInput-root': { borderRadius: 999, minHeight: { xs: 48, md: 40 } } }} />
  )
}

function VueHistorique({ reseau, modifier, surPC }: { reseau: Reseau; modifier: (v: Visite) => void; surPC: boolean }) {
  const semestres = semestresDisponibles(reseau)
  const [cle, setCle] = useState('')
  const [type, setType] = useState('')
  const [visiteur, setVisiteur] = useState('')
  const [recherche, setRecherche] = useState('')
  const s = semestres.find((x) => x.cle === cle)
  const liste = useMemo(() => reseau.visites
    .filter((v) => (!s || (v.date >= s.debut && v.date <= s.fin)) && (!type || v.type === type) && (!visiteur || v.visiteurs.includes(visiteur))
      && (!recherche || `${v.magasin} ${v.notes}`.toLowerCase().includes(recherche.toLowerCase())))
    .sort((a, b) => b.date.localeCompare(a.date)), [reseau, s, type, visiteur, recherche])
  const Actions = ({ v }: { v: Visite }) => (
    <Box sx={{ display: 'flex' }}>
      <Tooltip title="Compte rendu PDF"><IconButton component={RouterLink} to={lienCompteRendu(v)} aria-label={`Compte rendu de ${v.magasin} du ${dateCourte(v.date)}`}><PictureAsPdfOutlined /></IconButton></Tooltip>
      <Tooltip title="Modifier"><IconButton onClick={() => modifier(v)} aria-label={`Modifier la visite de ${v.magasin} du ${dateCourte(v.date)}`}><EditOutlined /></IconButton></Tooltip>
    </Box>
  )
  return (
    <>
      <RechercheFiltres actifs={(cle ? 1 : 0) + (type ? 1 : 0) + (visiteur ? 1 : 0)}
        recherche={<ChampRecherche valeur={recherche} onChange={setRecherche} libelle="Rechercher un magasin ou une note" />}
        pc={(r, f) => <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>{r}{f}</Box>}>
        <FiltreMenu libelle="Période" choisis={cle ? [cle] : []} onChange={(v) => setCle(v.at(-1) ?? '')} options={semestres.map((x) => ({ valeur: x.cle, libelle: x.court }))} />
        <FiltreMenu libelle="Type" choisis={type ? [type] : []} onChange={(v) => setType(v.at(-1) ?? '')} options={typesVisite.map((t) => ({ valeur: t.id, libelle: t.libelle }))} />
        <FiltreMenu libelle="Visité par" choisis={visiteur ? [visiteur] : []} onChange={(v) => setVisiteur(v.at(-1) ?? '')} options={visiteurs(reseau).map((n) => ({ valeur: n, libelle: n }))} />
        {(cle || type || visiteur || recherche) && <Button onClick={() => { setCle(''); setType(''); setVisiteur(''); setRecherche('') }} sx={{ minHeight: 36 }}>Effacer les filtres</Button>}
      </RechercheFiltres>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{liste.length} visite{liste.length > 1 ? 's' : ''}</Typography>
      {liste.length === 0 ? (
        <EmptyState icone={<EventNoteOutlined />} titre="Aucune visite" texte={reseau.visites.length ? 'Aucune visite ne correspond à ces filtres.' : 'Saisis ta première visite avec le bouton « Saisir une visite ».'} />
      ) : surPC ? (
        <Card>
          <TableContainer>
            <Table aria-label="Visites">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell><TableCell>Magasin</TableCell><TableCell>Type</TableCell><TableCell>Visité par</TableCell><TableCell>Notes</TableCell><TableCell>Compte rendu</TableCell><TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {liste.map((v) => (
                  <TableRow key={v.id ?? `${v.magasin}-${v.date}`} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{dateCourte(v.date)}</TableCell>
                    <TableCell><Link component={RouterLink} to={lienFiche(v.magasin)} sx={{ fontWeight: 600 }}>{v.magasin}</Link></TableCell>
                    <TableCell><PastilleTypeVisite type={v.type} /></TableCell>
                    <TableCell>{nomsVisiteurs(v) || <Typography variant="body2" color="text.secondary">Non précisé</Typography>}</TableCell>
                    <TableCell sx={{ maxWidth: 320 }}><Typography variant="body2" noWrap>{v.notes}</Typography></TableCell>
                    <TableCell><PastilleSignature requise={v.signatureRequise} signe={!!v.lienSigne} /></TableCell>
                    <TableCell sx={{ py: 0 }}><Actions v={v} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {liste.map((v) => (
            <Card key={v.id ?? `${v.magasin}-${v.date}`}>
              <CardContent sx={{ pb: '12px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Link component={RouterLink} to={lienFiche(v.magasin)} variant="h4" sx={{ display: 'block' }}>{v.magasin}</Link>
                    <Typography variant="body2" color="text.secondary">{dateCourte(v.date)}{v.visiteurs.length ? ` · ${nomsVisiteurs(v)}` : ''}</Typography>
                  </Box>
                  <Actions v={v} />
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}><PastilleTypeVisite type={v.type} /><PastilleSignature requise={v.signatureRequise} signe={!!v.lienSigne} /></Box>
                {v.notes && <Typography variant="body2" sx={{ mt: 1 }}>{v.notes}</Typography>}
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </>
  )
}

export function Visites() {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const [params, setParams] = useSearchParams()
  const vue = params.get('vue') === 'historique' ? 'historique' : 'rythme'
  const [edition, setEdition] = useState<Edition>(null)
  const [message, setMessage] = useState('')
  return (
    <AvecReseau>
      {(reseau) => (
        <>
          <PageHeader
            titre="Visites"
            sousTitre={`${reseau.visites.length} visite${reseau.visites.length > 1 ? 's' : ''} enregistrée${reseau.visites.length > 1 ? 's' : ''}`}
            actions={<Button variant="contained" startIcon={<AddOutlined />} onClick={() => setEdition({ visite: null, magasins: [] })} sx={{ minHeight: 48 }}>Saisir une visite</Button>}
          />
          <Tabs value={vue} onChange={(_e, v) => setParams({ vue: v }, { replace: true })} aria-label="Rubriques des visites" sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Tab value="rythme" label="Rythme de visite" sx={{ minHeight: 48 }} />
            <Tab value="historique" label="Historique" sx={{ minHeight: 48 }} />
          </Tabs>
          {vue === 'historique'
            ? <VueHistorique reseau={reseau} surPC={surPC} modifier={(v) => setEdition({ visite: v, magasins: [v.magasin] })} />
            : <VueRythme reseau={reseau} surPC={surPC} saisir={(m) => setEdition({ visite: null, magasins: m })} />}
          {edition && <DialogVisite reseau={reseau} visite={edition.visite} magasinsInitiaux={edition.magasins} onFermer={(m) => { setEdition(null); if (m) setMessage(m) }} />}
          <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
        </>
      )}
    </AvecReseau>
  )
}
