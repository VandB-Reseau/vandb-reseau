import Chip from '@mui/material/Chip'
import { typesVisite } from '../data/modele'

export function PastilleTypeVisite({ type }: { type: string }) {
  const t = typesVisite.find((x) => x.id === type)
  const c = t?.couleur ?? '#6b6b73'
  return <Chip size="small" variant="outlined" label={t?.libelle ?? 'Visite'} sx={{ fontSize: '0.75rem', fontWeight: 600, borderColor: c, color: c }} />
}

export function PastilleSignature({ requise, signe }: { requise: boolean; signe: boolean }) {
  if (!requise) return null
  return <Chip size="small" color={signe ? 'success' : 'warning'} variant={signe ? 'filled' : 'outlined'} label={signe ? 'CR signé' : 'CR à signer'} sx={{ fontSize: '0.75rem', fontWeight: 600 }} />
}
