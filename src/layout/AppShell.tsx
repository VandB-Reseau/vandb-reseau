import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
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
import InstallMobileOutlined from '@mui/icons-material/InstallMobileOutlined'
import Snackbar from '@mui/material/Snackbar'
import { DialogMotDePasse } from '../components/DialogMotDePasse'
import { Logo } from '../components/Logo'
import { RechercheGlobale } from '../components/RechercheGlobale'
import { BoutonMessages, Cloche } from '../components/Messages'
import { BoutonTaches } from '../components/Actions'
import { BoutonCreer } from '../components/Creer'
import { useInstallation } from '../lib/installation'
import { brandStripe } from '../theme/theme'
import { parametres, principales, secondaires, type Destination } from '../navigation/destinations'
import { useAuth } from '../auth/AuthContext'
import { roleLibelle } from '../auth/roles'

const LARGEUR_MENU = 264

function estActive(d: Destination, pathname: string): boolean {
  return d.chemin === '/' ? pathname === '/' : pathname.startsWith(d.chemin)
}

// liens : sur téléphone, les écrans hors de la barre du bas (agenda, équipe, paramètres)
function MenuCompte({ liens = [] }: { liens?: { titre?: string; destinations: Destination[] }[] }) {
  const { profil, deconnexion } = useAuth()
  const naviguer = useNavigate()
  const installation = useInstallation()
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
        {liens.flatMap((g, i) => [
          g.titre ? <ListSubheader key={`t${i}`} sx={{ lineHeight: '36px', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{g.titre}</ListSubheader> : null,
          ...g.destinations.map((d) => (
            <MenuItem key={d.chemin} onClick={() => { setAncre(null); naviguer(d.chemin) }} sx={{ minHeight: 48 }}>
              <ListItemIcon>{d.icone}</ListItemIcon>
              {d.libelle}
            </MenuItem>
          )),
          <Divider key={`d${i}`} />,
        ])}
        {installation && (
          <MenuItem onClick={() => { setAncre(null); installation() }} sx={{ minHeight: 48 }}>
            <ListItemIcon><InstallMobileOutlined fontSize="small" /></ListItemIcon>
            Installer l’app
          </MenuItem>
        )}
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

function MenuLateral({ franchise, sansParametres }: { franchise?: Destination[]; sansParametres?: boolean }) {
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
        {!franchise && <Box sx={{ px: 1.5, pb: 2 }}><BoutonCreer /></Box>}
        <List disablePadding>{(franchise ?? [...principales, ...secondaires]).map(item)}</List>
        {!franchise && !sansParametres && <>
          <Divider sx={{ my: 1.5, mx: 3 }} />
          <List disablePadding subheader={<ListSubheader sx={{ bgcolor: 'transparent', px: 4, lineHeight: '36px', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Paramètres</ListSubheader>}>
            {parametres.map(item)}
          </List>
        </>}
      </Box>
    </Drawer>
  )
}

const HAUTEUR_BARRE = 64

function BarreBasse({ franchise }: { franchise?: Destination[] }) {
  const { pathname } = useLocation()
  const naviguer = useNavigate()
  const item = (d: Destination) => {
    const actif = estActive(d, pathname)
    return (
      <ButtonBase key={d.chemin} onClick={() => naviguer(d.chemin)} aria-current={actif ? 'page' : undefined}
        sx={{ flex: 1, minWidth: 0, height: HAUTEUR_BARRE, borderRadius: 999, color: actif ? 'text.primary' : 'text.secondary', fontSize: '0.75rem', fontWeight: actif ? 600 : 500 }}>
        {/* Onglet actif posé sur une pastille, comme les barres en verre d'iOS */}
        <Box sx={{ width: '100%', height: HAUTEUR_BARRE - 10, borderRadius: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.25, ...(actif ? { bgcolor: 'action.selected' } : {}) }}>
          {actif ? d.iconeActive ?? d.icone : d.icone}
          <Box component="span" sx={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', px: 0.5 }}>{d.court ?? d.libelle}</Box>
        </Box>
      </ButtonBase>
    )
  }
  // Barre flottante en verre : translucide et floutée, le contenu reste visible dessous
  return (
    <Paper component="nav" aria-label="Navigation principale"
      sx={(t) => ({
        position: 'fixed', left: 12, right: 12, bottom: 'calc(8px + env(safe-area-inset-bottom))', zIndex: t.zIndex.appBar,
        borderRadius: 999, overflow: 'hidden', px: 0.625,
        bgcolor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.7)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        ...t.applyStyles('dark', {
          bgcolor: 'rgba(36, 36, 40, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        }),
      })}>
      <Box sx={{ display: 'flex', height: HAUTEUR_BARRE }}>
        {franchise ? franchise.map(item) : <>
          {principales.slice(0, 2).map(item)}
          <BoutonCreer rond />
          {principales.slice(2).map(item)}
        </>}
      </Box>
    </Paper>
  )
}

// franchise : navigation réduite de l'espace franchisé (sans recherche ni Paramètres) ; bandeau : sous l'en-tête ;
// sansParametres : Coach ou Responsable Régional ; sansCloche : aperçu de l'espace d'un franchisé, sans ses notifications
export function AppShell({ children, franchise, bandeau, sansParametres = false, sansCloche = false }: { children: ReactNode; franchise?: Destination[]; bandeau?: ReactNode; sansParametres?: boolean; sansCloche?: boolean }) {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const [rechercheOuverte, setRechercheOuverte] = useState(false)
  const { pathname } = useLocation()
  // Téléphone : la barre du bas s'efface dans une conversation et pendant la saisie d'un message, pour laisser la place au clavier
  const [saisie, setSaisie] = useState(false)
  useEffect(() => {
    const suivre = () => {
      const actif = document.activeElement as HTMLElement | null
      // Le champ ouvre le clavier ; un bouton de la saisie (envoi, destinataire) le garde ouvert sans l'ouvrir
      setSaisie((avant) => !!actif?.closest('[data-composeur]') && (avant || actif.tagName === 'TEXTAREA'))
    }
    const sortie = () => requestAnimationFrame(suivre)
    document.addEventListener('focusin', suivre)
    document.addEventListener('focusout', sortie)
    return () => { document.removeEventListener('focusin', suivre); document.removeEventListener('focusout', sortie) }
  }, [])
  const conversation = /^\/messages\/./.test(pathname)
  const sansBarre = surPC || saisie || conversation

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default', '--barre-basse': sansBarre ? '0px' : 'calc(80px + env(safe-area-inset-bottom))' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1, bgcolor: '#000000', color: '#ffffff' }}>
        <Toolbar sx={{ minHeight: { xs: 60, md: 68 }, gap: { xs: 0.5, sm: 2 } }}>
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
          <BoutonTaches />
          {!sansCloche && <BoutonMessages />}
          {!sansCloche && <Cloche />}
          <MenuCompte liens={surPC || franchise ? [] : [{ destinations: secondaires }, ...(sansParametres ? [] : [{ titre: 'Paramètres', destinations: parametres }])]} />
        </Toolbar>
        <Box aria-hidden sx={{ height: 4, background: brandStripe }} />
        {!surPC && rechercheOuverte && (
          <Box sx={{ px: 2, py: 1.5, bgcolor: 'background.paper', color: 'text.primary' }}>
            <RechercheGlobale onChoix={() => setRechercheOuverte(false)} />
          </Box>
        )}
      </AppBar>

      {surPC && <MenuLateral franchise={franchise} sansParametres={sansParametres} />}

      <Box component="main" sx={{ flex: 1, minWidth: 0, pt: { xs: '64px', md: '72px' }, pb: surPC ? 4 : conversation ? 0 : 'calc(96px + env(safe-area-inset-bottom))' }}>
        {bandeau}
        <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, sm: 3, md: 5 }, pt: { xs: 2, md: 3 } }}>{children}</Box>
      </Box>

      {!sansBarre && <BarreBasse franchise={franchise} />}
    </Box>
  )
}
