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
import { PARTIES, visitePrecedenteAvecPlan } from '../data/compteRendu'
import type { ActionPlan, Reseau, Visite } from '../data/modele'
import { dateLongue } from '../lib/format'
import { useDictee } from '../lib/dictee'

const titre = { mb: 1 } as const

// Champ texte avec micro : le texte dicté s'ajoute à la fin
function ChampDicte({ libelle, valeur, changer, minRows = 2 }: { libelle: string; valeur: string; changer: (f: (v: string) => string) => void; minRows?: number }) {
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

export function SaisieCompteRendu({ reseau, visite, tournee, magasin, date, notes, setNotes, parties, setParties, plan, setPlan }: {
  reseau: Reseau; visite: Visite | null; tournee: boolean; magasin: string; date: string
  notes: string; setNotes: (f: (n: string) => string) => void
  parties: string[]; setParties: (f: (p: string[]) => string[]) => void
  plan: ActionPlan[]; setPlan: (f: (p: ActionPlan[]) => ActionPlan[]) => void
}) {
  // Tournée de plusieurs magasins : seules les notes communes sont saisies
  if (tournee) return <ChampDicte libelle="Notes de visite" valeur={notes} changer={setNotes} minRows={4} />
  const precedente = magasin && visitePrecedenteAvecPlan(reseau.visites, magasin, date, visite?.id ?? null)

  return (
    <>
      {precedente && (
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2 }}>
          <Typography variant="subtitle2" component="h3" sx={titre}>Plan d’action du {dateLongue(precedente.date)}</Typography>
          <Box component="ul" sx={{ m: 0, pl: 3 }}>
            {precedente.plan.map((a, i) => <li key={i}><Typography variant="body2">{a.action}{a.porteur ? ` · ${a.porteur}` : ''}{a.echeance ? ` · ${a.echeance}` : ''}</Typography></li>)}
          </Box>
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
              <TextField label="Échéance" value={a.echeance} onChange={(e) => changer('echeance', e.target.value)} sx={{ gridRow: { xs: 2, sm: 'auto' } }} />
              <IconButton aria-label={`Retirer l’action ${i + 1}`} onClick={() => setPlan((p) => p.filter((_x, j) => j !== i))} sx={{ gridColumn: { xs: 3, sm: 'auto' }, gridRow: { xs: '1', sm: 'auto' } }}><CloseOutlined /></IconButton>
            </Box>
          )
        })}
        <Button startIcon={<AddOutlined />} onClick={() => setPlan((p) => [...p, { action: '', porteur: '', echeance: '' }])} sx={{ minHeight: 48 }}>Ajouter une action</Button>
      </Box>
    </>
  )
}
