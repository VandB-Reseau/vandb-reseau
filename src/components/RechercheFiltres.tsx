import { useState, type ReactNode } from 'react'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import TuneOutlined from '@mui/icons-material/TuneOutlined'

// Sur téléphone : la recherche et un bouton « Filtres » sur une ligne, les filtres se déplient au besoin
export function RechercheFiltres({ recherche, actifs, children, pc }: { recherche: ReactNode; actifs: number; children: ReactNode; pc: (recherche: ReactNode, filtres: ReactNode) => ReactNode }) {
  const theme = useTheme()
  const telephone = !useMediaQuery(theme.breakpoints.up('sm'), { noSsr: true })
  const [deplies, setDeplies] = useState(false)
  if (!telephone) return <>{pc(recherche, children)}</>
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>{recherche}</Box>
        <Badge badgeContent={actifs} color="secondary">
          <IconButton onClick={() => setDeplies((v) => !v)} aria-label="Filtres" aria-expanded={deplies} sx={{ width: 48, height: 48, border: '1px solid', borderColor: 'divider' }}><TuneOutlined /></IconButton>
        </Badge>
      </Box>
      {deplies && <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1.5, '& > .MuiTextField-root': { flex: '1 1 100%' } }}>{children}</Box>}
    </Box>
  )
}
