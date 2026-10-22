import { useState } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'

export interface Lecture { lus: string[]; nonLus: string[] }

// « Lue par 3 franchisés sur 5 », et qui ne l'a pas encore lue, pour relancer (Directeur et Responsable Régional) ;
// « Vue par » pour une bonne pratique
export function LigneLecture({ l, vue = false }: { l: Lecture; vue?: boolean }) {
  const [ouvert, setOuvert] = useState(false)
  const total = l.lus.length + l.nonLus.length
  if (!total) return null
  return (
    <Box sx={{ px: 2, pt: 1 }}>
      <ButtonBase onClick={() => setOuvert((v) => !v)} disabled={!l.nonLus.length} aria-expanded={l.nonLus.length ? ouvert : undefined}
        sx={{ minHeight: 48, gap: 1, fontFamily: 'inherit', fontSize: '0.875rem', color: 'text.secondary', borderRadius: 2 }}>
        <VisibilityOutlined fontSize="small" />
        <span>{vue ? 'Vue' : 'Lue'} par <b>{l.lus.length}</b> franchisé{l.lus.length > 1 ? 's' : ''} sur {total}</span>
        {l.nonLus.length > 0 && (ouvert ? <ExpandLessOutlined fontSize="small" /> : <ExpandMoreOutlined fontSize="small" />)}
      </ButtonBase>
      {ouvert && <Typography variant="body2" sx={{ pb: 0.5 }}><Box component="span" sx={{ color: 'text.secondary' }}>Pas encore {vue ? 'vue' : 'lue'} : </Box>{l.nonLus.join(', ')}</Typography>}
    </Box>
  )
}
