// Une seule carte d'indicateur (refonte vague 5, Joseph 10/11/2026, 53A) : libellé, valeur, détail, et un lien vers
// le détail quand il existe. Accueil de l'équipe, accueil du franchisé, Chiffres : même carte, même comportement.
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import { styleChiffre } from '../theme/theme'
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined'
import TrendingDownOutlined from '@mui/icons-material/TrendingDownOutlined'
import TrendingFlatOutlined from '@mui/icons-material/TrendingFlatOutlined'

// 364 / 368 (Joseph, 23/11/2026, tableau de bord « type SaaS ») : une évolution se lit flèche + valeur en couleur, à droite
// du chiffre, et sa référence en gris dessous (« vs octobre 2025 »). bon : la hausse est-elle une bonne nouvelle ?
export interface Evolution { texte: string; sens: 'hausse' | 'baisse' | 'stable'; bon?: boolean; reference?: string }
export function Fleche({ e }: { e: Evolution }) {
  const bon = e.bon ?? e.sens === 'hausse'
  const couleur = e.sens === 'stable' ? 'text.secondary' : bon ? 'success.dark' : 'error.main'
  const Icone = e.sens === 'hausse' ? TrendingUpOutlined : e.sens === 'baisse' ? TrendingDownOutlined : TrendingFlatOutlined
  return <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: couleur, fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}><Icone sx={{ fontSize: 18 }} />{e.texte}</Box>
}
export const sensDe = (n: number | null | undefined, seuil = 0.05): Evolution['sens'] => (n == null || Math.abs(n) < seuil ? 'stable' : n > 0 ? 'hausse' : 'baisse')

// Grille : deux par ligne sur téléphone ; sur PC, autant de cartes de 190 px au moins que la place le permet
// (294, Joseph 18/11/2026 : dans une colonne étroite, les cartes ne s'écrasent plus)
export const grilleIndicateurs = { display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(auto-fit, minmax(190px, 1fr))' }, gap: { xs: 1, md: 1.5 } } as const

// large : toute la largeur ; largeTelephone : toute la largeur sur téléphone seulement ;
// couleurDetail : le détail en gras de cette couleur (un écart) ; fin : à droite de la valeur (courbe) ; children : sous le détail (barre)
export function Indicateur({ libelle, valeur, detail, couleur, couleurDetail, lien, onClick, actif, large = false, largeTelephone = false, fin, children, phrase, icone, evolution }: {
  icone?: ReactNode; evolution?: Evolution | null; bordee?: boolean // 364 : picto dans un carré teinté, évolution fléchée ; bordee gardé pour mémoire (toutes bordées)
  libelle: string; valeur: ReactNode; detail?: ReactNode; couleur?: string; couleurDetail?: string; lien?: string; onClick?: () => void; actif?: boolean; large?: boolean; largeTelephone?: boolean; fin?: ReactNode; children?: ReactNode
  phrase?: string | null // choix 119 : le chiffre dit en clair, pour le franchisé
}) {
  const sx = { display: 'block', minWidth: 0, textAlign: 'left', px: { xs: 1.5, md: 2 }, py: { xs: 1.25, md: 1.75 }, borderRadius: '14px', bgcolor: 'background.paper', color: 'text.primary', fontFamily: 'inherit', textDecoration: 'none',
    ...(large ? { gridColumn: '1 / -1' } : largeTelephone ? { gridColumn: { xs: '1 / -1', md: 'auto' } } : {}),
    // Pas de survol sur un écran tactile : la carte touchée ne reste pas grisée
    ...(lien || onClick ? { '@media (hover: hover)': { '&:hover': { bgcolor: 'action.hover' } } } : {}),
    // 368 (23/11/2026) : toutes les cartes chiffrées bordées, comme celles du tableau de bord
    border: '1px solid', borderColor: 'divider',
    ...(actif ? { boxShadow: (t: { palette: { secondary: { main: string } } }) => `inset 0 0 0 2px ${t.palette.secondary.main}` } : {}) } as const
  const contenu = (
    <>
      {/* 295 : libellé et détail vont à la ligne plutôt que d'être coupés */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: icone ? 1 : 0 }}>
        {icone && <Box aria-hidden sx={{ width: 36, height: 36, flexShrink: 0, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(248, 187, 9, 0.18)', color: 'text.primary', '& svg': { fontSize: 20 } }}>{icone}</Box>}
        <Typography color="text.secondary" sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' }, lineHeight: 1.35, fontWeight: icone ? 600 : 400 }}>{libelle}</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1.25 }}>
            <Typography sx={{ ...styleChiffre, color: couleur }}>{valeur}</Typography>
            {evolution && <Fleche e={evolution} />}
          </Box>
          {evolution?.reference && !detail && <Typography color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.8125rem' } }}>{evolution.reference}</Typography>}
          {detail && <Typography color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' }, ...(couleurDetail ? { color: couleurDetail, fontWeight: 700 } : {}) }}>{detail}</Typography>}
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
