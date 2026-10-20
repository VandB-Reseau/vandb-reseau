import { useMemo, useState, type ReactNode } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
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
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AddOutlined from '@mui/icons-material/AddOutlined'
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import { VueCampagnes } from '../components/Campagnes'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import { RechercheFiltres } from '../components/RechercheFiltres'
import { Onglets } from '../components/Onglets'
import EventRepeatOutlined from '@mui/icons-material/EventRepeatOutlined'
import HistoryOutlined from '@mui/icons-material/HistoryOutlined'
import TipsAndUpdatesOutlined from '@mui/icons-material/TipsAndUpdatesOutlined'
import { DialogPratique, VuePratiques } from '../components/BonnesPratiques'
import type { BonnePratique } from '../data/bonnesPratiques'
import { BoutonAction, ChampRecherche } from '../components/Outils'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { DialogVisite, visiteurs } from '../components/DialogVisite'
import { PastilleSignature } from '../components/PastilleVisite'
import { CarteLignes, ChoixAffichage, Initiales, LigneCompacte, Pastille, TitreSection, useAffichage, useParTranches } from '../components/Social'
import RouteOutlined from '@mui/icons-material/RouteOutlined'
import DateRangeOutlined from '@mui/icons-material/DateRangeOutlined'
import { VueSemaine } from '../components/Semaine'
import { useAuth } from '../auth/AuthContext'
import { anneeDe, anneesDisponibles, lienCompteRendu, semestresDisponibles, suiviRythme, type LigneRythme } from '../data/visites'
import { nineBox } from '../data/sante'
import { PastilleCase } from '../components/Sante'
import { FiltreMenu } from '../components/FiltreMenu'
import Chip from '@mui/material/Chip'
import { dateCourte, lienCoach, lienFiche, lienPreparation } from '../lib/format'
import { libelleTypeVisite, nomsVisiteurs, typesVisite, type Reseau, type Visite } from '../data/modele'

type Edition = { visite: Visite | null; magasins: string[]; date?: string } | null

type Etat = 'retard' | 'ajour'

function VueRythme({ reseau, saisir, surPC, actions }: { reseau: Reseau; saisir: (magasins: string[]) => void; surPC: boolean; actions: ReactNode }) {
  const annees = useMemo(() => anneesDisponibles(reseau), [reseau])
  const [cle, setCle] = useState(anneeDe(reseau.jour).cle)
  const [texte, setTexte] = useState('')
  const [coachs, setCoachs] = useState<string[]>([])
  const [cases, setCases] = useState<string[]>([])
  const [etats, setEtats] = useState<string[]>([])
  const a = annees.find((x) => x.cle === cle) ?? annees[0]
  const toutes = useMemo(() => suiviRythme(reseau, a), [reseau, a])
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
  const { visibles, suite } = useParTranches(lignes, JSON.stringify([a.cle, t, coachs, cases, etats]))
  const [affichage, setAffichage] = useAffichage('rythme')

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

      <Card sx={{ mb: 2, border: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.2 }}>{faites} sur {objectif}</Typography>
              <Typography variant="body2" color="text.secondary">visites faites en {a.court}</Typography>
            </Box>
            <LinearProgress variant="determinate" value={taux} color={enRetard.length ? 'primary' : 'success'} aria-label={`Visites faites ${taux} %`} sx={{ mt: 1, height: 8, borderRadius: 4, bgcolor: 'action.hover' }} />
          </Box>
          {enRetard.length > 0 ? <Pastille ton="orange">{`${enRetard.length} en retard`}</Pastille> : <Pastille ton="vert">À jour</Pastille>}
        </Box>
      </Card>

      {lignes.length === 0 ? (
        <EmptyState icone={<EventNoteOutlined />} titre="Aucun magasin" texte="Aucun magasin ne correspond à ces filtres." />
      ) : (
        <>
          {parCoach.length > 1 && <>
            <TitreSection nombre={parCoach.length}>Par Coach</TitreSection>
            <CarteLignes label="Visites par Coach">
              {parCoach.map((g) => (
                <LigneCompacte key={g.coach} lien={g.coach ? lienCoach(g.coach) : undefined} avatar={<Initiales nom={g.coach || 'Sans Coach'} />} titre={g.coach || 'Sans Coach'}
                  detail={`${g.faites} sur ${g.objectif} visites · ${jours(g.jours)} sur l’année`}
                  fin={g.retard.length ? <Pastille ton="orange">{`${g.retard.length} en retard`}</Pastille> : <Pastille ton="gris">À jour</Pastille>}
                  actions={g.retard.length > 0 ? <Tooltip title="Préparer la tournée des magasins en retard"><IconButton onClick={() => saisir(g.retard.map((l) => l.magasin.nom))} aria-label={`Tournée de ${g.coach || 'Sans Coach'}`} sx={{ width: 48, height: 48 }}><RouteOutlined /></IconButton></Tooltip> : undefined} />
              ))}
            </CarteLignes>
          </>}

          <TitreSection nombre={lignes.length} action={surPC && <ChoixAffichage valeur={affichage} onChange={setAffichage} />}>Par magasin</TitreSection>
          {surPC && affichage === 'tableau' ? (
            <Card>
              <TableContainer>
                <Table aria-label="Rythme de visite par magasin" size="small" className="colonne-fixe">
                  <TableHead>
                    <TableRow>
                      <TableCell>Magasin</TableCell><TableCell>Coach</TableCell><TableCell>Nine box</TableCell><TableCell>Visites de l’année</TableCell><TableCell>Dernière visite</TableCell><TableCell>Prochaine visite</TableCell><TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibles.map((l) => (
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
                        <TableCell sx={{ py: 0, whiteSpace: 'nowrap' }}><Tooltip title="Préparer la visite"><IconButton component={RouterLink} to={lienPreparation(l.magasin.nom)} aria-label={`Préparer la visite de ${l.magasin.nom}`}><AssignmentOutlined /></IconButton></Tooltip><Tooltip title="Saisir une visite"><IconButton aria-label={`Saisir une visite pour ${l.magasin.nom}`} onClick={() => saisir([l.magasin.nom])}><AddOutlined /></IconButton></Tooltip></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          ) : (
            <CarteLignes label="Rythme de visite par magasin">
              {visibles.map((l) => (
                <LigneCompacte key={l.magasin.nom} lien={lienFiche(l.magasin.nom)} avatar={<Initiales nom={l.magasin.nom} />} titre={l.magasin.nom}
                  detail={[l.coach || 'Sans Coach', `${visites(l)} en ${a.court}`, l.derniere ? `dernière le ${dateCourte(l.derniere.date)}` : 'jamais visité'].join(' · ')}
                  fin={l.retard ? <Pastille ton="orange">{`${l.retard} j de retard`}</Pastille> : <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, whiteSpace: 'nowrap' }}>avant le {dateCourte(l.prochaine)}</Typography>}
                  actions={<>
                    {surPC && <Tooltip title="Préparer la visite"><IconButton component={RouterLink} to={lienPreparation(l.magasin.nom)} aria-label={`Préparer la visite de ${l.magasin.nom}`}><AssignmentOutlined /></IconButton></Tooltip>}
                    <Tooltip title="Saisir une visite"><IconButton aria-label={`Saisir une visite pour ${l.magasin.nom}`} onClick={() => saisir([l.magasin.nom])}><AddOutlined /></IconButton></Tooltip>
                  </>} />
              ))}
            </CarteLignes>
          )}
          {suite}
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

function VueHistorique({ reseau, modifier, actions }: { reseau: Reseau; modifier: (v: Visite) => void; actions: ReactNode }) {
  const semestres = useMemo(() => semestresDisponibles(reseau), [reseau])
  const [cle, setCle] = useState('')
  const [type, setType] = useState('')
  const [visiteur, setVisiteur] = useState('')
  const [recherche, setRecherche] = useState('')
  const s = useMemo(() => semestres.find((x) => x.cle === cle), [semestres, cle])
  const liste = useMemo(() => reseau.visites
    .filter((v) => (!s || (v.date >= s.debut && v.date <= s.fin)) && (!type || v.type === type) && (!visiteur || v.visiteurs.includes(visiteur))
      && (!recherche || `${v.magasin} ${v.notes}`.toLowerCase().includes(recherche.toLowerCase())))
    .sort((a, b) => b.date.localeCompare(a.date)), [reseau, s, type, visiteur, recherche])
  const { visibles, suite } = useParTranches(liste, JSON.stringify([cle, type, visiteur, recherche]))
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
      <TitreSection>{`${liste.length} visite${liste.length > 1 ? 's' : ''}`}</TitreSection>
      {liste.length === 0 ? (
        <EmptyState icone={<EventNoteOutlined />} titre="Aucune visite" texte={reseau.visites.length ? 'Aucune visite ne correspond à ces filtres.' : 'Saisis ta première visite avec le bouton « Saisir une visite ».'} />
      ) : (
        <CarteLignes label="Visites">
          {visibles.map((v) => (
            <LigneCompacte key={v.id ?? `${v.magasin}-${v.date}`} lien={lienFiche(v.magasin)} avatar={<Initiales nom={v.magasin} />} titre={v.magasin}
              detail={[dateCourte(v.date), libelleTypeVisite(v.type), nomsVisiteurs(v), v.notes].filter(Boolean).join(' · ')}
              fin={v.signatureRequise ? <PastilleSignature requise signe={!!v.lienSigne} /> : undefined}
              actions={<Actions v={v} />} />
          ))}
        </CarteLignes>
      )}
      {suite}
    </>
  )
}

export function Visites() {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const [params, setParams] = useSearchParams()
  const { profil } = useAuth()
  // Le Coach arrive sur sa semaine ; les autres sur le rythme de visite
  const vue = (['semaine', 'rythme', 'historique', 'pratiques', 'campagnes'] as const).find((v) => v === params.get('vue')) ?? (profil?.role === 'coach' ? 'semaine' : 'rythme')
  const [pratique, setPratique] = useState<BonnePratique | null | undefined>(undefined)
  const [edition, setEdition] = useState<Edition>(null)
  const [message, setMessage] = useState('')
  const actions = <BoutonAction libelle="Saisir une visite" onClick={() => setEdition({ visite: null, magasins: [] })} />
  return (
    <AvecReseau>
      {(reseau) => (
        <>
          <PageHeader
            titre="Visites"
            sousTitre={`${reseau.visites.length} visite${reseau.visites.length > 1 ? 's' : ''} enregistrée${reseau.visites.length > 1 ? 's' : ''}`}
          />
          <Onglets valeur={vue} onChange={(v) => setParams({ vue: v }, { replace: true })} libelle="Rubriques des visites" rubriques={[
            { vue: 'semaine', libelle: profil?.role === 'coach' ? 'Ma semaine' : 'Semaine', court: 'Semaine', icone: <DateRangeOutlined /> },
            { vue: 'rythme', libelle: 'Rythme de visite', court: 'Rythme', icone: <EventRepeatOutlined /> },
            { vue: 'historique', libelle: 'Historique', icone: <HistoryOutlined /> },
            { vue: 'pratiques', libelle: 'Bonnes pratiques', court: 'Pratiques', icone: <TipsAndUpdatesOutlined /> },
            { vue: 'campagnes', libelle: 'Campagnes', icone: <CampaignOutlined /> },
          ]} />
          {vue === 'campagnes'
            ? <VueCampagnes reseau={reseau} />
            : vue === 'pratiques'
            ? <VuePratiques reseau={reseau} modifier={setPratique} actions={<BoutonAction libelle="Ajouter une bonne pratique" onClick={() => setPratique(null)} />} />
            : vue === 'semaine'
            ? <VueSemaine reseau={reseau} surPC={surPC} planifier={(m, date) => setEdition({ visite: null, magasins: m, date })} />
            : vue === 'historique'
            ? <VueHistorique reseau={reseau} actions={actions} modifier={(v) => setEdition({ visite: v, magasins: [v.magasin] })} />
            : <VueRythme reseau={reseau} surPC={surPC} actions={actions} saisir={(m) => setEdition({ visite: null, magasins: m })} />}
          {edition && <DialogVisite reseau={reseau} visite={edition.visite} magasinsInitiaux={edition.magasins} dateInitiale={edition.date} onFermer={(m) => { setEdition(null); if (m) setMessage(m) }} />}
          {pratique !== undefined && <DialogPratique reseau={reseau} pratique={pratique} onFermer={(m) => { setPratique(undefined); if (m) setMessage(m) }} />}
          <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
        </>
      )}
    </AvecReseau>
  )
}
