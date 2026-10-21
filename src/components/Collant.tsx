import { useCallback, useRef, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import type { SxProps, Theme } from '@mui/material/styles'

// Bandes collées sous la barre du haut (64 px téléphone, 72 px PC) quand la page défile :
// les onglets, puis la barre de recherche et de filtres juste dessous.
// Chaque bande publie sa hauteur (--onglets, --filtres) pour que la suivante et les intertitres collants
// (mois, lettres, régions) se rangent dessous au lieu de passer dessous.
export type Bande = '--onglets' | '--filtres'

export const hautEntete = { xs: 64, md: 72 }

// Position collante sous la barre du haut et sous les bandes nommées
export function sousBandes(...bandes: Bande[]) {
  const ajout = bandes.map((b) => ` + var(${b}, 0px)`).join('')
  return { xs: `calc(${hautEntete.xs}px${ajout})`, md: `calc(${hautEntete.md}px${ajout})` }
}

// Mesure la bande et publie sa hauteur tant qu'elle est affichée
export function useBande(bande: Bande, actif = true) {
  const suivi = useRef<ResizeObserver | null>(null)
  return useCallback((e: HTMLElement | null) => {
    suivi.current?.disconnect()
    suivi.current = null
    const racine = document.documentElement.style
    if (!e || !actif) { racine.removeProperty(bande); return }
    const publier = () => racine.setProperty(bande, `${Math.round(e.getBoundingClientRect().height)}px`)
    publier()
    suivi.current = new ResizeObserver(publier)
    suivi.current.observe(e)
  }, [bande, actif])
}

// Barre d'outils collée sous les onglets : recherche et filtres, mois affiché, puces de tri.
// Sur le fond de la page, d'un bord à l'autre sur téléphone ; même place qu'avant tant qu'elle ne colle pas.
export function BandeCollante({ children, sx, label }: { children: ReactNode; sx?: SxProps<Theme>; label?: string }) {
  const bande = useBande('--filtres')
  return (
    <Box ref={bande} role={label ? 'group' : undefined} aria-label={label}
      sx={[{ position: 'sticky', top: sousBandes('--onglets'), zIndex: 4, bgcolor: 'background.default', mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, mt: -1, pt: 1, pb: 1, mb: 1 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {children}
    </Box>
  )
}
