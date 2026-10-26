import { useMemo, useState, type ReactNode } from 'react'
import { Link as RouterLink, Navigate, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import { brand } from '../theme/theme'
import ButtonBase from '@mui/material/ButtonBase'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
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
import { RechercheFiltres } from '../components/RechercheFiltres'
import { Onglets } from '../components/Onglets'
import EventRepeatOutlined from '@mui/icons-material/EventRepeatOutlined'
import HistoryOutlined from '@mui/icons-material/HistoryOutlined'
import { BoutonAction, ChampRecherche } from '../components/Outils'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { DialogVisite, visiteurs } from '../components/DialogVisite'
import { PastilleSignature } from '../components/PastilleVisite'
import { CarteLignes, ChoixAffichage, Initiales, LigneCompacte, MiniPhotos, Pastille, TitreSection, useAffichage, useParTranches } from '../components/Social'
import DateRangeOutlined from '@mui/icons-material/DateRangeOutlined'
import { VueSemaine } from '../components/Semaine'
import { useAuth } from '../auth/AuthContext'
import { anneeDe, anneesDisponibles, libellePasVu, lienCompteRendu, semestresDisponibles, suiviRythme, type LigneRythme } from '../data/visites'
import { nineBox } from '../data/sante'
import { PastilleCase } from '../components/Sante'
import { FiltreMenu } from '../components/FiltreMenu'
import Chip from '@mui/material/Chip'
import { dateCourte, lienCoach, lienFiche, lienPreparation } from '../lib/format'
import { libelleTypeVisite, nomsVisiteurs, typesVisite, type Reseau, type Visite } from '../data/modele'
import { chercherDansVisite, type Trouvaille } from '../data/compteRendu'
import { sousBandes } from '../components/Collant'
import { Blason } from '../components/Blason'

type Edition = { visite: Visite | null; magasins: string[]; date?: string } | null

type Etat = 'alerte' | 'delai'

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`
// Jours au-delà du délai de la case (jamais visité en tête)
const ecart = (l: LigneRythme) => (l.depuis === null ? Infinity : l.depuis - l.delai)

function Compteur({ valeur, libelle, signal, actif, onClick }: { valeur: number; libelle: string; signal?: boolean; actif?: boolean; onClick?: () => void }) {
  const contenu = (
    <>
      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.2, color: signal && valeur > 0 ? 'warning.dark' : undefined }}>{valeur}</Typography>
      <Typography variant="body2" color="text.secondary">{libelle}</Typography>
    </>
  )
  const sx = { py: 1.5, px: 1, minHeight: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' } as const
  if (!onClick) return <Box sx={sx}>{contenu}</Box>
  return <ButtonBase onClick={onClick} aria-pressed={!!actif} aria-label={`${valeur} ${libelle}`} sx={{ ...sx, fontFamily: 'inherit', bgcolor: actif ? 'action.selected' : undefined, '&:hover': { bgcolor: 'action.hover' } }}>{contenu}</ButtonBase>
}

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
    .filter((l) => !etats.length || etats.includes(l.alerte ? 'alerte' : 'delai'))
    .filter((l) => !t || `${l.magasin.nom} ${l.magasin.ville} ${l.magasin.departement} ${l.coach}`.toLowerCase().includes(t))
    .sort((x, y) => Number(y.alerte) - Number(x.alerte) || ecart(y) - ecart(x) || x.magasin.nom.localeCompare(y.magasin.nom, 'fr'))
  const faites = lignes.reduce((n, l) => n + l.faites, 0)
  const referenceTotale = lignes.reduce((n, l) => n + l.reference, 0)
  const signales = lignes.filter((l) => l.alerte)
  const listeCoachs = [...new Set(toutes.map((l) => l.coach).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'fr'))
  const parCoach = [...new Set(lignes.map((l) => l.coach))].map((c) => {
    const ls = lignes.filter((l) => l.coach === c)
    return { coach: c, ls, faites: ls.reduce((n, l) => n + l.faites, 0), reference: ls.reduce((n, l) => n + l.reference, 0), jours: ls.reduce((n, l) => n + l.jours, 0), signales: ls.filter((l) => l.alerte) }
  }).sort((x, y) => y.signales.length - x.signales.length || x.coach.localeCompare(y.coach, 'fr'))
  const actifs = coachs.length + cases.length + etats.length
  const mag = (p: (l: LigneRythme) => boolean) => { const n = toutes.filter(p).length; return `${n} magasin${n > 1 ? 's' : ''}` }
  const jours = (n: number) => `${String(Math.round(n * 10) / 10).replace('.', ',')} j`
  const visites = (l: LigneRythme) => `${pluriel(l.faites, 'visite')} · référence ${l.reference}`
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
        <FiltreMenu libelle="Dernière visite" choisis={etats} onChange={setEtats}
          options={[{ valeur: 'alerte' satisfies Etat, libelle: 'Pas vus depuis longtemps', detail: `${mag((l) => l.alerte)}` }, { valeur: 'delai' satisfies Etat, libelle: 'Vus récemment', detail: `${mag((l) => !l.alerte)}` }]} />
        {(actifs > 0 || texte) && <Button onClick={() => { setCoachs([]); setCases([]); setEtats([]); setTexte('') }} sx={{ minHeight: 36 }}>Effacer les filtres</Button>}
      </RechercheFiltres>

      {/* Trois compteurs sur une ligne, comme l'en-tête des fiches ; « pas vus » filtre la liste */}
      <Card aria-label={`Visites ${a.court}`} component="section" sx={{ mb: 2, border: 0, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <Compteur valeur={faites} libelle={faites > 1 ? 'faites' : 'faite'} />
        <Compteur valeur={referenceTotale} libelle="référence" />
        <Compteur valeur={signales.length} libelle="pas vus" signal actif={etats.length === 1 && etats[0] === 'alerte'}
          onClick={() => setEtats(etats.length === 1 && etats[0] === 'alerte' ? [] : ['alerte'])} />
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
                  detail={<Box component="span" sx={{ display: 'block', whiteSpace: 'normal' }}>
                    {`${pluriel(g.faites, 'visite')} sur ${g.reference} · ${jours(g.jours)} par an`}
                    <Box component="span" role="meter" aria-label={`Visites de ${g.coach || 'Sans Coach'}`} aria-valuemin={0} aria-valuemax={g.reference} aria-valuenow={Math.min(g.faites, g.reference)}
                      sx={{ display: 'block', height: 6, mt: 0.5, borderRadius: 3, bgcolor: 'action.hover', overflow: 'hidden' }}>
                      <Box component="span" sx={{ display: 'block', height: '100%', width: `${g.reference ? Math.min(100, Math.round((g.faites / g.reference) * 100)) : 0}%`, bgcolor: brand.vertFonce }} />
                    </Box>
                  </Box>}
                  fin={g.signales.length ? <Pastille ton="orange">{`${g.signales.length} à voir`}</Pastille> : undefined} />
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
                      <TableCell>Magasin</TableCell><TableCell>Coach</TableCell><TableCell>Nine box</TableCell><TableCell>Visites de l’année</TableCell><TableCell>Dernière visite</TableCell><TableCell>Alerte</TableCell><TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibles.map((l) => (
                      <TableRow key={l.magasin.nom} hover>
                        <TableCell><Link component={RouterLink} to={lienFiche(l.magasin.nom)} sx={{ fontWeight: 600 }}>{l.magasin.nom}</Link></TableCell>
                        <TableCell>{l.coach || <Typography variant="body2" color="text.secondary">Sans Coach</Typography>}</TableCell>
                        <TableCell><PastilleCase c={l.case} /></TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{visites(l)}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{l.derniere ? dateCourte(l.derniere.date) : <Typography variant="body2" color="text.secondary">Jamais visité</Typography>}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}><AlerteVisite l={l} /></TableCell>
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
                <LigneCompacte key={l.magasin.nom} lien={lienFiche(l.magasin.nom)} avatar={<Blason magasin={l.magasin} />} titre={l.magasin.nom}
                  detail={[l.coach || 'Sans Coach', `${visites(l)} en ${a.court}`, l.derniere ? `dernière le ${dateCourte(l.derniere.date)}` : l.alerte ? null : 'jamais visité', l.dernierContact && `appel le ${dateCourte(l.dernierContact.date)}`].filter(Boolean).join(' · ')}
                  fin={l.alerte ? <Pastille ton="orange">{libellePasVu(l)}</Pastille> : undefined}
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

// Pas vu depuis plus longtemps que le délai de sa case, ou date à laquelle l'alerte partira
function AlerteVisite({ l }: { l: LigneRythme }) {
  return l.alerte
    ? <Chip size="small" color="warning" label={libellePasVu(l)} sx={{ fontSize: 12, fontWeight: 600 }} />
    : <Typography variant="body2" color="text.secondary" component="span">{l.echeance ? `le ${dateCourte(l.echeance)}` : ''}</Typography>
}

const parMois = (vs: Visite[]) => [...vs.reduce((m, v) => m.set(v.date.slice(0, 7), [...(m.get(v.date.slice(0, 7)) ?? []), v]), new Map<string, Visite[]>())]
const nbDuMois = (vs: Visite[], mois: string) => vs.filter((v) => v.date.startsWith(mois)).length
const libelleMoisAnnee = (mois: string) => new Date(`${mois}-15T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

function detailVisite(v: Visite, t: Trouvaille | null | false | undefined): ReactNode {
  const tete = [dateCourte(v.date), libelleTypeVisite(v.type), nomsVisiteurs(v)].filter(Boolean).join(' · ')
  if (!t) return [tete, v.notes].filter(Boolean).join(' · ')
  // Le passage trouvé passe à la ligne (trois lignes au plus), pour rester lisible au téléphone
  return (
    <>
      <Box component="span" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'normal', color: 'text.primary' }}>{t.ou} : « {t.passage} »</Box>
      <Box component="span" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tete}</Box>
    </>
  )
}

function VueHistorique({ reseau, modifier, actions }: { reseau: Reseau; modifier: (v: Visite) => void; actions: ReactNode }) {
  const semestres = useMemo(() => semestresDisponibles(reseau), [reseau])
  const [cle, setCle] = useState('')
  const [type, setType] = useState('')
  const [visiteur, setVisiteur] = useState('')
  const [recherche, setRecherche] = useState('')
  const s = useMemo(() => semestres.find((x) => x.cle === cle), [semestres, cle])
  // La recherche lit tout le compte rendu (sprint 26, S1) ; le passage trouvé remplace la note sur la ligne
  const trouvailles = useMemo(() => new Map(reseau.visites.map((v) => [v, chercherDansVisite(v, recherche)] as const)), [reseau, recherche])
  const liste = useMemo(() => reseau.visites
    .filter((v) => (!s || (v.date >= s.debut && v.date <= s.fin)) && (!type || v.type === type) && (!visiteur || v.visiteurs.includes(visiteur))
      && trouvailles.get(v) !== false)
    .sort((a, b) => b.date.localeCompare(a.date)), [reseau, s, type, visiteur, trouvailles])
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
        recherche={<ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Magasin, mot du compte rendu…" />}>
        <FiltreMenu libelle="Période" choisis={cle ? [cle] : []} onChange={(v) => setCle(v.at(-1) ?? '')} options={semestres.map((x) => ({ valeur: x.cle, libelle: x.court }))} />
        <FiltreMenu libelle="Type" choisis={type ? [type] : []} onChange={(v) => setType(v.at(-1) ?? '')} options={typesVisite.map((t) => ({ valeur: t.id, libelle: t.libelle }))} />
        <FiltreMenu libelle="Visité par" choisis={visiteur ? [visiteur] : []} onChange={(v) => setVisiteur(v.at(-1) ?? '')} options={visiteurs(reseau).map((n) => ({ valeur: n, libelle: n }))} />
        {(cle || type || visiteur || recherche) && <Button onClick={() => { setCle(''); setType(''); setVisiteur(''); setRecherche('') }} sx={{ minHeight: 36 }}>Effacer les filtres</Button>}
      </RechercheFiltres>
      <TitreSection>{`${liste.length} visite${liste.length > 1 ? 's' : ''}`}</TitreSection>
      {liste.length === 0 ? (
        <EmptyState icone={<EventNoteOutlined />} titre="Aucune visite" texte={reseau.visites.length ? 'Aucune visite ne correspond à ces filtres.' : 'Saisis ta première visite avec le bouton « Saisir une visite ».'} />
      ) : (
        // Un intertitre collant par mois, avec le nombre de visites du mois (Joseph, 21/10/2026)
        <Box component="section" aria-label="Visites" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {parMois(visibles).map(([mois, vs]) => (
            <Box key={mois} component="section" aria-label={libelleMoisAnnee(mois)}>
              <Box sx={{ position: 'sticky', top: sousBandes('--onglets', '--filtres'), zIndex: 3, bgcolor: 'background.default', py: 0.75, px: 0.5 }}>
                <Typography component="h2" sx={{ fontWeight: 700, fontSize: '0.875rem', color: 'text.secondary', '&::first-letter': { textTransform: 'uppercase' } }}>
                  {libelleMoisAnnee(mois)} · {nbDuMois(liste, mois)} visite{nbDuMois(liste, mois) > 1 ? 's' : ''}
                </Typography>
              </Box>
              <CarteLignes>
                {vs.map((v) => (
                  <LigneCompacte key={v.id ?? `${v.magasin}-${v.date}`} lien={lienFiche(v.magasin)} avatar={<Blason magasin={reseau.magasins.find((x) => x.nom === v.magasin)} nom={v.magasin} />} titre={v.magasin}
                    detail={detailVisite(v, trouvailles.get(v))}
                    fin={v.prevue ? <Pastille ton="bleu">Prévue</Pastille> : v.signatureRequise ? <PastilleSignature requise signe={!!v.lienSigne} /> : <MiniPhotos photos={v.photos} />}
                    actions={<Actions v={v} />} />
                ))}
              </CarteLignes>
            </Box>
          ))}
        </Box>
      )}
      {suite}
    </>
  )
}

// Campagnes et Bonnes pratiques ont quitté les Visites (sprint 21) : les anciennes adresses y mènent
export function Visites() {
  const [params] = useSearchParams()
  if (params.get('vue') === 'campagnes') return <Navigate to={`/plus/sante?${params.toString()}`} replace />
  if (params.get('vue') === 'pratiques') return <Navigate to="/infos?vue=pratiques" replace />
  return <ContenuVisites />
}

function ContenuVisites() {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const [params, setParams] = useSearchParams()
  const { profil } = useAuth()
  // Le Coach arrive sur sa semaine ; les autres sur le rythme de visite
  const vue = (['semaine', 'rythme', 'historique'] as const).find((v) => v === params.get('vue')) ?? (profil?.role === 'coach' ? 'semaine' : 'rythme')
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
          ]} />
          {vue === 'semaine'
            ? <VueSemaine reseau={reseau} surPC={surPC} onMessage={setMessage} />
            : vue === 'historique'
            ? <VueHistorique reseau={reseau} actions={actions} modifier={(v) => setEdition({ visite: v, magasins: [v.magasin] })} />
            : <VueRythme reseau={reseau} surPC={surPC} actions={actions} saisir={(m) => setEdition({ visite: null, magasins: m })} />}
          {edition && <DialogVisite reseau={reseau} visite={edition.visite} magasinsInitiaux={edition.magasins} dateInitiale={edition.date} onFermer={(m) => { setEdition(null); if (m) setMessage(m) }} />}
          <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
        </>
      )}
    </AvecReseau>
  )
}
