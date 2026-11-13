import { createTheme, type Theme, type ThemeOptions } from '@mui/material/styles'
import { styleCellule, styleTable } from './tableaux'

// Charte graphique V and B (guideline officielle) : couleurs en duos, aucune autre teinte, pas de bleu
export const brand = {
  noir: '#1d1d1b',
  noirProfond: '#000000',
  anthracite: '#312e2e',
  or: '#f8bb09',
  jaune: '#f7d802',
  orange: '#ea6029',
  brique: '#c24119',
  creme: '#feedd8',
  beige: '#ede0c4',
  vert: '#3a8f8d',
  vertFonce: '#307672',
}

// Filet sous l'en-tête : deux aplats jaune-or et vert canard, sans dégradé (la charte travaille en aplats)
export const brandStripe = `linear-gradient(90deg, ${brand.or} 0 62%, ${brand.vert} 62% 100%)`

// Vague 8 (Joseph, 10/11/2026, 93A) : jetons communs. Couleurs par sens (à agir, à surveiller, bon, neutre) et trois
// arrondis seulement : 8 px champs et boutons, 12 px cartes, pilule pour les puces et la recherche.
export const ton = { agir: brand.brique, surveiller: '#b84a1e', bon: brand.vertFonce, neutre: '#5a5550' } as const
export type Ton = keyof typeof ton
export const rayon = { champ: 8, carte: 12, pilule: 999 } as const
// Couleurs autorisées pour un repère choisi par quelqu'un (événement d'agenda, zone…) : la charte, rien d'autre
export const couleursCharte = [brand.or, brand.jaune, brand.orange, brand.brique, brand.vert, brand.vertFonce, brand.anthracite, brand.noir] as const
export const dansCharte = (c: string | null | undefined, defaut: string) => (c && (couleursCharte as readonly string[]).includes(c.toLowerCase()) ? c.toLowerCase() : defaut)
// Couleur d'un événement d'agenda selon son type (vague 8 : plus de violet hors charte)
export const couleurEvenement = { event: brand.or, reunion: brand.vertFonce, formation: brand.brique } as const
// Texte lisible sur un aplat de la charte : noir sur les jaunes, blanc ailleurs
export const texteSur = (fond: string) => ([brand.or, brand.jaune, brand.creme, brand.beige] as string[]).includes(fond.toLowerCase()) ? brand.noir : '#ffffff'

// Vague 8 (92A) : une échelle de texte, et rien d'autre. Titre de page 30 (22 sur téléphone), chiffre clé 28, section 18,
// titre de carte 16, texte 14, légende 13, mention 12. Les écrans n'écrivent plus de taille en dur hors de cette échelle.
export const echelle = { page: '1.875rem', chiffre: '1.75rem', section: '1.125rem', carte: '1rem', texte: '0.875rem', legende: '0.8125rem', mention: '0.75rem' } as const

// Polices : Lato (charte) pour le texte ; Alegreya, police libre proche de Coline (titres de la charte, sans fichier web), pour les titres
const fontFamily = '"Lato", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
const titres = `"Alegreya", Georgia, serif`

const base = createTheme()

// Une seule couleur forte par ligne (Joseph, 21/10/2026) : le rouge reste une pastille pleine,
// orange, bleu et vert deviennent un texte coloré précédé d'un point, sans fond.
export type CouleurSignal = 'warning' | 'info' | 'success'
export function styleSignal(theme: Theme, couleur: CouleurSignal) {
  return {
    backgroundColor: 'transparent', color: theme.vars!.palette[couleur].dark, fontWeight: 600,
    '&::before': { content: '""', width: 8, height: 8, borderRadius: '50%', backgroundColor: 'currentColor', flexShrink: 0 },
    '&:has(.MuiChip-icon)::before': { display: 'none' },
    '& .MuiChip-icon': { color: 'inherit' },
    '&.MuiChip-clickable:hover': { backgroundColor: theme.vars!.palette.action.hover },
    ...theme.applyStyles('dark', { color: theme.vars!.palette[couleur].light }),
  }
}
const telephone = base.breakpoints.down('sm')
const ordinateur = base.breakpoints.up('md')

// Options du thème, reprises telles quelles par le budget (vague 8, 94A : un seul thème)
export const optionsTheme: ThemeOptions = {
  // Aucune animation (choix de Joseph, 20/10/2026) : chaque écran, menu et fenêtre s'affiche aussitôt
  transitions: { create: () => 'none', duration: { shortest: 0, shorter: 0, short: 0, standard: 0, complex: 0, enteringScreen: 0, leavingScreen: 0 } },
  // Mode clair / sombre suivi automatiquement depuis le réglage de l'appareil
  cssVariables: { colorSchemeSelector: 'media' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: brand.noir, contrastText: '#ffffff' },
        secondary: { main: brand.or, contrastText: brand.noir },
        info: { main: brand.anthracite, dark: brand.anthracite },
        // Orange de la charte trop clair pour un texte sur blanc : sa nuance foncée sert au texte
        warning: { main: brand.orange, dark: '#b84a1e' },
        error: { main: brand.brique },
        success: { main: brand.vert, dark: brand.vertFonce },
        background: { default: '#fbf7f0', paper: '#ffffff' },
        text: { primary: brand.noir, secondary: '#5a5550' },
        divider: '#ebe3d6',
        action: { selected: 'rgba(248, 187, 9, 0.28)' },
      },
    },
    dark: {
      palette: {
        primary: { main: brand.or, contrastText: brand.noir },
        secondary: { main: brand.or, contrastText: brand.noir },
        info: { main: '#e6e1da', light: '#e6e1da' },
        warning: { main: brand.or, light: brand.or },
        error: { main: brand.orange },
        success: { main: '#5fb3b0', light: '#5fb3b0' },
        background: { default: '#1d1d1b', paper: '#312e2e' },
        text: { primary: '#f2f2f0', secondary: '#b4b4ba' },
        divider: '#4a4545',
      },
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily,
    // Aucune taille sous 12 px dans l'app
    // Titres de page compacts sur téléphone, pour laisser la place au contenu
    // Refonte (Joseph, 09/11/2026, 8C) : titre de page en casse normale ; capitales seulement dans les écrans « marque »
    h1: { fontFamily: titres, fontSize: '1.875rem', fontWeight: 800, letterSpacing: '0.005em', [telephone]: { fontSize: '1.375rem' } },
    h2: { fontFamily: titres, fontSize: '1.5rem', fontWeight: 700 },
    h3: { fontFamily: titres, fontSize: '1.125rem', fontWeight: 700 },
    h4: { fontSize: '1.125rem', fontWeight: 700 },
    h5: { fontSize: '1rem', fontWeight: 700 },
    h6: { fontSize: '1rem', fontWeight: 700 },
    subtitle1: { fontSize: '1rem', fontWeight: 500 },
    subtitle2: { fontSize: '0.875rem', fontWeight: 600 },
    body1: { fontSize: '1rem' },
    body2: { fontSize: '0.875rem' },
    button: { fontSize: '0.875rem', fontWeight: 600, textTransform: 'none' },
    caption: { fontSize: '0.75rem' },
    overline: { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em' },
  },
  components: {
    // Puces : toujours en pilule (vague 8, 93A)
    MuiChip: {
      styleOverrides: { root: { borderRadius: rayon.pilule } },
      variants: (['warning', 'info', 'success'] as const).map((couleur) => ({
        props: { variant: 'filled' as const, color: couleur },
        style: ({ theme }: { theme: Theme }) => ({ ...styleSignal(theme, couleur), '&::before': { ...styleSignal(theme, couleur)['&::before'], marginLeft: 8, marginRight: -4 } }),
      })),
    },
    // Infobulles à 12 px au moins (11 px par défaut dans MUI)
    MuiTooltip: { styleOverrides: { tooltip: { fontSize: '0.75rem' } } },
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiSkeleton: { defaultProps: { animation: false } },
    // Liens sans soulignement, comme dans une app
    MuiLink: { defaultProps: { underline: 'hover' } },
    // Sur téléphone, les fenêtres montent du bas de l'écran
    // Ouvrir une fenêtre ne retire pas non plus la barre de défilement (le contenu derrière ne se décale pas)
    MuiDialog: {
      defaultProps: { disableScrollLock: true },
      styleOverrides: {
        // Refonte (Joseph, 09/11/2026, 9A) : sur ordinateur, créer ou modifier s'ouvre en panneau à droite, l'écran reste
        // visible ; les petites fenêtres de confirmation (largeur « xs ») restent au centre
        container: {
          [telephone]: { alignItems: 'flex-end' },
          [ordinateur]: { justifyContent: 'flex-end', alignItems: 'stretch', '&:has(> .MuiDialog-paperWidthXs), &:has(> .MuiDialog-paperFullScreen)': { justifyContent: 'center', alignItems: 'center' } },
        },
        paper: {
          [telephone]: { margin: 0, width: '100%', maxWidth: '100%', maxHeight: 'calc(100% - 24px)', borderRadius: '24px 24px 0 0' },
          [ordinateur]: {
            '&:not(.MuiDialog-paperWidthXs):not(.MuiDialog-paperFullScreen)': { margin: 0, height: '100%', maxHeight: '100%', borderRadius: 0, width: 560, maxWidth: '100%', borderLeft: '1px solid', borderColor: 'var(--mui-palette-divider)' },
            '&.MuiDialog-paperWidthMd:not(.MuiDialog-paperFullScreen), &.MuiDialog-paperWidthLg:not(.MuiDialog-paperFullScreen), &.MuiDialog-paperWidthXl:not(.MuiDialog-paperFullScreen)': { width: 'min(960px, 100%)' },
          },
        },
        paperFullScreen: { [telephone]: { height: 'auto', maxHeight: 'calc(100% - 24px)', borderRadius: '24px 24px 0 0' } },
      },
    },
    // Ouvrir un menu ou une liste ne doit pas retirer la barre de défilement (sinon la page se décale)
    MuiPopover: { defaultProps: { disableScrollLock: true } },
    // Colonne Magasin fixe au défilement horizontal : « colonne-fixe » (1re colonne) ou « deux-colonnes-fixes » (case à cocher + Magasin)
    // Tous les tableaux : première colonne figée, survol et sélection gardés (src/theme/tableaux.ts)
    MuiTable: { styleOverrides: { root: ({ theme }) => styleTable(theme) } },
    // Ligne des titres fixe au défilement vertical : le tableau défile dans sa carte, limitée à la hauteur de l'écran
    MuiTableContainer: {
      styleOverrides: {
        root: ({ theme }) => ({
          // Sous la barre du haut et les bandes collantes (onglets, filtres) : la ligne des titres reste visible
          maxHeight: 'calc(100dvh - 120px - var(--onglets, 0px) - var(--filtres, 0px))',
          // Une carte (Card, Paper) masque ce qui dépasse : le tableau doit pouvoir défiler dans sa hauteur
          '&.MuiTableContainer-root': { overflow: 'auto' },
          [theme.breakpoints.down('md')]: { maxHeight: 'calc(100dvh - 200px)' },
          '@media print': { maxHeight: 'none' },
        }),
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: ({ theme }) => ({
          position: 'sticky', top: 0, zIndex: 3,
          '& th': { backgroundColor: theme.palette.background.paper },
          '& tr:last-of-type > th': { boxShadow: `inset 0 -1px 0 ${theme.palette.divider}` },
        }),
      },
    },
    // Titres de colonnes en gras gris, sur une ligne, comme la liste des magasins
    MuiTableCell: { styleOverrides: { root: ({ theme }) => styleCellule(theme).root, head: ({ theme }) => styleCellule(theme).head } },
    MuiMenu: { defaultProps: { disableScrollLock: true } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      // Boutons rectangulaires arrondis, plus de pilules (refonte, 8C)
      styleOverrides: { root: { borderRadius: rayon.champ, minHeight: 40, paddingInline: 16 } },
    },
    MuiAppBar: { defaultProps: { elevation: 0, color: 'inherit' } },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderRadius: rayon.carte } },
    },
    MuiListItemButton: { styleOverrides: { root: { borderRadius: rayon.champ } } },
    // Champs : un seul style, coins de 8 px (la recherche garde sa forme de pilule, posée par BarreFiltres)
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: rayon.champ } } },
    MuiToggleButtonGroup: { styleOverrides: { root: { borderRadius: rayon.champ } } },
    // Écrans « marque » (Accueil, Infos réseau, compte rendu) : titres en capitales de la charte
    MuiCssBaseline: { styleOverrides: { '.marque .MuiTypography-h1': { textTransform: 'uppercase', letterSpacing: '0.01em' } } },
    MuiBottomNavigationAction: {
      styleOverrides: { label: { fontSize: '0.75rem', '&.Mui-selected': { fontSize: '0.75rem' } } },
    },
  },
}

export const theme = createTheme(optionsTheme)
