import { useCallback, useMemo, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Typography from '@mui/material/Typography'

// Agir sur plusieurs lignes à la fois (refonte vague 2, Joseph 09/11/2026, 16A) : une case par ligne, et dès qu'une
// ligne est cochée, une barre en bas de l'écran avec les actions possibles. Un seul composant pour toutes les listes.
export function useSelection(cles: string[]) {
  const [choisis, setChoisis] = useState<Set<string>>(new Set())
  // Une ligne qui disparaît de la liste (filtre) ne reste pas cochée en douce
  const visibles = useMemo(() => new Set(cles), [cles])
  const actifs = useMemo(() => new Set([...choisis].filter((c) => visibles.has(c))), [choisis, visibles])
  const basculer = useCallback((cle: string) => setChoisis((s) => { const n = new Set(s); if (n.has(cle)) n.delete(cle); else n.add(cle); return n }), [])
  const toutBasculer = useCallback(() => setChoisis(() => (actifs.size === visibles.size ? new Set() : new Set(visibles))), [actifs, visibles])
  const vider = useCallback(() => setChoisis(new Set()), [])
  return { choisis: actifs, liste: cles.filter((c) => actifs.has(c)), basculer, toutBasculer, vider, tous: actifs.size > 0 && actifs.size === visibles.size, certains: actifs.size > 0 && actifs.size < visibles.size }
}
export type Selection = ReturnType<typeof useSelection>

// Case d'une ligne : le clic ne déclenche pas l'ouverture de la ligne
export function CaseLigne({ s, cle, nom }: { s: Selection; cle: string; nom: string }) {
  return (
    <Checkbox checked={s.choisis.has(cle)} onChange={() => s.basculer(cle)} onClick={(e) => e.stopPropagation()}
      slotProps={{ input: { 'aria-label': `Sélectionner ${nom}` } }} sx={{ width: { xs: 48, md: 40 }, height: { xs: 48, md: 40 }, m: -1 }} />
  )
}
export function CaseEntete({ s }: { s: Selection }) {
  return (
    <Checkbox checked={s.tous} indeterminate={s.certains} onChange={s.toutBasculer}
      slotProps={{ input: { 'aria-label': s.tous ? 'Tout désélectionner' : 'Tout sélectionner' } }} sx={{ width: { xs: 48, md: 40 }, height: { xs: 48, md: 40 }, m: -1 }} />
  )
}

// Barre des actions, collée en bas de l'écran tant qu'au moins une ligne est cochée
export function BarreSelection({ s, children, quoi = 'sélectionné' }: { s: Selection; children: ReactNode; quoi?: string }) {
  if (!s.choisis.size) return null
  const n = s.choisis.size
  return (
    <Box role="toolbar" aria-label="Actions sur la sélection" className="pas-a-l-impression"
      sx={{ position: 'sticky', bottom: { xs: 'calc(72px + env(safe-area-inset-bottom, 0px))', md: 16 }, zIndex: 6, mt: 2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, px: 2, py: 1,
        bgcolor: 'text.primary', color: 'background.paper', borderRadius: 2, boxShadow: 6,
        '& .MuiButton-root': { color: 'inherit', borderColor: 'rgba(255,255,255,0.4)', minHeight: { xs: 48, md: 40 } } }}>
      <Typography sx={{ fontWeight: 700, mr: 1 }}>{`${n} ${quoi}${n > 1 ? 's' : ''}`}</Typography>
      {children}
      <Button onClick={s.vider} sx={{ ml: 'auto', opacity: 0.8 }}>Désélectionner</Button>
    </Box>
  )
}
