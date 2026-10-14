import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Link from '@mui/material/Link'
import Tab from '@mui/material/Tab'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import BalanceOutlined from '@mui/icons-material/BalanceOutlined'
import { EmptyState } from '../components/EmptyState'
import { JaugeCharge, PastilleCharge, aideCharge } from '../components/Charge'
import { chargeA, coachA, libelleMois, moisAVenir, niveauCharge } from '../data/charge'
import { statutA } from '../data/construction'
import { lienCoach, lienFiche } from '../lib/format'
import type { Reseau } from '../data/modele'

export function VueCharge({ reseau }: { reseau: Reseau }) {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  // Colonne 0 = aujourd'hui, puis le 1er de chacun des 11 mois suivants
  const dates = [reseau.jour, ...moisAVenir(reseau.jour, 12).slice(1)]
  const [indice, setIndice] = useState(0)
  const jour = dates[indice]
  const libelle = (i: number, court = false) => (i === 0 ? 'Aujourd’hui' : libelleMois(dates[i], court))

  if (reseau.equipe.length === 0) return <EmptyState icone={<BalanceOutlined />} titre="Aucun Coach à afficher" texte="Le plan de charge apparaîtra dès qu’un magasin sera affecté à un Coach dans l’ancienne application." />

  const charges = reseau.equipe.map((c) => ({ coach: c, parDate: dates.map((d) => chargeA(reseau, c.nom, d)) }))
    .filter((l) => l.parDate.some((v) => v > 0))
  const triees = [...charges].sort((a, b) => b.parDate[indice] - a.parDate[indice])
  const enDepassement = triees.filter((l) => niveauCharge(reseau, l.parDate[indice]) === 'depassement')
  const aSurveiller = triees.filter((l) => ['attention', 'complet'].includes(niveauCharge(reseau, l.parDate[indice])))
  const sansCoach = reseau.magasins.filter((m) => statutA(m.ouverture, jour, reseau.parametres) !== 'avenir' && !coachA(m, jour))
  const moyenne = triees.length ? triees.reduce((t, l) => t + l.parDate[indice], 0) / triees.length : 0

  return (
    <>
      <Tabs value={indice} onChange={(_e, v) => setIndice(v)} variant="scrollable" allowScrollButtonsMobile aria-label="Mois affiché" sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        {dates.map((d, i) => <Tab key={d} value={i} label={libelle(i)} sx={{ minHeight: 48 }} />)}
      </Tabs>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, mb: 2 }}>
        {[
          { valeur: enDepassement.length, texte: 'Coachs en dépassement', couleur: enDepassement.length ? 'error.main' : 'text.primary' },
          { valeur: aSurveiller.length, texte: 'Coachs à surveiller', couleur: aSurveiller.length ? 'warning.main' : 'text.primary' },
          { valeur: sansCoach.length, texte: 'Magasins sans Coach', couleur: sansCoach.length ? 'warning.main' : 'text.primary' },
          { valeur: moyenne.toLocaleString('fr-FR', { maximumFractionDigits: 1 }), texte: `Charge moyenne sur ${reseau.parametres.maxUnits}`, couleur: 'text.primary' },
        ].map((k) => (
          <Card key={k.texte}><CardContent>
            <Typography variant="h2" component="p" sx={{ color: k.couleur }}>{k.valeur}</Typography>
            <Typography variant="body2" color="text.secondary">{k.texte}</Typography>
          </CardContent></Card>
        ))}
      </Box>

      {sansCoach.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {sansCoach.length === 1 ? 'Un magasin n’a' : `${sansCoach.length} magasins n’ont`} pas de Coach {indice === 0 ? 'aujourd’hui' : `en ${libelle(indice)}`} :{' '}
          {sansCoach.map((m, i) => <span key={m.nom}>{i > 0 && ', '}<Link component={RouterLink} to={lienFiche(m.nom)}>{m.nom}</Link></span>)}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h3" component="h2" sx={{ mb: 0.5 }}>Charge des Coachs · {libelle(indice)}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{aideCharge}</Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, columnGap: 4 }}>
            {triees.map((l) => (
              <Link key={l.coach.nom} component={RouterLink} to={lienCoach(l.coach.nom)} underline="none" color="inherit" sx={{ display: 'block', borderRadius: 2, p: 1, mx: -1, '&:hover': { bgcolor: 'action.hover' } }}>
                <JaugeCharge reseau={reseau} charge={l.parDate[indice]} libelle={l.coach.nom} />
              </Link>
            ))}
          </Box>
        </CardContent>
      </Card>

      {surPC && (
        <>
          <Typography variant="h3" component="h2" sx={{ mb: 0.5 }}>Projection sur douze mois</Typography>
          <Card>
            <TableContainer>
              <Table size="small" aria-label="Projection de charge">
                <TableHead>
                  <TableRow>
                    <TableCell>Coach</TableCell>
                    {dates.map((d, i) => <TableCell key={d} align="center" sx={{ whiteSpace: 'nowrap' }}>{i === 0 ? 'Auj.' : libelleMois(d, true)}</TableCell>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...charges].sort((a, b) => a.coach.nom.localeCompare(b.coach.nom, 'fr')).map((l) => (
                    <TableRow key={l.coach.nom} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}><Link component={RouterLink} to={lienCoach(l.coach.nom)}>{l.coach.nom}</Link></TableCell>
                      {l.parDate.map((v, i) => <TableCell key={i} align="center" sx={{ px: 0.5 }}><PastilleCharge reseau={reseau} charge={v} /></TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 3 }}>
        Pour réaffecter un magasin, ouvre sa fiche et choisis « Réaffecter ». La règle de charge se règle dans Direction.
      </Typography>
    </>
  )
}

