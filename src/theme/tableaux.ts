import { alpha, type Theme } from '@mui/material/styles'

// Rendu commun de tous les tableaux de l'app (Joseph, 10/11/2026 : « harmoniser les tableaux » sur le modèle de la
// liste des magasins). Partagé par le thème du réseau et celui du pilotage.
// - Ligne des titres collée en haut (MuiTableHead), titres en gras gris, sur une ligne.
// - Première colonne figée au défilement horizontal, dans tous les tableaux (classe « sans-colonne-fixe » pour s'en
//   passer) ; quand la première colonne est une case à cocher, la colonne suivante est figée avec elle.
//   Une cellule qui couvre plusieurs colonnes (titre de groupe) ne se fige pas, elle masquerait ses voisines.
// - La cellule figée garde le survol et la sélection de sa ligne (fond opaque teinté, pas transparent).
export function styleTable(theme: Theme) {
  const fond = theme.palette.background.paper
  const filet = `inset -1px 0 0 ${theme.palette.divider}`
  const teinte = (c: string) => `linear-gradient(${c}, ${c})`
  const survol = teinte(theme.palette.action.hover)
  const choisi = teinte(alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity))
  const fige = '&:not(.sans-colonne-fixe) tr > :first-of-type:not([colspan]):not(.MuiTableCell-paddingCheckbox), &:not(.sans-colonne-fixe) tr > .MuiTableCell-paddingCheckbox:first-of-type + :not([colspan])'
  return {
    // Anciennes classes gardées : elles disent la même chose que le rendu par défaut
    '&.colonne-fixe tr > :first-of-type, &.deux-colonnes-fixes tr > :nth-of-type(-n+2)': { position: 'sticky', left: 0, zIndex: 2, backgroundColor: fond },
    '&.colonne-fixe tr > :first-of-type': { boxShadow: filet },
    '&.deux-colonnes-fixes tr > :first-of-type': { width: 52, minWidth: 52, maxWidth: 52 },
    '&.deux-colonnes-fixes tr > :nth-of-type(2)': { left: 52, boxShadow: filet },
    [fige]: { position: 'sticky', left: 0, zIndex: 2, backgroundColor: fond, boxShadow: filet },
    '&:not(.sans-colonne-fixe) tr > .MuiTableCell-paddingCheckbox:first-of-type': { position: 'sticky', left: 0, zIndex: 2, backgroundColor: fond, width: 52, minWidth: 52, maxWidth: 52 },
    '&:not(.sans-colonne-fixe) tr > .MuiTableCell-paddingCheckbox:first-of-type + :not([colspan])': { left: 52 },
    '& thead tr > th': { zIndex: 3 },
    '& thead tr > th:first-of-type, & thead tr > .MuiTableCell-paddingCheckbox:first-of-type + th': { zIndex: 4 },
    '& tbody tr.MuiTableRow-hover:hover > :first-of-type, & tbody tr.MuiTableRow-hover:hover > .MuiTableCell-paddingCheckbox:first-of-type + *': { backgroundImage: survol },
    '& tbody tr.Mui-selected > :first-of-type, & tbody tr.Mui-selected > .MuiTableCell-paddingCheckbox:first-of-type + *': { backgroundImage: choisi },
    '@media print': { '& tr > *': { position: 'static !important', boxShadow: 'none !important' } },
  }
}

export function styleCellule(theme: Theme) {
  return {
    root: { borderColor: theme.palette.divider, fontVariantNumeric: 'tabular-nums' },
    head: { color: theme.palette.text.secondary, fontWeight: 700, whiteSpace: 'nowrap' as const },
  }
}
