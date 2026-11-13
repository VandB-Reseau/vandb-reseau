import { createTheme } from '@mui/material/styles'
import { deepmerge } from '@mui/utils'
import { optionsTheme } from '../../theme/theme'

// Vague 8 (Joseph, 10/11/2026, 94A) : un seul thème. Le budget reprend le thème du réseau tel quel ; seuls restent ici les
// réglages propres aux tableaux financiers (fond des lignes clés), qui gardent leur rendu à part (Joseph, 10/11/2026).
export { brand, brandStripe, styleSignal, type CouleurSignal } from '../../theme/theme'

export const theme = createTheme(deepmerge(optionsTheme, {
  components: {
    // Fond des lignes clés des tableaux financiers (lot 38) : vert canard très clair, plus soutenu en mode sombre
    MuiCssBaseline: {
      styleOverrides: {
        ':root': { '--fond-ligne-cle': 'rgba(58, 143, 141, 0.10)' },
        '@media (prefers-color-scheme: dark)': { ':root': { '--fond-ligne-cle': 'rgba(95, 179, 176, 0.18)' } },
      },
    },
  },
}))
