import { useMemo, useState, type ReactNode } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Link from '@mui/material/Link'
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
import { useTheme } from '@mui/material/styles'
import AddOutlined from '@mui/icons-material/AddOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined'
import Alert from '@mui/material/Alert'
import { Fenetre } from '../components/EditionEquipe'
import { importerVisites } from '../data/chargement'
import { analyserVisites, lireClasseur, type ResultatImportVisites } from '../data/importVisites'
import { RechercheFiltres } from '../components/RechercheFiltres'
import { Onglets } from '../components/Onglets'
import EventRepeatOutlined from '@mui/icons-material/EventRepeatOutlined'
import HistoryOutlined from '@mui/icons-material/HistoryOutlined'
import { BoutonAction, ChampRecherche } from '../components/Outils'
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
import { dateCourte, lienCoach, lienFiche } from '../lib/format'
import { nomsVisiteurs, typesVisite, type Reseau, type Visite } from '../data/modele'

type Edition = { visite: Visite | null; magasins: string[] } | null

type Etat = 'retard' | 'ajour'

function VueRythme({ reseau, saisir, surPC, actions }: { reseau: Reseau; saisir: (magasins: string[]) => void; surPC: boolean; actions: ReactNode }) {
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
      <RechercheFiltres actifs={actifs} actions={actions}
        recherche={<ChampRecherche valeur={texte} onChange={setTexte} placeholder="Magasin, ville, Coach…" />}>
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

function VueHistorique({ reseau, modifier, surPC, actions }: { reseau: Reseau; modifier: (v: Visite) => void; surPC: boolean; actions: ReactNode }) {
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
      <RechercheFiltres actifs={(cle ? 1 : 0) + (type ? 1 : 0) + (visiteur ? 1 : 0)} actions={actions}
        recherche={<ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher un magasin ou une note" />}>
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

// ── Import du classeur de suivi des visites (un onglet par Coach) ──
function DialogImportVisites({ reseau, onFermer }: { reseau: Reseau; onFermer: (m?: string) => void }) {
  const [res, setRes] = useState<ResultatImportVisites | null>(null)
  const [nomFichier, setNomFichier] = useState('')
  const [erreur, setErreur] = useState('')
  const [dateAudits, setDateAudits] = useState(reseau.jour)
  const choisir = async (f: File | undefined) => {
    if (!f) return
    setNomFichier(f.name); setErreur(''); setRes(null)
    try {
      const r = analyserVisites(await lireClasseur(f), reseau)
      if (!r.visites.length && !r.audits.length && !r.dejaLa) setErreur('Aucune visite reconnue dans ce fichier. Vérifie que chaque onglet a une colonne « Magasin » et des colonnes « Visite 1 », « Visite 2 »…')
      else setRes(r)
    } catch { setErreur('Ce fichier ne peut pas être lu. Enregistre-le au format Excel (.xlsx) puis réessaie.') }
  }
  // Feuilles de route sans date : rangées à la date choisie, sauf si elles y sont déjà
  const feuilles = (res?.feuillesDeRoute ?? []).filter((f) => !reseau.visites.some((v) => v.magasin === f.magasin && v.date === dateAudits && v.type === 'feuille'))
  const n = res?.visites.length ?? 0, a = res?.audits.length ?? 0, fr = feuilles.length
  // Seules les notes des anciens tableaux d'audit et les feuilles de route sans date demandent une date
  const sansDate = (res?.audits.filter((x) => !x.date).length ?? 0) + fr
  const nbMag = res ? new Set(res.visites.map((v) => v.magasin)).size : 0
  const annees = res ? [...new Set(res.visites.map((v) => v.date.slice(0, 4)))].sort() : []
  const pluriel = (k: number, mot: string) => `${k} ${mot}${k > 1 ? 's' : ''}`
  const dateValide = /^\d{4}-\d{2}-\d{2}$/.test(dateAudits)
  return (
    <Fenetre large titre="Importer des visites" ouvert onFermer={onFermer} valide={n + a + fr > 0 && (!sansDate || dateValide)}
      enregistrer={async () => {
        await importerVisites([...res!.visites, ...feuilles.map((f) => ({ ...f, date: dateAudits, type: 'feuille' }))], res!.audits, dateAudits)
        return [n ? `${pluriel(n, 'visite')} importée${n > 1 ? 's' : ''}` : '', fr ? pluriel(fr, 'feuille') + ' de route' : '', a ? `${pluriel(a, 'note')} d’audit` : ''].filter(Boolean).join(', ')
      }}>
      <Button variant="outlined" component="label" startIcon={<UploadFileOutlined />} sx={{ alignSelf: 'flex-start', minHeight: 48 }}>
        {nomFichier || 'Choisir un fichier'}
        <input type="file" hidden accept=".xlsx" aria-label="Fichier de visites à importer" onChange={(e) => choisir(e.target.files?.[0])} />
      </Button>
      {erreur && <Alert severity="warning">{erreur}</Alert>}
      {res && (
        <>
          <Alert severity={n ? 'success' : 'info'}>
            {n ? `${pluriel(n, 'visite')} à ajouter pour ${pluriel(nbMag, 'magasin')}, ${annees.length > 1 ? `de ${annees[0]} à ${annees.at(-1)}` : `en ${annees[0]}`}.` : 'Aucune nouvelle visite.'}
            {res.dejaLa > 0 && ` ${pluriel(res.dejaLa, 'visite')} déjà dans l’app, laissée${res.dejaLa > 1 ? 's' : ''} telle${res.dejaLa > 1 ? 's' : ''} quelle${res.dejaLa > 1 ? 's' : ''}.`}
          </Alert>
          {a + fr > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
              <Box sx={{ flex: '1 1 240px' }}>
                {a > 0 && <Typography variant="body1">{pluriel(a, 'note')} d’audit : {res.audits.filter((x) => x.type === 'hygiene').length} hygiène, {res.audits.filter((x) => x.type === 'excellence').length} excellence.</Typography>}
                {fr > 0 && <Typography variant="body1">{pluriel(fr, 'feuille')} de route faite{fr > 1 ? 's' : ''}.</Typography>}
              </Box>
              {sansDate > 0 && <TextField type="date" label="Date des audits et feuilles de route" value={dateAudits} onChange={(e) => setDateAudits(e.target.value)} error={!dateValide}
                slotProps={{ inputLabel: { shrink: true } }} sx={{ width: { xs: '100%', sm: 300 } }} />}
            </Box>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {res.feuilles.filter((f) => f.visites).map((f) => (
              <Chip key={f.nom} label={`${f.nom} → ${f.personne}${f.equipe ? '' : ' (hors équipe)'} · ${f.visites}`} color={f.equipe ? 'primary' : 'default'} variant="outlined" sx={{ fontSize: 13 }} />
            ))}
          </Box>
          {res.inconnus.length > 0 && <Typography variant="body2" color="text.secondary">Magasins non trouvés ({res.inconnus.length}) : {res.inconnus.slice(0, 12).join(', ')}{res.inconnus.length > 12 ? '…' : ''}</Typography>}
          {res.illisibles.length > 0 && <Typography variant="body2" color="text.secondary">Dates non reconnues, laissées de côté ({res.illisibles.length}) : {res.illisibles.slice(0, 12).join(' · ')}{res.illisibles.length > 12 ? '…' : ''}</Typography>}
        </>
      )}
    </Fenetre>
  )
}

export function Visites() {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const [params, setParams] = useSearchParams()
  const vue = params.get('vue') === 'historique' ? 'historique' : 'rythme'
  const [edition, setEdition] = useState<Edition>(null)
  const [message, setMessage] = useState('')
  const [importer, setImporter] = useState(false)
  const actions = <>
    {surPC && <BoutonAction secondaire libelle="Importer Excel" icone={<UploadFileOutlined />} onClick={() => setImporter(true)} />}
    <BoutonAction libelle="Saisir une visite" onClick={() => setEdition({ visite: null, magasins: [] })} />
  </>
  return (
    <AvecReseau>
      {(reseau) => (
        <>
          <PageHeader
            titre="Visites"
            sousTitre={`${reseau.visites.length} visite${reseau.visites.length > 1 ? 's' : ''} enregistrée${reseau.visites.length > 1 ? 's' : ''}`}
          />
          <Onglets valeur={vue} onChange={(v) => setParams({ vue: v }, { replace: true })} libelle="Rubriques des visites" rubriques={[
            { vue: 'rythme', libelle: 'Rythme de visite', court: 'Rythme', icone: <EventRepeatOutlined /> },
            { vue: 'historique', libelle: 'Historique', icone: <HistoryOutlined /> },
          ]} />
          {vue === 'historique'
            ? <VueHistorique reseau={reseau} surPC={surPC} actions={actions} modifier={(v) => setEdition({ visite: v, magasins: [v.magasin] })} />
            : <VueRythme reseau={reseau} surPC={surPC} actions={actions} saisir={(m) => setEdition({ visite: null, magasins: m })} />}
          {edition && <DialogVisite reseau={reseau} visite={edition.visite} magasinsInitiaux={edition.magasins} onFermer={(m) => { setEdition(null); if (m) setMessage(m) }} />}
          {importer && <DialogImportVisites reseau={reseau} onFermer={(m) => { setImporter(false); if (m) setMessage(m) }} />}
          <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
        </>
      )}
    </AvecReseau>
  )
}
