import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import GlobalStyles from '@mui/material/GlobalStyles'
import Typography from '@mui/material/Typography'

// Feuille au format lettre de la charte (fiche avant visite, bilan de l'année) : lisible au téléphone et
// téléchargeable en PDF par l'impression du navigateur
export const styleImpression = (
  <GlobalStyles styles={{
    '@media print': {
      'header, nav, .MuiDrawer-root, .MuiBottomNavigation-root, .sans-impression, [aria-label="Aperçu"]': { display: 'none !important' },
      'body, main': { background: '#fff !important', padding: '0 !important', margin: '0 !important' },
      '.feuille': { boxShadow: 'none !important', border: '0 !important', margin: '0 !important', maxWidth: 'none !important' },
      '@page': { size: 'A4', margin: '12mm' },
    },
  }} />
)

export const NOIR = '#1d1d1b', GRIS = '#5f5f66', FILET = '#e0e0e0'
export const ROUGE = '#c24119', ORANGE = '#b84a1e', VERT = '#307672'

export function Titre({ children }: { children: ReactNode }) {
  return <Typography variant="h4" component="h2" sx={{ color: NOIR, borderBottom: '2px solid #f8bb09', pb: 0.5, mb: 1.5 }}>{children}</Typography>
}
export function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return <Box component="section" aria-label={titre} sx={{ mb: 3, breakInside: 'avoid' }}><Titre>{titre}</Titre>{children}</Box>
}
export function Champ({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <Box sx={{ py: 0.75 }}>
      <Typography variant="caption" sx={{ color: GRIS, display: 'block' }}>{libelle}</Typography>
      <Typography variant="body1" sx={{ color: NOIR }}>{children || 'Non renseigné'}</Typography>
    </Box>
  )
}
export const Vide = ({ children }: { children: ReactNode }) => <Typography variant="body1" sx={{ color: GRIS }}>{children}</Typography>
export const tableau = { width: '100%', borderCollapse: 'collapse', color: NOIR, '& th, & td': { textAlign: 'left', p: 1, borderBottom: `1px solid ${FILET}`, fontSize: 14, verticalAlign: 'top' }, '& th': { color: GRIS, fontWeight: 600 }, '& td.nombre, & th.nombre': { textAlign: 'right', whiteSpace: 'nowrap' } } as const
