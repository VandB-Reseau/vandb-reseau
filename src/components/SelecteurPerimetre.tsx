// Choix du périmètre (refonte vague 3, Joseph 09/11/2026, 21A) : sous la recherche du menu sur PC, en haut des listes
// sur téléphone. Le Coach n'a qu'un périmètre et ne voit pas ce choix.
import { useState } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import UnfoldMoreOutlined from '@mui/icons-material/UnfoldMoreOutlined'
import { useAuth } from '../auth/AuthContext'
import { useReseauSiDispo } from '../data/ReseauContext'
import { choisirPerimetre, optionsPerimetre, useCleChoisie } from '../data/perimetreChoisi'

// compact : puce d'une ligne (Accueil téléphone, maquette 278, Joseph 17/11/2026)
export function SelecteurPerimetre({ pleineLargeur = false, compact = false }: { pleineLargeur?: boolean; compact?: boolean }) {
  const { profil } = useAuth()
  const reseau = useReseauSiDispo()?.complet ?? null
  const cle = useCleChoisie()
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  if (!reseau) return null
  const options = optionsPerimetre(reseau, profil)
  if (options.length < 2) return null
  const choisie = options.find((o) => o.cle === cle) ?? options[0]
  return (
    <>
      {compact ? (
        <ButtonBase onClick={(e) => setAncre(e.currentTarget)} aria-haspopup="menu" aria-expanded={!!ancre} aria-label={`Périmètre : ${choisie.libelle}`}
          sx={{ maxWidth: '100%', minHeight: 48, gap: 0.5, px: 1.5, borderRadius: 999, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', fontFamily: 'inherit' }}>
          <Typography component="span" sx={{ fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{choisie.libelle}</Typography>
          <UnfoldMoreOutlined sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
        </ButtonBase>
      ) : <ButtonBase onClick={(e) => setAncre(e.currentTarget)} aria-haspopup="menu" aria-expanded={!!ancre} aria-label={`Périmètre : ${choisie.libelle}`}
        sx={{ width: '100%', minHeight: 48, justifyContent: 'space-between', gap: 1, px: 1.25, py: 0.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.default', textAlign: 'left', ...(pleineLargeur ? {} : {}) }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="span" sx={{ display: 'block', fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.3 }}>Périmètre</Typography>
          <Typography component="span" sx={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{choisie.libelle}</Typography>
        </Box>
        <UnfoldMoreOutlined sx={{ fontSize: 20, color: 'text.secondary', flexShrink: 0 }} />
      </ButtonBase>}
      <Menu anchorEl={ancre} open={!!ancre} onClose={() => setAncre(null)} slotProps={{ list: { 'aria-label': 'Choisir le périmètre' }, paper: { sx: { mt: 0.5, minWidth: 260, maxHeight: 420, borderRadius: 3 } } }}>
        {options.map((o) => (
          <MenuItem key={o.cle} selected={o.cle === choisie.cle} onClick={() => { setAncre(null); choisirPerimetre(o.cle) }} sx={{ minHeight: 48, pl: o.niveau ? 4 : 2 }}>
            <ListItemText primary={o.libelle} slotProps={{ primary: { sx: { fontWeight: o.niveau ? 500 : 700, fontSize: '0.875rem' } } }} />
            <Typography component="span" sx={{ ml: 2, fontSize: '0.75rem', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{o.detail}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
