import { memo, useCallback, useRef, useState } from 'react'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import TrendingUp from '@mui/icons-material/TrendingUp'
import TrendingDown from '@mui/icons-material/TrendingDown'
import TrendingFlat from '@mui/icons-material/TrendingFlat'
import { dateCourte } from '../lib/format'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { enregistrerDeploiements, enregistrerEvaluations } from '../data/chargement'
import { avecPoint, notesAu, couleurTon, criteresAxe, libelleAxe, libelleNote, type Axe, type CritereGrille, type CaseNineBox, type Evaluation, type Tendance, type IdCritere, type Note, type Thematique } from '../data/sante'
import type { Reseau } from '../data/modele'
import { messageErreur } from './EditionEquipe'

// Saisies affichées tout de suite, gardées dans le réseau chargé (elles restent en changeant de page),
// puis regroupées et enregistrées en une seule écriture après une courte pause
const DELAI = 800
// Clé : magasin et date (on peut noter à une date choisie)
let evalsEnAttente: Record<string, { magasin: string; e: Evaluation }> = {}
let depsEnAttente: { magasin: string; thematique: string; etat: string; date: string }[] = []
let minuteur: ReturnType<typeof setTimeout> | undefined
let signalerDernier: (m: string) => void = () => {}

async function vider() {
  minuteur = undefined
  const ev = evalsEnAttente, dp = depsEnAttente
  evalsEnAttente = {}; depsEnAttente = []
  const n = Object.keys(ev).length + dp.length
  if (!n) return
  try {
    if (Object.keys(ev).length) await enregistrerEvaluations(Object.values(ev))
    if (dp.length) await enregistrerDeploiements(dp, '')
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
export function useSaisieSante(reseau: Reseau, signaler: (m: string) => void, date = reseau.jour): Saisie & { version: number } {
  const [version, setVersion] = useState(0)
  const ref = useRef(reseau)
  ref.current = reseau
  const refDate = useRef(date)
  refDate.current = date
  signalerDernier = signaler
  const noter = useCallback((magasins: string[], critere: IdCritere, note: Note | null) => {
    const r = ref.current, date = refDate.current
    for (const magasin of magasins) {
      const notes = notesAu(r.evaluations[magasin], date)
      if (note !== null) notes[critere] = note
      else delete notes[critere]
      const e: Evaluation = { notes, date, par: r.directeur.nom }
      r.evaluations[magasin] = avecPoint(r.evaluations[magasin], e)
      evalsEnAttente[`${magasin}|${date}`] = { magasin, e }
    }
    setVersion((v) => v + 1)
    planifier()
  }, [])
  const deployer = useCallback((magasins: string[], t: string, valeur: string | null) => {
    const r = ref.current, date = refDate.current
    for (const magasin of magasins) {
      const j = r.deploiements.journal ?? (r.deploiements.journal = {})
      j[magasin] = [...(j[magasin] ?? []).filter((c) => !(c.date === date && c.thematique === t)), { date, thematique: t, etat: valeur ?? '' }].sort((a, b) => a.date.localeCompare(b.date))
      // L'état affiché reste le plus récent
      if (!j[magasin].some((c) => c.thematique === t && c.date > date)) {
        const v = { ...(r.deploiements.valeurs[magasin] ?? {}) }
        if (valeur) v[t] = valeur
        else delete v[t]
        r.deploiements.valeurs[magasin] = v
      }
      depsEnAttente = [...depsEnAttente.filter((x) => !(x.magasin === magasin && x.thematique === t && x.date === date)), { magasin, thematique: t, etat: valeur ?? '', date }]
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

// Sens d'évolution de la case depuis la case précédente
export function PastilleTendance({ t, court }: { t: Tendance | null; court?: boolean }) {
  if (!t || !t.precedente) return null
  const config = {
    monte: { icone: <TrendingUp />, couleur: 'success' as const, mot: 'En progrès' },
    descend: { icone: <TrendingDown />, couleur: 'error' as const, mot: 'En recul' },
    stable: { icone: <TrendingFlat />, couleur: 'default' as const, mot: 'Changement de case' },
  }[t.sens]
  const label = court ? config.mot : `${config.mot} depuis le ${dateCourte(t.depuis)} · avant : ${t.precedente.libelle}`
  return <Chip size="small" variant="outlined" icon={config.icone} color={config.couleur} label={label} sx={{ fontSize: 12, fontWeight: 600 }} />
}

// Libellé d'un critère, avec sa définition en info-bulle quand elle existe
export function LibelleCritere({ c, gras }: { c: CritereGrille; gras?: boolean }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
      <Typography component="span" variant="body2" sx={{ fontWeight: gras ? 600 : 500 }}>{c.libelle}</Typography>
      {c.definition && (
        <Tooltip title={c.definition} enterTouchDelay={0} leaveTouchDelay={4000}>
          <IconButton aria-label={`${c.libelle} : ${c.definition}`} sx={{ width: 48, height: 48, my: -1.5 }}><InfoOutlined sx={{ fontSize: 18 }} /></IconButton>
        </Tooltip>
      )}
    </Box>
  )
}

// Saisie des notes rangée par axe (Résultats, puis Franchisé ou Responsable du magasin)
export function NotesParAxe({ integre, notes, noter, libelleMagasin, colonnes = 2 }: { integre: boolean; notes: Partial<Record<IdCritere, Note>> | undefined; noter: (id: IdCritere, n: Note | null) => void; libelleMagasin?: string; colonnes?: 1 | 2 }) {
  return (
    <>
      {(['resultats', 'franchise'] as Axe[]).map((axe) => (
        <Box key={axe} sx={{ mb: 2 }}>
          <Typography variant="overline" component="h3" color="text.secondary" sx={{ fontSize: 13, display: 'block', mb: 0.5 }}>{libelleAxe(axe, integre)}</Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: colonnes === 2 ? '1fr 1fr' : '1fr' } }}>
            {criteresAxe(axe).map((c) => (
              <Box key={c.id}>
                <Box sx={{ mb: 0.5, minHeight: 24 }}><LibelleCritere c={c} gras /></Box>
                <BoutonsNote libelle={libelleMagasin ? `${c.libelle} de ${libelleMagasin}` : c.libelle} valeur={notes?.[c.id]} onChange={(n) => noter(c.id, n)} />
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </>
  )
}
