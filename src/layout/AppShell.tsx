import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Avatar from '@mui/material/Avatar'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import SearchIcon from '@mui/icons-material/Search'
import Logout from '@mui/icons-material/Logout'
import KeyOutlined from '@mui/icons-material/KeyOutlined'
import Snackbar from '@mui/material/Snackbar'
import { DialogMotDePasse } from '../components/DialogMotDePasse'
import { Logo } from '../components/Logo'
import { RechercheGlobale } from '../components/RechercheGlobale'
import { Cloche } from '../components/Messages'
import { brandStripe } from '../theme/theme'
import { parametres, principales, secondaires, plus, type Destination } from '../navigation/destinations'
import { useAuth } from '../auth/AuthContext'
import { roleLibelle } from '../auth/roles'

const LARGEUR_MENU = 264

function estActive(d: Destination, pathname: string): boolean {
  return d.chemin === '/' ? pathname === '/' : pathname.startsWith(d.chemin)
}

function MenuCompte() {
  const { profil, deconnexion } = useAuth()
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  const [motDePasse, setMotDePasse] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  if (!profil) return null
  const initiale = profil.nom.slice(0, 1).toUpperCase()
  return (
    <>
      <IconButton aria-label="Mon compte" onClick={(e) => setAncre(e.currentTarget)} sx={{ p: 0.5 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: 'secondary.main', color: 'secondary.contrastText', fontWeight: 600 }}>{initiale}</Avatar>
      </IconButton>
      <Menu anchorEl={ancre} open={!!ancre} onClose={() => setAncre(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2">{profil.email}</Typography>
          <Typography variant="caption" color="text.secondary">{roleLibelle[profil.role]}</Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => { setAncre(null); setMotDePasse(true) }}>
          <ListItemIcon><KeyOutlined fontSize="small" /></ListItemIcon>
          Changer mon mot de passe
        </MenuItem>
        <MenuItem onClick={() => { setAncre(null); void deconnexion() }}>
          <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
          Se déconnecter
        </MenuItem>
      </Menu>
      {motDePasse && <DialogMotDePasse onFermer={(msg) => { setMotDePasse(false); if (msg) setConfirmation(msg) }} />}
      <Snackbar open={!!confirmation} autoHideDuration={5000} onClose={() => setConfirmation('')} message={confirmation} />
    </>
  )
}

function MenuLateral({ franchise }: { franchise?: Destination[] }) {
  const { pathname } = useLocation()
  const naviguer = useNavigate()
  const item = (d: Destination) => {
    const actif = estActive(d, pathname)
    return (
      <ListItemButton key={d.chemin} selected={actif} onClick={() => naviguer(d.chemin)} sx={{ mx: 1.5, mb: 0.5, minHeight: 48 }}>
        <ListItemIcon sx={{ minWidth: 40, color: actif ? 'text.primary' : 'text.secondary' }}>{actif ? d.iconeActive ?? d.icone : d.icone}</ListItemIcon>
        <ListItemText primary={d.libelle} slotProps={{ primary: { sx: { fontWeight: actif ? 600 : 500, fontSize: '0.9375rem' } } }} />
      </ListItemButton>
    )
  }
  return (
    <Drawer
      variant="permanent"
      sx={{ width: LARGEUR_MENU, flexShrink: 0, '& .MuiDrawer-paper': { width: LARGEUR_MENU, boxSizing: 'border-box', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.default' } }}
    >
      <Toolbar sx={{ minHeight: 68 }} />
      <Box component="nav" aria-label="Navigation principale" sx={{ pt: 2 }}>
        <List disablePadding>{(franchise ?? [...principales, ...secondaires]).map(item)}</List>
        {!franchise && <>
          <Divider sx={{ my: 1.5, mx: 3 }} />
          <List disablePadding subheader={<ListSubheader sx={{ bgcolor: 'transparent', px: 4, lineHeight: '36px', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Paramètres</ListSubheader>}>
            {parametres.map(item)}
          </List>
        </>}
      </Box>
    </Drawer>
  )
}

function BarreBasse({ franchise }: { franchise?: Destination[] }) {
  const { pathname } = useLocation()
  const naviguer = useNavigate()
  const items = franchise ?? [...principales, plus]
  const actif = items.findIndex((d) => (d === plus ? pathname.startsWith('/plus') : estActive(d, pathname)))
  return (
    <Paper component="nav" aria-label="Navigation principale" sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: (t) => t.zIndex.appBar, borderTop: '1px solid', borderColor: 'divider', pb: 'env(safe-area-inset-bottom)' }}>
      <BottomNavigation showLabels value={actif} onChange={(_e, i: number) => naviguer(items[i].chemin)} sx={{ height: 72, bgcolor: 'background.paper' }}>
        {items.map((d, i) => (
          <BottomNavigationAction key={d.chemin} label={d.libelle} icon={i === actif ? d.iconeActive ?? d.icone : d.icone} sx={{ minWidth: 0, px: 0.5 }} />
        ))}
      </BottomNavigation>
    </Paper>
  )
}

// franchise : navigation réduite de l'espace franchisé (sans recherche ni Paramètres) ; bandeau : sous l'en-tête ;
// sansCloche : aperçu de l'espace d'un franchisé, sans ses notifications
export function AppShell({ children, franchise, bandeau, sansCloche = false }: { children: ReactNode; franchise?: Destination[]; bandeau?: ReactNode; sansCloche?: boolean }) {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const [rechercheOuverte, setRechercheOuverte] = useState(false)

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1, bgcolor: '#000000', color: '#ffffff' }}>
        <Toolbar sx={{ minHeight: { xs: 60, md: 68 }, gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: surPC ? LARGEUR_MENU - 24 : 'auto' }}>
            <Logo size={surPC ? 22 : 20} />
            <Typography variant="subtitle1" component="span" sx={{ fontWeight: 600, display: { xs: 'none', sm: 'inline' } }}>{franchise ? 'Espace franchisé' : 'Réseau'}</Typography>
          </Box>
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            {surPC && !franchise && <RechercheGlobale surFonce />}
          </Box>
          {!surPC && !franchise && (
            <IconButton aria-label="Rechercher" onClick={() => setRechercheOuverte((v) => !v)} sx={{ color: '#ffffff' }}>
              <SearchIcon />
            </IconButton>
          )}
          {!sansCloche && <Cloche />}
          <MenuCompte />
        </Toolbar>
        <Box aria-hidden sx={{ height: 4, background: brandStripe }} />
        {!surPC && rechercheOuverte && (
          <Box sx={{ px: 2, py: 1.5, bgcolor: 'background.paper', color: 'text.primary' }}>
            <RechercheGlobale onChoix={() => setRechercheOuverte(false)} />
          </Box>
        )}
      </AppBar>

      {surPC && <MenuLateral franchise={franchise} />}

      <Box component="main" sx={{ flex: 1, minWidth: 0, pt: { xs: '64px', md: '72px' }, pb: surPC ? 4 : '96px' }}>
        {bandeau}
        <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, sm: 3, md: 5 }, pt: { xs: 3, md: 4 } }}>{children}</Box>
      </Box>

      {!surPC && <BarreBasse franchise={franchise} />}
    </Box>
  )
}
