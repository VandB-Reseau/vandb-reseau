// Frise des douze mois (refonte vague 5, Joseph 10/11/2026, 48A) : les temps forts du réseau et les campagnes, du mois
// en cours aux onze suivants. Sur PC, une frise à colonnes ; sur téléphone, une liste par mois.
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { TitreSection } from './Social'
import { decalerMois, libelleMoisCourt, libelleMois } from '../data/chiffres'
import { dateAnnonce } from '../data/tempsForts'
import type { Campagne } from '../data/campagnes'
import type { Reseau } from '../data/modele'
import { brand } from '../theme/theme'
import { dateCourte } from '../lib/format'

const MOIS = 12

export function FriseTempsForts({ reseau, campagnes, ouvrir }: { reseau: Reseau; campagnes: Campagne[]; ouvrir: (id: string) => void }) {
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const debut = reseau.jour.slice(0, 7)
  const mois = Array.from({ length: MOIS }, (_x, i) => decalerMois(debut, i))
  const fin = mois[MOIS - 1]
  const tempsForts = (reseau.tempsForts ?? []).filter((t) => t.fin.slice(0, 7) >= debut && t.debut.slice(0, 7) <= fin)
  const lesCampagnes = campagnes.filter((c) => c.fin.slice(0, 7) >= debut && c.debut.slice(0, 7) <= fin)
  // La frise n'apparaît qu'une fois des temps forts réglés dans Paramètres
  if (!tempsForts.length) return null
  // Position en colonnes de mois (1 à 12) d'une période
  const colonnes = (d: string, f: string) => {
    const a = Math.max(0, mois.indexOf(d.slice(0, 7) < debut ? debut : d.slice(0, 7)))
    const b = mois.indexOf(f.slice(0, 7) > fin ? fin : f.slice(0, 7))
    return { gridColumn: `${a + 1} / ${(b < 0 ? MOIS - 1 : b) + 2}` }
  }
  if (!surPC) {
    return (
      <Box component="section" aria-label="Les douze mois" sx={{ mb: 3 }}>
        <TitreSection>Les douze mois</TitreSection>
        {mois.map((m) => {
          const tf = tempsForts.filter((t) => t.debut.slice(0, 7) === m)
          const cp = lesCampagnes.filter((c) => c.debut.slice(0, 7) === m)
          if (!tf.length && !cp.length) return null
          return (
            <Box key={m} sx={{ mb: 1.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700, mb: 0.5 }}>{libelleMois(m)}</Typography>
              {tf.map((t) => <Typography key={t.id} sx={{ fontWeight: 600 }}>{`${t.nom} · ${dateCourte(t.debut)}, annoncé le ${dateCourte(dateAnnonce(t))}`}</Typography>)}
              {cp.map((c) => (
                <ButtonBase key={c.id} onClick={() => ouvrir(c.id)} sx={{ display: 'block', textAlign: 'left', minHeight: 48, width: '100%', fontFamily: 'inherit' }}>
                  <Typography>{`Campagne ${c.nom} · du ${dateCourte(c.debut)} au ${dateCourte(c.fin)}`}</Typography>
                </ButtonBase>
              ))}
            </Box>
          )
        })}
      </Box>
    )
  }
  return (
    <Box component="section" aria-label="Les douze mois" sx={{ mb: 3 }}>
      <TitreSection>Les douze mois</TitreSection>
      <Box sx={{ bgcolor: 'background.paper', borderRadius: '14px', p: 2, overflowX: 'auto' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${MOIS}, minmax(64px, 1fr))`, gap: 0.5, minWidth: 780 }}>
          {mois.map((m) => <Typography key={m} variant="body2" color="text.secondary" sx={{ fontWeight: 700, textAlign: 'center', pb: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>{libelleMoisCourt(m)}</Typography>)}
          {tempsForts.map((t) => (
            <Box key={t.id} title={`${t.nom} : du ${dateCourte(t.debut)} au ${dateCourte(t.fin)}, annoncé le ${dateCourte(dateAnnonce(t))}`}
              sx={{ ...colonnes(t.debut, t.fin), bgcolor: brand.or, color: '#1d1d1b', borderRadius: 1, px: 1, py: 0.5, fontWeight: 700, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.nom}
            </Box>
          ))}
          {lesCampagnes.map((c) => (
            <ButtonBase key={c.id} onClick={() => ouvrir(c.id)}
              sx={{ ...colonnes(c.debut, c.fin), justifyContent: 'flex-start', bgcolor: 'action.selected', borderRadius: 1, px: 1, minHeight: 36, fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {c.nom}
            </ButtonBase>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
