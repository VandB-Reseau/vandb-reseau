// Compte rendu de visite ouvert depuis le fil d'actualité (Joseph, 22/10/2026) : une vignette carrée, comme une photo ;
// le toucher l'ouvre dans une fenêtre, et la fermer (ou revenir en arrière) laisse le fil à la même place,
// pour aimer ou commenter. La fenêtre suit le paramètre « cr » de l'adresse, d'où le retour arrière qui la ferme.
import { lazy, Suspense } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import { useReseau } from '../data/ReseauContext'
import { lienCompteRendu } from '../data/visites'
import { brandStripe } from '../theme/theme'

const FeuilleCompteRendu = lazy(() => import('./FeuilleCompteRendu').then((m) => ({ default: m.FeuilleCompteRendu })))

export function useOuvrirCompteRendu() {
  const [params, setParams] = useSearchParams()
  return (id: number) => {
    const n = new URLSearchParams(params)
    n.set('cr', String(id))
    setParams(n, { state: { cr: true } })
  }
}

// Petite page du compte rendu, de la taille d'une photo
export function VignetteCompteRendu({ libelle, onOuvrir }: { libelle: string; onOuvrir: () => void }) {
  return (
    <ButtonBase onClick={onOuvrir} aria-label={libelle}
      sx={{ aspectRatio: '1 / 1', borderRadius: 2, overflow: 'hidden', bgcolor: '#ffffff', border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
      <Box sx={{ height: 10, display: 'flex', justifyContent: 'flex-end', flexShrink: 0, pt: 0.75, pr: 0.75 }}><Box sx={{ width: '40%', height: 6, background: brandStripe, borderRadius: 0.5 }} /></Box>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5, color: '#1d1d1b', px: 0.5 }}>
        <PictureAsPdfOutlined sx={{ fontSize: 32, color: '#c24119' }} />
        <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.2, textAlign: 'center', color: '#1d1d1b' }}>Compte rendu</Typography>
      </Box>
    </ButtonBase>
  )
}

// Fenêtre du compte rendu, placée une fois sous le fil
export function FenetreCompteRendu() {
  const [params, setParams] = useSearchParams()
  const etat = useLocation().state as { cr?: boolean } | null
  const naviguer = useNavigate()
  const { reseau } = useReseau()
  const plein = !useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const id = params.get('cr')
  if (!id || !reseau) return null
  const v = reseau.visites.find((x) => String(x.id) === id)
  const fermer = () => {
    if (etat?.cr) { naviguer(-1); return }
    const n = new URLSearchParams(params)
    n.delete('cr')
    setParams(n, { replace: true })
  }
  return (
    <Dialog open onClose={fermer} fullScreen={plein} fullWidth maxWidth="md" slotProps={{ paper: { 'aria-label': 'Compte rendu' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider', position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1 }}>
        <IconButton onClick={fermer} aria-label="Fermer" sx={{ width: 48, height: 48 }}><CloseOutlined /></IconButton>
        <Typography variant="h3" component="h2" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Compte rendu</Typography>
        {v && <Button startIcon={<PictureAsPdfOutlined />} onClick={() => naviguer(lienCompteRendu(v), { replace: !!etat?.cr })} sx={{ minHeight: 48 }}>PDF</Button>}
      </Box>
      <Box sx={{ p: { xs: 1, md: 2 }, overflowY: 'auto', bgcolor: 'background.default' }}>
        {v
          ? <Suspense fallback={<Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Chargement…</Typography>}><FeuilleCompteRendu reseau={reseau} v={v} /></Suspense>
          : <Typography sx={{ p: 2 }}>Ce compte rendu n’est plus disponible.</Typography>}
      </Box>
    </Dialog>
  )
}
