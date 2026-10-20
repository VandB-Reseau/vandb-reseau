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
import BadgeOutlined from '@mui/icons-material/BadgeOutlined'
import HandshakeOutlined from '@mui/icons-material/HandshakeOutlined'
import ImportExportOutlined from '@mui/icons-material/ImportExportOutlined'
import HomeOutlined from '@mui/icons-material/HomeOutlined'
import Home from '@mui/icons-material/Home'
import TipsAndUpdatesOutlined from '@mui/icons-material/TipsAndUpdatesOutlined'
import TipsAndUpdates from '@mui/icons-material/TipsAndUpdates'

export interface Destination {
  chemin: string
  libelle: string
  court?: string // libellé de la barre du bas sur téléphone
  description: string
  icone: ReactElement
  iconeActive?: ReactElement
  sprint: string
}

// Destinations principales : barre du bas sur téléphone (avec le bouton Créer au centre), haut du menu latéral sur PC.
// Messages et Tâches sont des icônes de l'en-tête, à côté de la cloche ; le reste est derrière la photo du compte.
export const principales: Destination[] = [
  { chemin: '/', libelle: 'Accueil', description: 'Ce qui demande ton attention aujourd’hui', icone: <HomeOutlined />, iconeActive: <Home />, sprint: 'Sprint 4' },
  { chemin: '/magasins', libelle: 'Magasins', description: 'Tous les magasins, leur fiche complète et la carte', icone: <StorefrontOutlined />, iconeActive: <Storefront />, sprint: 'Sprint 1' },
  { chemin: '/visites', libelle: 'Visites', description: 'Visites terrain, audits et couverture du semestre', icone: <EventNoteOutlined />, iconeActive: <EventNote />, sprint: 'Sprint 3' },
  { chemin: '/plus/sante', libelle: 'Santé du parc', court: 'Santé', description: 'Nine box des magasins et suivi des déploiements', icone: <MonitorHeartOutlined />, sprint: 'Sprint 4' },
]

// Suite de la partie classique : sous les principales dans le menu PC, dans « Plus » sur téléphone
export const secondaires: Destination[] = [
  { chemin: '/plus/agenda', libelle: 'Agenda', description: 'Ouvertures, anniversaires, événements et congés', icone: <CalendarMonthOutlined />, sprint: 'Sprint 3' },
]

// Partie « Paramètres »
export const parametres: Destination[] = [
  { chemin: '/equipe', libelle: 'Équipe', description: 'Organisation, charge des Coachs, postes à pourvoir', icone: <GroupsOutlined />, iconeActive: <Groups />, sprint: 'Sprint 2' },
  { chemin: '/parametres/evolution', libelle: 'Évolution du parc', description: 'Ouvertures par année', icone: <TimelineOutlined />, sprint: 'Sprint 4' },
  { chemin: '/parametres/collaborateurs', libelle: 'Collaborateurs', description: 'Coachs, Responsables Régionaux, Directeur de réseau', icone: <BadgeOutlined />, sprint: 'Sprint 4' },
  { chemin: '/parametres/franchises', libelle: 'Franchisés', description: 'Franchisés et leurs magasins', icone: <HandshakeOutlined />, sprint: 'Sprint 4' },
  { chemin: '/parametres/donnees', libelle: 'Import et export', description: 'Référentiels en Excel et sauvegarde complète', icone: <ImportExportOutlined />, sprint: 'Sprint 8' },
  { chemin: '/parametres/reglages', libelle: 'Paramètres', description: 'Charge des Coachs, alertes, nine box, audits', icone: <SettingsOutlined />, sprint: 'Sprint 5' },
]

// Espace d'un franchisé : ses magasins seulement, sans Paramètres
export const espaceFranchise: Destination[] = [
  { chemin: '/', libelle: 'Accueil', description: 'Mes chiffres, mon plan d’action, mes visites', icone: <HomeOutlined />, iconeActive: <Home />, sprint: 'Sprint 11' },
  { chemin: '/magasins', libelle: 'Mes magasins', description: 'Fiche, chiffres, visites et campagnes', icone: <StorefrontOutlined />, iconeActive: <Storefront />, sprint: 'Sprint 11' },
  { chemin: '/bonnes-pratiques', libelle: 'Bonnes pratiques', description: 'Initiatives réussies du réseau', icone: <TipsAndUpdatesOutlined />, iconeActive: <TipsAndUpdates />, sprint: 'Sprint 11' },
]

export const plus: Destination = {
  chemin: '/plus', libelle: 'Plus', description: 'Agenda, équipe et paramètres', icone: <MoreHoriz />, sprint: '',
}

export function destinationCourante(pathname: string): Destination {
  const toutes = [...secondaires, ...parametres, ...principales.slice(1)]
  return toutes.find((d) => pathname.startsWith(d.chemin)) ?? (pathname.startsWith('/plus') || pathname.startsWith('/parametres') ? plus : principales[0])
}
