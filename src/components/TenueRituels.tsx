// Taux de tenue des rituels d'animation (refonte vague 4, Joseph 10/11/2026, 33A) : Équipe › Rituels et rapport du mois.
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { Section } from './Section'
import { useEntretiens } from '../data/entretiens'
import { tauxRituels, type TauxRituel } from '../data/rituels'
import { lienCoach, lienRR } from '../lib/format'
import type { Reseau } from '../data/modele'

const couleur = (t: number | null) => (t === null ? 'text.secondary' : t >= 80 ? 'success.dark' : t >= 50 ? 'warning.dark' : 'error.main')
export const libelleTaux = (t: TauxRituel) => (t.taux === null ? 'Pas encore mesuré' : `${t.taux} %`)

export function useTauxRituels(reseau: Reseau) {
  const { liste } = useEntretiens()
  return liste === undefined ? undefined : tauxRituels(reseau, liste)
}

export function VueRituels({ reseau }: { reseau: Reseau }) {
  const taux = useTauxRituels(reseau)
  if (!taux) return <Box sx={{ display: 'grid', gap: 2 }}><Skeleton variant="rounded" height={120} /><Skeleton variant="rounded" height={220} /></Box>
  if (!taux.length) return <Typography color="text.secondary">Aucun rituel suivi. Le Directeur les choisit dans Paramètres › Rituels d’animation.</Typography>
  const lien = (t: TauxRituel, nom: string) => (t.rituel.type === 'visite' ? lienCoach(nom) : lienRR(reseau.rrs.find((r) => r.nom === nom)?.id ?? ''))
  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box role="list" aria-label="Taux de tenue des rituels" sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: `repeat(${taux.length}, 1fr)` } }}>
        {taux.map((t) => (
          <Box role="listitem" key={t.rituel.type} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
            <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: couleur(t.taux) }}>{libelleTaux(t)}</Typography>
            <Typography sx={{ fontWeight: 600 }}>{t.rituel.libelle}</Typography>
            {t.taux !== null && <Typography variant="body2" color="text.secondary">{t.faits} sur {t.attendus}</Typography>}
          </Box>
        ))}
      </Box>
      {taux.map((t) => t.lignes.length > 0 && (
        <Section key={t.rituel.type} titre={t.rituel.libelle}>
          {[...t.lignes].sort((a, b) => a.faits / (a.attendus || 1) - b.faits / (b.attendus || 1)).map((l) => {
            const p = l.attendus ? Math.round((l.faits / l.attendus) * 100) : null
            return (
              <Box key={l.personne} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Link component={RouterLink} to={lien(t, l.personne)} sx={{ fontWeight: 500 }}>{l.personne}</Link>
                  <Typography variant="body2" color="text.secondary">{l.detail}</Typography>
                </Box>
                <Typography sx={{ fontWeight: 700, color: couleur(p) }}>{p === null ? '—' : `${p} %`}</Typography>
              </Box>
            )
          })}
        </Section>
      ))}
    </Box>
  )
}
