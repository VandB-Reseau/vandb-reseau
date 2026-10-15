import type { ReactElement } from 'react'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

export interface Rubrique<V extends string> { vue: V; libelle: string; court?: string; icone: ReactElement }

// Onglets des pages, sur le modèle de la page Équipe : toute la largeur, icône et libellé.
// PC : icône à gauche du libellé complet ; téléphone : icône au-dessus d'un libellé court, sur une carte.
export function Onglets<V extends string>({ valeur, onChange, rubriques, libelle }: { valeur: V; onChange: (v: V) => void; rubriques: Rubrique<V>[]; libelle: string }) {
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  return (
    <Tabs value={valeur} onChange={(_e, v) => onChange(v as V)} variant="fullWidth" aria-label={libelle}
      sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider', bgcolor: { xs: 'background.paper', md: 'transparent' }, borderRadius: { xs: 2, md: 0 } }}>
      {rubriques.map((r) => (
        <Tab key={r.vue} value={r.vue} icon={r.icone} iconPosition={surPC ? 'start' : 'top'} aria-label={r.libelle}
          label={surPC ? r.libelle : r.court ?? r.libelle} sx={{ minHeight: { xs: 64, md: 56 }, minWidth: 0, px: { xs: 0.5, md: 2 }, fontSize: { xs: '0.8125rem', md: '0.9375rem' } }} />
      ))}
    </Tabs>
  )
}
