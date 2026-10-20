import type { ReactElement, ReactNode, MouseEvent } from 'react'
import Badge from '@mui/material/Badge'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme, type SxProps, type Theme } from '@mui/material/styles'
import SearchIcon from '@mui/icons-material/Search'
import AddOutlined from '@mui/icons-material/AddOutlined'

// Une seule grammaire pour les barres d'outils de toutes les pages :
// recherche en pilule, filtres en puces (repliés sur téléphone), boutons ronds de 48 px
// (contour = réglage, plein = action principale), groupes de boutons en pilule.

export const useTelephone = () => !useMediaQuery(useTheme().breakpoints.up('sm'), { noSsr: true })

export const groupeSx: SxProps<Theme> = { display: 'flex', flexShrink: 0, bgcolor: 'background.paper', borderRadius: 999, overflow: 'hidden', outline: '1px solid', outlineColor: 'divider', outlineOffset: -1 }
export const boutonGroupeSx: SxProps<Theme> = {
  width: 48, height: 48, minWidth: 48, p: 0, border: 0, borderRadius: 0, color: 'text.secondary',
  '& + &': { borderLeft: '1px solid', borderLeftColor: 'divider' },
  '&:first-of-type': { pl: 0.5 }, '&:last-of-type': { pr: 0.5 },
  '&:hover': { bgcolor: 'action.hover' },
  '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'primary.main', color: 'primary.contrastText' },
}

// Libellé au survol seulement avec une souris : sur écran tactile, l'icône suffit
export function Bulle({ titre, children }: { titre: string; children: ReactElement }) {
  const souris = useMediaQuery('(hover: hover)')
  return (
    <Tooltip title={titre} placement="bottom" disableHoverListener={!souris} disableFocusListener={!souris} disableTouchListener slotProps={{ tooltip: { sx: { fontSize: 13 } } }}>
      {children}
    </Tooltip>
  )
}

export function ChampRecherche({ valeur, onChange, placeholder, libelle }: { valeur: string; onChange: (v: string) => void; placeholder: string; libelle?: string }) {
  return (
    <TextField size="small" placeholder={placeholder} value={valeur} onChange={(e) => onChange(e.target.value)}
      slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }, htmlInput: { 'aria-label': libelle ?? placeholder } }}
      sx={champRechercheSx} />
  )
}
export const champRechercheSx: SxProps<Theme> = { width: { xs: '100%', sm: 320 }, '& .MuiOutlinedInput-root': { borderRadius: 999, minHeight: 48 } }

export function BoutonOutil({ libelle, icone, onClick, plein, actif, badge, attributs }: {
  libelle: string; icone: ReactNode; onClick: (e: MouseEvent<HTMLElement>) => void; plein?: boolean; actif?: boolean; badge?: number
  attributs?: Record<string, string | boolean | undefined>
}) {
  const fonce = plein || actif
  const bouton = (
    <IconButton onClick={onClick} aria-label={libelle} {...attributs}
      sx={{ width: 48, height: 48, flexShrink: 0, border: '1px solid', borderColor: fonce ? 'primary.main' : 'divider', bgcolor: fonce ? 'primary.main' : 'background.paper', color: fonce ? 'primary.contrastText' : 'text.primary', '&:hover': { bgcolor: fonce ? 'primary.dark' : 'action.hover' } }}>
      {icone}
    </IconButton>
  )
  return <Bulle titre={libelle}>{badge ? <Badge badgeContent={badge} color="secondary">{bouton}</Badge> : bouton}</Bulle>
}

// Action d'une page : icône et libellé, sur PC comme sur téléphone (libellé court sur téléphone si fourni)
export function BoutonAction({ libelle, court, icone = <AddOutlined />, onClick, secondaire }: { libelle: string; court?: string; icone?: ReactNode; onClick: (e: MouseEvent<HTMLElement>) => void; secondaire?: boolean }) {
  const telephone = useTelephone()
  return (
    <Button variant={secondaire ? 'outlined' : 'contained'} startIcon={icone} onClick={onClick} aria-label={telephone && court ? libelle : undefined}
      sx={{ minHeight: 48, flexShrink: 0, whiteSpace: 'nowrap', ...(telephone && { px: 2 }) }}>{telephone ? court ?? libelle : libelle}</Button>
  )
}
