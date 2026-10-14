import { memo, useCallback, useRef, useState } from 'react'
import Chip from '@mui/material/Chip'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { enregistrerDeploiements, enregistrerEvaluations } from '../data/chargement'
import { caseDe, couleurTon, libelleNote, type CaseNineBox, type Evaluation, type IdCritere, type Note, type Thematique } from '../data/sante'
import type { Reseau } from '../data/modele'
import { messageErreur } from './EditionEquipe'

// Saisies affichées tout de suite, gardées dans le réseau chargé (elles restent en changeant de page),
// puis regroupées et enregistrées en une seule écriture après une courte pause
const DELAI = 800
let evalsEnAttente: Record<string, { e: Evaluation; caseId: string | null }> = {}
let depsEnAttente: { magasin: string; thematique: string; etat: string }[] = []
let minuteur: ReturnType<typeof setTimeout> | undefined
let signalerDernier: (m: string) => void = () => {}

async function vider() {
  minuteur = undefined
  const ev = evalsEnAttente, dp = depsEnAttente
  evalsEnAttente = {}; depsEnAttente = []
  const n = Object.keys(ev).length + dp.length
  if (!n) return
  try {
    if (Object.keys(ev).length) await enregistrerEvaluations(ev)
    if (dp.length) await enregistrerDeploiements(dp)
    signalerDernier(n > 1 ? `${n} modifications enregistrées` : 'Modification enregistrée')
  } catch (err) { signalerDernier(messageErreur(err)) }
}
function planifier() {
  if (minuteur) clearTimeout(minuteur)
  minuteur = setTimeout(vider, DELAI)
}
// Si on quitte la page avant la fin de la pause, on enregistre quand même
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { if (minuteur) { clearTimeout(minuteur); vider() } })

export interface Saisie {
  noter: (magasins: string[], critere: IdCritere, note: Note | null) => void
  deployer: (magasins: string[], thematique: string, valeur: string | null) => void
}

// Fonctions stables (même référence à chaque rendu) pour que seules les lignes modifiées se redessinent
export function useSaisieSante(reseau: Reseau, signaler: (m: string) => void): Saisie & { version: number } {
  const [version, setVersion] = useState(0)
  const ref = useRef(reseau)
  ref.current = reseau
  signalerDernier = signaler
  const noter = useCallback((magasins: string[], critere: IdCritere, note: Note | null) => {
    const r = ref.current
    for (const magasin of magasins) {
      const notes = { ...(r.evaluations[magasin]?.notes ?? {}) }
      if (note !== null) notes[critere] = note
      else delete notes[critere]
      const e: Evaluation = { notes, date: r.jour, par: r.directeur.nom }
      r.evaluations[magasin] = { ...r.evaluations[magasin], ...e }
      evalsEnAttente[magasin] = { e, caseId: caseDe(e)?.id ?? null }
    }
    setVersion((v) => v + 1)
    planifier()
  }, [])
  const deployer = useCallback((magasins: string[], t: string, valeur: string | null) => {
    const r = ref.current
    for (const magasin of magasins) {
      const v = { ...(r.deploiements.valeurs[magasin] ?? {}) }
      if (valeur) v[t] = valeur
      else delete v[t]
      r.deploiements.valeurs[magasin] = v
      depsEnAttente = [...depsEnAttente.filter((x) => !(x.magasin === magasin && x.thematique === t)), { magasin, thematique: t, etat: valeur ?? '' }]
    }
    setVersion((x) => x + 1)
    planifier()
  }, [])
  return { noter, deployer, version }
}

const couleurNote: Record<Note, 'error' | 'warning' | 'success' | 'info'> = { 0: 'info', 1: 'error', 2: 'warning', 3: 'success' }

const styleGroupe = (compact?: boolean) => ({
  flexWrap: 'nowrap' as const,
  '& .MuiToggleButton-root': {
    minHeight: { xs: 48, md: compact ? 36 : 44 }, px: compact ? 1 : 1.5, py: 0, fontSize: 13, textTransform: 'none', lineHeight: 1.2, whiteSpace: 'nowrap',
    transition: 'none',
  },
})

// Un clic suffit ; recliquer sur la note choisie l'efface
export const BoutonsNote = memo(function BoutonsNote({ libelle, valeur, onChange, compact }: { libelle: string; valeur: Note | undefined; onChange: (n: Note | null) => void; compact?: boolean }) {
  return (
    <ToggleButtonGroup exclusive size="small" value={valeur ?? null} onChange={(_e, v) => onChange(v ?? null)} aria-label={libelle} sx={styleGroupe(compact)}>
      {([1, 2, 3, 0] as Note[]).map((n) => (
        <ToggleButton key={n} value={n} aria-label={`${libelleNote[n]} : ${libelle}`}
          sx={{ '&.Mui-selected, &.Mui-selected:hover': { bgcolor: `${couleurNote[n]}.main`, color: `${couleurNote[n]}.contrastText`, fontWeight: 700 } }}>
          {n === 0 && compact ? 'N/C' : libelleNote[n]}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
})

export const BoutonsOption = memo(function BoutonsOption({ t, libelle, valeur, onChange, compact }: { t: Thematique; libelle: string; valeur: string; onChange: (v: string | null) => void; compact?: boolean }) {
  return (
    <ToggleButtonGroup exclusive size="small" value={valeur || null} onChange={(_e, v) => onChange(v ?? null)} aria-label={libelle} sx={styleGroupe(compact)}>
      {t.options.map((o) => (
        <ToggleButton key={o.libelle} value={o.libelle} aria-label={`${o.libelle} : ${libelle}`}
          sx={{ '&.Mui-selected, &.Mui-selected:hover': { bgcolor: `${couleurTon[o.ton]}.main`, color: `${couleurTon[o.ton]}.contrastText`, fontWeight: 700 } }}>
          {o.libelle}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
})

export const texteSur = (couleur: string) => (['#f6c544', '#8bc34a'].includes(couleur) ? '#1d1d1b' : '#fff')

export function PastilleCase({ c }: { c: CaseNineBox | null }) {
  if (!c) return <Chip label="Non classé" variant="outlined" sx={{ fontSize: 12 }} />
  return <Chip label={c.libelle} sx={{ bgcolor: c.couleur, color: texteSur(c.couleur), fontWeight: 600, fontSize: 12 }} />
}

// Une couleur par Coach, stable d'un écran à l'autre (ordre alphabétique)
const PALETTE = ['#1b6fce', '#c2185b', '#0f766e', '#7c3aed', '#b45309', '#0891b2', '#4d7c0f', '#be123c', '#4338ca', '#a16207', '#047857', '#9333ea']
export function couleursCoachs(coachs: string[]): Map<string, string> {
  return new Map([...new Set(coachs)].sort((a, b) => a.localeCompare(b, 'fr')).map((c, i) => [c, PALETTE[i % PALETTE.length]]))
}
