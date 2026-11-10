// Conversation d'un magasin ouverte sur le côté, sans quitter la fiche ou la visite (vague 6, 68A).
// PC : panneau à droite ; téléphone : la conversation en plein écran dans Messages.
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined'
import { useAuth } from '../auth/AuthContext'
import { FilMessages } from './Messages'
import { lienFil } from '../data/messagerie'
import type { Reseau } from '../data/modele'

export function useConversationLaterale(reseau: Reseau, magasin: string, lectureSeule = false): { ouvrir: () => void; panneau: ReactNode } {
  const naviguer = useNavigate()
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const { profil } = useAuth()
  const franchise = profil?.role === 'franchise' || !!reseau.espace
  const [ouvert, setOuvert] = useState(false)
  const [equipe, setEquipe] = useState(false)
  const [message, setMessage] = useState('')
  const fil = { genre: 'magasin' as const, magasin, equipe: equipe && !franchise }
  const ouvrir = () => (surPC ? setOuvert(true) : naviguer(lienFil({ genre: 'magasin', magasin, equipe: false })))
  const panneau = (
    <>
      <Drawer anchor="right" open={ouvert && surPC} onClose={() => setOuvert(false)}
        slotProps={{ paper: { 'aria-labelledby': 'titre-conversation-laterale', sx: { width: 460, maxWidth: '100vw', display: 'flex', flexDirection: 'column' } } as object }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography id="titre-conversation-laterale" variant="h3" component="h2" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Conversation : {magasin}</Typography>
          <Button startIcon={<OpenInNewOutlined />} onClick={() => naviguer(lienFil(fil))} sx={{ minHeight: 48 }}>Messages</Button>
          <IconButton aria-label="Fermer la conversation" onClick={() => setOuvert(false)} sx={{ width: 48, height: 48 }}><CloseOutlined /></IconButton>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          {ouvert && <FilMessages key={equipe ? 'equipe' : 'avec'} reseau={reseau} fil={fil} signaler={setMessage} lectureSeule={lectureSeule}
            basculer={franchise || lectureSeule ? undefined : setEquipe} cadre fond="background.paper" />}
        </Box>
      </Drawer>
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
  return { ouvrir, panneau }
}
