import { useState } from 'react'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ArrowDropDown from '@mui/icons-material/ArrowDropDown'

export interface Option { valeur: string; libelle: string; detail?: string }

// Puce de filtre Material : affiche le choix courant, ouvre une liste à cocher
export function FiltreMenu({ libelle, options, choisis, onChange }: { libelle: string; options: Option[]; choisis: string[]; onChange: (v: string[]) => void }) {
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  const actif = choisis.length > 0
  const resume = !actif ? libelle : choisis.length === 1 ? options.find((o) => o.valeur === choisis[0])?.libelle ?? libelle : `${libelle} · ${choisis.length}`
  const basculer = (v: string) => onChange(choisis.includes(v) ? choisis.filter((x) => x !== v) : [...choisis, v])
  return (
    <>
      <Chip
        label={resume}
        onClick={(e) => setAncre(e.currentTarget)}
        onDelete={actif ? () => onChange([]) : undefined}
        deleteIcon={actif ? undefined : <ArrowDropDown />}
        color={actif ? 'secondary' : 'default'}
        variant={actif ? 'filled' : 'outlined'}
        aria-label={`Filtre ${libelle}`}
        sx={{ height: 36, fontSize: '0.875rem', fontWeight: 500, borderRadius: 2 }}
      />
      <Menu anchorEl={ancre} open={!!ancre} onClose={() => setAncre(null)} slotProps={{ paper: { sx: { maxHeight: 420, minWidth: 260 } } }}>
        {options.map((o) => (
          <MenuItem key={o.valeur} onClick={() => basculer(o.valeur)} dense sx={{ minHeight: 44 }}>
            <Checkbox checked={choisis.includes(o.valeur)} size="small" sx={{ p: 0.5, mr: 1 }} tabIndex={-1} />
            <ListItemText primary={o.libelle} secondary={o.detail} />
          </MenuItem>
        ))}
        {actif && <Divider />}
        {actif && (
          <MenuItem onClick={() => { onChange([]); setAncre(null) }} sx={{ justifyContent: 'center' }}>
            <Button size="small">Tout effacer</Button>
          </MenuItem>
        )}
      </Menu>
    </>
  )
}

