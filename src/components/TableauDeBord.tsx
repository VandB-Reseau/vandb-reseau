// 364 / 365 (Joseph, 23/11/2026, « j'aime bien le rendu de l'app ci-joint ») : tableau de bord en tête des chiffres.
// Une rangée de cartes chiffrées (picto, chiffre, évolution fléchée et sa référence), puis deux graphes : la
// répartition du CA par univers et le CA des 6 derniers mois face à l'an dernier. Même gabarit pour le réseau
// (Chiffres) et pour un magasin (Vue d'ensemble de sa fiche).
import { useMemo, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import EuroOutlined from '@mui/icons-material/EuroOutlined'
import PercentOutlined from '@mui/icons-material/PercentOutlined'
import ShoppingBasketOutlined from '@mui/icons-material/ShoppingBasketOutlined'
import { Indicateur, grilleIndicateurs, sensDe, type Evolution } from './Indicateur'
import { Anneau, Barres, CarteGraphe } from './Graphes'
import { Fleche } from './Indicateur'
import { formatKEuros, libelleMois, libelleMoisCourt, decalerMois } from '../data/chiffres'
import { tableauDeBord } from '../data/tableauDeBord'
import type { Reseau } from '../data/modele'

const fr = (n: number, d = 1) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
const signe = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '')
export const evolPourcent = (n: number | null, reference: string): Evolution | null => n == null ? null : { texte: `${signe(n)}${fr(Math.abs(n))} %`, sens: sensDe(n), reference }
export const evolPoints = (n: number | null, reference: string): Evolution | null => n == null ? null : { texte: `${signe(n)}${fr(Math.abs(n))} pt${Math.abs(n) >= 2 ? 's' : ''}`, sens: sensDe(n), reference }

// avant / quatrieme : cartes posées avant ou après les trois cartes communes ; etroit : graphes l'un sous l'autre (colonne
// de la fiche magasin) ; groupe : nom de la rangée de cartes
export function TableauDeBord({ reseau, noms, avant, quatrieme, label = 'Tableau de bord', groupe = 'Indicateurs', etroit = false }: {
  reseau: Reseau; noms: string[]; avant?: ReactNode; quatrieme?: ReactNode; label?: string; groupe?: string; etroit?: boolean
}) {
  const t = useMemo(() => tableauDeBord(reseau, noms), [reseau, noms])
  if (!t) return null
  const vsN1 = `vs ${libelleMois(decalerMois(t.mois, -12))}`
  const derniere = t.mois6.at(-1)!
  const evol6 = derniere.ca != null && derniere.caN1 ? (derniere.ca / derniere.caN1 - 1) * 100 : null
  return (
    <Box component="section" aria-label={label} sx={{ display: 'grid', gap: { xs: 1, md: 1.5 }, mb: 2 }}>
      <Box role="group" aria-label={groupe} sx={{ ...grilleIndicateurs, ...(etroit ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : {}) }}>
        {avant}
        <Indicateur bordee icone={<EuroOutlined />} libelle={`CA de ${libelleMois(t.mois)}`} valeur={formatKEuros(t.ca)}
          evolution={evolPourcent(t.evolCA, noms.length > 1 ? `${vsN1}, à magasins comparables` : vsN1)} />
        <Indicateur bordee icone={<PercentOutlined />} libelle="Marge moyenne" valeur={t.marge == null ? '—' : `${fr(t.marge)} %`}
          evolution={evolPoints(t.evolMarge, vsN1)} detail={t.marge == null ? 'Pas encore de marge saisie' : undefined} />
        <Indicateur bordee icone={<ShoppingBasketOutlined />} libelle="Panier moyen Cave" valeur={t.panierCave == null ? '—' : `${fr(t.panierCave, 2)} €`}
          evolution={evolPourcent(t.evolPanier, vsN1)} detail={t.panierCave == null ? 'Pas de panier Cave ce mois' : undefined} />
        {quatrieme}
      </Box>
      <Box sx={{ display: 'grid', gap: { xs: 1, md: 1.5 }, gridTemplateColumns: etroit ? 'minmax(0, 1fr)' : { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' } }}>
        <CarteGraphe titre="CA par univers" sousTitre={libelleMois(t.mois)}>
          <Anneau label={`Répartition du CA de ${libelleMois(t.mois)} par univers`} centre={formatKEuros(t.ca)} sousCentre="CA du mois" format={formatKEuros}
            parts={[{ libelle: 'Cave', valeur: t.parts.cave }, { libelle: 'Bar', valeur: t.parts.bar }, { libelle: 'Extérieur', valeur: t.parts.ext }]} />
        </CarteGraphe>
        <CarteGraphe titre="Évolution du CA" sousTitre="6 derniers mois" fin={evol6 != null ? <Fleche e={evolPourcent(evol6, '')!} /> : undefined}>
          <Barres label="Chiffre d'affaires des 6 derniers mois, face à l'an dernier" format={formatKEuros}
            barres={t.mois6.map((m) => ({ libelle: libelleMoisCourt(m.mois).split(' ')[0], valeur: m.ca, reference: m.caN1 }))} />
        </CarteGraphe>
      </Box>
    </Box>
  )
}
