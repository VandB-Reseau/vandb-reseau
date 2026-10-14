import { lazy, Suspense, useMemo, useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import FormatListBulleted from '@mui/icons-material/FormatListBulleted'
import MapOutlined from '@mui/icons-material/MapOutlined'
import { EmptyState } from '../components/EmptyState'
import { coachA, chargeA, moisAVenir } from '../data/charge'
import { statutA } from '../data/construction'
import { rattacherCoach, reaffecter } from '../data/chargement'
import { useReseau } from '../data/ReseauContext'
import {
  chargesAvecPlan, coachsDisponibles, coachsParRR, optionsCoach, optionsRR, plafondCharge, positionsCoachs, proposerMagasins, proposerRR,
  raisonMagasinLibelle, raisonRRLibelle, rrDuCoachA, rrsRattachables, type Plafond, type PropositionMagasin, type PropositionRR,
} from '../data/plan'
import { dateLongue, lienCoach, lienFiche } from '../lib/format'
import type { Magasin, Reseau } from '../data/modele'
import type { VueCarte } from '../components/CarteMagasins'

const CarteMagasins = lazy(() => import('../components/CarteMagasins').then((m) => ({ default: m.CarteMagasins })))

const km = (d: number | null) => (d === null ? 'distance inconnue' : `${Math.round(d)} km`)
type Choix = Record<string, { cible?: string; garde?: boolean }>

export function VuePlan({ reseau }: { reseau: Reseau }) {
  // Par défaut : le premier jour du mois prochain
  const [params] = useSearchParams()
  const [jour, setJour] = useState(() => params.get('date') ?? moisAVenir(reseau.jour, 2)[1])
  const [plafond, setPlafond] = useState<Plafond>('maximum')
  const dateValide = /^\d{4}-\d{2}-\d{2}$/.test(jour)
  return (
    <>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2, maxWidth: 820 }}>
        Choisis une date : l’app propose qui reprend les magasins sans Coach ou trop chargés, et à quel Responsable Régional rattacher les Coachs, d’après les distances et la règle de charge. Rien n’est enregistré tant que tu n’as pas validé.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 3 }}>
        <TextField type="date" label="À la date du" value={jour} onChange={(e) => setJour(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: { xs: '100%', sm: 220 } }} />
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Charge à ne pas dépasser</Typography>
          <ToggleButtonGroup exclusive size="small" value={plafond} onChange={(_e, v) => v && setPlafond(v)} aria-label="Charge à ne pas dépasser">
            <ToggleButton value="maximum" sx={{ minHeight: 48, px: 2 }}>Maximum ({reseau.parametres.maxUnits})</ToggleButton>
            <ToggleButton value="seuil" sx={{ minHeight: 48, px: 2 }}>Sous le seuil d’attention ({reseau.parametres.alertThreshold})</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
      {dateValide ? <PlanADate key={`${jour}|${plafond}`} reseau={reseau} jour={jour} plafond={plafondCharge(reseau, plafond)} /> : <Alert severity="info">Choisis une date complète pour voir les propositions.</Alert>}
    </>
  )
}

function Indicateur({ titre, avant, apres }: { titre: string; avant: number; apres: number }) {
  return (
    <Card><CardContent>
      <Typography variant="h2" component="p" sx={{ color: apres > 0 ? 'warning.main' : 'success.main' }}>
        {avant === apres ? apres : <><Box component="span" sx={{ color: 'text.secondary', fontSize: '0.7em' }}>{avant} → </Box>{apres}</>}
      </Typography>
      <Typography variant="body2" color="text.secondary">{titre}</Typography>
    </CardContent></Card>
  )
}

function PlanADate({ reseau, jour, plafond }: { reseau: Reseau; jour: string; plafond: number }) {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const { recharger } = useReseau()
  const propM = useMemo(() => proposerMagasins(reseau, jour, plafond), [reseau, jour, plafond])
  const propR = useMemo(() => proposerRR(reseau, jour, new Map(propM.map((p) => [p.magasin.nom, p.coach]))), [reseau, jour, propM])
  const [choixM, setChoixM] = useState<Choix>({})
  const [choixR, setChoixR] = useState<Choix>({})
  const [affichage, setAffichage] = useState<'liste' | 'carte'>('liste')
  const [confirmer, setConfirmer] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(false)
  const [message, setMessage] = useState('')

  const cibleM = (p: PropositionMagasin) => choixM[p.magasin.nom]?.cible ?? p.coach
  const gardeM = (p: PropositionMagasin) => choixM[p.magasin.nom]?.garde ?? true
  const cibleR = (p: PropositionRR) => choixR[p.coach.nom]?.cible ?? p.rr
  const gardeR = (p: PropositionRR) => choixR[p.coach.nom]?.garde ?? true
  const retenusM = new Map(propM.filter(gardeM).map((p) => [p.magasin.nom, cibleM(p)]))
  const retenusR = new Map(propR.filter(gardeR).map((p) => [p.coach.nom, cibleR(p)]))
  const positions = useMemo(() => positionsCoachs(reseau, jour), [reseau, jour])

  // Indicateurs avant / après le plan retenu
  const max = reseau.parametres.maxUnits
  const disponibles = coachsDisponibles(reseau, jour)
  const chargesAvant = new Map(reseau.equipe.map((c) => [c.nom, chargeA(reseau, c.nom, jour)]))
  const chargesApres = chargesAvecPlan(reseau, jour, retenusM)
  const depassements = (ch: Map<string, number>) => disponibles.filter((c) => (ch.get(c.nom) ?? 0) > max).length
  const equipe = new Set(reseau.equipe.map((c) => c.nom))
  const sansCoach = (choix: Map<string, string>) => reseau.magasins.filter((m) => statutA(m.ouverture, jour, reseau.parametres) !== 'avenir' && !m.rrEnDirect && !equipe.has(choix.get(m.nom) ?? coachA(m, jour))).length
  const rrSurcharges = (choix: Map<string, string>) => [...coachsParRR(reseau, jour, choix).values()].filter((n) => n > reseau.parametres.maxCoachsRR).length
  const sansRR = (choix: Map<string, string>) => disponibles.filter((c) => !(choix.get(c.nom) ?? rrDuCoachA(c, jour)?.id)).length

  const total = retenusM.size + retenusR.size

  const enregistrer = async () => {
    setEnvoi(true); setErreur(false)
    try {
      for (const p of propM.filter(gardeM)) await reaffecter(p.magasin.nom, cibleM(p), jour, 'Plan d’affectation')
      for (const p of propR.filter(gardeR)) await rattacherCoach(p.coach.nom, cibleR(p), jour)
      await recharger()
      setConfirmer(false)
      setMessage(`Plan enregistré : ${retenusM.size} magasin${retenusM.size > 1 ? 's' : ''} et ${retenusR.size} Coach${retenusR.size > 1 ? 's' : ''} au ${dateLongue(jour)}.`)
      setChoixM({}); setChoixR({})
    } catch {
      setErreur(true)
      await recharger() // ce qui est déjà passé disparaît des propositions
    } finally { setEnvoi(false) }
  }

  const vueCarte: VueCarte = {
    coachDe: (m: Magasin) => retenusM.get(m.nom) ?? coachA(m, jour),
    rrDe: (m: Magasin) => {
      if (m.rrEnDirect) return m.rr
      const c = reseau.equipe.find((x) => x.nom === (retenusM.get(m.nom) ?? coachA(m, jour)))
      if (!c) return null
      const id = retenusR.get(c.nom)
      return id ? reseau.rrs.find((r) => r.id === id) ?? null : rrDuCoachA(c, jour)
    },
    statutDe: (m: Magasin) => statutA(m.ouverture, jour, reseau.parametres),
    modifies: new Map(propM.filter(gardeM).map((p) => [p.magasin.nom, p.avant])),
  }

  return (
    <>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, mb: 3 }}>
        <Indicateur titre="Magasins sans Coach" avant={sansCoach(new Map())} apres={sansCoach(retenusM)} />
        <Indicateur titre="Coachs en dépassement" avant={depassements(chargesAvant)} apres={depassements(chargesApres)} />
        <Indicateur titre="Coachs sans Responsable Régional" avant={sansRR(new Map())} apres={sansRR(retenusR)} />
        <Indicateur titre={`Responsables Régionaux au-delà de ${reseau.parametres.maxCoachsRR} Coachs`} avant={rrSurcharges(new Map())} apres={rrSurcharges(retenusR)} />
      </Box>

      {depassements(chargesApres) > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {depassements(chargesApres) === 1 ? 'Un Coach reste' : `${depassements(chargesApres)} Coachs restent`} au-delà de {max} : aucun autre Coach en poste n’a assez de place pour reprendre ses magasins sans dépasser la charge choisie. Un recrutement ou un poste à pourvoir permettrait de le soulager.
        </Alert>
      )}
      {rrSurcharges(retenusR) > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {rrSurcharges(retenusR) === 1 ? 'Un Responsable Régional reste' : `${rrSurcharges(retenusR)} Responsables Régionaux restent`} au-delà de {reseau.parametres.maxCoachsRR} Coachs : les autres n’ont pas de place pour en accueillir un de plus. Le maximum se règle dans Direction.
        </Alert>
      )}
      {propM.length === 0 && propR.length === 0 ? (
        <EmptyState icone={<TaskAltOutlined />} titre={`Rien à proposer au ${dateLongue(jour)}`} texte="Chaque magasin en activité ou en préparation a un Coach sous la charge choisie, et chaque Coach a un Responsable Régional. Essaie une autre date ou le seuil d’attention." />
      ) : <>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
          <ToggleButtonGroup exclusive size="small" value={affichage} onChange={(_e, v) => v && setAffichage(v)} aria-label="Affichage du plan">
            <ToggleButton value="liste" sx={{ minHeight: 48, px: 2, gap: 1 }}><FormatListBulleted fontSize="small" />Liste</ToggleButton>
            <ToggleButton value="carte" sx={{ minHeight: 48, px: 2, gap: 1 }}><MapOutlined fontSize="small" />Carte</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" disabled={total === 0} onClick={() => setConfirmer(true)} sx={{ minHeight: 48 }}>
            {total === 0 ? 'Coche au moins une proposition' : `Valider ${total} changement${total > 1 ? 's' : ''}`}
          </Button>
        </Box>

        {affichage === 'carte' ? (
          <Suspense fallback={<Skeleton variant="rounded" height={500} />}>
            <CarteMagasins magasins={reseau.magasins} rrs={reseau.rrs} equipe={reseau.equipe} vue={vueCarte} margeBas={surPC ? 40 : 104} />
          </Suspense>
        ) : <>
          {propM.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="h3" component="h2">Magasins à confier à un Coach ({propM.length})</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Coach proposé : le plus proche qui reste sous la charge choisie. Distances à vol d’oiseau depuis le domicile du Coach, ou le centre de ses magasins s’il n’est pas renseigné.
                </Typography>
                <Box role="list" aria-label="Propositions pour les magasins">
                  {propM.map((p) => {
                    const sans = new Map(retenusM); sans.delete(p.magasin.nom)
                    const options = optionsCoach(reseau, p.magasin, jour, chargesAvecPlan(reseau, jour, sans), plafond, p.avant, positions)
                    const choisie = options.find((o) => o.coach.nom === cibleM(p))
                    const garde = gardeM(p)
                    return (
                      <Box key={p.magasin.nom} role="listitem" aria-label={p.magasin.nom} sx={{ display: 'flex', gap: { xs: 1, md: 2 }, alignItems: 'center', flexWrap: { xs: 'wrap', md: 'nowrap' }, py: 1.5, borderTop: '1px solid', borderColor: 'divider', opacity: garde ? 1 : 0.6 }}>
                        <Checkbox checked={garde} onChange={(e) => setChoixM((c) => ({ ...c, [p.magasin.nom]: { ...c[p.magasin.nom], garde: e.target.checked } }))} slotProps={{ input: { 'aria-label': `Garder la proposition pour ${p.magasin.nom}` } }} />
                        <Box sx={{ flex: 1, minWidth: 180 }}>
                          <Link component={RouterLink} to={lienFiche(p.magasin.nom)} sx={{ fontWeight: 600 }}>{p.magasin.nom}</Link>
                          <Typography variant="body2" color="text.secondary">
                            {raisonMagasinLibelle[p.raison]} · actuellement {p.avant ? <Link component={RouterLink} to={lienCoach(p.avant)}>{p.avant}</Link> : 'aucun Coach'}
                          </Typography>
                        </Box>
                        <TextField
                          select
                          label="Confier à"
                          value={cibleM(p)}
                          onChange={(e) => setChoixM((c) => ({ ...c, [p.magasin.nom]: { ...c[p.magasin.nom], cible: e.target.value } }))}
                          slotProps={{ select: { native: true } }}
                          sx={{ width: { xs: '100%', md: 400 }, flexShrink: 0 }}
                        >
                          {options.map((o) => (
                            <option key={o.coach.nom} value={o.coach.nom}>
                              {o.coach.nom}{o.coach.fictif ? ' (poste à pourvoir)' : ''} · {km(o.distance)} · charge {o.chargeApres}/{reseau.parametres.maxUnits}
                            </option>
                          ))}
                        </TextField>
                        {choisie?.depasse && <Chip size="small" color="error" variant="outlined" label="Au-dessus de la charge choisie" sx={{ fontSize: '0.75rem' }} />}
                      </Box>
                    )
                  })}
                </Box>
              </CardContent>
            </Card>
          )}

          {propR.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="h3" component="h2">Coachs à rattacher à un Responsable Régional ({propR.length})</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Responsable Régional proposé : celui dont la zone est la plus proche du Coach, sans dépasser {reseau.parametres.maxCoachsRR} Coachs (réglable dans Direction).
                </Typography>
                <Box role="list" aria-label="Propositions pour les Coachs">
                  {propR.map((p) => {
                    const sans = new Map(retenusR); sans.delete(p.coach.nom)
                    const options = optionsRR(reseau, p.coach, jour, retenusM, coachsParRR(reseau, jour, sans), p.avant?.id)
                    const garde = gardeR(p)
                    return (
                      <Box key={p.coach.nom} role="listitem" aria-label={p.coach.nom} sx={{ display: 'flex', gap: { xs: 1, md: 2 }, alignItems: 'center', flexWrap: { xs: 'wrap', md: 'nowrap' }, py: 1.5, borderTop: '1px solid', borderColor: 'divider', opacity: garde ? 1 : 0.6 }}>
                        <Checkbox checked={garde} onChange={(e) => setChoixR((c) => ({ ...c, [p.coach.nom]: { ...c[p.coach.nom], garde: e.target.checked } }))} slotProps={{ input: { 'aria-label': `Garder la proposition pour ${p.coach.nom}` } }} />
                        <Box sx={{ flex: 1, minWidth: 180 }}>
                          <Link component={RouterLink} to={lienCoach(p.coach.nom)} sx={{ fontWeight: 600 }}>{p.coach.nom}</Link>
                          <Typography variant="body2" color="text.secondary">{raisonRRLibelle[p.raison]} · actuellement {p.avant?.nom ?? 'aucun'}</Typography>
                        </Box>
                        <TextField
                          select
                          label="Rattacher à"
                          value={cibleR(p)}
                          onChange={(e) => setChoixR((c) => ({ ...c, [p.coach.nom]: { ...c[p.coach.nom], cible: e.target.value } }))}
                          slotProps={{ select: { native: true } }}
                          sx={{ width: { xs: '100%', md: 400 }, flexShrink: 0 }}
                        >
                          {options.map((o) => (
                            <option key={o.rr.id} value={o.rr.id}>{o.rr.nom} · {km(o.distance)} · {o.coachsApres} Coachs</option>
                          ))}
                        </TextField>
                      </Box>
                    )
                  })}
                </Box>
              </CardContent>
            </Card>
          )}
        </>}
      </>}

      {rrsRattachables(reseau).length === 0 && <Alert severity="info" sx={{ mb: 2 }}>Ajoute un Responsable Régional dans l’onglet Organisation pour recevoir des propositions de rattachement.</Alert>}

      <Dialog open={confirmer} onClose={() => !envoi && setConfirmer(false)} aria-labelledby="titre-plan" fullWidth maxWidth="sm">
        <DialogTitle id="titre-plan">Enregistrer le plan au {dateLongue(jour)} ?</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            {retenusM.size > 0 && <>{retenusM.size} magasin{retenusM.size > 1 ? 's changent' : ' change'} de Coach. </>}
            {retenusR.size > 0 && <>{retenusR.size} Coach{retenusR.size > 1 ? 's changent' : ' change'} de Responsable Régional. </>}
          </Typography>
          <Typography variant="body2" color="text.secondary">Les changements prennent effet à cette date et apparaissent dans l’historique de chaque magasin et de chaque Coach. Tu pourras toujours réaffecter ensuite.</Typography>
          {erreur && <Alert severity="error" sx={{ mt: 2 }}>Le plan n’a pas pu être enregistré en entier. Vérifie ta connexion et réessaie : les changements déjà passés ne seront pas doublés.</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmer(false)} disabled={envoi} sx={{ minHeight: 48 }}>Annuler</Button>
          <Button variant="contained" onClick={enregistrer} disabled={envoi} sx={{ minHeight: 48 }}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={!!message} autoHideDuration={6000} onClose={() => setMessage('')} message={message} />
    </>
  )
}
