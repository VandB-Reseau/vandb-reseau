import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import HandshakeOutlined from '@mui/icons-material/HandshakeOutlined'
import BusinessOutlined from '@mui/icons-material/BusinessOutlined'
import { brand } from '../theme/theme'
import { statutAide, statutLibelle, type Statut } from '../data/modele'

const couleurStatut: Record<Statut, 'default' | 'success' | 'info' | 'warning'> = {
  ouvert: 'success',
  nouveau: 'info',
  preouverture: 'warning',
  avenir: 'default',
}

export function PastilleStatut({ statut }: { statut: Statut }) {
  return (
    <Tooltip title={statutAide[statut]}>
      <Chip label={statutLibelle[statut]} color={couleurStatut[statut]} size="small" variant={statut === 'avenir' ? 'outlined' : 'filled'} sx={{ fontSize: '0.75rem', fontWeight: 600 }} />
    </Tooltip>
  )
}

export function PastilleType({ franchise, compacte }: { franchise: boolean; compacte?: boolean }) {
  const couleur = franchise ? brand.vertFonce : brand.orange
  return (
    <Chip
      icon={franchise ? <HandshakeOutlined /> : <BusinessOutlined />}
      label={franchise ? 'Franchisé' : 'Intégré'}
      size="small"
      variant="outlined"
      sx={{
        fontSize: '0.75rem', fontWeight: 600, borderColor: couleur, color: couleur,
        '& .MuiChip-icon': { color: couleur },
        ...(compacte && { '& .MuiChip-label': { display: { xs: 'none', sm: 'block' } } }),
      }}
    />
  )
}

export function PastilleRR({ nom, couleur }: { nom: string; couleur: string }) {
  return (
    <Chip
      label={nom}
      size="small"
      sx={{ fontSize: '0.75rem', bgcolor: 'transparent', border: '1px solid', borderColor: 'divider', '&::before': { content: '""', width: 8, height: 8, borderRadius: '50%', bgcolor: couleur, ml: 1 } }}
    />
  )
}
