import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import MicOutlined from '@mui/icons-material/MicOutlined'
import StopCircleOutlined from '@mui/icons-material/StopCircleOutlined'
import { PARTIES, redigerCompteRendu, visitePrecedenteAvecPlan } from '../data/compteRendu'
import type { ActionPlan, Reseau, Visite } from '../data/modele'
import { dateLongue } from '../lib/format'
import { useDictee } from '../lib/dictee'

const titre = { mb: 1 } as const

export function SaisieCompteRendu({ reseau, visite, magasin, date, notes, setNotes, parties, setParties, plan, setPlan }: {
  reseau: Reseau; visite: Visite | null; magasin: string; date: string
  notes: string; setNotes: (f: (n: string) => string) => void
  parties: string[]; setParties: (p: string[]) => void
  plan: ActionPlan[]; setPlan: (f: (p: ActionPlan[]) => ActionPlan[]) => void
}) {
  const dictee = useDictee((t) => setNotes((n) => (n.trim() ? `${n.trimEnd()} ${t}` : t)))
  const [ouvertes, setOuvertes] = useState<number[]>([])
  const [redaction, setRedaction] = useState(false)
  const [erreur, setErreur] = useState('')
  const precedente = magasin ? visitePrecedenteAvecPlan(reseau.visites, magasin, date, visite?.id ?? null) : null

  const champNotes = (
    <TextField
      label="Notes de visite" value={notes} onChange={(e) => setNotes(() => e.target.value)} multiline minRows={4}
      slotProps={{ input: { endAdornment: dictee.disponible ? (
        <InputAdornment position="end" sx={{ alignSelf: 'flex-start', mt: 1 }}>
          <IconButton aria-label={dictee.actif ? 'Arrêter la dictée' : 'Dicter'} onClick={dictee.basculer} color={dictee.actif ? 'error' : 'default'} sx={{ width: 48, height: 48 }}>
            {dictee.actif ? <StopCircleOutlined /> : <MicOutlined />}
          </IconButton>
        </InputAdornment>
      ) : undefined } }}
    />
  )
  // Tournée de plusieurs magasins : seules les notes communes sont saisies
  if (!magasin) return champNotes

  const visibles = PARTIES.map((_p, i) => i).filter((i) => parties[i]?.trim() || ouvertes.includes(i))
  const cachees = PARTIES.map((_p, i) => i).filter((i) => !visibles.includes(i))
  const changerPartie = (i: number, v: string) => setParties(parties.map((x, j) => (j === i ? v : x)))
  const rediger = async () => {
    setRedaction(true); setErreur('')
    try {
      const r = await redigerCompteRendu({ magasin, notes, parties, planPrecedent: precedente?.plan ?? [] })
      setParties(r.parties)
      if (r.plan.length) setPlan(() => r.plan)
    } catch (e) { setErreur(e instanceof Error ? e.message : 'La rédaction automatique n’a pas abouti.') } finally { setRedaction(false) }
  }

  return (
    <>
      {champNotes}
      {dictee.erreur && <Alert severity="warning">{dictee.erreur}</Alert>}
      <Box>
        <Button
          variant="outlined" startIcon={redaction ? <CircularProgress size={18} /> : <AutoAwesomeOutlined />}
          disabled={!notes.trim() || redaction || dictee.actif} onClick={rediger} sx={{ minHeight: 48 }}
        >{redaction ? 'Rédaction en cours…' : 'Rédiger le compte rendu'}</Button>
      </Box>
      {erreur && <Alert severity="error">{erreur}</Alert>}

      {precedente && (
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2 }}>
          <Typography variant="subtitle2" component="h3" sx={titre}>Plan d’action du {dateLongue(precedente.date)}</Typography>
          <Box component="ul" sx={{ m: 0, pl: 3 }}>
            {precedente.plan.map((a, i) => <li key={i}><Typography variant="body2">{a.action}{a.porteur ? ` · ${a.porteur}` : ''}{a.echeance ? ` · ${a.echeance}` : ''}</Typography></li>)}
          </Box>
        </Box>
      )}

      {visibles.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visibles.map((i) => (
            <TextField key={i} label={`${i + 1}. ${PARTIES[i].titre}`} value={parties[i]} onChange={(e) => changerPartie(i, e.target.value)} multiline minRows={2} />
          ))}
        </Box>
      )}
      {cachees.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }} role="group" aria-label="Parties non abordées">
          {cachees.map((i) => (
            <Button key={i} size="small" startIcon={<AddOutlined />} onClick={() => setOuvertes((o) => [...o, i])} sx={{ minHeight: 48 }}>{PARTIES[i].titre}</Button>
          ))}
        </Box>
      )}

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
