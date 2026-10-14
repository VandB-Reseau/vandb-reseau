import { useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import CheckCircle from '@mui/icons-material/CheckCircle'
import { coachA, suggererCoachs } from '../data/charge'
import { reaffecter } from '../data/chargement'
import { useReseau } from '../data/ReseauContext'
import type { Magasin, Reseau } from '../data/modele'
import { PastilleCharge } from './Charge'

export function ReaffecterDialog({ reseau, magasin, ouvert, onFermer }: { reseau: Reseau; magasin: Magasin; ouvert: boolean; onFermer: (fait?: string) => void }) {
  const theme = useTheme()
  const pleinEcran = useMediaQuery(theme.breakpoints.down('sm'))
  const { recharger } = useReseau()
  const [date, setDate] = useState(reseau.jour)
  const [choisi, setChoisi] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(false)
  const dateValide = /^\d{4}-\d{2}-\d{2}$/.test(date)
  const suggestions = useMemo(() => (dateValide ? suggererCoachs(reseau, magasin, date) : []), [reseau, magasin, date, dateValide])
  const actuel = dateValide ? coachA(magasin, date) : magasin.coach

  const valider = async () => {
    if (!choisi) return
    setEnvoi(true)
    setErreur(false)
    try {
      await reaffecter(magasin.nom, choisi, date, note.trim() || 'Réaffectation')
      await recharger()
      onFermer(choisi)
    } catch {
      setErreur(true)
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <Dialog open={ouvert} onClose={() => onFermer()} fullScreen={pleinEcran} fullWidth maxWidth="sm" aria-labelledby="titre-reaffecter">
      <DialogTitle id="titre-reaffecter">Réaffecter {magasin.nom}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Coach {date === reseau.jour ? 'actuel' : 'à cette date'} : <strong>{actuel || 'aucun'}</strong>. Les Coachs proposés sont classés du plus proche au plus éloigné, ceux qui dépasseraient la charge maximale en dernier.
        </Typography>
        <TextField type="date" label="À partir du" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ mb: 2 }} fullWidth />
        <List aria-label="Coachs proposés" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, py: 0, maxHeight: 340, overflow: 'auto' }}>
          {suggestions.map((s, i) => (
            <ListItemButton key={s.coach.nom} selected={choisi === s.coach.nom} onClick={() => setChoisi(s.coach.nom)} sx={{ minHeight: 64, borderRadius: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
              <ListItemText
                primary={<Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  {s.coach.nom}
                  {i === 0 && !s.depasse && <Chip size="small" color="primary" label="Suggéré" sx={{ fontSize: '0.75rem' }} />}
                  {s.coach.fictif && <Chip size="small" variant="outlined" label="Poste à pourvoir" sx={{ fontSize: '0.75rem' }} />}
                </Box>}
                secondary={[s.distance !== null ? `${Math.round(s.distance)} km` : 'Distance inconnue', s.coach.rr?.nom, `charge après : ${s.chargeApres} / ${reseau.parametres.maxUnits}${s.depasse ? ', dépassement' : ''}`].filter(Boolean).join(' · ')}
              />
              <PastilleCharge reseau={reseau} charge={s.chargeAvant} />
              {choisi === s.coach.nom && <CheckCircle color="primary" sx={{ ml: 1 }} />}
            </ListItemButton>
          ))}
        </List>
        <TextField label="Note (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Par exemple : rééquilibrage de charge" fullWidth sx={{ mt: 2 }} />
        {erreur && <Alert severity="error" sx={{ mt: 2 }}>La réaffectation n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => onFermer()} sx={{ minHeight: 48 }}>Annuler</Button>
        <Button variant="contained" disabled={!choisi || !dateValide || envoi} onClick={valider} sx={{ minHeight: 48 }}>
          {envoi ? 'Enregistrement…' : choisi ? `Confier à ${choisi}` : 'Choisis un Coach'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
