import type { ReactElement } from 'react'
import HomeOutlined from '@mui/icons-material/HomeOutlined'
import Home from '@mui/icons-material/Home'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import Storefront from '@mui/icons-material/Storefront'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import EventNote from '@mui/icons-material/EventNote'
import GroupsOutlined from '@mui/icons-material/GroupsOutlined'
import Groups from '@mui/icons-material/Groups'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import MapOutlined from '@mui/icons-material/MapOutlined'
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined'
import MonitorHeartOutlined from '@mui/icons-material/MonitorHeartOutlined'
import TimelineOutlined from '@mui/icons-material/TimelineOutlined'
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined'

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
  { chemin: '/', libelle: 'Accueil', description: 'Ce qui demande ton attention aujourd’hui', icone: <HomeOutlined />, iconeActive: <Home />, sprint: 'Sprint 4' },
  { chemin: '/magasins', libelle: 'Magasins', description: 'Tous les magasins, leur fiche complète et la carte', icone: <StorefrontOutlined />, iconeActive: <Storefront />, sprint: 'Sprint 1' },
  { chemin: '/visites', libelle: 'Visites', description: 'Visites terrain, audits et couverture du semestre', icone: <EventNoteOutlined />, iconeActive: <EventNote />, sprint: 'Sprint 3' },
  { chemin: '/equipe', libelle: 'Équipe', description: 'Organisation, charge des Coachs, postes à pourvoir, franchisés', icone: <GroupsOutlined />, iconeActive: <Groups />, sprint: 'Sprint 2' },
]

// Destinations secondaires : écran « Plus » sur téléphone, section « Pilotage » du menu sur PC
export const secondaires: Destination[] = [
  { chemin: '/plus/carte', libelle: 'Carte', description: 'Tous les magasins sur la carte, par Responsable Régional', icone: <MapOutlined />, sprint: 'Sprint 1' },
  { chemin: '/plus/agenda', libelle: 'Agenda', description: 'Ouvertures, anniversaires, événements et congés', icone: <CalendarMonthOutlined />, sprint: 'Sprint 3' },
  { chemin: '/plus/sante', libelle: 'Santé du parc', description: 'Nine box des magasins et suivi des déploiements', icone: <MonitorHeartOutlined />, sprint: 'Sprint 4' },
  { chemin: '/plus/evolution', libelle: 'Évolution du réseau', description: 'Ouvertures par année fiscale', icone: <TimelineOutlined />, sprint: 'Sprint 4' },
  { chemin: '/plus/direction', libelle: 'Direction', description: 'Règle de charge ; import et export Excel, sauvegarde', icone: <AdminPanelSettingsOutlined />, sprint: 'Sprint 5' },
]

export const plus: Destination = {
  chemin: '/plus', libelle: 'Plus', description: 'Pilotage et paramètres', icone: <MoreHoriz />, sprint: '',
}

export function destinationCourante(pathname: string): Destination {
  const toutes = [...secondaires, ...principales.slice(1)]
  return toutes.find((d) => pathname.startsWith(d.chemin)) ?? (pathname.startsWith('/plus') ? plus : principales[0])
}
