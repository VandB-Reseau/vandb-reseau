// 185 · Opérations commerciales du réseau (Joseph, 15/11/2026) : sur les magasins du périmètre, quels types d'opération
// marchent le mieux en caisse (effet médian en points face à la tendance), et les opérations les plus fortes.
// Équipe seulement (onglet de Chiffres) : le franchisé ne voit jamais les autres magasins.
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
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
import { Section, LigneVide } from './Section'
import { formatEuros } from '../data/chiffres'
import { bilanOperation, libelleTypeOperation, operationsDu, phraseBilan, pts, statsOperations } from '../data/operations'
import { dateCourte, lienFiche } from '../lib/format'
import type { Reseau } from '../data/modele'

export function OperationsReseau({ reseau }: { reseau: Reseau }) {
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const noms = reseau.magasins.map((m) => m.nom)
  const stats = statsOperations(reseau, noms)
  const meilleures = noms.flatMap((m) => operationsDu(reseau, m).map((o) => ({ m, o, b: bilanOperation(reseau.chiffres[m] ?? [], o) })))
    .flatMap((x) => (x.b.etat === 'mesure' ? [{ ...x, effet: x.b.effetPts }] : [])).sort((a, b) => b.effet - a.effet).slice(0, 10)
  if (!stats.length) {
    return (
      <Section titre="Opérations commerciales">
        <LigneVide>Aucune opération notée sur ces magasins. Le franchisé ou son Coach les note dans les chiffres du magasin ; leur bilan arrive ici le mois suivant.</LigneVide>
      </Section>
    )
  }
  const effet = (v: number | null) => (v === null ? '—' : pts(v))
  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Section titre="Ce qui marche le mieux">
        {surPC ? (
          <TableContainer component={Card} variant="outlined">
            <Table size="small" aria-label="Opérations par type">
              <TableHead>
                <TableRow>
                  <TableCell>Type d’opération</TableCell>
                  <TableCell align="right">Opérations</TableCell>
                  <TableCell align="right">Magasins</TableCell>
                  <TableCell align="right">Avec bilan</TableCell>
                  <TableCell align="right">Effet médian</TableCell>
                  <TableCell align="right">Effet positif</TableCell>
                  <TableCell align="right">Coût médian HT</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stats.map((s) => (
                  <TableRow key={s.type}>
                    <TableCell sx={{ fontWeight: 600 }}>{libelleTypeOperation(s.type)}</TableCell>
                    <TableCell align="right">{s.operations}</TableCell>
                    <TableCell align="right">{s.magasins}</TableCell>
                    <TableCell align="right">{s.mesurees}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: (s.effetMedian ?? 0) > 0 ? 'success.dark' : 'text.primary' }}>{effet(s.effetMedian)}</TableCell>
                    <TableCell align="right">{s.mesurees ? `${s.positives} sur ${s.mesurees}` : '—'}</TableCell>
                    <TableCell align="right">{formatEuros(s.coutMedian)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box component="ul" aria-label="Opérations par type" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {stats.map((s) => (
              <Box component="li" key={s.type} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Typography sx={{ fontWeight: 600, mr: 'auto' }}>{libelleTypeOperation(s.type)}</Typography>
                  <Typography sx={{ fontWeight: 700, color: (s.effetMedian ?? 0) > 0 ? 'success.dark' : 'text.primary' }}>{effet(s.effetMedian)}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {[`${s.operations} opération${s.operations > 1 ? 's' : ''} dans ${s.magasins} magasin${s.magasins > 1 ? 's' : ''}`, s.mesurees ? `effet positif ${s.positives} sur ${s.mesurees}` : 'aucun bilan encore', s.coutMedian !== null && `coût médian ${formatEuros(s.coutMedian)} HT`].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Effet : évolution du mois face à l’an passé, moins la tendance des 3 mois d’avant. Caisse au mois : un repère, pas une preuve.</Typography>
      </Section>
      {meilleures.length > 0 && (
        <Section titre="Les opérations les plus fortes">
          <Box component="ol" aria-label="Opérations les plus fortes" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {meilleures.map(({ m, o, b }) => (
              <Box component="li" key={`${m}-${o.id}`} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                <Typography sx={{ fontWeight: 600 }}>{o.titre} · <Link component={RouterLink} to={`${lienFiche(m)}?vue=chiffres`}>{m}</Link></Typography>
                <Typography variant="body2" color="text.secondary">{libelleTypeOperation(o.type)} · {dateCourte(o.jour)}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: b.etat === 'mesure' && b.effetPts > 0 ? 'success.dark' : 'text.primary' }}>{phraseBilan(b, o).texte}</Typography>
              </Box>
            ))}
          </Box>
        </Section>
      )}
    </Box>
  )
}
