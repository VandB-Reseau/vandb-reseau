import { useCallback, useState } from 'react'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'

// « Enregistré · Annuler » (refonte vague 2, Joseph 09/11/2026, 17A) : un geste enregistré tout de suite se défait
// pendant 5 secondes depuis le bandeau, au lieu d'une fenêtre « Êtes-vous sûr ? » avant.
export interface MessageAnnulable { texte: string; annuler?: () => void }
export function useMessageAnnulable() {
  const [message, setMessage] = useState<MessageAnnulable | null>(null)
  const signaler = useCallback((texte: string, annuler?: () => void) => setMessage(texte ? { texte, annuler } : null), [])
  const bandeau = (
    <Snackbar open={!!message} autoHideDuration={5000} onClose={(_e, raison) => { if (raison !== 'clickaway') setMessage(null) }} message={message?.texte}
      action={message?.annuler ? <Button color="secondary" onClick={() => { const a = message.annuler; setMessage(null); a?.() }} sx={{ minHeight: 48, fontWeight: 700 }}>Annuler</Button> : undefined} />
  )
  return { signaler, bandeau }
}
