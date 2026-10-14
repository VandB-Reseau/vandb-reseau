import { useState } from 'react'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import { enregistrerDeploiement, enregistrerEvaluation } from '../data/chargement'
import { caseDe, couleurTon, libelleNote, tonDe, type CaseNineBox, type Evaluation, type IdCritere, type Note, type Thematique } from '../data/sante'
import type { Reseau } from '../data/modele'
import { messageErreur } from './EditionEquipe'

// Garde les saisies à l'écran tout de suite, puis les enregistre dans la base
export function useSaisieSante(reseau: Reseau, signaler: (m: string) => void) {
  const [evals, setEvals] = useState<Record<string, Evaluation>>({})
  const [deps, setDeps] = useState<Record<string, string>>({})
  const evaluation = (magasin: string): Evaluation | undefined => evals[magasin] ?? reseau.evaluations[magasin]
  const etat = (magasin: string, t: string): string => deps[`${magasin}|${t}`] ?? reseau.deploiements.valeurs[magasin]?.[t] ?? ''
  const noter = async (magasin: string, critere: IdCritere, note: Note | '') => {
    const avant = evaluation(magasin)
    const notes = { ...(avant?.notes ?? {}) }
    if (note) notes[critere] = note
    else delete notes[critere]
    const e: Evaluation = { notes, date: reseau.jour, par: reseau.directeur.nom }
    setEvals((x) => ({ ...x, [magasin]: e }))
    try { await enregistrerEvaluation(magasin, e, caseDe(e)?.id ?? null); signaler(`Note enregistrée pour ${magasin}`) } catch (err) { signaler(messageErreur(err)) }
  }
  const deployer = async (magasin: string, t: string, valeur: string) => {
    setDeps((x) => ({ ...x, [`${magasin}|${t}`]: valeur }))
    try { await enregistrerDeploiement(magasin, t, valeur); signaler(`Déploiement enregistré pour ${magasin}`) } catch (err) { signaler(messageErreur(err)) }
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
