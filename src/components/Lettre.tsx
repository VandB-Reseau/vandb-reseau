import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { Logo } from './Logo'
import { brand, brandStripe } from '../theme/theme'

// Mise en page « lettre courante » de la charte V and B : logo en cartouche noir en haut à gauche,
// habillage sobre qui ne touche pas les bords (coin jaune-or et vert canard, filet en pied), texte en Lato

export function EnTeteLettre({ objet, date }: { objet: string; date: ReactNode }) {
  return (
    <Box sx={{ position: 'relative', px: { xs: 2, sm: 4 }, pt: { xs: 2, sm: 3 } }}>
      <Box component="svg" viewBox="0 0 150 70" aria-hidden sx={{ position: 'absolute', top: 16, right: 16, width: { xs: 110, sm: 150 }, height: 'auto' }}>
        <path d="M150 0 L150 52 C120 40 95 58 60 44 C38 36 22 22 0 0 Z" fill={brand.or} />
        <path d="M150 0 L150 26 C128 20 110 30 88 20 C74 14 66 6 60 0 Z" fill={brand.vert} />
      </Box>
      <Box sx={{ display: 'inline-flex', bgcolor: brand.noir, px: 1.5, py: 1, borderRadius: 1.5, position: 'relative' }}><Logo size={22} /></Box>
      <Typography sx={{ color: brand.noir, fontWeight: 700, mt: { xs: 3, sm: 4 } }}>{objet}</Typography>
      <Typography variant="body2" sx={{ color: '#5a5550' }}>{date}</Typography>
    </Box>
  )
}

export function PiedLettre() {
  return <Box aria-hidden sx={{ height: 4, background: brandStripe, mx: { xs: 2, sm: 4 }, mb: { xs: 2, sm: 3 } }} />
}

// Intertitre en capitales (sous-titres de la charte : Lato en capitales)
export function IntertitreLettre({ children }: { children: ReactNode }) {
  return <Typography variant="h4" component="h2" sx={{ fontFamily: 'inherit', color: brand.noir, fontSize: '0.9375rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `2px solid ${brand.or}`, pb: 0.5, mb: 1.5 }}>{children}</Typography>
}
