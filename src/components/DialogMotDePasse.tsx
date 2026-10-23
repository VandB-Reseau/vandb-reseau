import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { supabase } from '../lib/supabase'

const LONGUEUR_MINI = 8

// premiere : compte créé depuis l'app avec un mot de passe provisoire, à remplacer avant d'aller plus loin
export function DialogMotDePasse({ onFermer, premiere }: { onFermer: (message?: string) => void; premiere?: boolean }) {
  const pleinEcran = useMediaQuery(useTheme().breakpoints.down('sm'))
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const tropCourt = nouveau.length > 0 && nouveau.length < LONGUEUR_MINI
  const different = confirmation.length > 0 && confirmation !== nouveau
  const valide = nouveau.length >= LONGUEUR_MINI && confirmation === nouveau
  const enregistrer = async () => {
    setEnvoi(true)
    setErreur('')
    try {
      const { error } = await supabase.auth.updateUser(premiere ? { password: nouveau, data: { mot_de_passe_provisoire: false } } : { password: nouveau })
      if (error) setErreur(/different|same/i.test(error.message) ? 'Choisis un mot de passe différent de l’actuel.' : 'Changement impossible pour le moment. Réessaie dans un instant.')
      else onFermer('Mot de passe changé.')
    } catch {
      setErreur('Pas de connexion internet. Réessaie dans un instant.')
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <Dialog open onClose={premiere ? undefined : () => onFermer()} fullScreen={pleinEcran} fullWidth maxWidth="xs" aria-labelledby="titre-mot-de-passe">
      <DialogTitle id="titre-mot-de-passe">{premiere ? 'Choisis ton mot de passe' : 'Changer mon mot de passe'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <TextField label="Nouveau mot de passe" type="password" autoComplete="new-password" value={nouveau} onChange={(e) => setNouveau(e.target.value)}
          error={tropCourt} helperText={tropCourt ? `${LONGUEUR_MINI} caractères au moins` : ' '} autoFocus />
        <TextField label="Confirmer le mot de passe" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)}
          error={different} helperText={different ? 'Les deux mots de passe ne sont pas identiques' : ' '} />
        {erreur && <Alert severity="error">{erreur}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {!premiere && <Button onClick={() => onFermer()} sx={{ minHeight: 48 }}>Annuler</Button>}
        <Button variant="contained" disabled={!valide || envoi} onClick={enregistrer} sx={{ minHeight: 48 }}>Enregistrer</Button>
      </DialogActions>
    </Dialog>
  )
}
