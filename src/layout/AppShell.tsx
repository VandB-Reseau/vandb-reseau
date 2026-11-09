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
import Logout from '@mui/icons-material/Logout'
import KeyOutlined from '@mui/icons-material/KeyOutlined'
import InstallMobileOutlined from '@mui/icons-material/InstallMobileOutlined'
import Snackbar from '@mui/material/Snackbar'
import { DialogMotDePasse } from '../components/DialogMotDePasse'
import { DialogAgendaAbonne } from '../components/AgendaAbonne'
import { useApercu } from '../auth/Apercu'
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined'
import { Logo } from '../components/Logo'
import { RechercheGlobale } from '../components/RechercheGlobale'
import Badge from '@mui/material/Badge'
import Tooltip from '@mui/material/Tooltip'
import { useTotalEchanges } from '../data/echanges'
import { BoutonCreer } from '../components/Creer'
import { useInstallation } from '../lib/installation'
import { brandStripe } from '../theme/theme'
import { barreTelephone, magasins, parametres, pourRole, rubriquesMenu, secondaires, type Destination } from '../navigation/destinations'
import { CreerProvider } from '../components/Creer'
import { useCompteurTaches } from '../data/tachesVues'
import { useNouveautesInfos } from '../data/infosVues'
import NewspaperOutlined from '@mui/icons-material/NewspaperOutlined'
import { useAuth } from '../auth/AuthContext'
import { roleLibelle } from '../auth/roles'
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined'
import NotificationsOffOutlined from '@mui/icons-material/NotificationsOffOutlined'
import { activerNotifications, couperNotifications, ErreurNotifications, useNotificationsAppareil } from '../lib/notifications'

const LARGEUR_MENU = 248

function estActive(d: Destination, pathname: string): boolean {
  // Charge des Coachs et Import et export sont des rubriques de Paramètres
  if (d.chemin === '/parametres/reglages' && /^\/parametres\/(charge|donnees)/.test(pathname)) return true
  // Évolution du parc est une vue de Magasins, Animation réseau un onglet de Messages (refonte, Joseph 09/11/2026)
  if (d.chemin === '/magasins' && pathname.startsWith('/parametres/evolution')) return true
  if (d.chemin === '/echanges' && pathname.startsWith('/animation')) return true
  return d.chemin === '/' ? pathname === '/' : pathname.startsWith(d.chemin)
}

// liens : sur téléphone, les écrans hors de la barre du bas (agenda, équipe, paramètres)
function MenuCompte({ liens = [], ligne = false }: { liens?: { titre?: string; destinations: Destination[] }[]; ligne?: boolean }) {
  const { profil, deconnexion } = useAuth()
  const naviguer = useNavigate()
  const installation = useInstallation()
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  const [motDePasse, setMotDePasse] = useState(false)
  const [agenda, setAgenda] = useState(false)
  const { apercu, equipe } = useApercu()
  const [confirmation, setConfirmation] = useState('')
  const notifications = useNotificationsAppareil()
  const basculerNotifications = async () => {
    try {
      if (notifications.etat === 'actif') { await couperNotifications(); setConfirmation('Notifications coupées sur cet appareil.') }
      else { await activerNotifications(); setConfirmation('Notifications activées sur cet appareil.') }
    } catch (e) {
      setConfirmation(e instanceof ErreurNotifications ? e.message : 'Les notifications n’ont pas pu être activées. Réessaie dans un instant.')
    }
    notifications.relire()
  }
  if (!profil) return null
  const initiale = profil.nom.slice(0, 1).toUpperCase()
  return (
    <>
      {ligne ? (
        // PC : le compte en bas du menu, comme dans les apps de gestion (refonte, choix 1A)
        <ButtonBase aria-label="Mon compte" onClick={(e) => setAncre(e.currentTarget)} sx={{ width: '100%', minHeight: 56, px: 1.5, gap: 1.5, borderRadius: 2, justifyContent: 'flex-start', textAlign: 'left', '&:hover': { bgcolor: 'action.hover' } }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', color: 'secondary.contrastText', fontWeight: 600, fontSize: '0.875rem' }}>{initiale}</Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{profil.nom}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">{roleLibelle[profil.role]}</Typography>
          </Box>
        </ButtonBase>
      ) : (
        <IconButton aria-label="Mon compte" onClick={(e) => setAncre(e.currentTarget)} sx={{ p: 0.5 }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: 'secondary.main', color: 'secondary.contrastText', fontWeight: 600 }}>{initiale}</Avatar>
        </IconButton>
      )}
      <Menu anchorEl={ancre} open={!!ancre} onClose={() => setAncre(null)} anchorOrigin={ligne ? { vertical: 'top', horizontal: 'left' } : { vertical: 'bottom', horizontal: 'right' }} transformOrigin={ligne ? { vertical: 'bottom', horizontal: 'left' } : { vertical: 'top', horizontal: 'right' }}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2">{profil.email}</Typography>
          <Typography variant="caption" color="text.secondary">{roleLibelle[profil.role]}</Typography>
        </Box>
        <Divider />
        {liens.flatMap((g, i) => [
          g.titre ? <ListSubheader key={`t${i}`} sx={{ lineHeight: '36px', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{g.titre}</ListSubheader> : null,
          ...g.destinations.map((d) => (
            <MenuItem key={d.chemin} onClick={() => { setAncre(null); naviguer(d.chemin) }} sx={{ minHeight: { xs: 48, sm: 48 } }}>
              <ListItemIcon>{d.icone}</ListItemIcon>
              {d.libelle}
            </MenuItem>
          )),
          <Divider key={`d${i}`} />,
        ])}
        {installation && (
          <MenuItem onClick={() => { setAncre(null); installation() }} sx={{ minHeight: { xs: 48, sm: 48 } }}>
            <ListItemIcon><InstallMobileOutlined fontSize="small" /></ListItemIcon>
            Installer l’app
          </MenuItem>
        )}
        {notifications.etat !== 'indisponible' && (
          <MenuItem disabled={notifications.etat === 'bloque'} onClick={() => { setAncre(null); void basculerNotifications() }} sx={{ minHeight: { xs: 48, sm: 48 } }}>
            <ListItemIcon>{notifications.etat === 'actif' ? <NotificationsOffOutlined fontSize="small" /> : <NotificationsActiveOutlined fontSize="small" />}</ListItemIcon>
            {notifications.etat === 'actif' ? 'Couper les notifications sur cet appareil' : notifications.etat === 'bloque' ? 'Notifications bloquées sur cet appareil' : 'Recevoir les notifications sur cet appareil'}
          </MenuItem>
        )}
        {['directeur', 'rr', 'coach'].includes(profil.role) && !apercu && !equipe && (
          <MenuItem onClick={() => { setAncre(null); setAgenda(true) }} sx={{ minHeight: { xs: 48, sm: 48 } }}>
            <ListItemIcon><EventAvailableOutlined fontSize="small" /></ListItemIcon>
            Mon agenda dans Google Agenda
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
      {agenda && <DialogAgendaAbonne onFermer={(msg) => { setAgenda(false); if (msg) setConfirmation(msg) }} />}
      {motDePasse && <DialogMotDePasse onFermer={(msg) => { setMotDePasse(false); if (msg) setConfirmation(msg) }} />}
      <Snackbar open={!!confirmation} autoHideDuration={5000} onClose={() => setConfirmation('')} message={confirmation} />
    </>
  )
}

// Icône d'une destination ; Messages porte le nombre de nouveautés, Tâches celui des tâches en retard ou nouvelles,
// Infos réseau (franchisé) celui des communications et bonnes pratiques pas encore vues
interface Compteurs { messages: number; taches: number; infos: number }
const compteDe = (d: Destination, c: Compteurs) => (d.chemin === '/echanges' ? c.messages : d.chemin === '/taches' ? c.taches : d.chemin === '/infos' ? c.infos : 0)
function useCompteurs(sansCompteur?: boolean, franchise?: boolean): Compteurs {
  return { messages: useTotalEchanges(sansCompteur), taches: useCompteurTaches(sansCompteur), infos: useNouveautesInfos(sansCompteur || !franchise) }
}
function Icone({ d, actif, c }: { d: Destination; actif: boolean; c: Compteurs }) {
  const icone = actif ? d.iconeActive ?? d.icone : d.icone
  const n = compteDe(d, c)
  if (!n) return icone
  return <Badge color="error" badgeContent={n} max={99} sx={{ '& .MuiBadge-badge': { fontSize: '0.75rem' } }}>{icone}</Badge>
}
const libelleAccessible = (d: Destination, c: Compteurs) => {
  const n = compteDe(d, c)
  if (!n) return undefined
  return d.chemin === '/taches' ? `${d.libelle} : ${n} en retard ou nouvelle${n > 1 ? 's' : ''}` : `${d.libelle} : ${n} nouveauté${n > 1 ? 's' : ''}`
}

// Menu latéral clair (refonte, Joseph 09/11/2026, choix 1A et 2A) : logo et recherche en haut, quatre rubriques titrées,
// Infos réseau et le compte en bas. Plus de barre noire au-dessus des pages.
const titreRubrique = { bgcolor: 'transparent', px: 1.5, lineHeight: '32px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' } as const
function MenuLateral({ franchise, sansParametres, sansCompteur }: { franchise?: Destination[]; sansParametres?: boolean; sansCompteur?: boolean }) {
  const { pathname } = useLocation()
  const naviguer = useNavigate()
  const c = useCompteurs(sansCompteur, !!franchise)
  const item = (d: Destination) => {
    const actif = estActive(d, pathname)
    return (
      <ListItemButton key={d.chemin} selected={actif} onClick={() => naviguer(d.chemin)} aria-label={libelleAccessible(d, c)} aria-current={actif ? 'page' : undefined}
        sx={{ mb: 0.25, minHeight: 40, px: 1.5, borderRadius: 2, '&.Mui-selected': { bgcolor: 'action.selected', boxShadow: (t) => `inset 3px 0 0 ${t.palette.secondary.main}` } }}>
        <ListItemIcon sx={{ minWidth: 34, color: actif ? 'text.primary' : 'text.secondary', '& svg': { fontSize: 20 } }}><Icone d={d} actif={actif} c={c} /></ListItemIcon>
        <ListItemText primary={d.libelle} slotProps={{ primary: { sx: { fontWeight: actif ? 700 : 500, fontSize: '0.875rem' } } }} />
      </ListItemButton>
    )
  }
  return (
    <Drawer
      variant="permanent"
      sx={{ width: LARGEUR_MENU, flexShrink: 0, '& .MuiDrawer-paper': { width: LARGEUR_MENU, boxSizing: 'border-box', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column' } }}
    >
      <Box sx={{ px: 2, pt: 2, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box sx={{ bgcolor: '#000000', borderRadius: 1.5, px: 0.75, py: 0.5, display: 'flex' }}><Logo size={14} /></Box>
        <Typography component="span" sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>{franchise ? 'Espace franchisé' : 'Réseau'}</Typography>
      </Box>
      <Box aria-hidden sx={{ height: 3, mx: 2, mb: 1.5, borderRadius: 2, background: brandStripe }} />
      {!franchise && <Box sx={{ px: 1.5, pb: 1 }}><RechercheGlobale menu /></Box>}
      <Box component="nav" aria-label="Navigation principale" sx={{ px: 1, flex: 1, overflowY: 'auto' }}>
        {franchise
          ? <List disablePadding>{franchise.map(item)}</List>
          : rubriquesMenu(!!sansParametres).map((r) => (
            <List key={r.titre} disablePadding sx={{ mb: 1 }} subheader={<ListSubheader disableSticky sx={titreRubrique}>{r.titre}</ListSubheader>}>
              {r.destinations.map(item)}
            </List>
          ))}
      </Box>
      <Box sx={{ px: 1, pb: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider', display: 'grid', gap: 0.5 }}>
        {!franchise && <BoutonInfos ligne />}
        <MenuCompte ligne />
      </Box>
    </Drawer>
  )
}

// Infos réseau, à droite du « + » : communications et bonnes pratiques, avec le nombre de nouveautés pas encore vues
function BoutonInfos({ ligne = false }: { ligne?: boolean }) {
  const naviguer = useNavigate()
  const { pathname } = useLocation()
  const n = useNouveautesInfos()
  const libelle = n ? `Infos réseau : ${n} nouveauté${n > 1 ? 's' : ''}` : 'Infos réseau'
  if (ligne) return (
    <ListItemButton selected={pathname === '/infos'} onClick={() => naviguer('/infos')} aria-label={libelle} aria-current={pathname === '/infos' ? 'page' : undefined} sx={{ minHeight: 40, px: 1.5, borderRadius: 2 }}>
      <ListItemIcon sx={{ minWidth: 34, color: 'text.secondary', '& svg': { fontSize: 20 } }}><Badge color="error" badgeContent={n} max={99} sx={{ '& .MuiBadge-badge': { fontSize: '0.75rem' } }}><NewspaperOutlined /></Badge></ListItemIcon>
      <ListItemText primary="Infos réseau" slotProps={{ primary: { sx: { fontWeight: 500, fontSize: '0.875rem' } } }} />
    </ListItemButton>
  )
  return (
    <Tooltip title="Infos réseau">
      <IconButton aria-label={libelle} aria-current={pathname === '/infos' ? 'page' : undefined} onClick={() => naviguer('/infos')} sx={{ width: 48, height: 48, flexShrink: 0, color: 'text.primary' }}>
        <Badge color="error" badgeContent={n} max={99} sx={{ '& .MuiBadge-badge': { fontSize: '0.75rem' } }}><NewspaperOutlined /></Badge>
      </IconButton>
    </Tooltip>
  )
}

const HAUTEUR_BARRE = 64

function BarreBasse({ franchise, sansCompteur }: { franchise?: Destination[]; sansCompteur?: boolean }) {
  const { pathname } = useLocation()
  const naviguer = useNavigate()
  const c = useCompteurs(sansCompteur, !!franchise)
  const item = (d: Destination) => {
    const actif = estActive(d, pathname)
    return (
      <ButtonBase key={d.chemin} onClick={() => naviguer(d.chemin)} aria-current={actif ? 'page' : undefined} aria-label={libelleAccessible(d, c)}
        sx={{ flex: 1, minWidth: 0, height: HAUTEUR_BARRE, borderRadius: 999, color: actif ? 'text.primary' : 'text.secondary', fontSize: '0.75rem', fontWeight: actif ? 600 : 500 }}>
        {/* Onglet actif posé sur une pastille, comme les barres en verre d'iOS */}
        <Box sx={{ width: '100%', height: HAUTEUR_BARRE - 10, borderRadius: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.25, ...(actif ? { bgcolor: 'action.selected' } : {}) }}>
          <Icone d={d} actif={actif} c={c} />
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
        {(franchise ?? barreTelephone).map(item)}
      </Box>
    </Paper>
  )
}

// franchise : navigation réduite de l'espace franchisé (sans recherche ni Paramètres) ; bandeau : sous l'en-tête ;
// sansParametres : Coach ou Responsable Régional ; sansCompteur : aperçu de l'espace d'un franchisé, sans ses nouveautés
export function AppShell({ children, franchise, bandeau, sansParametres = false, sansCompteur = false }: { children: ReactNode; franchise?: Destination[]; bandeau?: ReactNode; sansParametres?: boolean; sansCompteur?: boolean }) {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const { pathname } = useLocation()
  const { profil } = useAuth()
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
  const conversation = /^\/echanges\/(magasin|groupe|personne)\/.|^\/echanges\/(reseau|pratiques)$/.test(pathname)
  const sansBarre = surPC || saisie || conversation

  return (
    <CreerProvider>
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default', '--barre-basse': sansBarre ? '0px' : 'calc(80px + env(safe-area-inset-bottom))' }}>
      {/* Téléphone : barre du haut claire (logo, recherche, « + », infos, compte). PC : plus de barre du haut, tout est dans le menu */}
      {!surPC && (
        <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1, bgcolor: 'background.paper', color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Toolbar sx={{ minHeight: 60, gap: 0.5, px: { xs: 1.5, sm: 2 } }}>
            <Box sx={{ bgcolor: '#000000', borderRadius: 1.5, px: 0.75, py: 0.5, display: 'flex', flexShrink: 0 }}><Logo size={14} /></Box>
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center', px: 0.5 }}>
              {!franchise && <RechercheGlobale court />}
              {franchise && <Typography component="span" sx={{ fontWeight: 700, mr: 'auto', ml: 1 }}>Espace franchisé</Typography>}
            </Box>
            {!franchise && <BoutonCreer entete />}
            {!franchise && <BoutonInfos />}
            <MenuCompte liens={franchise ? [] : [{ destinations: [magasins, ...pourRole(secondaires, profil?.role)] }, ...(sansParametres ? [] : [{ titre: 'Réglages', destinations: parametres }])]} />
          </Toolbar>
        </AppBar>
      )}

      {surPC && <MenuLateral franchise={franchise} sansParametres={sansParametres} sansCompteur={sansCompteur} />}

      <Box component="main" sx={{ flex: 1, minWidth: 0, pt: { xs: '64px', md: 0 }, pb: surPC ? 4 : conversation ? 0 : 'calc(96px + env(safe-area-inset-bottom))' }}>
        {bandeau}
        <Box sx={{ maxWidth: 1360, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, pt: { xs: 1.5, md: 3 } }}>{children}</Box>
      </Box>

      {!sansBarre && <BarreBasse franchise={franchise} sansCompteur={sansCompteur} />}
    </Box>
    </CreerProvider>
  )
}
