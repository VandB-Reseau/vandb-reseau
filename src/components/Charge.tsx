import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { niveauCharge, niveauLibelle, type NiveauCharge } from '../data/charge'
import type { Reseau } from '../data/modele'

export const couleurNiveau: Record<NiveauCharge, 'default' | 'success' | 'warning' | 'error'> = {
  vide: 'default', ok: 'success', attention: 'warning', complet: 'warning', depassement: 'error',
}

export const aideCharge = 'Un magasin ouvert compte 1 unité ; un magasin en pré-ouverture ou ouvert depuis peu en compte 2.'

export function PastilleCharge({ reseau, charge }: { reseau: Reseau; charge: number }) {
  const niveau = niveauCharge(reseau, charge)
  return (
    <Tooltip title={`${niveauLibelle[niveau]} · ${aideCharge}`}>
      <Chip
        label={`${charge} / ${reseau.parametres.maxUnits}`}
        color={couleurNiveau[niveau]}
        variant={niveau === 'ok' || niveau === 'vide' ? 'outlined' : 'filled'}
        size="small"
        sx={{ fontSize: '0.75rem', fontWeight: 700, minWidth: 64 }}
      />
    </Tooltip>
  )
}

export function JaugeCharge({ reseau, charge, libelle }: { reseau: Reseau; charge: number; libelle?: string }) {
  const max = reseau.parametres.maxUnits
  const niveau = niveauCharge(reseau, charge)
  const couleur = couleurNiveau[niveau] === 'default' ? 'inherit' : couleurNiveau[niveau]
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.75 }}>
        {libelle && <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: 500 }} noWrap>{libelle}</Typography>}
        <Typography variant="body2" color={niveau === 'depassement' ? 'error' : 'text.secondary'} sx={{ fontWeight: 600 }}>
          {charge} / {max} · {niveauLibelle[niveau]}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.min(100, (charge / max) * 100)}
        color={couleur}
        aria-label={`Charge ${charge} sur ${max}`}
        sx={{ height: 10, borderRadius: 5, bgcolor: 'action.hover' }}
      />
    </Box>
  )
}
