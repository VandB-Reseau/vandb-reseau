import { useState, type ReactNode } from 'react'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import Tooltip from '@mui/material/Tooltip'
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined'
import { useLocation } from 'react-router-dom'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import Chip from '@mui/material/Chip'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { suitLePerimetre, useEtiquettePerimetre } from '../data/perimetreChoisi'
import { SelecteurPerimetre } from './SelecteurPerimetre'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

// En-tête commun à toutes les pages : le titre toujours à la même place, les actions sur sa ligne,
// le sous-titre dessous, peu d'espace avant le contenu. Sur téléphone, sans action, le sous-titre (un compteur)
// passe à droite du titre : le contenu remonte d'une ligne (Joseph, 21/10/2026).
// Vague 8 (104A) : gabarit de page. Le titre (= nom du menu), une ligne de résumé, UNE action principale à droite,
// les actions secondaires dans « ⋯ » (autres). Jamais de titre de section qui répète l'onglet ouvert.
export interface AutreAction { libelle: string; icone?: ReactNode; onClick: () => void }
function MenuAutres({ autres }: { autres: AutreAction[] }) {
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  return (
    <>
      <Tooltip title="Autres actions"><IconButton aria-label="Autres actions" aria-haspopup="menu" aria-expanded={!!ancre} onClick={(e) => setAncre(e.currentTarget)} sx={{ width: 48, height: 48, flexShrink: 0 }}><MoreHorizOutlined /></IconButton></Tooltip>
      <Menu anchorEl={ancre} open={!!ancre} onClose={() => setAncre(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        {autres.map((a) => <MenuItem key={a.libelle} onClick={() => { setAncre(null); a.onClick() }} sx={{ minHeight: 48 }}>{a.icone && <ListItemIcon>{a.icone}</ListItemIcon>}{a.libelle}</MenuItem>)}
      </Menu>
    </>
  )
}
export function PageHeader({ titre, sousTitre, actions: principales, autres }: { titre: string; sousTitre?: string; actions?: ReactNode; autres?: AutreAction[] }) {
  const actions = autres?.length ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>{principales}<MenuAutres autres={autres} /></Box> : principales
  // Téléphone (vague 3, 21A) : le périmètre sous le titre, qui garde sa place d'une page à l'autre
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const { pathname } = useLocation()
  const selecteur = !surPC && suitLePerimetre(pathname) ? <Box sx={{ mt: 1 }}><SelecteurPerimetre /></Box> : null
  if (!actions && sousTitre) {
    return (
      <Box sx={{ mb: { xs: 1.5, md: 2 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: 'minmax(0, 1fr)' }, alignItems: 'center', columnGap: 2 }}>
          <Titre titre={titre} />
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: { xs: 'right', md: 'left' }, maxWidth: { xs: '45vw', md: 'none' } }}>{sousTitre}</Typography>
        </Box>
        {selecteur}
      </Box>
    )
  }
  return (
    <Box sx={{ mb: { xs: 1, md: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 1.5, md: 2 }, flexWrap: { xs: 'nowrap', md: 'wrap' } }}>
        <Titre titre={titre} fixe={!surPC && !!sousTitre} />
        {/* Téléphone : le compteur reste à droite du titre, avant l'action (vague 4, 39A) ; le titre garde sa largeur */}
        {!surPC && sousTitre && <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 0, minHeight: 40, maxHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', textAlign: 'right', overflow: 'hidden' }}>
          <Box component="span" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{sousTitre}</Box></Typography>}
        {actions}
      </Box>
      {surPC && sousTitre && <Typography variant="body2" color="text.secondary">{sousTitre}</Typography>}
      {selecteur}
    </Box>
  )
}

// Le titre dans une case de hauteur fixe : il reste à la même place quelle que soit la hauteur des actions
// Vague 3 (21A) : sur PC, le périmètre choisi se rappelle à côté du titre, et se retire d'un clic
function Titre({ titre, fixe = false }: { titre: string; fixe?: boolean }) {
  const etiquette = useEtiquettePerimetre()
  return (
    <Box sx={{ flex: fixe ? '0 0 auto' : 1, minWidth: 0, minHeight: { xs: 40, md: 48 }, display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Typography variant="h1" sx={{ minWidth: 0 }}>{titre}</Typography>
      {etiquette && <Chip variant="outlined" label={etiquette.libelle} onDelete={etiquette.revenir} deleteIcon={<CloseOutlined aria-label="Revenir à tout le périmètre" />} sx={{ display: { xs: 'none', md: 'inline-flex' }, fontWeight: 700, fontSize: '0.8125rem' }} />}
    </Box>
  )
}
