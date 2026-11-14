// Une seule carte d'indicateur (refonte vague 5, Joseph 10/11/2026, 53A) : libellé, valeur, détail, et un lien vers
// le détail quand il existe. Accueil de l'équipe, accueil du franchisé, Chiffres : même carte, même comportement.
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import { styleChiffre } from '../theme/theme'

// Grille : deux par ligne sur téléphone, quatre sur PC
export const grilleIndicateurs = { display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: { xs: 1, md: 1.5 } } as const

// large : toute la largeur ; largeTelephone : toute la largeur sur téléphone seulement ;
// couleurDetail : le détail en gras de cette couleur (un écart) ; fin : à droite de la valeur (courbe) ; children : sous le détail (barre)
export function Indicateur({ libelle, valeur, detail, couleur, couleurDetail, lien, onClick, actif, large = false, largeTelephone = false, fin, children, phrase }: {
  libelle: string; valeur: ReactNode; detail?: ReactNode; couleur?: string; couleurDetail?: string; lien?: string; onClick?: () => void; actif?: boolean; large?: boolean; largeTelephone?: boolean; fin?: ReactNode; children?: ReactNode
  phrase?: string | null // choix 119 : le chiffre dit en clair, pour le franchisé
}) {
  const sx = { display: 'block', minWidth: 0, textAlign: 'left', px: { xs: 1.5, md: 2 }, py: { xs: 1.25, md: 1.75 }, borderRadius: '14px', bgcolor: 'background.paper', color: 'text.primary', fontFamily: 'inherit', textDecoration: 'none',
    ...(large ? { gridColumn: '1 / -1' } : largeTelephone ? { gridColumn: { xs: '1 / -1', md: 'auto' } } : {}),
    // Pas de survol sur un écran tactile : la carte touchée ne reste pas grisée
    ...(lien || onClick ? { '@media (hover: hover)': { '&:hover': { bgcolor: 'action.hover' } } } : {}),
    ...(actif ? { boxShadow: (t: { palette: { secondary: { main: string } } }) => `inset 0 0 0 2px ${t.palette.secondary.main}` } : {}) } as const
  const contenu = (
    <>
      <Typography color="text.secondary" noWrap sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' }, lineHeight: 1.35 }}>{libelle}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ ...styleChiffre, color: couleur }}>{valeur}</Typography>
          {detail && <Typography color="text.secondary" noWrap sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' }, ...(couleurDetail ? { color: couleurDetail, fontWeight: 700 } : {}) }}>{detail}</Typography>}
        </Box>
        {fin}
      </Box>
      {phrase && <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, mt: 0.5 }}>{phrase}</Typography>}
      {children && <Box aria-hidden>{children}</Box>}
    </>
  )
  const texte = typeof valeur === 'string' && typeof detail === 'string' ? `${libelle} : ${valeur}, ${detail}` : undefined
  if (lien) return <ButtonBase component={RouterLink} to={lien} aria-label={texte} sx={sx}>{contenu}</ButtonBase>
  if (onClick) return <ButtonBase onClick={onClick} aria-label={texte} aria-pressed={!!actif} sx={sx}>{contenu}</ButtonBase>
  return <Box role="group" aria-label={libelle} sx={sx}>{contenu}</Box>
}
