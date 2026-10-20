import type { ReactElement } from 'react'
import Badge from '@mui/material/Badge'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

// pastille : nombre de nouveautés (messages non lus)
export interface Rubrique<V extends string> { vue: V; libelle: string; court?: string; icone: ReactElement; pastille?: number }

// Onglets des pages en puces, comme dans une app : la rubrique ouverte en noir, les autres cerclées.
// PC : icône et libellé complet ; téléphone : libellé court seul. La bande défile quand elle déborde.
// Chaque puce garde une zone tactile de 48 px de haut.
export function Onglets<V extends string>({ valeur, onChange, rubriques, libelle }: { valeur: V; onChange: (v: V) => void; rubriques: Rubrique<V>[]; libelle: string }) {
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  return (
    <Tabs value={valeur} onChange={(_e, v) => onChange(v as V)} variant="scrollable" scrollButtons={false} aria-label={libelle}
      slotProps={{ indicator: { sx: { display: 'none' } } }}
      sx={{ mb: { xs: 1.5, md: 2.5 }, minHeight: 48, mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, '& .MuiTabs-flexContainer': { gap: 1 } }}>
      {rubriques.map((r) => (
        <Tab key={r.vue} value={r.vue} icon={surPC ? r.icone : undefined} iconPosition="start" aria-label={r.libelle} disableRipple
          label={r.pastille ? <Badge color="error" badgeContent={r.pastille} sx={{ '& .MuiBadge-badge': { position: 'static', transform: 'none', ml: 0.75, fontSize: '0.75rem' } }}>{surPC ? r.libelle : r.court ?? r.libelle}</Badge> : surPC ? r.libelle : r.court ?? r.libelle}
          sx={{
            minHeight: 48, minWidth: 0, px: 2, py: 0, gap: 0.75, position: 'relative', zIndex: 0, color: 'text.primary', opacity: 1,
            fontSize: '0.875rem', fontWeight: 500,
            '& .MuiTab-icon': { mb: 0, mr: 0, fontSize: 20 },
            // Puce de 40 px dessinée dans la zone tactile de 48 px
            '&::before': { content: '""', position: 'absolute', inset: '4px 0', borderRadius: 999, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', zIndex: -1 },
            '&.Mui-selected': { color: 'primary.contrastText', fontWeight: 600 },
            '&.Mui-selected::before': { bgcolor: 'primary.main', borderColor: 'primary.main' },
            '&.Mui-focusVisible::before': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 1 },
          }} />
      ))}
    </Tabs>
  )
}
