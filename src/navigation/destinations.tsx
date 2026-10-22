import type { ReactElement } from 'react'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import Storefront from '@mui/icons-material/Storefront'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import EventNote from '@mui/icons-material/EventNote'
import GroupsOutlined from '@mui/icons-material/GroupsOutlined'
import Groups from '@mui/icons-material/Groups'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined'
import MonitorHeartOutlined from '@mui/icons-material/MonitorHeartOutlined'
import TimelineOutlined from '@mui/icons-material/TimelineOutlined'
import SettingsOutlined from '@mui/icons-material/SettingsOutlined'
import HomeOutlined from '@mui/icons-material/HomeOutlined'
import Home from '@mui/icons-material/Home'
import TipsAndUpdatesOutlined from '@mui/icons-material/TipsAndUpdatesOutlined'
import TipsAndUpdates from '@mui/icons-material/TipsAndUpdates'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import Forum from '@mui/icons-material/Forum'
import MonitorHeart from '@mui/icons-material/MonitorHeart'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import TaskAlt from '@mui/icons-material/TaskAlt'

export interface Destination {
  chemin: string
  libelle: string
  court?: string // libellé de la barre du bas sur téléphone
  description: string
  icone: ReactElement
  iconeActive?: ReactElement
  sprint: string
}

const messages: Destination = { chemin: '/echanges', libelle: 'Messages', description: 'Groupes des magasins, échanges à deux et communications', icone: <ForumOutlined />, iconeActive: <Forum />, sprint: 'Échanges' }
const taches: Destination = { chemin: '/taches', libelle: 'Tâches', description: 'Mes tâches à faire et faites', icone: <TaskAltOutlined />, iconeActive: <TaskAlt />, sprint: 'Échanges' }
export const magasins: Destination = { chemin: '/magasins', libelle: 'Magasins', description: 'Tous les magasins, leur fiche complète et la carte', icone: <StorefrontOutlined />, iconeActive: <Storefront />, sprint: 'Sprint 1' }

// Destinations principales : haut du menu latéral sur PC ; barre du bas sur téléphone sans Magasins, qui passe derrière
// la photo du compte et reste dans la recherche (Joseph, 22/10/2026 : Messages et Tâches séparés).
export const principales: Destination[] = [
  { chemin: '/', libelle: 'Accueil', description: 'Ce qui demande ton attention aujourd’hui', icone: <HomeOutlined />, iconeActive: <Home />, sprint: 'Sprint 4' },
  magasins,
  { chemin: '/visites', libelle: 'Visites', description: 'Visites terrain, audits et couverture du semestre', icone: <EventNoteOutlined />, iconeActive: <EventNote />, sprint: 'Sprint 3' },
  messages,
  taches,
  { chemin: '/plus/sante', libelle: 'Santé du parc', court: 'Santé', description: 'Nine box des magasins et suivi des déploiements', icone: <MonitorHeartOutlined />, iconeActive: <MonitorHeart />, sprint: 'Sprint 4' },
]
export const barreTelephone = principales.filter((d) => d !== magasins)

// Suite de la partie classique : sous les principales dans le menu PC, dans « Plus » sur téléphone
export const secondaires: Destination[] = [
  { chemin: '/plus/agenda', libelle: 'Agenda', description: 'Visites, campagnes et événements', icone: <CalendarMonthOutlined />, sprint: 'Sprint 3' },
]

// Partie « Paramètres » : trois entrées (sprint 21). Collaborateurs et Franchisés sont des onglets d'Équipe ;
// Charge des Coachs et Import et export sont des rubriques de Paramètres
export const parametres: Destination[] = [
  { chemin: '/equipe', libelle: 'Équipe', description: 'Organisation, portefeuilles, postes à pourvoir, collaborateurs, franchisés', icone: <GroupsOutlined />, iconeActive: <Groups />, sprint: 'Sprint 2' },
  { chemin: '/parametres/evolution', libelle: 'Évolution du parc', description: 'Ouvertures par année', icone: <TimelineOutlined />, sprint: 'Sprint 4' },
  { chemin: '/parametres/reglages', libelle: 'Paramètres', description: 'Charge des Coachs, import et export, alertes, nine box, audits', icone: <SettingsOutlined />, sprint: 'Sprint 5' },
]

// Espace d'un franchisé : ses magasins seulement, sans Paramètres
export const espaceFranchise: Destination[] = [
  { chemin: '/', libelle: 'Accueil', description: 'Mes chiffres, mes tâches, mes visites', icone: <HomeOutlined />, iconeActive: <Home />, sprint: 'Sprint 11' },
  { chemin: '/magasins', libelle: 'Mes magasins', description: 'Fiche, chiffres, visites et campagnes', icone: <StorefrontOutlined />, iconeActive: <Storefront />, sprint: 'Sprint 11' },
  { ...messages, description: 'Mes magasins, mon équipe et les communications du réseau' },
  taches,
  { chemin: '/bonnes-pratiques', libelle: 'Bonnes pratiques', court: 'Pratiques', description: 'Initiatives réussies du réseau', icone: <TipsAndUpdatesOutlined />, iconeActive: <TipsAndUpdates />, sprint: 'Sprint 11' },
]

export const plus: Destination = {
  chemin: '/plus', libelle: 'Plus', description: 'Agenda, équipe et paramètres', icone: <MoreHoriz />, sprint: '',
}

export function destinationCourante(pathname: string): Destination {
  const toutes = [...secondaires, ...parametres, ...principales.slice(1)]
  // Rubriques de Paramètres ouvertes sur leur propre écran
  if (pathname.startsWith('/parametres/charge') || pathname.startsWith('/parametres/donnees')) return parametres[2]
  return toutes.find((d) => pathname.startsWith(d.chemin)) ?? (pathname.startsWith('/plus') || pathname.startsWith('/parametres') ? plus : principales[0])
}
