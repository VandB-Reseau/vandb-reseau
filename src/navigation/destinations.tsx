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
import NewspaperOutlined from '@mui/icons-material/NewspaperOutlined'
import Newspaper from '@mui/icons-material/Newspaper'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import Forum from '@mui/icons-material/Forum'
import MonitorHeart from '@mui/icons-material/MonitorHeart'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import TaskAlt from '@mui/icons-material/TaskAlt'
import InsightsOutlined from '@mui/icons-material/InsightsOutlined'
import RequestQuoteOutlined from '@mui/icons-material/RequestQuoteOutlined'
import RequestQuote from '@mui/icons-material/RequestQuote'
import Insights from '@mui/icons-material/Insights'
import QueryStatsOutlined from '@mui/icons-material/QueryStatsOutlined'
import QueryStats from '@mui/icons-material/QueryStats'

export interface Destination {
  chemin: string
  libelle: string
  court?: string // libellé de la barre du bas sur téléphone
  description: string
  icone: ReactElement
  iconeActive?: ReactElement
  sprint: string
  roles?: string[] // réservé à ces rôles ; absent = tous les rôles de l'équipe
}

const messages: Destination = { chemin: '/echanges', libelle: 'Messages', description: 'Groupes des magasins, échanges à deux et communications', icone: <ForumOutlined />, iconeActive: <Forum />, sprint: 'Échanges' }
const taches: Destination = { chemin: '/taches', libelle: 'Tâches', description: 'Mes tâches à faire et faites', icone: <TaskAltOutlined />, iconeActive: <TaskAlt />, sprint: 'Échanges' }
export const magasins: Destination = { chemin: '/magasins', libelle: 'Magasins', description: 'Tous les magasins, leur fiche complète et la carte', icone: <StorefrontOutlined />, iconeActive: <Storefront />, sprint: 'Sprint 1' }

// Destinations principales : barre du bas sur téléphone (Accueil, Visites, Messages, Tâches, Santé)
const accueil: Destination = { chemin: '/', libelle: 'Accueil', description: 'Ce qui demande ton attention aujourd’hui', icone: <HomeOutlined />, iconeActive: <Home />, sprint: 'Sprint 4' }
const visites: Destination = { chemin: '/visites', libelle: 'Visites', description: 'Visites terrain, audits et couverture du semestre', icone: <EventNoteOutlined />, iconeActive: <EventNote />, sprint: 'Sprint 3' }
const sante: Destination = { chemin: '/plus/sante', libelle: 'Santé du parc', court: 'Santé', description: 'Nine box et évaluation des magasins', icone: <MonitorHeartOutlined />, iconeActive: <MonitorHeart />, sprint: 'Sprint 4' }
export const principales: Destination[] = [accueil, magasins, visites, messages, taches, sante]
export const barreTelephone = principales.filter((d) => d !== magasins)

// Budgets (fusion avec le pilotage, Joseph 03/11/2026, option A) : budget et suivi d'un magasin dans sa fiche
export const budgets: Destination = { chemin: '/budgets', libelle: 'Budgets', description: 'Budgets de l’année, suivi face au réel, hypothèses, imports de caisse', icone: <RequestQuoteOutlined />, iconeActive: <RequestQuote />, sprint: 'Fusion' }
// Performance (refonte vague 2, Joseph 09/11/2026, 15A) : les chiffres du réseau en une page
export const performance: Destination = { chemin: '/performance', libelle: 'Performance', description: 'Chiffres des magasins, écarts au budget, évolution du parc', icone: <QueryStatsOutlined />, iconeActive: <QueryStats />, sprint: 'Refonte' }
export const agenda: Destination = { chemin: '/plus/agenda', libelle: 'Agenda', description: 'Visites, campagnes, formations et événements', icone: <CalendarMonthOutlined />, sprint: 'Sprint 3' }
// Rubrique Animation (refonte vague 3, Joseph 09/11/2026, 27A) : Infos réseau et Campagnes (campagnes, déploiements,
// challenges, et pour le Directeur et les RR le suivi des sondages, formations et réunions, ancien onglet de Messages)
export const infosReseau: Destination = { chemin: '/infos', libelle: 'Infos réseau', court: 'Infos', description: 'Communications et bonnes pratiques du réseau', icone: <NewspaperOutlined />, iconeActive: <Newspaper />, sprint: 'Sprint 22' }
export const campagnes: Destination = { chemin: '/campagnes', libelle: 'Campagnes', description: 'Campagnes, déploiements, challenges, sondages, formations et réunions, avec leur suivi', icone: <InsightsOutlined />, iconeActive: <Insights />, sprint: 'Refonte' }
export const animation = campagnes
export const secondaires: Destination[] = [campagnes, budgets, performance, agenda]
export const pourRole = (liste: Destination[], role: string | undefined) => liste.filter((d) => !d.roles || (!!role && d.roles.includes(role)))

// Réglages : Équipe et Paramètres. Évolution du parc est une vue de Magasins depuis la refonte (Joseph, 09/11/2026, 2A)
export const evolution: Destination = { chemin: '/performance?vue=evolution', libelle: 'Évolution du parc', description: 'Ouvertures par année', icone: <TimelineOutlined />, sprint: 'Sprint 4' }
export const parametres: Destination[] = [
  { chemin: '/equipe', libelle: 'Équipe', description: 'Organisation, portefeuilles, postes à pourvoir, collaborateurs, franchisés', icone: <GroupsOutlined />, iconeActive: <Groups />, sprint: 'Sprint 2' },
  { chemin: '/parametres/reglages', libelle: 'Paramètres', description: 'Charge des Coachs, import et export, alertes, nine box, audits', icone: <SettingsOutlined />, sprint: 'Sprint 5' },
]

// Menu latéral sur PC, en rubriques titrées (Joseph, 09/11/2026, choix 2A de la refonte ; Animation : vague 3, 27A)
export interface Rubrique { titre: string; destinations: Destination[] }
export function rubriquesMenu(sansParametres: boolean): Rubrique[] {
  return [
    { titre: 'Mon travail', destinations: [accueil, taches, messages, agenda] },
    { titre: 'Réseau', destinations: [magasins, visites, sante] },
    { titre: 'Animation', destinations: [infosReseau, campagnes] },
    { titre: 'Finances', destinations: [budgets, performance] },
    ...(sansParametres ? [] : [{ titre: 'Réglages', destinations: parametres }]),
  ]
}

// Espace d'un franchisé : ses magasins seulement, sans Paramètres
export const espaceFranchise: Destination[] = [
  { chemin: '/', libelle: 'Accueil', description: 'Mes chiffres, mes tâches, mes visites', icone: <HomeOutlined />, iconeActive: <Home />, sprint: 'Sprint 11' },
  { chemin: '/magasins', libelle: 'Mes magasins', description: 'Fiche, chiffres, visites et campagnes', icone: <StorefrontOutlined />, iconeActive: <Storefront />, sprint: 'Sprint 11' },
  { chemin: '/budgets', libelle: 'Mon budget', court: 'Budget', description: 'Budget de l’année, suivi face au réel et saisies', icone: <RequestQuoteOutlined />, iconeActive: <RequestQuote />, sprint: 'Fusion' },
  { ...messages, description: 'Mes magasins et mon équipe' },
  taches,
  // Communications et bonnes pratiques réunies, comme pour l'équipe (Joseph, 23/10/2026)
  infosReseau,
]

export const plus: Destination = {
  chemin: '/plus', libelle: 'Plus', description: 'Agenda, équipe et paramètres', icone: <MoreHoriz />, sprint: '',
}

export function destinationCourante(pathname: string): Destination {
  const toutes = [...secondaires, animation, evolution, ...parametres, ...principales.slice(1)]
  // Rubriques de Paramètres ouvertes sur leur propre écran
  if (pathname.startsWith('/parametres/charge') || pathname.startsWith('/parametres/donnees')) return parametres[1]
  return toutes.find((d) => pathname.startsWith(d.chemin)) ?? (pathname.startsWith('/plus') || pathname.startsWith('/parametres') ? plus : principales[0])
}
