import { Fragment, useMemo, useState } from 'react'
import { CarteLignes, ChoixAffichage, Initiales, LigneCompacte, useAffichage } from '../components/Social'
import { Link as RouterLink } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Snackbar from '@mui/material/Snackbar'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import BalanceOutlined from '@mui/icons-material/BalanceOutlined'
import ChevronRight from '@mui/icons-material/ChevronRight'
import ExpandMore from '@mui/icons-material/ExpandMore'
import AutoFixHighOutlined from '@mui/icons-material/AutoFixHighOutlined'
import { EmptyState } from '../components/EmptyState'
import { PastilleCharge } from '../components/Charge'
import { ChampMois, premierDuMois } from '../components/ChampMois'
import { coachA, libelleMois, moisAVenir } from '../data/charge'
import { reaffecter } from '../data/chargement'
import { ajouterMois, statutA } from '../data/construction'
import { heures, kilometres, routeAnnuelle, type RouteAnnuelle } from '../data/kilometrage'
import { chargesAvecPlan, creerCalcul, magasinsAvecPlan, optionsCoach, positionCoach } from '../data/plan'
import { useReseau } from '../data/ReseauContext'
import { useTrajetsRoutiers } from '../data/routes'
import { duree } from '../data/tournee'
import { dateCourte, lienCoach, lienFiche } from '../lib/format'
import type { Coach, Magasin, Reseau } from '../data/modele'

// Charge des Coachs, vue par Coach : unités, route de l'année par la route réelle (un aller-retour domicile-magasin
// par visite du rythme), changements prévus dans les douze prochains mois, et simulation de nouvelles répartitions.

interface Changement { date: string; texte: string; magasin: string; sens: '+' | '-' | 'o' }
interface Ligne { coach: Coach; magasins: Magasin[]; charge: number; chargeDans1an: number; route: RouteAnnuelle; changements: Changement[] }
interface Avant { charge: number; route: RouteAnnuelle; magasins: number }

function changementsDuCoach(reseau: Reseau, coach: string, fin: string): Changement[] {
  const res: Changement[] = []
  for (const m of reseau.magasins) {
    m.historiqueCoach.forEach((h, i) => {
      if (h.date <= reseau.jour || h.date > fin) return
      const avant = i > 0 ? m.historiqueCoach[i - 1].coach : ''
      if (h.coach === avant) return
      if (h.coach === coach) res.push({ date: h.date, magasin: m.nom, sens: '+', texte: avant ? `reprend ${m.nom} (après ${avant})` : `prend en charge ${m.nom}` })
      else if (avant === coach) res.push({ date: h.date, magasin: m.nom, sens: '-', texte: `confie ${m.nom} à ${h.coach || 'personne'}` })
    })
    if (m.ouverture > reseau.jour && m.ouverture <= fin && coachA(m, m.ouverture) === coach) res.push({ date: m.ouverture, magasin: m.nom, sens: 'o', texte: `ouverture de ${m.nom}` })
  }
  return res.sort((a, b) => a.date.localeCompare(b.date))
}

function ListeChangements({ changements }: { changements: Changement[] }) {
  if (!changements.length) return <Typography variant="body2" color="text.secondary">Aucun changement prévu dans l’année.</Typography>
  return (
    <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {changements.map((c) => (
        <Box component="li" key={c.date + c.magasin + c.sens} sx={{ display: 'flex', gap: 1.5, py: 0.5 }}>
          <Typography variant="body2" sx={{ width: 96, flexShrink: 0, color: 'text.secondary' }}>{dateCourte(c.date)}</Typography>
          <Typography variant="body2" sx={{ color: c.sens === '-' ? 'text.secondary' : 'text.primary' }}>{c.texte.charAt(0).toUpperCase() + c.texte.slice(1)}</Typography>
        </Box>
      ))}
    </Box>
  )
}

const marque = (r: RouteAnnuelle) => (r.estime || !r.complete ? ' *' : '')
const routeTexte = (r: RouteAnnuelle) => `${kilometres(r.km)} · ${heures(r.minutes)} de route par an${marque(r)}`
const evolution = (avant: string, apres: string) => (avant === apres ? apres : `${avant} → ${apres}`)

export function VueCharge({ reseau, versRepartition }: { reseau: Reseau; versRepartition: () => void }) {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const { recharger } = useReseau()
  const [ouverts, setOuverts] = useState<Set<string>>(new Set())
  const [affichage, setAffichage] = useAffichage('charge')
  const [simulation, setSimulation] = useState<Map<string, string>>(new Map())
  const [date, setDate] = useState(() => moisAVenir(reseau.jour, 2)[1])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(false)
  const [message, setMessage] = useState('')
  const basculer = (n: string) => setOuverts((s) => { const t = new Set(s); if (t.has(n)) t.delete(n); else t.add(n); return t })
  const fin = ajouterMois(reseau.jour, 12)
  const max = reseau.parametres.maxUnits
  const jour = reseau.jour

  const routes = useTrajetsRoutiers(reseau)
  const calcul = useMemo(() => creerCalcul(reseau, jour), [reseau, jour, routes.version]) // eslint-disable-line react-hooks/exhaustive-deps

  const calculer = (choix: Map<string, string>): Ligne[] => {
    const charges = chargesAvecPlan(reseau, jour, choix, calcul)
    const dans1an = chargesAvecPlan(reseau, fin, choix)
    return reseau.equipe
      .map((c) => {
        const magasins = magasinsAvecPlan(reseau, c.nom, jour, choix)
        return {
          coach: c, magasins, charge: charges.get(c.nom) ?? 0, chargeDans1an: dans1an.get(c.nom) ?? 0,
          route: routeAnnuelle(reseau, positionCoach(reseau, c, jour, choix), magasins), changements: changementsDuCoach(reseau, c.nom, fin),
        }
      })
      .filter((l) => l.magasins.length || l.changements.length || choix.size > 0 && [...choix.values()].includes(l.coach.nom))
      .sort((a, b) => a.coach.nom.localeCompare(b.coach.nom, 'fr'))
  }
  const base = useMemo(() => calculer(new Map()), [calcul, fin]) // eslint-disable-line react-hooks/exhaustive-deps
  const lignes = useMemo(() => (simulation.size ? calculer(simulation) : base), [simulation, base]) // eslint-disable-line react-hooks/exhaustive-deps
  const avantDe = useMemo(() => new Map<string, Avant>(base.map((l) => [l.coach.nom, { charge: l.charge, route: l.route, magasins: l.magasins.length }])), [base])
  const touches = new Set(simulation.size ? [...simulation].flatMap(([nom, vers]) => [coachA(calcul.magasin.get(nom)!, jour), vers]) : [])

  if (!lignes.length) return <EmptyState icone={<BalanceOutlined />} titre="Aucun Coach à afficher" texte="La charge apparaîtra dès qu’un Coach aura des magasins. Ajoute un Coach dans Équipe." action={<Button variant="contained" component={RouterLink} to="/equipe" sx={{ minHeight: 48 }}>Ouvrir Équipe</Button>} />

  const sansDomicile = lignes.filter((l) => l.coach.lat === null).map((l) => l.coach.nom)
  const depassements = base.filter((l) => l.charge > max || l.chargeDans1an > max)
  const sansCoach = reseau.magasins.filter((m) => !m.rrEnDirect && statutA(m.ouverture, fin, reseau.parametres) !== 'avenir' && !coachA(m, fin) && !coachA(m, jour))
  const aTraiter = depassements.length + sansCoach.length > 0

  const simuler = (magasin: string, vers: string) => setSimulation((s) => {
    const t = new Map(s)
    const m = calcul.magasin.get(magasin)
    if (!vers || (m && coachA(m, jour) === vers)) t.delete(magasin); else t.set(magasin, vers)
    return t
  })
  const valider = async () => {
    setEnvoi(true); setErreur(false)
    try {
      for (const [magasin, coach] of simulation) await reaffecter(magasin, coach, date, 'Simulation de charge')
      await recharger()
      setMessage(`${simulation.size} magasin${simulation.size > 1 ? 's changent' : ' change'} de Coach à partir de ${libelleMois(premierDuMois(date))}.`)
      setSimulation(new Map())
    } catch {
      setErreur(true)
      await recharger()
    } finally { setEnvoi(false) }
  }

  const avant = (l: Ligne) => (touches.has(l.coach.nom) ? avantDe.get(l.coach.nom) : undefined)
  const RouteCellule = ({ l }: { l: Ligne }) => {
    const a = avant(l)
    return <>{a ? `${evolution(kilometres(a.route.km), kilometres(l.route.km))} · ${evolution(heures(a.route.minutes), heures(l.route.minutes))}` : `${kilometres(l.route.km)} · ${heures(l.route.minutes)}`}{marque(l.route)}</>
  }

  // Magasins du Coach, du plus loin au plus près, avec le Coach à qui le confier dans la simulation
  const Detail = ({ l }: { l: Ligne }) => (
    <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, py: 1.5 }}>
      <Box>
        <Typography variant="subtitle2" component="h3" sx={{ mb: 0.5 }}>Magasins ({l.magasins.length})</Typography>
        <Box role="list" aria-label={`Magasins de ${l.coach.nom}`}>
          {[...l.magasins].sort((a, b) => (l.route.acces.find((x) => x.magasin === b)?.minutes ?? 0) - (l.route.acces.find((x) => x.magasin === a)?.minutes ?? 0)).map((m) => {
            const acces = l.route.acces.find((x) => x.magasin === m)
            const deplace = simulation.has(m.nom)
            const origine = coachA(m, jour)
            const options = optionsCoach(reseau, m, jour, chargesAvecPlan(reseau, jour, simulation, calcul), max, origine, calcul, simulation).filter((o) => !o.coach.fictif)
            return (
              <Box key={m.nom} role="listitem" aria-label={m.nom} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: { xs: 'wrap', md: 'nowrap' }, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ flex: 1, minWidth: 180 }}>
                  <Link component={RouterLink} to={lienFiche(m.nom)} sx={{ fontWeight: 600 }}>{m.nom}</Link>
                  {deplace && <Chip size="small" color="primary" variant="outlined" label={`Simulé, venant de ${origine || 'aucun Coach'}`} sx={{ ml: 1, fontSize: '0.75rem' }} />}
                  <Typography variant="body2" color="text.secondary">
                    {acces ? `${duree(acces.minutes)} aller-retour (${kilometres(acces.km)})${acces.estime ? ', estimé' : ''} · ${acces.visites} visite${acces.visites > 1 ? 's' : ''} par an · ${heures(acces.minutes * acces.visites)} de route par an` : 'Position inconnue'}
                  </Typography>
                </Box>
                <TextField select label="Confier à" value={simulation.get(m.nom) ?? origine} onChange={(e) => simuler(m.nom, e.target.value)}
                  slotProps={{ select: { native: true } }} sx={{ width: { xs: '100%', md: 340 }, flexShrink: 0 }}>
                  {origine && <option value={origine}>{origine} (aujourd’hui)</option>}
                  {options.filter((o) => o.coach.nom !== origine).map((o) => (
                    <option key={o.coach.nom} value={o.coach.nom}>
                      {o.coach.nom} · {o.minutesEnPlus === null ? 'trajet inconnu' : `+${heures(o.minutesEnPlus)} par an`} · charge {o.chargeApres}/{max}
                    </option>
                  ))}
                </TextField>
              </Box>
            )
          })}
        </Box>
      </Box>
      <Box>
        <Typography variant="subtitle2" component="h3" sx={{ mb: 0.5 }}>Changements dans les douze prochains mois</Typography>
        <ListeChangements changements={l.changements} />
      </Box>
    </Box>
  )

  const coachsTouches = lignes.filter((l) => touches.has(l.coach.nom))

  return (
    <>
      {aTraiter && (
        <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" onClick={versRepartition} startIcon={<AutoFixHighOutlined />} sx={{ minHeight: 48 }}>Proposer une répartition</Button>}>
          {[
            depassements.length && `${depassements.length} Coach${depassements.length > 1 ? 's' : ''} au-delà de ${max} unités maintenant ou dans l’année`,
            sansCoach.length && `${sansCoach.length} magasin${sansCoach.length > 1 ? 's' : ''} sans Coach d’ici un an`,
          ].filter(Boolean).join(' · ')}
        </Alert>
      )}

      {routes.etat === 'estime' && <Alert severity="info" sx={{ mb: 2 }}>Trajets estimés : le service d’itinéraire ne répond pas pour le moment.</Alert>}

      {simulation.size > 0 && (
        <Card component="section" aria-label="Simulation" sx={{ mb: 2, borderColor: 'primary.main' }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h3" component="h2" sx={{ mb: 1 }}>Simulation : {simulation.size} magasin{simulation.size > 1 ? 's changent' : ' change'} de Coach</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {[...simulation].map(([nom, vers]) => (
                <Chip key={nom} label={`${nom} : ${coachA(calcul.magasin.get(nom)!, jour) || 'aucun Coach'} → ${vers}`} onDelete={() => simuler(nom, '')} sx={{ minHeight: 40 }} />
              ))}
            </Box>
            <Box role="list" aria-label="Effet sur les Coachs">
              {coachsTouches.map((l) => {
                const a = avantDe.get(l.coach.nom)
                return (
                  <Box key={l.coach.nom} role="listitem" aria-label={l.coach.nom} sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography sx={{ fontWeight: 600, minWidth: 180 }}>{l.coach.nom}</Typography>
                    <Typography variant="body2" sx={{ color: l.charge > max ? 'error.main' : 'text.primary' }}>Charge {evolution(String(a?.charge ?? 0), String(l.charge))} / {max}</Typography>
                    <Typography variant="body2">{evolution(kilometres(a?.route.km ?? 0), kilometres(l.route.km))} par an</Typography>
                    <Typography variant="body2">{evolution(heures(a?.route.minutes ?? 0), heures(l.route.minutes))} de route par an</Typography>
                  </Box>
                )
              })}
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mt: 2 }}>
              <ChampMois label="À partir de" value={date} onChange={setDate} jour={reseau.jour} sx={{ width: { xs: '100%', sm: 220 } }} />
              <Box sx={{ flex: 1 }} />
              <Button onClick={() => setSimulation(new Map())} disabled={envoi} sx={{ minHeight: 48 }}>Abandonner</Button>
              <Button variant="contained" onClick={valider} disabled={envoi || !/^\d{4}-\d{2}-\d{2}$/.test(date)} sx={{ minHeight: 48 }}>
                {envoi ? 'Enregistrement…' : `Valider ${simulation.size} changement${simulation.size > 1 ? 's' : ''}`}
              </Button>
            </Box>
            {erreur && <Alert severity="error" sx={{ mt: 2 }}>Les changements n’ont pas tous pu être enregistrés. Vérifie ta connexion et réessaie.</Alert>}
          </CardContent>
        </Card>
      )}

      {surPC && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}><ChoixAffichage valeur={affichage} onChange={setAffichage} /></Box>
      )}
      {surPC && affichage === 'tableau' ? (
        <Card>
          <TableContainer>
            <Table className="colonne-fixe" aria-label="Charge par Coach">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 48 }} />
                  <TableCell>Coach</TableCell>
                  <TableCell>Responsable Régional</TableCell>
                  <TableCell align="right">Magasins</TableCell>
                  <TableCell align="center">Charge</TableCell>
                  <TableCell>Route par an</TableCell>
                  <TableCell>Magasin le plus loin</TableCell>
                  <TableCell>Dans l’année</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lignes.map((l) => {
                  const ouvert = ouverts.has(l.coach.nom)
                  const plus = l.changements.filter((c) => c.sens !== '-').length, moins = l.changements.filter((c) => c.sens === '-').length
                  const loin = l.route.acces[0]
                  return (
                    <Fragment key={l.coach.nom}>
                      <TableRow hover onClick={() => basculer(l.coach.nom)} sx={{ cursor: 'pointer', '& > td': { borderBottom: ouvert ? 0 : undefined } }}>
                        <TableCell sx={{ px: 0 }}>
                          <IconButton onClick={(e) => { e.stopPropagation(); basculer(l.coach.nom) }} aria-label={`${ouvert ? 'Replier' : 'Déplier'} ${l.coach.nom}`} aria-expanded={ouvert}>{ouvert ? <ExpandMore /> : <ChevronRight />}</IconButton>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}><Link component={RouterLink} to={lienCoach(l.coach.nom)} onClick={(e) => e.stopPropagation()} sx={{ fontWeight: 600 }}>{l.coach.nom}</Link></TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{l.coach.rr?.nom ?? 'Aucun'}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{l.magasins.length}</TableCell>
                        <TableCell align="center"><PastilleCharge reseau={reseau} charge={l.charge} /></TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}><RouteCellule l={l} /></TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{loin ? `${loin.magasin.nom} · ${duree(loin.minutes / 2)}` : 'Aucun'}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>
                          {l.changements.length ? [plus && `${plus} arrivée${plus > 1 ? 's' : ''}`, moins && `${moins} départ${moins > 1 ? 's' : ''}`].filter(Boolean).join(', ') + ` · charge ${l.chargeDans1an} dans un an` : 'Aucun changement'}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={8} sx={{ py: 0, borderBottom: ouvert ? undefined : 0 }}>
                          <Collapse in={ouvert} unmountOnExit><Box sx={{ pl: 6 }}><Detail l={l} /></Box></Collapse>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      ) : (
        <CarteLignes label="Charge par Coach">
          {lignes.map((l) => {
            const ouvert = ouverts.has(l.coach.nom)
            const a = avant(l)
            return (
              <Box key={l.coach.nom}>
                <LigneCompacte lien={lienCoach(l.coach.nom)} avatar={<Initiales nom={l.coach.nom} />} titre={l.coach.nom}
                  detail={<>{a && a.magasins !== l.magasins.length ? `${a.magasins} → ` : ''}{l.magasins.length} magasin{l.magasins.length > 1 ? 's' : ''} · {a ? <RouteCellule l={l} /> : routeTexte(l.route)}</>}
                  fin={<PastilleCharge reseau={reseau} charge={l.charge} />}
                  actions={<IconButton onClick={() => basculer(l.coach.nom)} aria-label={`${ouvert ? 'Replier' : 'Déplier'} ${l.coach.nom}`} aria-expanded={ouvert}>{ouvert ? <ExpandMore /> : <ChevronRight />}</IconButton>} />
                <Collapse in={ouvert} unmountOnExit><Box sx={{ px: 2, pb: 2 }}><Detail l={l} /></Box></Collapse>
              </Box>
            )
          })}
        </CarteLignes>
      )}

      {(sansDomicile.length > 0 || lignes.some((l) => l.route.estime)) && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {sansDomicile.length > 0 && `Domicile non renseigné pour ${sansDomicile.join(', ')} : trajets comptés depuis le centre de ses magasins (*). `}
          {lignes.some((l) => l.route.estime) && 'Trajets marqués * en partie estimés, en attendant le service d’itinéraire.'}
        </Alert>
      )}
      <Snackbar open={!!message} autoHideDuration={6000} onClose={() => setMessage('')} message={message} />
    </>
  )
}
