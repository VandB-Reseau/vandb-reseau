import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import FilterListOutlined from '@mui/icons-material/FilterListOutlined'
import { fondEnTete } from '../theme/theme'

// Vues rapides d'une liste (vague 8, Joseph 10/11/2026, 96A) : un seul composant pour choisir une vue parmi quelques-unes
// (« Tous 33 », « À traiter 4 »…), au style des vues de la liste des magasins. Le nombre se lit en gris à côté du nom.
// Un libellé « Nom · 12 » est lu comme le nom et son nombre ; le nom accessible reste le libellé d'origine.
export interface OptionVue<V extends string> { v: V; libelle: string; nombre?: number; icone?: ReactNode }

// 361 / 368 (Joseph, 23/11/2026, tableaux « type SaaS ») : les vues sont des pastilles posées dans un bac gris ; la vue
// choisie ressort en blanc, son nombre dans un compteur. Zone tactile de 48 px gardée, la pastille visible fait 36 px.
export const styleBac = {
  display: 'flex', width: 'fit-content', maxWidth: '100%', alignItems: 'center', gap: 0.25, px: 0.5, borderRadius: '12px', bgcolor: fondEnTete,
  overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, mb: 1.5,
} as const
export const styleVue = (actif: boolean) => ({
  flexShrink: 0, minHeight: 48, px: 0, fontFamily: 'inherit',
  '& > span': { px: 1.25, height: 36, display: 'flex', alignItems: 'center', gap: 0.75, borderRadius: '9px', fontSize: '0.875rem', fontWeight: actif ? 700 : 600,
    bgcolor: actif ? 'background.paper' : 'transparent', boxShadow: actif ? '0 1px 2px rgba(29, 29, 27, 0.12)' : 'none', color: actif ? 'text.primary' : 'text.secondary', whiteSpace: 'nowrap' },
  '&:hover > span': { color: 'text.primary' },
}) as const

// Compteur d'une vue ou d'une section : pastille grise, chiffre en gras (366, 368)
export function Compteur({ nombre, actif = false }: { nombre: number; actif?: boolean }) {
  return <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 24, height: 22, px: 0.875, borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
    bgcolor: actif ? fondEnTete : 'rgba(29, 29, 27, 0.06)', color: 'text.secondary' }}>{nombre}</Box>
}

// Joseph (14/11/2026) : un filtre ne doit pas ressembler à des onglets en plus. Puces cerclées, coche sur la puce active,
// picto « filtre » en tête de la rangée (Activité de la fiche magasin, Actualités de l'accueil, tous les filtres en puces)
export const styleFiltre = (actif: boolean) => ({
  flexShrink: 0, minHeight: 48, px: 0.25, fontFamily: 'inherit',
  '& > span': { pl: actif ? 1 : 1.5, pr: 1.5, height: 34, display: 'flex', alignItems: 'center', gap: 0.5, borderRadius: 999, fontSize: '0.875rem', fontWeight: actif ? 700 : 500,
    border: '1px solid', borderColor: actif ? 'text.primary' : 'divider', bgcolor: actif ? 'action.selected' : 'background.paper', color: 'text.primary', whiteSpace: 'nowrap' },
  '&:hover > span': { borderColor: 'text.primary' },
}) as const

export function VuesRapides<V extends string>({ valeur, options, onChange, label, sx, filtre = false }: { valeur: V; options: OptionVue<V>[]; onChange: (v: V) => void; label: string; sx?: object; filtre?: boolean }) {
  return (
    <Box role="group" aria-label={label} sx={filtre ? { display: 'flex', alignItems: 'center', gap: 0.75, overflowX: 'auto', mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, mb: 1, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, ...sx } : { ...styleBac, ...sx }}>
      {filtre && <FilterListOutlined aria-hidden sx={{ flexShrink: 0, color: 'text.secondary', mr: 0.25 }} />}
      {options.map((o) => {
        const actif = o.v === valeur
        const m = o.nombre === undefined ? /^(.*) · (\d+)$/.exec(o.libelle) : null
        const nom = m ? m[1] : o.libelle
        const nombre = o.nombre ?? (m ? Number(m[2]) : undefined)
        return (
          <ButtonBase key={o.v} onClick={() => onChange(o.v)} aria-pressed={actif} aria-label={o.nombre !== undefined ? `${o.libelle} · ${o.nombre}` : m ? o.libelle : undefined} sx={filtre ? styleFiltre(actif) : styleVue(actif)}>
            <span>{filtre && actif && <CheckOutlined sx={{ fontSize: 18 }} />}{o.icone}{nom}{nombre !== undefined && (filtre ? <Box component="span" sx={{ fontWeight: 500, color: 'text.secondary' }}>{nombre}</Box> : <Compteur nombre={nombre} actif={actif} />)}</span>
          </ButtonBase>
        )
      })}
    </Box>
  )
}
