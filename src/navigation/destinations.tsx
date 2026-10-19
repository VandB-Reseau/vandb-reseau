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
import DashboardOutlined from '@mui/icons-material/DashboardOutlined'
import Dashboard from '@mui/icons-material/Dashboard'

export interface Destination {
  chemin: string
  libelle: string
  description: string
  icone: ReactElement
  iconeActive?: ReactElement
  sprint: string
}

// Destinations principales : barre du bas sur téléphone, haut du menu latéral sur PC
export const principales: Destination[] = [
  { chemin: '/', libelle: 'Dashboard', description: 'Ce qui demande ton attention aujourd’hui', icone: <DashboardOutlined />, iconeActive: <Dashboard />, sprint: 'Sprint 4' },
  { chemin: '/magasins', libelle: 'Magasins', description: 'Tous les magasins, leur fiche complète et la carte', icone: <StorefrontOutlined />, iconeActive: <Storefront />, sprint: 'Sprint 1' },
  { chemin: '/visites', libelle: 'Visites', description: 'Visites terrain, audits et couverture du semestre', icone: <EventNoteOutlined />, iconeActive: <EventNote />, sprint: 'Sprint 3' },
  { chemin: '/plus/sante', libelle: 'Santé du parc', description: 'Nine box des magasins et suivi des déploiements', icone: <MonitorHeartOutlined />, sprint: 'Sprint 4' },
]

// Suite de la partie classique : sous les principales dans le menu PC, dans « Plus » sur téléphone
export const secondaires: Destination[] = [
  { chemin: '/plus/agenda', libelle: 'Agenda', description: 'Ouvertures, anniversaires, événements et congés', icone: <CalendarMonthOutlined />, sprint: 'Sprint 3' },
  { chemin: '/equipe', libelle: 'Équipe', description: 'Organisation, charge des Coachs, postes à pourvoir', icone: <GroupsOutlined />, iconeActive: <Groups />, sprint: 'Sprint 2' },
]

// Partie « Paramètres »
export const parametres: Destination[] = [
  { chemin: '/parametres/evolution', libelle: 'Évolution du parc', description: 'Ouvertures par année', icone: <TimelineOutlined />, sprint: 'Sprint 4' },
  { chemin: '/parametres/collaborateurs', libelle: 'Collaborateurs', description: 'Coachs, Responsables Régionaux, Directeur de réseau', icone: <BadgeOutlined />, sprint: 'Sprint 4' },
  { chemin: '/parametres/franchises', libelle: 'Franchisés', description: 'Franchisés et leurs magasins', icone: <HandshakeOutlined />, sprint: 'Sprint 4' },
  { chemin: '/parametres/donnees', libelle: 'Import et export', description: 'Référentiels en Excel et sauvegarde complète', icone: <ImportExportOutlined />, sprint: 'Sprint 8' },
  { chemin: '/parametres/reglages', libelle: 'Paramètres', description: 'Charge des Coachs, alertes, nine box, audits', icone: <SettingsOutlined />, sprint: 'Sprint 5' },
]

export const plus: Destination = {
  chemin: '/plus', libelle: 'Plus', description: 'Agenda, équipe et paramètres', icone: <MoreHoriz />, sprint: '',
}

export function destinationCourante(pathname: string): Destination {
  const toutes = [...secondaires, ...parametres, ...principales.slice(1)]
  return toutes.find((d) => pathname.startsWith(d.chemin)) ?? (pathname.startsWith('/plus') || pathname.startsWith('/parametres') ? plus : principales[0])
}
