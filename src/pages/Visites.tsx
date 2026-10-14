import { useMemo, useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
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
import EditOutlined from '@mui/icons-material/EditOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { DialogVisite, visiteurs } from '../components/DialogVisite'
import { PastilleSignature, PastilleTypeVisite } from '../components/PastilleVisite'
import { couverture, lienCompteRendu, semestreDe, semestresDisponibles } from '../data/visites'
import { dateCourte, lienCoach, lienFiche } from '../lib/format'
import { typesVisite, type Reseau, type Visite } from '../data/modele'

type Edition = { visite: Visite | null; magasins: string[] } | null

function VueCouverture({ reseau, saisir }: { reseau: Reseau; saisir: (magasins: string[]) => void }) {
  const semestres = semestresDisponibles(reseau)
  const [cle, setCle] = useState(semestreDe(reseau.jour).cle)
  const [coach, setCoach] = useState('')
  const s = semestres.find((x) => x.cle === cle) ?? semestres[0]
  const lignes = couverture(reseau, s).filter((l) => !coach || l.coach === coach)
  const faites = lignes.filter((l) => l.visites.length > 0)
  const restantes = lignes.filter((l) => l.visites.length === 0)
  const taux = lignes.length ? Math.round((faites.length / lignes.length) * 100) : 0
  const parCoach = new Map<string, typeof restantes>()
  restantes.forEach((l) => parCoach.set(l.coach || '', [...(parCoach.get(l.coach || '') ?? []), l]))
  const groupes = [...parCoach.entries()].sort((a, b) => b[1].length - a[1].length)
  const coachs = [...new Set(couverture(reseau, s).map((l) => l.coach).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))

  return (
    <>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <TextField select label="Semestre" value={s.cle} onChange={(e) => setCle(e.target.value)} sx={{ minWidth: 280 }}>
          {semestres.map((x) => <MenuItem key={x.cle} value={x.cle}>{x.libelle}</MenuItem>)}
        </TextField>
        <TextField select label="Coach" value={coach} onChange={(e) => setCoach(e.target.value)} sx={{ minWidth: 220 }} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
          <MenuItem value="">Tous les Coachs</MenuItem>
          {coachs.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>
      </Box>
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
            <Typography variant="h2" component="p">{taux} %</Typography>
            <Typography variant="body1" color="text.secondary">{faites.length} magasin{faites.length > 1 ? 's' : ''} visité{faites.length > 1 ? 's' : ''} sur {lignes.length} · objectif : une visite par magasin et par semestre</Typography>
          </Box>
          <LinearProgress variant="determinate" value={taux} color={taux >= 100 ? 'success' : 'primary'} aria-label={`Couverture ${taux} %`} sx={{ height: 10, borderRadius: 5, bgcolor: 'action.hover' }} />
        </CardContent>
      </Card>
      {restantes.length === 0 ? (
        <EmptyState icone={<TaskAltOutlined />} titre="Tous les magasins sont visités" texte={`Chaque magasin a reçu au moins une visite sur ${s.court}.`} />
      ) : (
        <>
          <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>À visiter ({restantes.length})</Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
            {groupes.map(([c, ls]) => (
              <Card key={c}>
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h4" component="h3" sx={{ flex: 1 }}>
                      {c ? <Link component={RouterLink} to={lienCoach(c)} color="inherit">{c}</Link> : 'Sans Coach'}
                    </Typography>
                    <Button size="small" startIcon={<AddOutlined />} onClick={() => saisir(ls.map((l) => l.magasin.nom))} sx={{ minHeight: 48 }}>Tournée</Button>
                  </Box>
                  {ls.map((l) => (
                    <Box key={l.magasin.nom} sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 52, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Link component={RouterLink} to={lienFiche(l.magasin.nom)} sx={{ fontWeight: 500 }}>{l.magasin.nom}</Link>
                        <Typography variant="body2" color="text.secondary">{l.derniere ? `Dernière visite : ${dateCourte(l.derniere.date)}` : 'Jamais visité'}</Typography>
                      </Box>
                      <Tooltip title="Saisir une visite"><IconButton aria-label={`Saisir une visite pour ${l.magasin.nom}`} onClick={() => saisir([l.magasin.nom])}><AddOutlined /></IconButton></Tooltip>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            ))}
          </Box>
        </>
      )}
    </>
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
    .filter((v) => (!s || (v.date >= s.debut && v.date <= s.fin)) && (!type || v.type === type) && (!visiteur || v.visiteur === visiteur)
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
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '2fr 1fr 1fr 1fr' }, mb: 2 }}>
        <TextField label="Rechercher un magasin ou une note" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        <TextField select label="Période" value={cle} onChange={(e) => setCle(e.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
          <MenuItem value="">Toutes les périodes</MenuItem>
          {semestres.map((x) => <MenuItem key={x.cle} value={x.cle}>{x.libelle}</MenuItem>)}
        </TextField>
        <TextField select label="Type" value={type} onChange={(e) => setType(e.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
          <MenuItem value="">Tous les types</MenuItem>
          {typesVisite.map((t) => <MenuItem key={t.id} value={t.id}>{t.libelle}</MenuItem>)}
        </TextField>
        <TextField select label="Visité par" value={visiteur} onChange={(e) => setVisiteur(e.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
          <MenuItem value="">Tout le monde</MenuItem>
          {visiteurs(reseau).map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
        </TextField>
      </Box>
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
                    <TableCell>{v.visiteur || <Typography variant="body2" color="text.secondary">Non précisé</Typography>}</TableCell>
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
                    <Typography variant="body2" color="text.secondary">{dateCourte(v.date)}{v.visiteur ? ` · ${v.visiteur}` : ''}</Typography>
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
  const vue = params.get('vue') === 'historique' ? 'historique' : 'couverture'
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
            <Tab value="couverture" label="Couverture du semestre" sx={{ minHeight: 48 }} />
            <Tab value="historique" label="Historique" sx={{ minHeight: 48 }} />
          </Tabs>
          {vue === 'historique'
            ? <VueHistorique reseau={reseau} surPC={surPC} modifier={(v) => setEdition({ visite: v, magasins: [v.magasin] })} />
            : <VueCouverture reseau={reseau} saisir={(m) => setEdition({ visite: null, magasins: m })} />}
          {edition && <DialogVisite reseau={reseau} visite={edition.visite} magasinsInitiaux={edition.magasins} onFermer={(m) => { setEdition(null); if (m) setMessage(m) }} />}
          <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
        </>
      )}
    </AvecReseau>
  )
}
