import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { enregistrerFermeture } from '../data/chargement'
import { useReseau } from '../data/ReseauContext'
import { libelleFermeture, type Magasin, type TypeFermeture } from '../data/modele'
import { dateLongue } from '../lib/format'

// Fermeture ou cession hors réseau d'un magasin (Directeur seul) : date, motif court, repreneur pour une cession.
// À la date choisie, le magasin sort des listes, de la carte, du rythme et des repères ; sa fiche reste ouverte.
export function DialogFermeture({ magasin, jour, onFermer }: { magasin: Magasin; jour: string; onFermer: (message?: string) => void }) {
  const pleinEcran = useMediaQuery(useTheme().breakpoints.down('sm'))
  const { recharger } = useReseau()
  const f = magasin.fermeture
  const [type, setType] = useState<TypeFermeture>(f?.type ?? 'fermeture')
  const [date, setDate] = useState(f?.date ?? jour)
  const [motif, setMotif] = useState(f?.motif ?? '')
  const [repreneur, setRepreneur] = useState(f?.repreneur ?? '')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<'' | 'base' | 'echec'>('')
  const dateValide = /^\d{4}-\d{2}-\d{2}$/.test(date)

  const enregistrer = async (retirer: boolean) => {
    setEnvoi(true)
    setErreur('')
    const r = await enregistrerFermeture(magasin.nom, retirer ? null : { date, type, motif: motif.trim(), repreneur: repreneur.trim() })
    if (r !== 'ok') { setErreur(r); setEnvoi(false); return }
    await recharger()
    onFermer(retirer ? `${magasin.nom} est de nouveau dans le réseau.`
      : `${libelleFermeture[type]} de ${magasin.nom} ${date <= jour ? 'enregistrée' : 'prévue'} le ${dateLongue(date)}.`)
  }

  return (
    <Dialog open onClose={() => onFermer()} fullScreen={pleinEcran} fullWidth maxWidth="sm" aria-labelledby="titre-fermeture">
      <DialogTitle id="titre-fermeture">Fermer ou céder {magasin.nom}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <ToggleButtonGroup exclusive value={type} onChange={(_, v) => v && setType(v)} aria-label="Sortie du réseau" fullWidth>
            {(['fermeture', 'cession'] as const).map((t) => <ToggleButton key={t} value={t} sx={{ minHeight: 48 }}>{libelleFermeture[t]}</ToggleButton>)}
          </ToggleButtonGroup>
          <TextField type="date" label={type === 'cession' ? 'Date de la cession' : 'Date de fermeture'} value={date} onChange={(e) => setDate(e.target.value)}
            error={!dateValide} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Motif" value={motif} onChange={(e) => setMotif(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
          {type === 'cession' && <TextField label="Repreneur" value={repreneur} onChange={(e) => setRepreneur(e.target.value)} slotProps={{ htmlInput: { maxLength: 120 } }} />}
          {erreur === 'base' && <Alert severity="warning">La base n’est pas encore prête pour les fermetures : la mise à jour de Supabase doit d’abord être passée.</Alert>}
          {erreur === 'echec' && <Alert severity="error">La fermeture n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.</Alert>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        {f && <Button color="inherit" onClick={() => enregistrer(true)} disabled={envoi} sx={{ minHeight: 48, mr: 'auto' }}>Remettre dans le réseau</Button>}
        <Button onClick={() => onFermer()} sx={{ minHeight: 48 }}>Annuler</Button>
        <Button variant="contained" onClick={() => enregistrer(false)} disabled={!dateValide || envoi} sx={{ minHeight: 48 }}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
      </DialogActions>
    </Dialog>
  )
}
