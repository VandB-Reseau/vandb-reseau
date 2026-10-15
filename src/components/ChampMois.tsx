import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import type { SxProps, Theme } from '@mui/material/styles'
import { libelleMois, moisAVenir } from '../data/charge'

// Premier jour du mois d'une date (les changements d'affectation se font au mois)
export const premierDuMois = (iso: string) => `${iso.slice(0, 7)}-01`

// Choix d'un mois, renvoyé comme le 1er du mois (AAAA-MM-01)
export function ChampMois({ label, value, onChange, jour, sx }: { label: string; value: string; onChange: (v: string) => void; jour: string; sx?: SxProps<Theme> }) {
  const [a, m] = jour.split('-').map(Number)
  const debut = new Date(Date.UTC(a, m - 1 - 24, 1)).toISOString().slice(0, 10)
  const options = moisAVenir(debut, 49)
  const v = premierDuMois(value)
  if (!options.includes(v)) options.push(v)
  options.sort()
  return (
    <TextField select label={label} value={v} onChange={(e) => onChange(e.target.value)} sx={sx}
      slotProps={{ select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: 360 } } } } } }}>
      {options.map((o) => <MenuItem key={o} value={o} sx={{ minHeight: 48 }}>{libelleMois(o).replace(/^./, (c) => c.toUpperCase())}</MenuItem>)}
    </TextField>
  )
}
