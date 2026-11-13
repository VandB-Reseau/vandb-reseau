import { useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import { enregistrerActionLibre } from '../data/chargement'
import { porteursDu } from '../data/actions'
import { useReseau } from '../data/ReseauContext'
import { useAuth } from '../auth/AuthContext'
import { ChampDate } from './ChampDate'

// Une même tâche pour le franchisé de chaque magasin sélectionné (refonte vague 2, 16A)
export function TacheEnSerie({ magasins, onFermer }: { magasins: string[]; onFermer: (message?: string) => void }) {
  const { reseau, recharger } = useReseau()
  const { profil } = useAuth()
  const [intitule, setIntitule] = useState('')
  const [echeance, setEcheance] = useState('')
  const [occupe, setOccupe] = useState(false)
  const creer = async () => {
    setOccupe(true)
    let n = 0
    for (const m of magasins) {
      if (!reseau) break
      const porteur = porteursDu(reseau, m).find((p) => !['Coach', 'Responsable Régional', 'Responsable des magasins intégrés', 'Directeur de réseau'].includes(p.role))?.nom ?? ''
      try {
        await enregistrerActionLibre(m, { action: intitule.trim(), porteur, echeance, creeLe: reseau.jour, ...(profil?.nom ? { auteur: profil.nom } : {}) })
        n++
      } catch { /* suivant */ }
    }
    await recharger().catch(() => undefined)
    setOccupe(false)
    onFermer(n ? `Tâche créée pour ${n} magasin${n > 1 ? 's' : ''}.` : 'La tâche n’a pas pu être créée. Réessaie dans un instant.')
  }
  return (
    <Dialog open onClose={() => onFermer()} aria-labelledby="titre-tache-serie" fullWidth maxWidth="xs">
      <DialogTitle id="titre-tache-serie">{`Une tâche pour ${magasins.length} magasin${magasins.length > 1 ? 's' : ''}`}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        <TextField label="Tâche" value={intitule} onChange={(e) => setIntitule(e.target.value)} autoFocus fullWidth />
        <ChampDate label="Échéance" value={echeance} onChange={(e) => setEcheance(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onFermer()} sx={{ minHeight: 48 }}>Annuler</Button>
        <Button variant="contained" disabled={!intitule.trim() || occupe} onClick={() => void creer()} sx={{ minHeight: 48 }}>Ajouter</Button>
      </DialogActions>
    </Dialog>
  )
}
