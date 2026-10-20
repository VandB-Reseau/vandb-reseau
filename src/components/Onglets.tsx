import type { ReactElement, ReactNode } from 'react'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

// pastille : nombre de nouveautés (messages non lus)
export interface Rubrique<V extends string> { vue: V; libelle: string; court?: string; icone: ReactElement; pastille?: number }

// Onglets des pages en puces, comme dans une app : la rubrique ouverte en noir, les autres cerclées.
// PC : icône et libellé complet ; téléphone : libellé court seul. La bande défile quand elle déborde.
// Chaque puce garde une zone tactile de 48 px de haut.
// collants (fiches) : la bande reste sous la barre du haut quand l'en-tête de la fiche a défilé,
// et changer d'onglet garde la position (RetourEnHaut) au lieu de remonter tout en haut.
export function Onglets<V extends string>({ valeur, onChange, rubriques, libelle, collants }: { valeur: V; onChange: (v: V) => void; rubriques: Rubrique<V>[]; libelle: string; collants?: boolean }) {
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  return (
    <>
    {collants && <Box className="onglets-repere" aria-hidden />}
    <Tabs className={collants ? 'onglets-collants' : undefined} value={valeur} onChange={(_e, v) => onChange(v as V)} variant="scrollable" scrollButtons={false} aria-label={libelle}
      slotProps={{ indicator: { sx: { display: 'none' } } }}
      sx={{
        mb: { xs: 1.5, md: 2.5 }, minHeight: 48, mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, '& .MuiTabs-flexContainer': { gap: 1 },
        // Sous la barre du haut (hauteur posée par AppShell), sur le fond de la page
        ...(collants ? { position: 'sticky', top: 'var(--haut-entete, 64px)', zIndex: 4, bgcolor: 'background.default' } : {}),
      }}>
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
    </>
  )
}

// Contenu sous des onglets collants : toujours assez haut pour que les onglets restent en haut
// de l'écran quand l'onglet ouvert est court (sinon la page remonte et l'en-tête réapparaît)
export function ContenuOnglet({ children }: { children: ReactNode }) {
  return <Box sx={{ minHeight: { xs: 'calc(100dvh - 216px)', md: 'calc(100dvh - 168px)' } }}>{children}</Box>
}
