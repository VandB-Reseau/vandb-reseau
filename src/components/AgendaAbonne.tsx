import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined'
import { useAuth } from '../auth/AuthContext'
import { useReseau } from '../data/ReseauContext'
import { nomDe } from '../data/messagerie'
import { supabase } from '../lib/supabase'
import type { Profil } from '../auth/roles'
import type { Reseau } from '../data/modele'

// Agenda de l'app dans Google Agenda (sprint 25, F2, migration 0034) : un lien secret par personne, relu par Google
// (fonction Supabase « agenda »). Ses visites et les événements, réunions et formations du réseau.
const URL_BASE = import.meta.env.VITE_SUPABASE_URL ?? 'https://aipodcpbakywbrrilaud.supabase.co'
export const lienAgenda = (jeton: string) => `${URL_BASE}/functions/v1/agenda?jeton=${jeton}`
export const lienGoogle = (jeton: string) => `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(lienAgenda(jeton).replace(/^https:/, 'webcal:'))}`

// Nom de la personne tel que l'app l'écrit dans les visiteurs
export function monNom(reseau: Reseau | null, profil: Profil | null): string {
  if (!profil || !reseau) return ''
  if (profil.role === 'directeur') return nomDe(reseau, 'directeur')
  if (profil.role === 'rr') { const id = profil.perimetre.rr?.[0]; return id ? nomDe(reseau, `rr:${id}`) : '' }
  if (profil.role === 'coach') return profil.perimetre.coachs?.[0] ?? ''
  return ''
}

export function DialogAgendaAbonne({ onFermer }: { onFermer: (message?: string) => void }) {
  const theme = useTheme()
  const plein = useMediaQuery(theme.breakpoints.down('sm'))
  const { profil } = useAuth()
  const { reseau } = useReseau()
  const [jeton, setJeton] = useState('')
  const [etat, setEtat] = useState<'' | 'charge' | 'erreur'>('charge')
  const nom = monNom(reseau, profil)
  const demander = async (nouveau: boolean) => {
    setEtat('charge')
    const { data, error } = await supabase.rpc('mon_agenda', { p_nom: nom, p_nouveau: nouveau })
    if (error || typeof data !== 'string') { setEtat('erreur'); return }
    setJeton(data); setEtat('')
    if (nouveau) onFermer('Nouveau lien créé : l’ancien ne marche plus.')
  }
  useEffect(() => { void demander(false) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const copier = async () => {
    try { await navigator.clipboard.writeText(lienAgenda(jeton)); onFermer('Lien copié.') } catch { onFermer('Le lien n’a pas pu être copié.') }
  }
  return (
    <Dialog open onClose={() => onFermer()} fullScreen={plein} fullWidth maxWidth="xs" slotProps={{ paper: { 'aria-label': 'Mon agenda dans Google Agenda' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 2 }}>
        <Typography variant="h3" component="h2" sx={{ flex: 1, minWidth: 0 }}>Mon agenda dans Google Agenda</Typography>
        <IconButton aria-label="Fermer" onClick={() => onFermer()} sx={{ width: 48, height: 48 }}><CloseOutlined /></IconButton>
      </Box>
      <Box sx={{ px: 2, pb: 3, pt: 1, display: 'grid', gap: 2 }}>
        <Typography color="text.secondary">Mes visites, les événements, réunions et formations du réseau.</Typography>
        {etat === 'charge' && <Box sx={{ display: 'grid', placeItems: 'center', py: 2 }}><CircularProgress aria-label="Préparation du lien" /></Box>}
        {etat === 'erreur' && <Typography role="alert">Le lien n’est pas encore disponible. Réessaie plus tard.</Typography>}
        {etat === '' && jeton && (
          <>
            <Button variant="contained" component="a" href={lienGoogle(jeton)} target="_blank" rel="noopener" startIcon={<EventAvailableOutlined />} sx={{ minHeight: 48 }}>
              Ouvrir Google Agenda
            </Button>
            <Button variant="outlined" onClick={() => void copier()} startIcon={<ContentCopyOutlined />} sx={{ minHeight: 48 }}>Copier le lien</Button>
            <Button onClick={() => void demander(true)} sx={{ minHeight: 48, justifySelf: 'start' }}>Changer le lien</Button>
          </>
        )}
      </Box>
    </Dialog>
  )
}
