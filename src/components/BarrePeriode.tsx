import { useSyncExternalStore } from 'react'
import Box from '@mui/material/Box'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'

export type PeriodeCommune = 'mois' | 'cumul'

// Vague 8 (106A) : une seule période pour tous les écrans chiffrés (Accueil, fiche magasin, suivi du budget).
// Le choix suit d'un écran à l'autre pendant la session (mémoire de l'onglet du navigateur).
const CLE = 'periode-chiffres'
const abonnes = new Set<() => void>()
let memoire: PeriodeCommune | null = null
function lire(): PeriodeCommune | null {
  if (memoire) return memoire
  try { const v = sessionStorage.getItem(CLE); if (v === 'mois' || v === 'cumul') return (memoire = v) } catch { /* sans mémoire : par défaut */ }
  return null
}
export function changerPeriode(v: PeriodeCommune) {
  memoire = v
  try { sessionStorage.setItem(CLE, v) } catch { /* sans mémoire : le choix vaut pour la page */ }
  abonnes.forEach((f) => f())
}
// Tant que rien n'est choisi dans la session, chaque écran garde sa période d'office (la synthèse du budget : le cumul)
export function usePeriodeCommune(defaut: PeriodeCommune = 'mois'): [PeriodeCommune, (v: PeriodeCommune) => void] {
  const v = useSyncExternalStore((f) => { abonnes.add(f); return () => { abonnes.delete(f) } }, lire, lire)
  return [v ?? defaut, changerPeriode]
}

// La barre elle-même : « Comparé à N-1 » ou « au budget », puis Mois / Cumul, toujours dans cet ordre et avec ces mots
export function BarrePeriode({ valeur, onChange, comparaison = 'N-1', sx }: { valeur: PeriodeCommune; onChange: (v: PeriodeCommune) => void; comparaison?: 'N-1' | 'budget'; sx?: object }) {
  return (
    <Box role="group" aria-label="Période des chiffres" className="pas-a-l-impression" sx={{ display: 'flex', alignItems: 'center', gap: 1, ...sx }}>
      <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>{comparaison === 'budget' ? 'Comparé au budget' : 'Comparé à N-1'}</Typography>
      <ToggleButtonGroup exclusive size="small" value={valeur} onChange={(_e, v: PeriodeCommune | null) => v && onChange(v)} aria-label="Période"
        sx={{ '& .MuiToggleButton-root': { minHeight: { xs: 48, md: 36 }, px: 1.5, textTransform: 'none', fontWeight: 600 } }}>
        <ToggleButton value="mois">Mois</ToggleButton>
        <ToggleButton value="cumul">Cumul</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  )
}
