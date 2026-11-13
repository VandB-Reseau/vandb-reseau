import { useLocation, useNavigate } from 'react-router-dom'
import ButtonBase from '@mui/material/ButtonBase'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import { useReseau } from '../data/ReseauContext'
import { lienFiche } from '../lib/format'

// Vague 8 (109A) : en tête du menu du franchisé, « Mon magasin » mène à la fiche de son magasin ;
// avec plusieurs magasins, on choisit lequel, et la fiche ouverte reste choisie.
export function SelecteurMonMagasin() {
  const { reseau } = useReseau()
  const naviguer = useNavigate()
  const { pathname } = useLocation()
  const magasins = reseau?.magasins ?? []
  if (!magasins.length) return null
  const ouvert = magasins.find((m) => pathname === lienFiche(m.nom) || pathname.startsWith(`${lienFiche(m.nom)}/`))
  if (magasins.length === 1) {
    const m = magasins[0]
    return (
      <ButtonBase onClick={() => naviguer(lienFiche(m.nom))} aria-label={`Mon magasin : ${m.nom}`}
        sx={{ width: '100%', minHeight: 48, px: 1.5, gap: 1, justifyContent: 'flex-start', borderRadius: 2, border: '1px solid', borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' } }}>
        <StorefrontOutlined fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography noWrap sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{m.nom}</Typography>
      </ButtonBase>
    )
  }
  return (
    <TextField select fullWidth size="small" label="Mon magasin" value={ouvert?.nom ?? ''}
      onChange={(e) => naviguer(lienFiche(e.target.value))}
      slotProps={{ select: { displayEmpty: true, renderValue: (v) => (v as string) || 'Choisir un magasin' } }}>
      {magasins.map((m) => <MenuItem key={m.nom} value={m.nom} sx={{ minHeight: 48 }}>{m.nom}</MenuItem>)}
    </TextField>
  )
}
