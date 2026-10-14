import { Fragment, useState } from 'react'
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
import { JaugeCharge, PastilleCharge, aideCharge } from '../components/Charge'
import { PastilleStatut } from '../components/Pastilles'
import { chargeA, coachA, libelleMois, magasinsDuCoach, moisAVenir, niveauCharge, poids } from '../data/charge'
import { statutA } from '../data/construction'
import { lienCoach, lienFiche } from '../lib/format'
import type { Coach, Reseau } from '../data/modele'

// Charge des Coachs : d'abord ce qui demande une action, puis chaque Coach avec sa charge
// aujourd'hui, son pic sur douze mois et le détail des magasins qui la composent.

interface Ligne { coach: Coach; parMois: number[]; actuelle: number; pic: number; moisPic: number }

function libelle(dates: string[], i: number, court = false) {
  return i === 0 ? (court ? 'Auj.' : 'aujourd’hui') : libelleMois(dates[i], court)
}

function Detail({ reseau, coach }: { reseau: Reseau; coach: string }) {
  const magasins = magasinsDuCoach(reseau, coach).map((m) => ({ m, w: poids(reseau, m.statut) })).sort((a, b) => b.w - a.w || a.m.nom.localeCompare(b.m.nom, 'fr'))
  if (!magasins.length) return <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>Aucun magasin aujourd’hui.</Typography>
  return (
    <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {magasins.map(({ m, w }) => (
        <Box component="li" key={m.nom} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 44, borderTop: '1px solid', borderColor: 'divider' }}>
          <Link component={RouterLink} to={lienFiche(m.nom)} sx={{ flex: 1, minWidth: 0 }}>{m.nom}</Link>
          <PastilleStatut statut={m.statut} />
          <Typography variant="body2" color="text.secondary" sx={{ width: 72, textAlign: 'right' }}>{w} unité{w > 1 ? 's' : ''}</Typography>
        </Box>
      ))}
    </Box>
  )
}

export function VueCharge({ reseau }: { reseau: Reseau }) {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const [ouverts, setOuverts] = useState<Set<string>>(new Set())
  const basculer = (n: string) => setOuverts((s) => { const t = new Set(s); if (t.has(n)) t.delete(n); else t.add(n); return t })
  // Aujourd'hui, puis le 1er de chacun des 11 mois suivants
  const dates = [reseau.jour, ...moisAVenir(reseau.jour, 12).slice(1)]
  const max = reseau.parametres.maxUnits

  if (reseau.equipe.length === 0) return <EmptyState icone={<BalanceOutlined />} titre="Aucun Coach à afficher" texte="La charge apparaîtra dès qu’un Coach aura des magasins. Ajoute un Coach dans l’onglet Organisation." />

  const lignes: Ligne[] = reseau.equipe
    .map((c) => {
      const parMois = dates.map((d) => chargeA(reseau, c.nom, d))
      const pic = Math.max(...parMois)
      return { coach: c, parMois, actuelle: parMois[0], pic, moisPic: parMois.indexOf(pic) }
    })
    .filter((l) => l.pic > 0)
    .sort((a, b) => b.pic - a.pic || b.actuelle - a.actuelle || a.coach.nom.localeCompare(b.coach.nom, 'fr'))

  // Ce qui demande une action : dépassements (maintenant ou à venir) et magasins qui vont manquer de Coach
  const depassements = lignes.filter((l) => l.pic > max).map((l) => ({ l, premier: l.parMois.findIndex((v) => v > max) }))
  const sansCoach = dates.map((d, i) => ({ i, magasins: reseau.magasins.filter((m) => !m.rrEnDirect && statutA(m.ouverture, d, reseau.parametres) !== 'avenir' && !coachA(m, d)) }))
  const premierSansCoach = sansCoach.find((x) => x.magasins.length)
  const aTraiter = depassements.length > 0 || !!premierSansCoach
  const datePlan = depassements.length ? dates[Math.min(...depassements.map((d) => d.premier))] : premierSansCoach ? dates[premierSansCoach.i] : reseau.jour

  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {aideCharge} Maximum : {max} unités, à surveiller dès {reseau.parametres.alertThreshold} (réglable dans Direction).
      </Typography>

      <Card sx={{ mb: 3 }} aria-label="À traiter">
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h3" component="h2" sx={{ mb: 1 }}>À traiter sur les douze prochains mois</Typography>
          {!aTraiter ? (
            <Alert severity="success">Aucun Coach ne dépasse {max} unités et tous les magasins ont un Coach d’ici un an.</Alert>
          ) : <>
            <Box component="ul" sx={{ pl: 2.5, my: 1, '& li': { mb: 0.75 } }}>
              {depassements.map(({ l, premier }) => (
                <li key={l.coach.nom}>
                  <Typography variant="body1">
                    <Link component={RouterLink} to={lienCoach(l.coach.nom)} sx={{ fontWeight: 600 }}>{l.coach.nom}</Link>
                    {premier === 0 ? ' est en dépassement aujourd’hui' : ` sera en dépassement à partir de ${libelle(dates, premier)}`} ({l.parMois[premier]} / {max}{l.pic > l.parMois[premier] ? `, jusqu’à ${l.pic} en ${libelle(dates, l.moisPic)}` : ''}).
                  </Typography>
                </li>
              ))}
              {premierSansCoach && (
                <li>
                  <Typography variant="body1">
                    {premierSansCoach.magasins.length === 1 ? 'Un magasin sera' : `${premierSansCoach.magasins.length} magasins seront`} sans Coach {premierSansCoach.i === 0 ? 'dès aujourd’hui' : `en ${libelle(dates, premierSansCoach.i)}`} :{' '}
                    {premierSansCoach.magasins.map((m, i) => <span key={m.nom}>{i > 0 && ', '}<Link component={RouterLink} to={lienFiche(m.nom)}>{m.nom}</Link></span>)}.
                  </Typography>
                </li>
              )}
            </Box>
            <Button variant="contained" startIcon={<AutoFixHighOutlined />} component={RouterLink} to={`/equipe?vue=plan&date=${datePlan}`} sx={{ minHeight: 48, mt: 1 }}>
              Proposer des réaffectations
            </Button>
          </>}
        </CardContent>
      </Card>

      <Typography variant="h3" component="h2" sx={{ mb: 0.5 }}>Charge par Coach</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Du plus chargé au moins chargé, selon le pic des douze mois. Déplie un Coach pour voir les magasins qui composent sa charge.
      </Typography>

      {surPC ? (
        <Card>
          <TableContainer>
            <Table size="small" aria-label="Charge par Coach">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 48 }} />
                  <TableCell>Coach</TableCell>
                  <TableCell>Responsable Régional</TableCell>
                  <TableCell sx={{ minWidth: 200 }}>Aujourd’hui</TableCell>
                  {dates.slice(1).map((d, i) => <TableCell key={d} align="center" sx={{ whiteSpace: 'nowrap', px: 0.5 }}>{libelle(dates, i + 1, true)}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {lignes.map((l) => {
                  const ouvert = ouverts.has(l.coach.nom)
                  return (
                    <Fragment key={l.coach.nom}>
                      <TableRow hover>
                        <TableCell sx={{ px: 0 }}>
                          <IconButton onClick={() => basculer(l.coach.nom)} aria-label={`${ouvert ? 'Replier' : 'Déplier'} ${l.coach.nom}`} aria-expanded={ouvert}>{ouvert ? <ExpandMore /> : <ChevronRight />}</IconButton>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}><Link component={RouterLink} to={lienCoach(l.coach.nom)}>{l.coach.nom}</Link></TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{l.coach.rr?.nom ?? 'Aucun'}</TableCell>
                        <TableCell><JaugeCharge reseau={reseau} charge={l.actuelle} /></TableCell>
                        {l.parMois.slice(1).map((v, i) => {
                          const n = niveauCharge(reseau, v)
                          return <TableCell key={i} align="center" sx={{ px: 0.5, fontWeight: n === 'depassement' ? 700 : 400, color: n === 'depassement' ? 'error.main' : n === 'attention' || n === 'complet' ? 'warning.dark' : 'text.secondary' }}>{v}</TableCell>
                        })}
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={4 + dates.length - 1} sx={{ py: 0, borderBottom: ouvert ? undefined : 0 }}>
                          <Collapse in={ouvert} unmountOnExit><Box sx={{ pl: 6, pb: 1.5, maxWidth: 640 }}><Detail reseau={reseau} coach={l.coach.nom} /></Box></Collapse>
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
                    <PastilleCharge reseau={reseau} charge={l.actuelle} />
                    <IconButton onClick={() => basculer(l.coach.nom)} aria-label={`${ouvert ? 'Replier' : 'Déplier'} ${l.coach.nom}`} aria-expanded={ouvert}>{ouvert ? <ExpandMore /> : <ChevronRight />}</IconButton>
                  </Box>
                  <Typography variant="body2" color={l.pic > max ? 'error' : 'text.secondary'}>
                    {l.pic > l.actuelle ? `Monte à ${l.pic} en ${libelle(dates, l.moisPic)}` : 'Stable ou en baisse sur douze mois'}
                  </Typography>
                  <Collapse in={ouvert} unmountOnExit><Box sx={{ mt: 1 }}><Detail reseau={reseau} coach={l.coach.nom} /></Box></Collapse>
                </CardContent>
              </Card>
            )
          })}
        </Box>
      )}
    </>
  )
}
