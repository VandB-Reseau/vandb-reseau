import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import NotificationsNoneOutlined from '@mui/icons-material/NotificationsNoneOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { useReseauSiDispo } from '../data/ReseauContext'
import { useAuth } from '../auth/AuthContext'
import { useApercu } from '../auth/Apercu'
import { marquerLues, useNotificationsApp } from '../data/notificationsApp'
import { EmptyState } from './EmptyState'
import { dateCourte } from '../lib/format'

// Cloche des notifications (refonte vague 2, Joseph 09/11/2026, 10A) : à côté de la recherche, avec le nombre de non lues ;
// elle ouvre un volet à droite. Un clic mène au bon endroit et marque la notification lue.
export function Cloche() {
  const etat = useReseauSiDispo()
  const { profil } = useAuth()
  const { apercu, equipe } = useApercu()
  const actif = !apercu && !equipe
  const { toutes, nonLues, lues } = useNotificationsApp(etat?.reseau ?? null, profil, actif)
  const [ouvert, setOuvert] = useState(false)
  const [filtre, setFiltre] = useState<'nonLues' | 'toutes'>('nonLues')
  const naviguer = useNavigate()
  if (!actif) return null
  const liste = filtre === 'nonLues' ? nonLues : toutes
  const n = nonLues.length
  return (
    <>
      <Tooltip title="Notifications">
        <IconButton aria-label={n ? `Notifications, ${n} non lue${n > 1 ? 's' : ''}` : 'Notifications'} onClick={() => setOuvert(true)} sx={{ width: { xs: 48, md: 44 }, height: { xs: 48, md: 44 }, flexShrink: 0 }}>
          <Badge color="error" badgeContent={n} max={99}><NotificationsNoneOutlined /></Badge>
        </IconButton>
      </Tooltip>
      <Drawer anchor="right" open={ouvert} onClose={() => setOuvert(false)} sx={{ zIndex: (t) => t.zIndex.modal }}
        slotProps={{ paper: { component: 'aside', 'aria-label': 'Notifications', sx: { width: { xs: '100%', sm: 380 }, display: 'flex', flexDirection: 'column' } } as never }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 'calc(12px + env(safe-area-inset-top, 0px))', pb: 1 }}>
          <Typography variant="h2" component="h2" sx={{ flex: 1, fontSize: '1.25rem' }}>Notifications</Typography>
          {n > 0 && <Button onClick={() => marquerLues(nonLues.map((x) => x.id))} sx={{ minHeight: 44 }}>Tout marquer comme lu</Button>}
          <IconButton aria-label="Fermer les notifications" onClick={() => setOuvert(false)} sx={{ width: 48, height: 48 }}><CloseOutlined /></IconButton>
        </Box>
        <Box sx={{ px: 2, pb: 1 }}>
          <ToggleButtonGroup exclusive size="small" value={filtre} onChange={(_e, v) => v && setFiltre(v)} aria-label="Notifications affichées">
            <ToggleButton value="nonLues" sx={{ minHeight: 40, px: 1.75, '@media (max-width: 899.95px)': { minHeight: 48 } }}>{`Non lues${n ? ` · ${n}` : ''}`}</ToggleButton>
            <ToggleButton value="toutes" sx={{ minHeight: 40, px: 1.75, '@media (max-width: 899.95px)': { minHeight: 48 } }}>Toutes</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box component="ul" aria-label="Liste des notifications" sx={{ listStyle: 'none', m: 0, p: 0, overflowY: 'auto', flex: 1 }}>
          {liste.length === 0 && <li><EmptyState titre={filtre === 'nonLues' ? 'Tout est lu' : 'Rien de nouveau'} texte="Commentaires des budgets, tâches confiées ou en retard et comptes rendus de visite arriveront ici." /></li>}
          {liste.map((x) => {
            const lue = lues.has(x.id)
            return (
              <li key={x.id}>
                <ButtonBase onClick={() => { marquerLues([x.id]); setOuvert(false); naviguer(x.lien) }}
                  sx={{ width: '100%', minHeight: 56, px: 2, py: 1.25, gap: 1.5, alignItems: 'flex-start', justifyContent: 'flex-start', textAlign: 'left', fontFamily: 'inherit', borderTop: 1, borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' } }}>
                  <Box aria-hidden sx={{ width: 8, height: 8, mt: 0.9, borderRadius: '50%', flexShrink: 0, bgcolor: lue ? 'transparent' : 'secondary.main' }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: lue ? 600 : 700 }}>{x.titre}{!lue && <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}> (non lue)</Box>}</Typography>
                    <Typography variant="body2" color="text.secondary">{x.detail}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{dateCourte(x.quand)}</Typography>
                </ButtonBase>
              </li>
            )
          })}
        </Box>
      </Drawer>
    </>
  )
}
