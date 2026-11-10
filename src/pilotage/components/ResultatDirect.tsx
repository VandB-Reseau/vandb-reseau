import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import type { SujetAide } from '../lib/aide'
import { Aide } from './Aide'
import { milliers, MOIS_LONGS, taux } from '../lib/format'
import type { Tresorerie } from '../moteur/tresorerie'
import type { Budget } from '../moteur/types'
import { hautEntete } from '../../components/Collant'

// Lot 42 (Joseph, 02/11/2026, proposition 4) : le résultat du budget reste en vue pendant qu'on change les hypothèses ;
// chaque frappe le recalcule. Sur PC, la bande reste collée en haut de l'écran ; sur téléphone, elle est en tête de page.
// Joseph (09/11/2026) : collée sous les onglets de la fiche, jamais par-dessus ; pas collée sur « Visualiser », où le compte
// de résultat a besoin de toute la hauteur
export function ResultatDirect({ budget: b, ebeSiege, tresorerie, annee, infos = {}, collant = true }: {
  budget: Budget; ebeSiege: number | null; tresorerie: Tresorerie | null; annee: number; collant?: boolean
  infos?: Partial<Record<'ca' | 'marge' | 'ebe', ReactNode>> // calcul détaillé derrière l'icône (i)
}) {
  const ecart = ebeSiege === null ? null : b.ebe - ebeSiege
  const cases: { libelle: string; valeur: string; detail?: string; couleur?: string; fort?: boolean; info?: ReactNode; aide?: SujetAide }[] = [
    { info: infos.ca, libelle: 'Chiffre d’affaires HT', valeur: milliers(b.ca), detail: `${b.atterrissage > 0 ? `${b.ca >= b.atterrissage ? '+' : ''}${taux(b.ca / b.atterrissage - 1)} sur l’atterrissage` : ''}` },
    { info: infos.marge, libelle: 'Marge commerciale', valeur: taux(b.tauxMarge), detail: milliers(b.marge) },
    { aide: 'pctFP', libelle: '% FP', valeur: taux(b.ratios.pctFP), detail: `${milliers(b.personnel)} de personnel` },
    {
      info: infos.ebe, libelle: 'EBE', valeur: milliers(b.ebe), fort: true,
      detail: ecart === null ? `${taux(b.ratios.ebeSurCA)} du CA` : Math.round(ecart / 100) === 0 ? 'Identique au siège' : `${ecart > 0 ? '+' : ''}${milliers(ecart)} face au siège`,
      couleur: ecart !== null && Math.round(ecart / 100) !== 0 ? (ecart > 0 ? 'success.dark' : 'error.main') : undefined,
    },
    { aide: 'resultatNet', libelle: 'Résultat net', valeur: milliers(b.resultatNet), detail: `Impôt : ${milliers(b.impot)}` },
    ...(tresorerie ? [{
      libelle: 'Trésorerie, point bas', valeur: milliers(tresorerie.pointBas.montant), detail: `Fin ${MOIS_LONGS[tresorerie.pointBas.mois]}`,
      couleur: tresorerie.pointBas.montant < 0 ? 'error.main' : undefined,
    }] : []),
  ]
  return (
    <Card component="section" aria-label="Indicateurs clés" data-annee={annee}
      sx={{ ...(collant ? { position: { md: 'sticky' }, top: { md: `calc(${hautEntete.md}px + var(--onglets, 0px) + 8px)` }, zIndex: 3, boxShadow: { md: 3 } } : {}), px: { xs: 0, sm: 2.5 }, py: 1.5 }}>
      {/* Refonte vague 2 (18A) : sur téléphone, les indicateurs tiennent en une bande qui défile de côté */}
      <Box sx={{ display: { xs: 'flex', sm: 'grid' }, overflowX: { xs: 'auto', sm: 'visible' }, scrollSnapType: { xs: 'x mandatory', sm: 'none' }, px: { xs: 2, sm: 0 }, scrollPaddingInline: 16,
        gridTemplateColumns: { sm: 'repeat(3, minmax(0, 1fr))', lg: `repeat(${cases.length}, minmax(0, 1fr))` }, columnGap: 3, rowGap: 1.5 }}>
        {cases.map((c) => (
          <Box key={c.libelle} sx={{ minWidth: { xs: 140, sm: 0 }, flex: { xs: '0 0 auto' }, scrollSnapAlign: 'start' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minHeight: 24 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>{c.libelle}</Typography>
              {c.aide && <Aide sujet={c.aide} />}
              {c.info}
            </Box>
            <Typography sx={{ fontSize: c.fort ? '1.375rem' : '1.25rem', fontWeight: c.fort ? 900 : 700, lineHeight: 1.25, fontVariantNumeric: 'tabular-nums' }}>{c.valeur}</Typography>
            {c.detail && <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: c.couleur ?? 'text.secondary', fontWeight: c.couleur ? 700 : 400 }}>{c.detail}</Typography>}
          </Box>
        ))}
      </Box>
    </Card>
  )
}
