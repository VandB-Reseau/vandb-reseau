// Statut d'une tâche (refonte vague 4, Joseph 10/11/2026, 32A) : À faire, En cours, Bloquée (avec sa raison), Faite.
// « Faite » se coche comme avant ; la puce change les trois autres. Vocabulaire réservé (40A) : ces mots ne servent qu'aux tâches.
import { useState } from 'react'
import Chip from '@mui/material/Chip'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { Fenetre } from './EditionEquipe'
import type { ActionPlan, StatutTache } from '../data/modele'

export const libelleStatutTache = (a: Pick<ActionPlan, 'statut' | 'faite'>) => (a.faite ? 'Faite' : a.statut === 'en_cours' ? 'En cours' : a.statut === 'bloquee' ? 'Bloquée' : 'À faire')

const styles = {
  a_faire: { bgcolor: 'action.hover', color: 'text.secondary' },
  en_cours: { bgcolor: 'rgba(248, 187, 9, 0.22)', color: 'text.primary' },
  bloquee: { bgcolor: 'rgba(194, 65, 25, 0.12)', color: 'error.dark' },
} as const

// changer : absent = lecture seule ; la promesse se termine une fois le statut enregistré
export function PuceStatut({ a, changer, titre }: { a: ActionPlan; titre: string; changer?: (statut: '' | StatutTache, raison: string) => Promise<void> }) {
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  const [raison, setRaison] = useState<string | null>(null)
  if (a.faite) return null
  const actuel = a.statut ?? 'a_faire'
  const libelle = libelleStatutTache(a)
  const sx = { fontSize: 12, fontWeight: 700, borderRadius: 1, height: 24, ...styles[actuel] }
  if (!changer) return <Chip size="small" label={libelle} sx={sx} />
  const choisir = (s: '' | StatutTache) => { setAncre(null); if (s === 'bloquee') setRaison(a.raison ?? ''); else void changer(s, '') }
  return (
    <>
      <Chip size="small" label={libelle} onClick={(e) => setAncre(e.currentTarget)} aria-haspopup="menu" aria-label={`Statut : ${libelle}. Changer le statut de ${titre}`}
        sx={{ ...sx, minHeight: { xs: 48, sm: 24 }, '&:hover': styles[actuel] }} />
      <Menu anchorEl={ancre} open={!!ancre} onClose={() => setAncre(null)} slotProps={{ list: { 'aria-label': 'Statut de la tâche' } }}>
        <MenuItem selected={actuel === 'a_faire'} onClick={() => choisir('')} sx={{ minHeight: 48 }}>À faire</MenuItem>
        <MenuItem selected={actuel === 'en_cours'} onClick={() => choisir('en_cours')} sx={{ minHeight: 48 }}>En cours</MenuItem>
        <MenuItem selected={actuel === 'bloquee'} onClick={() => choisir('bloquee')} sx={{ minHeight: 48 }}>Bloquée…</MenuItem>
      </Menu>
      {raison !== null && (
        <Fenetre titre="Tâche bloquée" ouvert onFermer={() => setRaison(null)} valide={!!raison.trim()} sansRechargement
          enregistrer={async () => { await changer('bloquee', raison.trim()); return '' }}>
          <Typography variant="body2" color="text.secondary">{titre}</Typography>
          <TextField label="Ce qui bloque" value={raison} onChange={(e) => setRaison(e.target.value)} autoFocus multiline minRows={2} slotProps={{ htmlInput: { maxLength: 300 } }} />
        </Fenetre>
      )}
    </>
  )
}
