import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import { brand } from '../theme/theme'
import { formatPourcent, formatValeur } from '../data/chiffres'
import { libellesLevier, type LeviersMagasin, type PositionLevier } from '../data/leviers'

// Position d'un indicateur : bande = moitié centrale du réseau, trait fin = médiane, rond = le magasin
function Barre({ p }: { p: PositionLevier }) {
  const theme = useTheme()
  const r = p.repere
  if (!r) return null
  const bas = r.quartBas ?? r.mediane
  const min = Math.min(bas * 0.8, p.valeur), max = Math.max(r.quartHaut * 1.2, p.valeur)
  const x = (v: number) => `${((v - min) / (max - min || 1)) * 100}%`
  const couleur = p.quart === 'bas' ? theme.palette.error.main : p.quart === 'haut' ? theme.palette.success.main : theme.palette.text.primary
  return (
    <Box aria-hidden sx={{ position: 'relative', height: 16, my: 0.5 }}>
      <Box sx={{ position: 'absolute', left: 0, right: 0, top: 6, height: 4, borderRadius: 2, bgcolor: 'action.hover' }} />
      <Box sx={{ position: 'absolute', left: x(bas), width: `calc(${x(r.quartHaut)} - ${x(bas)})`, top: 4, height: 8, borderRadius: 2, bgcolor: alpha(brand.or, 0.45) }} />
      <Box sx={{ position: 'absolute', left: x(r.mediane), top: 2, width: 2, height: 12, ml: '-1px', bgcolor: 'text.secondary' }} />
      <Box sx={{ position: 'absolute', left: x(p.valeur), top: 2, width: 12, height: 12, ml: '-6px', borderRadius: '50%', bgcolor: couleur, border: '2px solid', borderColor: 'background.paper' }} />
    </Box>
  )
}

const couleurEcart = (n: number | null) => (n === null ? 'text.secondary' : n <= -5 ? 'error.main' : n >= 5 ? 'success.main' : 'text.secondary')

export function ContenuLeviers({ lev }: { lev: LeviersMagasin }) {
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Typography variant="body1" sx={{ fontWeight: 700, color: lev.levier ? 'error.main' : 'text.primary' }}>
        {lev.levier ? `Levier : ${libellesLevier[lev.levier].toLowerCase()}` : 'Aucun levier en retrait'}
      </Typography>
      <Box component="ul" aria-label="Panier et flux" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5 }}>
        {lev.positions.map((p) => (
          <Box component="li" key={p.indicateur} aria-label={`${libellesLevier[p.indicateur]} : ${formatValeur(p.indicateur, p.valeur)}`}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>{`${libellesLevier[p.indicateur]} · ${formatValeur(p.indicateur, p.valeur)}`}</Typography>
              {p.ecartReseau !== null && <Typography variant="body2" sx={{ color: couleurEcart(p.ecartReseau), fontVariantNumeric: 'tabular-nums' }}>{`${formatPourcent(p.ecartReseau)} vs réseau`}</Typography>}
              {p.evolution !== null && <Typography variant="body2" sx={{ color: couleurEcart(p.evolution), fontVariantNumeric: 'tabular-nums' }}>{`${formatPourcent(p.evolution)} vs N-1`}</Typography>}
            </Box>
            <Barre p={p} />
            {p.repere && <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>{`Réseau : ${p.repere.quartBas !== undefined ? `${formatValeur(p.indicateur, p.repere.quartBas)} à ` : 'médiane '}${p.repere.quartBas !== undefined ? formatValeur(p.indicateur, p.repere.quartHaut) : formatValeur(p.indicateur, p.repere.mediane)}`}</Typography>}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
