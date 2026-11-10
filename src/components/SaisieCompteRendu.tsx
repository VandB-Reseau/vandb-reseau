import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import MicOutlined from '@mui/icons-material/MicOutlined'
import StopCircleOutlined from '@mui/icons-material/StopCircleOutlined'
import MenuItem from '@mui/material/MenuItem'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { PARTIES } from '../data/compteRendu'
import { actionsEnCours, echeanceDate, enRetard, type ActionSuivie } from '../data/actions'
import type { ActionPlan, Reseau, Visite } from '../data/modele'
import { dateCourte } from '../lib/format'
import { ChampPorteur } from './Actions'
import { useDictee } from '../lib/dictee'
import type { RevueTache } from '../data/chargement'
import { prioritesActives, type Priorite, type StatutPriorite } from '../data/planAction'
import type { Sujet } from '../data/ordreDuJour'

// Champ texte avec micro : le texte dicté s'ajoute à la fin
export function ChampDicte({ libelle, valeur, changer, minRows = 2 }: { libelle: string; valeur: string; changer: (f: (v: string) => string) => void; minRows?: number }) {
  const dictee = useDictee((t) => changer((v) => (v.trim() ? `${v.trimEnd()} ${t}` : t)))
  return (
    <Box>
      <TextField
        fullWidth label={libelle} value={valeur} onChange={(e) => changer(() => e.target.value)} multiline minRows={minRows}
        slotProps={{ input: { endAdornment: dictee.disponible ? (
          <InputAdornment position="end" sx={{ alignSelf: 'flex-start', mt: 1 }}>
            <IconButton aria-label={dictee.actif ? `Arrêter la dictée : ${libelle}` : `Dicter : ${libelle}`} onClick={dictee.basculer} color={dictee.actif ? 'error' : 'default'} sx={{ width: 48, height: 48 }}>
              {dictee.actif ? <StopCircleOutlined /> : <MicOutlined />}
            </IconButton>
          </InputAdornment>
        ) : undefined } }}
      />
      {dictee.erreur && <Alert severity="warning" sx={{ mt: 1 }}>{dictee.erreur}</Alert>}
    </Box>
  )
}

// ── Saisie d'une visite (vague 7, Joseph 10/11/2026, 83A, 86A, 87A) : ordre du jour, plan d'action revu, constats ──

export type RevuesTaches = Record<string, RevueTache>
export interface RevuePriorite { statut: StatutPriorite; bilan: string }
export type RevuesPriorites = Record<string, RevuePriorite>
export type EtatSujet = 'traite' | 'reporte'

// Ordre du jour préparé : chaque sujet est traité (d'office) ou reporté à la prochaine visite
export function OrdreDuJourSaisie({ sujets, etats, setEtats }: { sujets: Sujet[]; etats: Record<string, EtatSujet>; setEtats: (f: (x: Record<string, EtatSujet>) => Record<string, EtatSujet>) => void }) {
  return (
    <Box component="ul" aria-label="Sujets de l’ordre du jour" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {sujets.map((s) => (
        <Box component="li" key={s.id} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{s.titre}</Typography>
            {s.detail && <Typography variant="body2" color="text.secondary">{s.detail}</Typography>}
          </Box>
          <ToggleButtonGroup exclusive size="small" value={etats[s.id] ?? 'traite'} onChange={(_e, v) => v && setEtats((x) => ({ ...x, [s.id]: v }))} aria-label={`Sujet : ${s.titre}`}>
            <ToggleButton value="traite" sx={{ minHeight: 48, px: 2 }}>Traité</ToggleButton>
            <ToggleButton value="reporte" sx={{ minHeight: 48, px: 2 }}>Reporté</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      ))}
    </Box>
  )
}

const STATUTS_REVUE: { v: RevueTache['statut']; libelle: string }[] = [
  { v: 'a_faire', libelle: 'À faire' }, { v: 'en_cours', libelle: 'En cours' }, { v: 'bloquee', libelle: 'Bloquée' }, { v: 'reportee', libelle: 'Reportée' }, { v: 'faite', libelle: 'Faite' },
]
const statutDe = (x: ActionSuivie): RevueTache['statut'] => (x.a.statut === 'en_cours' || x.a.statut === 'bloquee' ? x.a.statut : 'a_faire')

// Une tâche ouverte, revue sur place : où en est-on ?
function TacheRevue({ reseau, x, revue, changer }: { reseau: Reseau; x: ActionSuivie; revue: RevueTache | undefined; changer: (r: RevueTache | undefined) => void }) {
  const statut = revue?.statut ?? statutDe(x)
  const retard = enRetard(x.a, reseau.jour)
  const poser = (r: RevueTache) => changer(r.statut === statutDe(x) && r.statut !== 'bloquee' ? undefined : r)
  return (
    <Box component="li" sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) 170px' }, alignItems: 'start', py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere', textDecoration: statut === 'faite' ? 'line-through' : undefined }}>{x.a.action}</Typography>
        <Typography variant="body2" color={retard ? 'error' : 'text.secondary'}>
          {[x.a.porteur, x.a.echeance && `échéance ${echeanceDate(x.a) ? dateCourte(x.a.echeance) : x.a.echeance}`, x.date && `depuis le ${dateCourte(x.date)}`].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
      <TextField select size="small" label="Où en est-on ?" value={statut} onChange={(e) => poser({ statut: e.target.value as RevueTache['statut'], raison: revue?.raison ?? x.a.raison ?? '', echeance: revue?.echeance ?? '' })}
        sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}>
        {STATUTS_REVUE.map((s) => <MenuItem key={s.v} value={s.v} sx={{ minHeight: 48 }}>{s.libelle}</MenuItem>)}
      </TextField>
      {statut === 'bloquee' && <TextField size="small" label="Ce qui bloque" value={revue?.raison ?? x.a.raison ?? ''} onChange={(e) => changer({ statut: 'bloquee', raison: e.target.value })} sx={{ gridColumn: '1 / -1' }} />}
      {statut === 'reportee' && <TextField size="small" type="date" label="Nouvelle échéance" value={revue?.echeance ?? ''} onChange={(e) => changer({ statut: 'reportee', echeance: e.target.value })}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: reseau.jour } }} sx={{ gridColumn: '1 / -1', maxWidth: 260 }} />}
    </Box>
  )
}

// Ligne d'une nouvelle tâche décidée pendant la visite (mêmes champs que la fenêtre de tâche, la priorité comprise)
function LigneNouvelleTache({ reseau, magasin, a, rang, priorites, changer, retirer }: { reseau: Reseau; magasin: string; a: ActionPlan; rang: number; priorites: Priorite[]; changer: (cle: keyof ActionPlan, v: string) => void; retirer: () => void }) {
  return (
    <Box sx={{ display: 'grid', gap: 1, mb: 1.5, alignItems: 'start', gridTemplateColumns: { xs: '1fr 1fr 48px', sm: priorites.length ? '2fr 2fr 160px 170px 48px' : '2fr 2fr 170px 48px' } }}>
      <TextField label="Tâche" value={a.action} onChange={(e) => changer('action', e.target.value)} sx={{ gridColumn: { xs: '1 / 3', sm: 'auto' } }} />
      <ChampPorteur reseau={reseau} magasin={magasin} valeur={a.porteur} changer={(v) => changer('porteur', v)} sx={{ gridRow: { xs: 2, sm: 'auto' }, minWidth: 0 }} />
      {priorites.length > 0 && (
        <TextField select label="Priorité" value={priorites.some((p) => p.id === a.priorite) ? a.priorite : ''} onChange={(e) => changer('priorite', e.target.value)}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ gridRow: { xs: 3, sm: 'auto' }, gridColumn: { xs: '1 / 3', sm: 'auto' } }}>
          <MenuItem value="" sx={{ minHeight: 48 }}>Aucune</MenuItem>
          {priorites.map((p) => <MenuItem key={p.id} value={p.id} sx={{ minHeight: 48 }}>{p.titre}</MenuItem>)}
        </TextField>
      )}
      <TextField label="Échéance" type={!a.echeance || echeanceDate(a) ? 'date' : 'text'} value={a.echeance} onChange={(e) => changer('echeance', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ gridRow: { xs: 2, sm: 'auto' } }} />
      <IconButton aria-label={`Retirer la tâche ${rang}`} onClick={retirer} sx={{ gridColumn: { xs: 3, sm: 'auto' }, gridRow: { xs: '1', sm: 'auto' }, mt: 0.5 }}><CloseOutlined /></IconButton>
    </Box>
  )
}

const LIBELLES_PRIORITE: { v: StatutPriorite; libelle: string }[] = [{ v: 'active', libelle: 'Toujours d’actualité' }, { v: 'atteinte', libelle: 'Atteinte' }, { v: 'abandonnee', libelle: 'Abandonnée' }]

// Plan d'action revu pendant la visite : chaque priorité en cours avec ses tâches, puis les autres tâches ; nouvelles tâches
export function RevuePlan({ reseau, visite, magasin, plan, setPlan, revues, setRevues, priorites: revuesP, setPriorites }: {
  reseau: Reseau; visite: Visite | null; magasin: string
  plan: ActionPlan[]; setPlan: (f: (p: ActionPlan[]) => ActionPlan[]) => void
  revues: RevuesTaches; setRevues: (f: (x: RevuesTaches) => RevuesTaches) => void
  priorites: RevuesPriorites; setPriorites: (f: (x: RevuesPriorites) => RevuesPriorites) => void
}) {
  const actives = prioritesActives(reseau, magasin)
  const ouvertes = actionsEnCours(reseau, new Set([magasin])).filter((x) => !x.visite || x.visite.id !== (visite?.id ?? null))
  const changerRevue = (cle: string) => (r: RevueTache | undefined) => setRevues((x) => { const n = { ...x }; if (r) n[cle] = r; else delete n[cle]; return n })
  const ligne = (a: ActionPlan, i: number) => (
    <LigneNouvelleTache key={i} reseau={reseau} magasin={magasin} a={a} rang={i + 1} priorites={actives}
      changer={(cle, v) => setPlan((p) => p.map((x, j) => (j === i ? { ...x, [cle]: v } : x)))} retirer={() => setPlan((p) => p.filter((_x, j) => j !== i))} />
  )
  const ajouter = (priorite: string) => setPlan((p) => [...p, { action: '', porteur: '', echeance: '', ...(priorite ? { priorite } : {}) }])
  const sansPriorite = (a: { priorite?: string }) => !a.priorite || !actives.some((p) => p.id === a.priorite)
  const groupe = (titre: string, taches: ActionSuivie[], nouvelles: [ActionPlan, number][], priorite: string) => (
    <>
      {taches.length > 0 && <Box component="ul" aria-label={`Tâches en cours · ${titre}`} sx={{ listStyle: 'none', m: 0, p: 0 }}>{taches.map((x) => <TacheRevue key={x.cle} reseau={reseau} x={x} revue={revues[x.cle]} changer={changerRevue(x.cle)} />)}</Box>}
      {nouvelles.length > 0 && <Box sx={{ mt: 1.5 }}>{nouvelles.map(([a, i]) => ligne(a, i))}</Box>}
      <Button startIcon={<AddOutlined />} onClick={() => ajouter(priorite)} sx={{ minHeight: 48 }} aria-label={priorite ? `Ajouter une tâche à la priorité ${titre}` : 'Ajouter une tâche'}>Ajouter une tâche</Button>
    </>
  )
  const indexes = plan.map((a, i) => [a, i] as [ActionPlan, number])
  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {actives.map((p, rang) => {
        const r = revuesP[p.id] ?? { statut: 'active' as StatutPriorite, bilan: '' }
        return (
          <Box key={p.id} component="section" aria-label={`Priorité ${rang + 1} : ${p.titre}`} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
              <Box aria-hidden sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'text.primary', color: 'background.paper', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13 }}>{rang + 1}</Box>
              <Typography component="h4" sx={{ fontWeight: 700, flex: 1, minWidth: 160 }}>{p.titre}</Typography>
              <ToggleButtonGroup exclusive size="small" value={r.statut} onChange={(_e, v) => v && setPriorites((x) => ({ ...x, [p.id]: { ...r, statut: v } }))} aria-label={`Statut de la priorité ${p.titre}`} sx={{ flexWrap: 'wrap' }}>
                {LIBELLES_PRIORITE.map((s) => <ToggleButton key={s.v} value={s.v} sx={{ minHeight: 48, px: 1.5 }}>{s.libelle}</ToggleButton>)}
              </ToggleButtonGroup>
            </Box>
            {r.statut !== 'active' && <TextField fullWidth size="small" label="Bilan en une ligne" value={r.bilan} onChange={(e) => setPriorites((x) => ({ ...x, [p.id]: { ...r, bilan: e.target.value } }))} sx={{ mb: 1 }} />}
            {groupe(p.titre, ouvertes.filter((x) => x.a.priorite === p.id), indexes.filter(([a]) => a.priorite === p.id), p.id)}
          </Box>
        )
      })}
      <Box component="section" aria-label={actives.length ? 'Autres tâches' : 'Tâches'}>
        {actives.length > 0 && <Typography component="h4" sx={{ fontWeight: 700, mb: 1 }}>Autres tâches</Typography>}
        {groupe('Autres tâches', ouvertes.filter((x) => sansPriorite(x.a)), indexes.filter(([a]) => sansPriorite(a)), '')}
      </Box>
    </Box>
  )
}

// Constats de la visite : les six parties du compte rendu (et les notes libres des anciennes visites)
export function ConstatsVisite({ tournee, notes, setNotes, parties, setParties }: {
  tournee: boolean; notes: string; setNotes: (f: (n: string) => string) => void; parties: string[]; setParties: (f: (p: string[]) => string[]) => void
}) {
  if (tournee) return <ChampDicte libelle="Notes de visite" valeur={notes} changer={setNotes} minRows={4} />
  return (
    <>
      {PARTIES.map((p, i) => (
        <ChampDicte key={i} libelle={`${i + 1}. ${p.titre}`} valeur={parties[i] ?? ''} changer={(f) => setParties((t) => t.map((x, j) => (j === i ? f(x) : x)))} />
      ))}
      {notes.trim() && <ChampDicte libelle="Notes de visite" valeur={notes} changer={setNotes} />}
    </>
  )
}
