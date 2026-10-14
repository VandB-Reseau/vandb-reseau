import { useState } from 'react'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import { enregistrerDeploiements, enregistrerEvaluations } from '../data/chargement'
import { caseDe, couleurTon, libelleNote, tonDe, type CaseNineBox, type Evaluation, type IdCritere, type Note, type Thematique } from '../data/sante'
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

export function useSaisieSante(reseau: Reseau, signaler: (m: string) => void) {
  const [, setVersion] = useState(0)
  signalerDernier = signaler
  const evaluation = (magasin: string): Evaluation | undefined => reseau.evaluations[magasin]
  const etat = (magasin: string, t: string): string => reseau.deploiements.valeurs[magasin]?.[t] ?? ''
  const noter = (magasin: string, critere: IdCritere, note: Note | '') => {
    const notes = { ...(reseau.evaluations[magasin]?.notes ?? {}) }
    if (note) notes[critere] = note
    else delete notes[critere]
    const e: Evaluation = { notes, date: reseau.jour, par: reseau.directeur.nom }
    reseau.evaluations[magasin] = { ...reseau.evaluations[magasin], ...e }
    evalsEnAttente[magasin] = { e, caseId: caseDe(e)?.id ?? null }
    setVersion((v) => v + 1)
    planifier()
  }
  const deployer = (magasin: string, t: string, valeur: string) => {
    const v = { ...(reseau.deploiements.valeurs[magasin] ?? {}) }
    if (valeur) v[t] = valeur
    else delete v[t]
    reseau.deploiements.valeurs[magasin] = v
    depsEnAttente = [...depsEnAttente.filter((x) => !(x.magasin === magasin && x.thematique === t)), { magasin, thematique: t, etat: valeur }]
    setVersion((x) => x + 1)
    planifier()
  }
  return { evaluation, etat, noter, deployer }
}

export function SelectNote({ libelle, valeur, onChange, compact }: { libelle: string; valeur: Note | undefined; onChange: (n: Note | '') => void; compact?: boolean }) {
  return (
    <TextField select size={compact ? 'small' : 'medium'} label={compact ? undefined : libelle} value={valeur ?? ''} onChange={(e) => onChange(e.target.value ? (Number(e.target.value) as Note) : '')}
      slotProps={{ select: { displayEmpty: true, SelectDisplayProps: { 'aria-label': libelle } as object }, inputLabel: { shrink: true } }} sx={{ minWidth: compact ? 110 : 200, '& .MuiInputBase-root': { minHeight: 48 } }}>
      <MenuItem value="">Non noté</MenuItem>
      {([3, 2, 1] as Note[]).map((n) => <MenuItem key={n} value={n}>{libelleNote[n]}</MenuItem>)}
    </TextField>
  )
}

export function SelectDeploiement({ t, valeur, onChange, libelle, compact }: { t: Thematique; valeur: string; onChange: (v: string) => void; libelle: string; compact?: boolean }) {
  const ton = tonDe(t, valeur)
  return (
    <TextField select size={compact ? 'small' : 'medium'} label={compact ? undefined : t.libelle} value={t.options.some((o) => o.libelle === valeur) ? valeur : ''} onChange={(e) => onChange(e.target.value)}
      slotProps={{ select: { displayEmpty: true, SelectDisplayProps: { 'aria-label': libelle } as object }, inputLabel: { shrink: true } }}
      sx={{ minWidth: compact ? 130 : 200, '& .MuiInputBase-root': { minHeight: 48, bgcolor: ton ? `${couleurTon[ton]}.light` : undefined, color: ton ? `${couleurTon[ton]}.contrastText` : undefined } }}>
      <MenuItem value="">Non renseigné</MenuItem>
      {t.options.map((o) => <MenuItem key={o.libelle} value={o.libelle}>{o.libelle}</MenuItem>)}
    </TextField>
  )
}

export function PastilleCase({ c }: { c: CaseNineBox | null }) {
  if (!c) return <Chip label="Non classé" variant="outlined" sx={{ fontSize: 12 }} />
  return <Chip label={c.libelle} sx={{ bgcolor: c.couleur, color: ['#f6c544', '#8bc34a'].includes(c.couleur) ? '#1d1d1b' : '#fff', fontWeight: 600, fontSize: 12 }} />
}
