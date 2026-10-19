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
import { PARTIES } from '../data/compteRendu'
import { actionsEnCours, echeanceDate, enRetard } from '../data/actions'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import type { ActionPlan, Reseau, Visite } from '../data/modele'
import { dateCourte } from '../lib/format'
import { useDictee } from '../lib/dictee'

const titre = { mb: 1 } as const

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

export function SaisieCompteRendu({ reseau, visite, tournee, magasin, notes, setNotes, parties, setParties, plan, setPlan, faites, setFaites }: {
  reseau: Reseau; visite: Visite | null; tournee: boolean; magasin: string
  faites: Record<string, boolean>; setFaites: (f: (x: Record<string, boolean>) => Record<string, boolean>) => void
  notes: string; setNotes: (f: (n: string) => string) => void
  parties: string[]; setParties: (f: (p: string[]) => string[]) => void
  plan: ActionPlan[]; setPlan: (f: (p: ActionPlan[]) => ActionPlan[]) => void
}) {
  // Tournée de plusieurs magasins : seules les notes communes sont saisies
  if (tournee) return <ChampDicte libelle="Notes de visite" valeur={notes} changer={setNotes} minRows={4} />
  // Actions encore en cours des visites précédentes : cochées faites, elles sortent du plan du magasin
  const enCours = magasin ? actionsEnCours(reseau, new Set([magasin])).filter((x) => !x.visite || x.visite.id !== (visite?.id ?? null)) : []

  return (
    <>
      {enCours.length > 0 && (
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2 }} role="group" aria-label="Actions en cours">
          <Typography variant="subtitle2" component="h3" sx={titre}>Actions en cours</Typography>
          {enCours.map((x) => (
            <FormControlLabel key={x.cle} sx={{ display: 'flex', alignItems: 'flex-start', mx: 0, minHeight: 48 }}
              control={<Checkbox checked={!!faites[x.cle]} onChange={(e) => setFaites((f) => ({ ...f, [x.cle]: e.target.checked }))} sx={{ width: 48, height: 48, mt: -0.5 }} />}
              label={<Box sx={{ py: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{x.a.action}</Typography>
                <Typography variant="caption" color={enRetard(x.a, reseau.jour) ? 'error' : 'text.secondary'} sx={{ display: 'block' }}>
                  {[x.a.porteur, x.a.echeance && `échéance ${echeanceDate(x.a) ? dateCourte(x.a.echeance) : x.a.echeance}`, x.date && `depuis le ${dateCourte(x.date)}`].filter(Boolean).join(' · ')}
                </Typography>
              </Box>} />
          ))}
        </Box>
      )}
      {PARTIES.map((p, i) => (
        <ChampDicte key={i} libelle={`${i + 1}. ${p.titre}`} valeur={parties[i] ?? ''} changer={(f) => setParties((t) => t.map((x, j) => (j === i ? f(x) : x)))} />
      ))}
      {/* Notes libres des visites saisies avant le découpage en parties */}
      {notes.trim() && <ChampDicte libelle="Notes de visite" valeur={notes} changer={setNotes} />}

      <Box>
        <Typography variant="subtitle2" component="h3" sx={titre}>Plan d’action</Typography>
        {plan.map((a, i) => {
          const changer = (cle: keyof ActionPlan, v: string) => setPlan((p) => p.map((x, j) => (j === i ? { ...x, [cle]: v } : x)))
          return (
            <Box key={i} sx={{ display: 'grid', gap: 1, mb: 1.5, alignItems: 'center', gridTemplateColumns: { xs: '1fr 1fr 48px', sm: '3fr 1.2fr 1fr 48px' } }}>
              <TextField label="Action" value={a.action} onChange={(e) => changer('action', e.target.value)} sx={{ gridColumn: { xs: '1 / 3', sm: 'auto' } }} />
              <TextField label="Porteur" value={a.porteur} onChange={(e) => changer('porteur', e.target.value)} sx={{ gridRow: { xs: 2, sm: 'auto' } }} />
              <TextField label="Échéance" type={!a.echeance || echeanceDate(a) ? 'date' : 'text'} value={a.echeance} onChange={(e) => changer('echeance', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ gridRow: { xs: 2, sm: 'auto' } }} />
              <IconButton aria-label={`Retirer l’action ${i + 1}`} onClick={() => setPlan((p) => p.filter((_x, j) => j !== i))} sx={{ gridColumn: { xs: 3, sm: 'auto' }, gridRow: { xs: '1', sm: 'auto' } }}><CloseOutlined /></IconButton>
            </Box>
          )
        })}
        <Button startIcon={<AddOutlined />} onClick={() => setPlan((p) => [...p, { action: '', porteur: '', echeance: '' }])} sx={{ minHeight: 48 }}>Ajouter une action</Button>
      </Box>
    </>
  )
}
