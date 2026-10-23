// Carte à titre, ligne libellé / valeur et ligne de contact des fiches (magasin, Coach, RR, franchisé)
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import CallOutlined from '@mui/icons-material/CallOutlined'
import MailOutlined from '@mui/icons-material/MailOutlined'
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined'
import { Initiales } from './Social'
import { telLien } from '../lib/format'
import type { Personne } from '../data/modele'

export function Section({ titre, children, action }: { titre: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h3" component="h2" sx={{ flex: 1 }}>{titre}</Typography>
          {action}
        </Box>
        {children}
      </CardContent>
    </Card>
  )
}

export function Ligne({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' }, gap: { xs: 0.25, sm: 2 }, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Typography variant="body2" color="text.secondary">{libelle}</Typography>
      <Box sx={{ typography: 'body1', minWidth: 0, overflowWrap: 'anywhere' }}>{children || <Typography color="text.secondary" variant="body2">Non renseigné</Typography>}</Box>
    </Box>
  )
}

// Ligne de contact à initiales, comme dans Magasins : le nom (vers sa fiche), le rôle dessous, les pictos à droite
export function Contact({ role, p, sousTitre, lien }: { role: string; p: Personne | null; sousTitre?: string; lien?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Initiales nom={p?.nom ?? role} taille={40} icone={p ? undefined : <PersonOutlineOutlined />} couleur={p ? undefined : '#9e9e9e'} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {p && lien
          ? <Link component={RouterLink} to={lien} variant="body1" color="inherit" underline="hover" sx={{ fontWeight: 600, display: 'inline-flex', minHeight: 32, alignItems: 'center' }}>{p.nom}</Link>
          : <Typography variant="body1" sx={{ fontWeight: 600, color: p ? undefined : 'text.secondary' }}>{p?.nom ?? 'Non renseigné'}</Typography>}
        <Typography variant="body2" color="text.secondary" noWrap>{[role, sousTitre].filter(Boolean).join(' · ')}</Typography>
      </Box>
      {p?.telephone && <Tooltip title={p.telephone}><IconButton href={telLien(p.telephone)} aria-label={`Appeler ${p.nom}`} sx={{ width: 48, height: 48 }}><CallOutlined /></IconButton></Tooltip>}
      {p?.email && <Tooltip title={p.email}><IconButton href={`mailto:${p.email}`} aria-label={`Écrire à ${p.nom}`} sx={{ width: 48, height: 48 }}><MailOutlined /></IconButton></Tooltip>}
    </Box>
  )
}

