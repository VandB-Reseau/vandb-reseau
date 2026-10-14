import { Fragment, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import BalanceOutlined from '@mui/icons-material/BalanceOutlined'
import ChevronRight from '@mui/icons-material/ChevronRight'
import ExpandMore from '@mui/icons-material/ExpandMore'
import AutoFixHighOutlined from '@mui/icons-material/AutoFixHighOutlined'
import { EmptyState } from '../components/EmptyState'
import { PastilleCharge } from '../components/Charge'
import { chargeA, coachA, magasinsDuCoach } from '../data/charge'
import { ajouterMois, statutA } from '../data/construction'
import { positionsCoachs } from '../data/plan'
import { duree, tournee, type Tournee } from '../data/tournee'
import { dateCourte, lienCoach, lienFiche } from '../lib/format'
import type { Coach, Magasin, Reseau } from '../data/modele'

// Charge des Coachs, vue par Coach : nombre de magasins, tournée (domicile, magasins, retour) en km et en temps,
// et les changements prévus dans les douze prochains mois.

interface Changement { date: string; texte: string; magasin: string; sens: '+' | '-' | 'o' }
interface Ligne { coach: Coach; magasins: Magasin[]; charge: number; chargeDans1an: number; tournee: Tournee; changements: Changement[] }

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

function Detail({ l }: { l: Ligne }) {
  return (
    <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, py: 1.5 }}>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Magasins aujourd’hui ({l.magasins.length})</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.5 }}>
          {l.magasins.map((m) => <Link key={m.nom} component={RouterLink} to={lienFiche(m.nom)} variant="body2">{m.nom}</Link>)}
        </Box>
      </Box>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Changements dans les douze prochains mois</Typography>
        <ListeChangements changements={l.changements} />
      </Box>
    </Box>
  )
}

export function VueCharge({ reseau }: { reseau: Reseau }) {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const [ouverts, setOuverts] = useState<Set<string>>(new Set())
  const basculer = (n: string) => setOuverts((s) => { const t = new Set(s); if (t.has(n)) t.delete(n); else t.add(n); return t })
  const fin = ajouterMois(reseau.jour, 12)
  const max = reseau.parametres.maxUnits
  const maxMin = reseau.parametres.maxTourneeHeures * 60

  const lignes: Ligne[] = useMemo(() => {
    const positions = positionsCoachs(reseau, reseau.jour)
    return reseau.equipe
      .map((c) => {
        const magasins = magasinsDuCoach(reseau, c.nom)
        return {
          coach: c, magasins, charge: chargeA(reseau, c.nom), chargeDans1an: chargeA(reseau, c.nom, fin),
          tournee: tournee(c.lat !== null && c.lon !== null ? { lat: c.lat, lon: c.lon } : positions.get(c.nom) ?? null, magasins),
          changements: changementsDuCoach(reseau, c.nom, fin),
        }
      })
      .filter((l) => l.magasins.length || l.changements.length)
      .sort((a, b) => a.coach.nom.localeCompare(b.coach.nom, 'fr'))
  }, [reseau, fin])

  if (!lignes.length) return <EmptyState icone={<BalanceOutlined />} titre="Aucun Coach à afficher" texte="La charge apparaîtra dès qu’un Coach aura des magasins. Ajoute un Coach dans l’onglet Organisation." />

  const sansDomicile = lignes.filter((l) => l.coach.lat === null).map((l) => l.coach.nom)
  const longues = lignes.filter((l) => l.tournee.minutes > maxMin)
  const depassements = lignes.filter((l) => l.charge > max || l.chargeDans1an > max)
  const sansCoach = reseau.magasins.filter((m) => !m.rrEnDirect && statutA(m.ouverture, fin, reseau.parametres) !== 'avenir' && !coachA(m, fin) && !coachA(m, reseau.jour))
  const aTraiter = longues.length + depassements.length + sansCoach.length > 0

  const Tour = ({ t }: { t: Tournee }) => (
    <Typography variant="body2" component="span" sx={{ color: t.minutes > maxMin ? 'error.main' : 'text.primary', fontWeight: t.minutes > maxMin ? 700 : 400 }}>
      {Math.round(t.km).toLocaleString('fr-FR')} km · {duree(t.minutes)}{!t.complete && ' *'}
    </Typography>
  )

  return (
    <>
      {aTraiter && (
        <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" component={RouterLink} to={`/equipe?vue=plan&date=${reseau.jour}`} startIcon={<AutoFixHighOutlined />} sx={{ minHeight: 48 }}>Proposer une répartition</Button>}>
          {[
            longues.length && `${longues.length} tournée${longues.length > 1 ? 's' : ''} au-delà de ${reseau.parametres.maxTourneeHeures} h`,
            depassements.length && `${depassements.length} Coach${depassements.length > 1 ? 's' : ''} au-delà de ${max} unités maintenant ou dans l’année`,
            sansCoach.length && `${sansCoach.length} magasin${sansCoach.length > 1 ? 's' : ''} sans Coach d’ici un an`,
          ].filter(Boolean).join(' · ')}
        </Alert>
      )}

      {surPC ? (
        <Card>
          <TableContainer>
            <Table aria-label="Charge par Coach">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 48 }} />
                  <TableCell>Coach</TableCell>
                  <TableCell>Responsable Régional</TableCell>
                  <TableCell align="right">Magasins</TableCell>
                  <TableCell align="center">Charge</TableCell>
                  <TableCell>Tournée complète</TableCell>
                  <TableCell>Dans l’année</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lignes.map((l) => {
                  const ouvert = ouverts.has(l.coach.nom)
                  const plus = l.changements.filter((c) => c.sens !== '-').length, moins = l.changements.filter((c) => c.sens === '-').length
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}><Tour t={l.tournee} /></TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>
                          {l.changements.length ? [plus && `${plus} arrivée${plus > 1 ? 's' : ''}`, moins && `${moins} départ${moins > 1 ? 's' : ''}`].filter(Boolean).join(', ') + ` · charge ${l.chargeDans1an} dans un an` : 'Aucun changement'}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={7} sx={{ py: 0, borderBottom: ouvert ? undefined : 0 }}>
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
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {lignes.map((l) => {
            const ouvert = ouverts.has(l.coach.nom)
            return (
              <Card key={l.coach.nom}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Link component={RouterLink} to={lienCoach(l.coach.nom)} sx={{ flex: 1, minWidth: 0, fontWeight: 600, py: 1 }}>{l.coach.nom}</Link>
                    <PastilleCharge reseau={reseau} charge={l.charge} />
                    <IconButton onClick={() => basculer(l.coach.nom)} aria-label={`${ouvert ? 'Replier' : 'Déplier'} ${l.coach.nom}`} aria-expanded={ouvert}>{ouvert ? <ExpandMore /> : <ChevronRight />}</IconButton>
                  </Box>
                  <Typography variant="body2">{l.magasins.length} magasin{l.magasins.length > 1 ? 's' : ''} · <Tour t={l.tournee} /></Typography>
                  <Typography variant="body2" color="text.secondary">{l.changements.length ? `${l.changements.length} changement${l.changements.length > 1 ? 's' : ''} dans l’année` : 'Aucun changement dans l’année'}</Typography>
                  <Collapse in={ouvert} unmountOnExit><Detail l={l} /></Collapse>
                </CardContent>
              </Card>
            )
          })}
        </Box>
      )}

      {sansDomicile.length > 0 && <Alert severity="info" sx={{ mt: 2 }}>Domicile non renseigné pour {sansDomicile.join(', ')} : tournée calculée depuis le centre de ses magasins (*).</Alert>}
    </>
  )
}
