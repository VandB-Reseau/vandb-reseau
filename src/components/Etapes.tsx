// 338 (Joseph, 18/11/2026) : un seul composant d'étapes, celui du budget (ronds numérotés reliés par un filet), pour la
// visite et le plan marché extérieur. L'étape faite prend une coche, l'étape ouverte un rond noir plein.
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import CheckOutlined from '@mui/icons-material/CheckOutlined'

export interface Etape { cle: string; libelle: string; detail?: ReactNode; fait?: boolean; aria: string }

export function FriseEtapes({ libelle, etapes, actuelle, choisir, sx }: { libelle: string; etapes: Etape[]; actuelle: string; choisir: (cle: string) => void; sx?: object }) {
  return (
    <Box component="nav" aria-label={libelle} sx={{ overflowX: 'auto', scrollbarWidth: 'none', ...sx }}>
      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', alignItems: 'stretch', minWidth: 'min-content' }}>
        {etapes.map((e, i) => {
          const ici = e.cle === actuelle
          return (
            <Box component="li" key={e.cle} sx={{ display: 'flex', alignItems: 'center', flex: '1 1 0', minWidth: 0 }}>
              <ButtonBase onClick={() => choisir(e.cle)} aria-current={ici ? 'step' : undefined} aria-label={e.aria}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75, minHeight: 56, borderRadius: 2, fontFamily: 'inherit', textAlign: 'left', justifyContent: 'flex-start', flexShrink: 0, '&:hover': { bgcolor: 'action.hover' } }}>
                <Box component="span" aria-hidden sx={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, fontWeight: 800, fontSize: '0.875rem', border: 2,
                  borderColor: ici ? 'text.primary' : e.fait ? 'success.main' : 'divider', bgcolor: ici ? 'text.primary' : e.fait ? 'success.main' : 'background.paper', color: ici || e.fait ? 'background.paper' : 'text.primary' }}>
                  {e.fait && !ici ? <CheckOutlined sx={{ fontSize: 18 }} /> : i + 1}
                </Box>
                <Box component="span" sx={{ minWidth: 0 }}>
                  <Box component="span" sx={{ display: 'block', fontWeight: ici ? 800 : 600, fontSize: '0.875rem', lineHeight: 1.25, whiteSpace: 'nowrap', color: 'text.primary' }}>{e.libelle}</Box>
                  {e.detail && <Box component="span" sx={{ display: { xs: 'none', md: 'block' }, fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>{e.detail}</Box>}
                </Box>
              </ButtonBase>
              {i < etapes.length - 1 && <Box aria-hidden sx={{ flex: 1, minWidth: 12, height: 2, bgcolor: 'divider', mx: 0.5 }} />}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
