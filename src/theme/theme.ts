import { createTheme } from '@mui/material/styles'

// Charte V and B 2024
export const brand = {
  noir: '#1b1b1f',
  noirProfond: '#000000',
  or: '#eaa400',
  bleu: '#1b6fce',
  orange: '#ef7d00',
  jaune: '#f6c544',
}

// Filet multicolore sous l'en-tête (jaune → orange → bleu)
export const brandStripe = `linear-gradient(90deg, ${brand.jaune} 0%, ${brand.orange} 50%, ${brand.bleu} 100%)`

const fontFamily = '"Outfit", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'

export const theme = createTheme({
  // Mode clair / sombre suivi automatiquement depuis le réglage de l'appareil
  cssVariables: { colorSchemeSelector: 'media' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: brand.noir, contrastText: '#ffffff' },
        secondary: { main: brand.or, contrastText: brand.noir },
        info: { main: brand.bleu },
        warning: { main: brand.orange },
        background: { default: '#f5f5f3', paper: '#ffffff' },
        text: { primary: brand.noir, secondary: '#55555c' },
        divider: '#e3e3e0',
      },
    },
    dark: {
      palette: {
        primary: { main: brand.jaune, contrastText: brand.noir },
        secondary: { main: brand.or, contrastText: brand.noir },
        info: { main: '#6aa8ef' },
        warning: { main: '#ff9a33' },
        background: { default: '#121214', paper: '#1d1d21' },
        text: { primary: '#f2f2f0', secondary: '#b4b4ba' },
        divider: '#33333a',
      },
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily,
    // Aucune taille sous 12 px dans l'app
    h1: { fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h2: { fontSize: '1.5rem', fontWeight: 600 },
    h3: { fontSize: '1.25rem', fontWeight: 600 },
    h4: { fontSize: '1.125rem', fontWeight: 600 },
    h5: { fontSize: '1rem', fontWeight: 600 },
    h6: { fontSize: '1rem', fontWeight: 600 },
    subtitle1: { fontSize: '1rem', fontWeight: 500 },
    subtitle2: { fontSize: '0.875rem', fontWeight: 600 },
    body1: { fontSize: '1rem' },
    body2: { fontSize: '0.875rem' },
    button: { fontSize: '0.875rem', fontWeight: 600, textTransform: 'none' },
    caption: { fontSize: '0.75rem' },
    overline: { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em' },
  },
  components: {
    // Ouvrir un menu ou une liste ne doit pas retirer la barre de défilement (sinon la page se décale)
    MuiPopover: { defaultProps: { disableScrollLock: true } },
    // Colonne Magasin fixe au défilement horizontal : « colonne-fixe » (1re colonne) ou « deux-colonnes-fixes » (case à cocher + Magasin)
    MuiTable: {
      styleOverrides: {
        root: ({ theme }) => ({
          '&.colonne-fixe tr > :first-of-type, &.deux-colonnes-fixes tr > :nth-of-type(-n+2)': {
            position: 'sticky', left: 0, zIndex: 2, backgroundColor: theme.palette.background.paper,
          },
          '&.colonne-fixe tr > :first-of-type': { boxShadow: `inset -1px 0 0 ${theme.palette.divider}` },
          '&.deux-colonnes-fixes tr > :first-of-type': { width: 52, minWidth: 52, maxWidth: 52 },
          '&.deux-colonnes-fixes tr > :nth-of-type(2)': { left: 52, boxShadow: `inset -1px 0 0 ${theme.palette.divider}` },
          '& thead tr > th': { zIndex: 3 },
        }),
      },
    },
    MuiMenu: { defaultProps: { disableScrollLock: true } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 999, minHeight: 40, paddingInline: 20 } },
    },
    MuiAppBar: { defaultProps: { elevation: 0, color: 'inherit' } },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderRadius: 16 } },
    },
    MuiListItemButton: { styleOverrides: { root: { borderRadius: 999 } } },
    MuiBottomNavigationAction: {
      styleOverrides: { label: { fontSize: '0.75rem', '&.Mui-selected': { fontSize: '0.75rem' } } },
    },
  },
})
