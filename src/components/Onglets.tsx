import type { ReactElement } from 'react'
import Badge from '@mui/material/Badge'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

// pastille : nombre de nouveautés (messages non lus)
export interface Rubrique<V extends string> { vue: V; libelle: string; court?: string; icone: ReactElement; pastille?: number }

// Onglets des pages, sur le modèle de la page Équipe : toute la largeur, icône et libellé.
// PC : icône à gauche du libellé complet ; téléphone : libellé court seul sur une bande de 48 px, pour laisser la place au contenu.
// Au-delà de quatre onglets sur téléphone, la bande défile.
export function Onglets<V extends string>({ valeur, onChange, rubriques, libelle }: { valeur: V; onChange: (v: V) => void; rubriques: Rubrique<V>[]; libelle: string }) {
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const defile = !surPC && rubriques.length > 4
  return (
    <Tabs value={valeur} onChange={(_e, v) => onChange(v as V)} variant={defile ? 'scrollable' : 'fullWidth'} scrollButtons={false} aria-label={libelle}
      sx={{ mb: { xs: 2, md: 3 }, minHeight: { xs: 48, md: 56 }, borderBottom: '1px solid', borderColor: 'divider', bgcolor: { xs: 'background.paper', md: 'transparent' }, borderRadius: { xs: 2, md: 0 } }}>
      {rubriques.map((r) => (
        <Tab key={r.vue} value={r.vue} icon={surPC ? r.icone : undefined} iconPosition="start" aria-label={r.libelle}
          label={r.pastille ? <Badge color="error" badgeContent={r.pastille} sx={{ '& .MuiBadge-badge': { position: 'static', transform: 'none', ml: 0.75, fontSize: '0.75rem' } }}>{surPC ? r.libelle : r.court ?? r.libelle}</Badge> : surPC ? r.libelle : r.court ?? r.libelle} sx={{ minHeight: { xs: 48, md: 56 }, minWidth: defile ? 72 : 0, px: { xs: defile ? 1.5 : 0.5, md: 2 }, fontSize: { xs: '0.8125rem', md: '0.9375rem' } }} />
      ))}
    </Tabs>
  )
}
