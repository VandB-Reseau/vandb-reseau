// Compte rendu de visite ouvert depuis le fil d'actualité (Joseph, 22/10/2026) : une pièce jointe avec picto (choix 271) ;
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

const FeuilleCompteRendu = lazy(() => import('./FeuilleCompteRendu').then((m) => ({ default: m.FeuilleCompteRendu })))

export function useOuvrirCompteRendu() {
  const [params, setParams] = useSearchParams()
  return (id: number) => {
    const n = new URLSearchParams(params)
    n.set('cr', String(id))
    setParams(n, { state: { cr: true } })
  }
}

// Pièce jointe qui n'est pas une photo (choix 271, Joseph 17/11/2026) : une ligne avec un picto, jamais un grand carré
export function PieceJointe({ nom, detail = 'PDF · Ouvrir', libelle, onOuvrir }: { nom: string; detail?: string; libelle: string; onOuvrir: () => void }) {
  return (
    <ButtonBase onClick={onOuvrir} aria-label={libelle}
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25, minHeight: 48, maxWidth: '100%', px: 1.5, py: 0.75, border: '1px solid', borderColor: 'divider', borderRadius: 2, textAlign: 'left', justifyContent: 'flex-start', color: 'text.primary', '&:hover': { bgcolor: 'action.hover' } }}>
      <PictureAsPdfOutlined sx={{ color: 'error.main', flex: 'none' }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.3 }} noWrap>{nom}</Typography>
        <Typography color="text.secondary" sx={{ fontSize: '0.75rem', lineHeight: 1.3 }}>{detail}</Typography>
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
