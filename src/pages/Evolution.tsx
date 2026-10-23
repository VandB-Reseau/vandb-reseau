import { Link as RouterLink } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
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
import CalendarTodayOutlined from '@mui/icons-material/CalendarTodayOutlined'
import { CarteLignes, ChoixAffichage, Initiales, LigneCompacte, useAffichage, cartouche } from '../components/Social'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { lienFiche } from '../lib/format'
import type { Magasin, Reseau } from '../data/modele'

// Année civile, de janvier à décembre
export const anneeDe = (iso: string) => Number(iso.slice(0, 4))

function lignes(reseau: Reseau) {
  const datees = reseau.magasins.filter((m) => m.ouverture)
  const annees = [...new Set(datees.map((m) => anneeDe(m.ouverture)))].sort()
  let cumul = 0
  const enCours = anneeDe(reseau.jour)
  return annees.map((a) => {
    const ouvertures = datees.filter((m) => anneeDe(m.ouverture) === a).sort((x, y) => x.ouverture.localeCompare(y.ouverture))
    cumul += ouvertures.length
    return { a, ouvertures, cumul, prevues: ouvertures.filter((m) => m.ouverture > reseau.jour).length, enCours: a === enCours }
  })
}

function Contenu({ reseau }: { reseau: Reseau }) {
  const l = lignes(reseau)
  const max = Math.max(1, ...l.map((x) => x.ouvertures.length))
  const recentes = l.slice(-8)
  const sansDate = reseau.magasins.filter((m) => !m.ouverture).length
  const ouverts = reseau.magasins.filter((m) => m.ouverture && m.ouverture <= reseau.jour).length
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const [affichage, setAffichage] = useAffichage('evolution')
  return (
    <>
      <PageHeader titre="Évolution du parc" sousTitre={`${ouverts} magasins ouverts aujourd’hui`} />
      <Alert severity="info" sx={{ mb: 3 }}>Les fermetures ne sont pas encore enregistrées : seules les ouvertures sont comptées.{sansDate ? ` ${sansDate} magasin${sansDate > 1 ? 's' : ''} sans date d’ouverture ne ${sansDate > 1 ? 'sont' : 'est'} pas compté${sansDate > 1 ? 's' : ''}.` : ''}</Alert>
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography component="h2" sx={[cartouche, { mb: 2 }]}>Ouvertures par année</Typography>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 1, md: 2 }, height: 220 }} role="img" aria-label={`Ouvertures : ${recentes.map((x) => `${x.a} ${x.ouvertures.length}`).join(', ')}`}>
            {recentes.map((x) => (
              <Box key={x.a} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{x.ouvertures.length}</Typography>
                <Box sx={{ width: '100%', maxWidth: 64, height: `${(x.ouvertures.length / max) * 160}px`, minHeight: 4, borderRadius: '8px 8px 0 0', bgcolor: x.enCours ? 'secondary.main' : 'primary.main', opacity: x.a > anneeDe(reseau.jour) ? 0.5 : 1 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{x.a}</Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
      {surPC && <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}><ChoixAffichage valeur={affichage} onChange={setAffichage} /></Box>}
      {!surPC || affichage === 'lignes' ? (
        <CarteLignes label="Évolution par année">
          {[...l].reverse().map((x) => (
            <LigneCompacte key={x.a} avatar={<Initiales nom={String(x.a)} icone={<CalendarTodayOutlined />} />}
              titre={`${x.a}${x.enCours ? ' (en cours)' : ''}`}
              detail={x.ouvertures.map((m) => m.nom).join(', ')}
              fin={<Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.2 }}>+{x.ouvertures.length}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{x.prevues ? `dont ${x.prevues} prévue${x.prevues > 1 ? 's' : ''} · ` : ''}{x.cumul} au total</Typography>
              </Box>} />
          ))}
        </CarteLignes>
      ) : (
      <TableContainer component={Card}>
        <Table aria-label="Évolution par année">
          <TableHead>
            <TableRow>
              <TableCell>Année</TableCell>
              <TableCell align="right">Ouvertures</TableCell>
              <TableCell align="right">Taille du réseau</TableCell>
              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Magasins</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[...l].reverse().map((x) => (
              <TableRow key={x.a} selected={x.enCours}>
                <TableCell>{x.a}{x.enCours ? ' (en cours)' : ''}</TableCell>
                <TableCell align="right">{x.ouvertures.length}{x.prevues ? ` dont ${x.prevues} prévue${x.prevues > 1 ? 's' : ''}` : ''}</TableCell>
                <TableCell align="right">{x.cumul}</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{x.ouvertures.map((m: Magasin, i) => <span key={m.nom}>{i > 0 && ', '}<Link component={RouterLink} to={lienFiche(m.nom)}>{m.nom}</Link></span>)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      )}
    </>
  )
}

export function Evolution() {
  return <AvecReseau>{(reseau) => <Contenu reseau={reseau} />}</AvecReseau>
}
