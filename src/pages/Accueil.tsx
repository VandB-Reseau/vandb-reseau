import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Badge from '@mui/material/Badge'
import Drawer from '@mui/material/Drawer'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { visuellementCache } from '../lib/accessibilite'
import FilterListOutlined from '@mui/icons-material/FilterListOutlined'
import Tooltip from '@mui/material/Tooltip'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined'
import TodayOutlined from '@mui/icons-material/TodayOutlined'
import PersonSearchOutlined from '@mui/icons-material/PersonSearchOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import QueryStatsOutlined from '@mui/icons-material/QueryStatsOutlined'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import HandshakeOutlined from '@mui/icons-material/HandshakeOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined'
import TipsAndUpdatesOutlined from '@mui/icons-material/TipsAndUpdatesOutlined'
import HistoryOutlined from '@mui/icons-material/HistoryOutlined'
import CelebrationOutlined from '@mui/icons-material/CelebrationOutlined'
import SnoozeOutlined from '@mui/icons-material/SnoozeOutlined'
import FlagOutlined from '@mui/icons-material/FlagOutlined'
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined'
import { AvecReseau } from '../components/EtatDonnees'
import { FenetreCompteRendu, PieceJointe, useOuvrirCompteRendu } from '../components/ApercuCompteRendu'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import { CarteLignes, GrillePhotos, Initiales, LigneCompacte, Pastille, Puces, TitreSection, type Ton } from '../components/Social'
import { analyser, caDe, chiffresDuMagasin, decalerMois, formatKEuros, formatPourcent, libelleMoisCourt, suiviAlerte } from '../data/chiffres'
import { useAuth } from '../auth/AuthContext'
import { useMessagerie } from '../data/MessagerieContext'
import { caseDe, nineBox, tendance } from '../data/sante'
import { anneeDe, suiviRythme, type LigneRythme, lienVisite } from '../data/visites'
import { chargeA, coachA, libelleSuivi, niveauCharge, suivi } from '../data/charge'
import { dateCourte, lienCoach, lienFiche } from '../lib/format'
import { ajouterJours, elementsDuMois, jourLong } from '../data/agenda'
import { nomsVisiteurs, type Magasin, type Reseau, type Visite } from '../data/modele'
import { estVisite } from '../data/chiffres'
import { DialogVisite } from '../components/DialogVisite'
import { DialogPlanifier } from '../components/DialogPlanifier'
import { marquerVisiteFaite } from '../data/chargement'
import { useReseau } from '../data/ReseauContext'
import { messageErreur } from '../components/EditionEquipe'
import { magasinsDu, perimetreDuProfil, personnesDu, type Perimetre } from '../data/perimetre'
import { AuMagasin } from '../components/AuMagasin'
import SupportAgentOutlined from '@mui/icons-material/SupportAgentOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import Collapse from '@mui/material/Collapse'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import { aTraiterParLeSiege, enAttenteLongue, libelleTheme, useDemandes, type Demande } from '../data/demandes'
import { useEntretiens, type Entretien } from '../data/entretiens'
import { dateRelative } from '../lib/format'
import { libelleMois } from '../data/chiffres'
import type { Profil } from '../auth/roles'
import { libelleTypeVisite } from '../data/modele'
import { PageHeader } from '../components/PageHeader'
import { SelecteurPerimetre } from '../components/SelecteurPerimetre'
import { rappelsVisites } from '../data/ordreDuJour'
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined'
import RateReviewOutlined from '@mui/icons-material/RateReviewOutlined'
import { actionsDes, actionsEnCours, echeanceDate, enRetard, monNomPorteur, portePar, type ActionSuivie } from '../data/actions'
import { useEcritureActions } from '../components/Actions'
import { libellesEtatMandat, mandatsARenouveler } from '../data/associes'
import { bilan, magasinsConcernes, phase } from '../data/campagnes'
import { filDu, quand, type ElementFil, type GenreFil } from '../data/fil'
import { useCommunicationsDuFil, type CommunicationsDuFil } from '../data/communications'
import { MarqueUne, ReactionsCommunication } from './Communications'
import { useApercu } from '../auth/Apercu'
import Snackbar from '@mui/material/Snackbar'
import { VisuelFil } from '../components/MiseEnForme'
import { ReactionsPratique } from '../components/BonnesPratiques'
import { useReactionsPratiques, type ReactionsPratiques } from '../data/reactionsPratiques'
import { basculerPouceVisite, commenterVisite, messageReactionVisite, supprimerCommentaireVisite, useReactionsVisites, type ReactionsVisites } from '../data/reactionsVisites'
import { Reactions, ReactionsEnAttente } from '../components/Reactions'
import { BandeCollante } from '../components/Collant'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { SondagesARepondre } from '../components/Questions'
import { brand } from '../theme/theme'
import { Blason } from '../components/Blason'
import { Indicateur } from '../components/Indicateur'
import { ALaUne, aLaUneDuJour, connaissancesEnAttente } from '../components/ALaUne'
import { prendreConnaissance, useConnaissances, type Communication, type Connaissance } from '../data/communications'
import { ActionsSimples, AJour, BarrePartager, BoutonConnaissance, CartePublication, estPublication, instantFil, useDernierPassage, useSuiteAutomatique } from '../components/Publication'
import { libellesResponsable, parcoursDu } from '../data/integration'
import { misDeCote, mettrePlusTard, reprendre, usePlusTard } from '../data/plusTard'
import { useMessageAnnulable } from '../components/Annulable'
import { BarrePeriode, usePeriodeCommune } from '../components/BarrePeriode'

// Ordre de priorité fixé par Joseph le 14/10/2026
const PRIORITAIRES = ['redressement', 'relance', 'renforcer']
const APERCU = 5
// Téléphone : le bloc reste court pour laisser la place aux actualités (Joseph, 22/10/2026)
const APERCU_COMPACT = 2

// Une ligne « À traiter » : un avatar, deux lignes de texte, une seule pastille (la plus grave)
// Un magasin sans picto propre (tâche, visite prévue, mandat) a son blason de ville ; le reste garde ses initiales
function avatarATraiter(reseau: Reseau, x: ATraiter) {
  const m = x.icone ? undefined : reseau.magasins.find((y) => y.nom === x.avatar)
  return m ? <Blason magasin={m} /> : <Initiales nom={x.avatar} icone={x.icone} />
}

interface ATraiter { cle: string; sujet?: string; nom?: string; titre: string; detail: string; lien: string; avatar: string; icone?: ReactNode; pastille?: { ton: Ton; libelle: string }; visite?: Visite; tache?: ActionSuivie }

function aTraiter(reseau: Reseau, p: Perimetre, sansParametres: boolean, moi = ''): ATraiter[] {
  const j = reseau.jour
  const perimetre = magasinsDu(reseau, p)
  const noms = new Set(perimetre.map((m) => m.nom))
  const actifs = perimetre.filter((m) => m.statut !== 'avenir')
  const avecCoach = p.type !== 'coach'
  const coachDe = (m: Magasin) => (avecCoach ? `${libelleSuivi(m, coachA(m, j))} · ` : '')
  const items: ATraiter[] = []
  const vus = new Set<string>()
  // Démarche coach : les magasins qui décrochent d'abord (appel en retard en tête), puis ceux à surveiller
  const alertes = actifs.map((m) => { const an = analyser(reseau, m.nom); return { m, an, suivi: suiviAlerte(reseau, m.nom, an) } })
    .filter((x) => x.an?.statut === 'decroche' || x.an?.statut === 'surveiller')
    .sort((x, y) => (x.an!.statut === y.an!.statut ? 0 : x.an!.statut === 'decroche' ? -1 : 1) || (y.suivi?.retard ?? 0) - (x.suivi?.retard ?? 0) || (x.an!.ecart ?? 0) - (y.an!.ecart ?? 0))
  for (const { m, an, suivi } of alertes) {
    vus.add(m.nom)
    const appel = suivi && !suivi.contact ? (suivi.retard > 0 ? `appel en retard de ${suivi.retard} j` : `à appeler avant le ${dateCourte(suivi.limite)}`) : ''
    items.push({ cle: `a-${m.nom}`, titre: m.nom, avatar: m.nom, lien: lienFiche(m.nom), detail: coachDe(m) + [an!.raisons.join(' · '), appel].filter(Boolean).join(' · '),
      pastille: an!.statut === 'decroche' ? { ton: 'rouge', libelle: 'Décroche' } : { ton: 'orange', libelle: 'À surveiller' } })
  }
  // Tâches en retard ou à échéance dans les quinze jours
  const dans15j = ajouterJours(j, 15)
  for (const x of actionsEnCours(reseau, noms).filter((x) => echeanceDate(x.a) && echeanceDate(x.a) <= dans15j).sort((x, y) => echeanceDate(x.a).localeCompare(echeanceDate(y.a)))) {
    const retard = enRetard(x.a, j)
    items.push({ cle: `t-${x.cle}`, titre: x.a.action, avatar: x.a.action, icone: <TaskAltOutlined />, lien: `${lienFiche(x.magasin)}?vue=actions`,
      detail: [x.magasin, x.libre?.exterieur && `Marché extérieur : ${x.libre.exterieur.nom}`, x.a.porteur, `pour le ${dateCourte(echeanceDate(x.a))}`].filter(Boolean).join(' · '), pastille: retard ? { ton: 'rouge', libelle: 'En retard' } : undefined, tache: x })
  }
  // Refonte vague 4 (32A) : une tâche bloquée attend qu'on la débloque, quelle que soit son échéance
  for (const x of actionsEnCours(reseau, noms).filter((x) => x.a.statut === 'bloquee' && !items.some((i) => i.cle === `t-${x.cle}`))) {
    items.push({ cle: `t-${x.cle}`, titre: x.a.action, avatar: x.a.action, icone: <TaskAltOutlined />, lien: `${lienFiche(x.magasin)}?vue=actions`,
      detail: [x.magasin, x.libre?.exterieur && `Marché extérieur : ${x.libre.exterieur.nom}`, x.a.porteur, x.a.raison && `bloquée : ${x.a.raison}`].filter(Boolean).join(' · '), pastille: { ton: 'rouge', libelle: 'Bloquée' }, tache: x })
  }
  for (const i of items) if (i.tache?.a.statut === 'bloquee' && i.pastille?.libelle !== 'Bloquée' && i.pastille?.ton !== 'rouge') i.pastille = { ton: 'rouge', libelle: 'Bloquée' }
  // Visites planifiées dont la date est passée sans compte rendu : faites ou à reporter
  for (const v of reseau.visites.filter((v) => v.prevue && v.date < j && v.id !== null && noms.has(v.magasin) && estVisite(v)).sort((x, y) => x.date.localeCompare(y.date))) {
    items.push({ cle: `vp-${v.id}`, titre: v.magasin, avatar: v.magasin, icone: <EventAvailableOutlined />, lien: '', visite: v,
      detail: [`Prévue le ${dateCourte(v.date)}`, nomsVisiteurs(v)].filter(Boolean).join(' · '), pastille: { ton: 'orange', libelle: 'À relancer' } })
  }
  // Vague 7 (85A) : mes visites à préparer (3 jours avant), compte rendu à écrire, signature attendue
  if (moi) {
    for (const r of rappelsVisites(reseau, noms, moi)) {
      items.push({ cle: r.cle, titre: r.magasin, avatar: r.magasin, icone: r.genre === 'preparer' ? <AssignmentOutlined /> : <RateReviewOutlined />,
        lien: `${lienVisite(r.visite).split('?')[0]}?id=${r.visite.id}&etape=${r.genre === 'preparer' ? 'preparer' : r.genre === 'signature' ? 'suivi' : 'surplace'}`, detail: r.detail,
        pastille: r.genre === 'preparer' ? { ton: 'gris', libelle: 'À venir' } : r.genre === 'compterendu' ? { ton: 'type', libelle: 'Compte rendu' } : { ton: 'type', libelle: 'Signature' } })
    }
  }
  const a = anneeDe(j)
  // Magasins pas vus depuis plus longtemps que le délai de leur case : les plus en dépassement d'abord
  const ecart = (l: LigneRythme) => (l.depuis === null ? Infinity : l.depuis - l.delai)
  for (const l of suiviRythme(reseau, a).filter((l) => l.alerte && noms.has(l.magasin.nom)).sort((x, y) => ecart(y) - ecart(x))) {
    items.push({ cle: `v-${l.magasin.nom}`, titre: l.magasin.nom, avatar: l.magasin.nom, lien: lienFiche(l.magasin.nom),
      detail: (avecCoach ? `${libelleSuivi(l.magasin, l.coach)} · ` : '') + [l.case?.libelle ?? 'Non classé', l.derniere ? `pas vu depuis ${l.depuis} j` : 'jamais visité', l.dernierContact && `appel le ${dateCourte(l.dernierContact.date)}`].filter(Boolean).join(' · '), pastille: { ton: 'type', libelle: 'Visite' } })
  }
  for (const { m, c } of actifs.map((m) => ({ m, c: caseDe(reseau.evaluations[m.nom]) })).filter((x) => x.c && PRIORITAIRES.includes(x.c.id) && !vus.has(x.m.nom))
    .sort((x, y) => PRIORITAIRES.indexOf(x.c!.id) - PRIORITAIRES.indexOf(y.c!.id))) {
    items.push({ cle: `s-${m.nom}`, titre: m.nom, avatar: m.nom, lien: lienFiche(m.nom), detail: coachDe(m) + `rythme conseillé ${c!.rythme}`, pastille: { ton: c!.id === 'redressement' ? 'rouge' : 'orange', libelle: c!.libelle } })
  }
  // Magasins qui ont reculé d'une case ces trois derniers mois
  const il3mois = ajouterJours(j, -92)
  for (const { m, t } of actifs.map((m) => ({ m, t: tendance(reseau.evaluations, m.nom) })).filter((x) => x.t?.precedente && x.t.depuis >= il3mois && x.t.sens === 'descend')) {
    items.push({ cle: `c-${m.nom}`, titre: m.nom, avatar: m.nom, lien: lienFiche(m.nom), detail: `${dateCourte(t!.depuis)} · ${t!.precedente!.libelle} vers ${t!.actuelle.libelle}`, pastille: { ton: 'orange', libelle: 'En dessous' } })
  }
  if (p.type !== 'coach') {
    const coachsVus = reseau.equipe.filter((c) => p.type === 'reseau' || (p.type === 'rr' && c.rr?.id === p.id))
    for (const x of coachsVus.filter((c) => !c.fictif).map((c) => ({ c, charge: chargeA(reseau, c.nom) })).filter((x) => ['depassement', 'complet'].includes(niveauCharge(reseau, x.charge))).sort((a, b) => b.charge - a.charge)) {
      items.push({ cle: `ch-${x.c.nom}`, titre: x.c.nom, avatar: x.c.nom, lien: lienCoach(x.c.nom), detail: `Charge ${x.charge} sur ${reseau.parametres.maxUnits}`, pastille: { ton: 'orange', libelle: 'Surchargé' } })
    }
    for (const c of coachsVus.filter((c) => c.fictif)) items.push({ cle: `pv-${c.nom}`, titre: c.nom, avatar: c.nom, icone: <PersonSearchOutlined />, lien: lienCoach(c.nom), detail: 'Poste de Coach à pourvoir', pastille: { ton: 'gris', libelle: 'Sans Coach' } })
    for (const m of actifs.filter((m) => !suivi(m, coachA(m, j)))) items.push({ cle: `sc-${m.nom}`, titre: m.nom, avatar: m.nom, lien: lienFiche(m.nom), detail: 'Magasin sans Coach', pastille: { ton: 'gris', libelle: 'Sans Coach' } })
  }
  const dans6mois = ajouterJours(j, 183)
  for (const m of perimetre.filter((m) => m.ouverture > j && m.ouverture <= dans6mois).sort((a, b) => a.ouverture.localeCompare(b.ouverture))) {
    const manque = [!coachA(m, j) && 'Coach', m.franchise && !m.responsable && 'Franchisé', !m.ouvertureConnue && 'date confirmée'].filter(Boolean) as string[]
    if (!manque.length) continue
    items.push({ cle: `o-${m.nom}`, titre: m.nom, avatar: m.nom, icone: <StorefrontOutlined />, lien: lienFiche(m.nom), detail: `Ouvre le ${dateCourte(m.ouverture)} · manque : ${manque.join(', ')}`, pastille: { ton: 'type', libelle: 'Ouverture' } })
  }
  for (const { c, b } of reseau.campagnes.liste.filter((c) => phase(c, j) === 'encours')
    .map((c) => ({ c, b: bilan(reseau.campagnes, c, magasinsConcernes(reseau, c).filter((m) => noms.has(m.nom))) })).filter((x) => x.b.total > 0 && x.b.aConstater > 0)) {
    items.push({ cle: `cp-${c.id}`, titre: c.nom, avatar: c.nom, icone: <CampaignOutlined />, lien: `/infos?vue=campagnes&campagne=${encodeURIComponent(c.id)}`,
      detail: `${b.fait} sur ${b.total} magasin${b.total > 1 ? 's' : ''} exécuté${b.fait > 1 ? 's' : ''} · ${b.aConstater} à constater`, pastille: { ton: 'gris', libelle: b.taux === null ? 'Campagne' : `${b.taux} %` } })
  }
  void sansParametres
  return items
}

// Refonte vague 4 (38B) : À traiter réunit ce que je dois faire. Demandes des franchisés qui attendent le siège, et pour
// un RR les entretiens du mois pas encore faits avec ses Coachs (à partir du 15)
function aTraiterAnimation(reseau: Reseau, p: Perimetre, profil: Profil | null, demandes: Demande[] | null | undefined, entretiens: Entretien[] | null | undefined): ATraiter[] {
  const noms = new Set(magasinsDu(reseau, p).map((m) => m.nom))
  const items: ATraiter[] = []
  for (const d of (demandes ?? []).filter((d) => aTraiterParLeSiege(d) && noms.has(d.magasin))) {
    const longue = enAttenteLongue(d, `${reseau.jour}T12:00:00Z`)
    items.push({ cle: `dm-${d.id}`, nom: d.magasin, titre: d.titre, avatar: d.titre, icone: <SupportAgentOutlined />, lien: '/demandes',
      detail: [d.magasin, libelleTheme(d.theme), `ouverte ${dateRelative(d.ouverteLe, reseau.jour)}`].join(' · '), pastille: longue ? { ton: 'rouge', libelle: 'En retard' } : { ton: 'type', libelle: 'Demande' } })
  }
  const mois = reseau.jour.slice(0, 7)
  if (profil?.role === 'rr' && entretiens && Number(reseau.jour.slice(8, 10)) >= 15) {
    const ids = profil.perimetre.rr ?? []
    for (const c of reseau.equipe.filter((c) => !c.fictif && c.rr && ids.includes(c.rr.id) && !entretiens.some((e) => e.coach === c.nom && e.mois === mois && e.faitLe))) {
      items.push({ cle: `en-${c.nom}`, titre: `Entretien avec ${c.nom}`, avatar: c.nom, icone: <ForumOutlined />, lien: `${lienCoach(c.nom)}?vue=entretiens`, detail: `Entretien de ${libelleMois(mois).toLowerCase()} pas encore fait`, pastille: { ton: 'type', libelle: 'Entretien' } })
    }
  }
  return items
}

// Refonte vague 5 : prises de connaissance qui manquent depuis 7 jours (46A) et étapes d'intégration dues (50A)
function aTraiterVague5(reseau: Reseau, p: Perimetre, communications: Communication[], connaissances: Map<number, Connaissance> | null): ATraiter[] {
  const items: ATraiter[] = []
  for (const { c, k } of connaissancesEnAttente(communications, connaissances, reseau.jour)) {
    items.push({ cle: `pc-${c.id}`, titre: c.titre, avatar: c.titre, icone: <CampaignOutlined />, lien: `/infos?vue=communications&c=${c.id}`,
      detail: `${k.manquants.length} franchisé${k.manquants.length > 1 ? 's' : ''} sans prise de connaissance : ${k.manquants.join(', ')}`, pastille: { ton: 'orange', libelle: 'À relancer' } })
  }
  // Une ligne par magasin : la prochaine étape due, et le nombre d'étapes en retard
  for (const m of magasinsDu(reseau, p)) {
    const dues = parcoursDu(reseau, m)?.etapes.filter((x) => x.etat === 'retard' || x.etat === 'bientot') ?? []
    if (!dues.length) continue
    const retard = dues.filter((x) => x.etat === 'retard').length
    const x = dues[0]
    items.push({ cle: `in-${m.nom}`, sujet: retard ? `Intégration en retard : ${x.e.libelle}` : `Intégration : ${x.e.libelle}`, nom: m.nom, titre: `${m.nom} · ${x.e.libelle}`, avatar: m.nom, icone: <FlagOutlined />, lien: `${lienFiche(m.nom)}?vue=fiche`,
      detail: [`Intégration, jour ${x.e.jour}`, libellesResponsable[x.e.responsable], retard > 1 ? `${retard} étapes en retard` : `pour le ${dateCourte(x.echeance)}`].join(' · '),
      pastille: retard ? { ton: 'rouge', libelle: 'En retard' } : { ton: 'type', libelle: 'Intégration' } })
  }
  return items
}

// Les urgences (pastille rouge) d'abord, puis le suivi, les visites à faire en dernier (Joseph, 21/10/2026)
type GroupeATraiter = 'urgent' | 'suivi' | 'visite'
const groupeDe = (x: ATraiter): GroupeATraiter => (x.pastille?.ton === 'rouge' ? 'urgent' : x.cle.startsWith('v-') ? 'visite' : 'suivi')
const GROUPES: { v: GroupeATraiter; libelle: string }[] = [{ v: 'urgent', libelle: 'Urgent' }, { v: 'suivi', libelle: 'Suivi' }, { v: 'visite', libelle: 'À voir' }]

// Choix 271 (Joseph, 17/11/2026) : sur PC, les lignes d'un même sujet (5 visites d'intégration, 40 magasins à visiter…) se
// regroupent en une seule ligne qui nomme les magasins et se déplie. Tâches, magasins qui décrochent et visites à
// confirmer restent une par une : chacune a son geste
const SUJETS: Record<string, string> = {
  v: 'Magasins à visiter', s: 'Magasins prioritaires', c: 'Magasins qui ont reculé d’une case', sc: 'Magasins sans Coach', pv: 'Postes de Coach à pourvoir',
  ch: 'Coachs surchargés', o: 'Ouvertures à préparer', cp: 'Campagnes à constater', dm: 'Demandes de franchisés', pc: 'Prises de connaissance à relancer', en: 'Entretiens du mois',
}
const sujetDe = (x: ATraiter) => x.sujet ?? SUJETS[x.cle.split('-')[0]]
type LigneOuGroupe = { seul: ATraiter } | { sujet: string; items: ATraiter[] }
function regrouper(liste: ATraiter[]): LigneOuGroupe[] {
  const sortie: LigneOuGroupe[] = []
  const parSujet = new Map<string, ATraiter[]>()
  for (const x of liste) {
    const sujet = sujetDe(x)
    const cle = sujet && `${groupeDe(x)}|${sujet}`
    if (!cle) { sortie.push({ seul: x }); continue }
    const g = parSujet.get(cle)
    if (g) { g.push(x); continue }
    const nouveau = [x]
    parSujet.set(cle, nouveau)
    sortie.push({ sujet: sujet!, items: nouveau })
  }
  return sortie.map((r) => ('items' in r && r.items.length === 1 ? { seul: r.items[0] } : r))
}
const nomDe = (x: ATraiter) => x.nom ?? x.titre

function LigneGroupe({ sujet, items, children }: { sujet: string; items: ATraiter[]; children: ReactNode }) {
  const [ouvert, setOuvert] = useState(false)
  const noms = [...new Set(items.map(nomDe))]
  const pastille = items.find((x) => x.pastille?.ton === 'rouge')?.pastille ?? items[0].pastille
  return (
    <Box>
      <ButtonBase onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} aria-label={`${sujet} : ${items.length}`}
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, minHeight: 64, width: '100%', textAlign: 'left', justifyContent: 'flex-start', color: 'text.primary', '&:hover': { bgcolor: 'action.hover' } }}>
        <Initiales nom={sujet} icone={items[0].icone ?? <StorefrontOutlined />} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }}>{sujet}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{noms.join(', ')}</Typography>
        </Box>
        <Pastille ton={pastille?.ton ?? 'gris'}>{String(items.length)}</Pastille>
        {ouvert ? <ExpandLessOutlined /> : <ExpandMoreOutlined />}
      </ButtonBase>
      <Collapse in={ouvert} unmountOnExit><Box sx={{ pl: 3, '& > * + *': { borderTop: '1px solid', borderColor: 'divider' }, borderTop: '1px solid', borderColor: 'divider' }}>{children}</Box></Collapse>
    </Box>
  )
}

// Cocher une tâche sans quitter l'accueil ; « Annuler » la remet en cours
function useCocherTache(reseau: Reseau) {
  const { recharger } = useReseau()
  const { cocher, lectureSeule } = useEcritureActions(reseau)
  const [fait, setFait] = useState<ActionSuivie | null>(null)
  const [erreur, setErreur] = useState('')
  const basculer = async (x: ActionSuivie, faite: boolean) => {
    try { await cocher(x, faite); await recharger(); setFait(faite ? x : null) } catch { setFait(null); setErreur('La tâche n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.') }
  }
  const bandeau = (
    <>
      <Snackbar open={!!fait} autoHideDuration={5000} onClose={() => setFait(null)} message={fait ? `Tâche faite : ${fait.a.action}` : ''}
        action={fait && <Button color="inherit" onClick={() => basculer(fait, false)} sx={{ minHeight: 48, color: brand.or, fontWeight: 700 }}>Annuler</Button>} />
      <Snackbar open={!!erreur} autoHideDuration={5000} onClose={() => setErreur('')} message={erreur} />
    </>
  )
  return { cocher: lectureSeule ? null : (x: ActionSuivie) => basculer(x, true), bandeau }
}

function LigneTache({ x, cocher, titre, detail, lien, fin }: { x: ActionSuivie; cocher: ((x: ActionSuivie) => void) | null; titre: string; detail: string; lien: string; fin?: ReactNode }) {
  if (!cocher) return <LigneCompacte lien={lien} avatar={<Initiales nom={titre} icone={<TaskAltOutlined />} />} titre={titre} detail={detail} fin={fin} />
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', pl: 1 }}>
      <Tooltip title="Faite"><IconButton onClick={() => cocher(x)} aria-label={`Tâche faite : ${titre}`} sx={{ width: 48, height: 48, flex: 'none', border: '2px solid', borderColor: 'text.primary', ml: 0.5 }}><CheckOutlined /></IconButton></Tooltip>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex' }}><LigneCompacte lien={lien} titre={titre} detail={detail} fin={fin} /></Box>
    </Box>
  )
}

function BlocATraiter({ reseau, items, compact = false }: { reseau: Reseau; items: ATraiter[]; compact?: boolean }) {
  const { recharger } = useReseau()
  const [compteRendu, setCompteRendu] = useState<Visite | null>(null)
  const [reporter, setReporter] = useState<Visite | null>(null)
  const [message, setMessage] = useState('')
  const taches = useCocherTache(reseau)
  const faite = async (v: Visite) => {
    try { await marquerVisiteFaite(v.id!); await recharger(); setMessage(`Visite de ${v.magasin} comptée faite.`) } catch (e) { setMessage(messageErreur(e)) }
  }
  const [tout, setTout] = useState(false)
  const [filtre, setFiltre] = useState<GroupeATraiter | 'tout'>('tout')
  // 54A : « Plus tard » met une ligne de côté 7 jours (préférences du compte) ; « Annuler » la remet
  const deCote = usePlusTard()
  const annulable = useMessageAnnulable()
  const deCoteIci = items.filter((x) => misDeCote(deCote, x.cle, reseau.jour))
  const plusTard = (x: ATraiter) => { mettrePlusTard(x.cle, reseau.jour); annulable.signaler(`« ${x.titre} » revient dans 7 jours.`, () => reprendre(x.cle)) }
  const boutonPlusTard = (x: ATraiter) => (
    <Tooltip title="Plus tard"><IconButton onClick={() => plusTard(x)} aria-label={`Plus tard : ${x.titre}`} sx={{ width: 48, height: 48, flex: 'none' }}><SnoozeOutlined /></IconButton></Tooltip>
  )
  const tries = GROUPES.flatMap((g) => items.filter((x) => groupeDe(x) === g.v && !misDeCote(deCote, x.cle, reseau.jour)))
  const presents = GROUPES.map((g) => ({ ...g, n: tries.filter((x) => groupeDe(x) === g.v).length })).filter((g) => g.n)
  const filtres = filtre === 'tout' ? tries : tries.filter((x) => groupeDe(x) === filtre)
  const apercu = compact ? APERCU_COMPACT : APERCU
  // Un sujet partagé par plusieurs lignes n'en fait qu'une (choix 271 sur PC, 278 sur téléphone)
  const rangees: LigneOuGroupe[] = regrouper(filtres)
  const lignes = tout ? rangees : rangees.slice(0, apercu)
  const ligne = (x: ATraiter) => (x.visite
            ? <LigneCompacte key={x.cle} onClick={() => setCompteRendu(x.visite!)} label={`Compte rendu de ${x.titre}`} avatar={avatarATraiter(reseau, x)} titre={x.titre} detail={x.detail}
              actions={<Box sx={{ display: 'flex', gap: 0.5, flex: 'none' }}>
                <Button onClick={() => faite(x.visite!)} aria-label={`Visite de ${x.titre} faite`} sx={{ minHeight: 48, minWidth: 0, px: 1.25 }}>Faite</Button>
                <Button onClick={() => setReporter(x.visite!)} aria-label={`Reporter la visite de ${x.titre}`} sx={{ minHeight: 48, minWidth: 0, px: 1.25 }}>Reporter</Button>
              </Box>} />
            : x.tache
              ? <LigneTache key={x.cle} x={x.tache} cocher={taches.cocher} lien={x.lien} titre={x.titre} detail={x.detail} fin={x.pastille && <Pastille ton={x.pastille.ton}>{x.pastille.libelle}</Pastille>} />
              : <LigneCompacte key={x.cle} lien={x.lien} avatar={avatarATraiter(reseau, x)} titre={x.titre} detail={x.detail} fin={x.pastille && <Pastille ton={x.pastille.ton}>{x.pastille.libelle}</Pastille>} actions={boutonPlusTard(x)} />)
  return (
    // 349 (18/11/2026) : le détail d'une ligne passe sur deux lignes plutôt que d'être coupé au milieu
    <Box component="section" aria-label="À traiter" sx={{ '& .MuiTypography-body2': { whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } }}>
      {!compact && <TitreSection nombre={tries.length}>À traiter</TitreSection>}
      {/* Téléphone : les puces n'apparaissent qu'une fois la liste dépliée */}
      {(!compact || tout) && presents.length > 1 && (
        <Puces label="Éléments à traiter affichés" valeur={filtre} onChange={(v) => { setFiltre(v); setTout(compact) }}
          options={[{ v: 'tout' as const, libelle: 'Tout' }, ...presents.map((g) => ({ v: g.v, libelle: `${g.libelle} · ${g.n}` }))]} />
      )}
      {!tries.length ? <CarteLignes><LigneCompacte avatar={<Initiales nom="ok" icone={<TaskAltOutlined />} couleur={brand.vertFonce} />} titre="Rien d’urgent" detail="Aucun magasin ne décroche ni n’attend de visite, aucune tâche en retard." /></CarteLignes> : (
        <CarteLignes>
          {lignes.map((r) => ('seul' in r ? ligne(r.seul) : <LigneGroupe key={`g-${r.sujet}-${groupeDe(r.items[0])}`} sujet={r.sujet} items={r.items}>{r.items.map(ligne)}</LigneGroupe>))}
          {rangees.length > apercu && (
            <ButtonBase onClick={() => setTout((v) => !v)} sx={{ width: '100%', minHeight: 48, fontWeight: 600, fontSize: '0.875rem' }}>{tout ? 'Afficher moins' : `Voir les ${rangees.length}`}</ButtonBase>
          )}
        </CarteLignes>
      )}
      {deCoteIci.length > 0 && (
        <Button onClick={() => deCoteIci.forEach((x) => reprendre(x.cle))} sx={{ minHeight: 48, mt: 0.5 }}>
          {deCoteIci.length} mis de côté · Tout revoir
        </Button>
      )}
      {annulable.bandeau}
      {compteRendu && <DialogVisite reseau={reseau} visite={compteRendu} onFermer={(m) => { setCompteRendu(null); if (m) setMessage(m) }} />}
      {reporter && <DialogPlanifier reseau={reseau} magasins={[reporter.magasin]} dateInitiale={reseau.jour} visite={reporter} onFermer={(m) => { setReporter(null); if (m) setMessage(m) }} />}
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
      {taches.bandeau}
    </Box>
  )
}

function BlocSemaine({ reseau, p, compact = false }: { reseau: Reseau; p: Perimetre; compact?: boolean }) {
  const j = reseau.jour
  const noms = new Set(magasinsDu(reseau, p).map((m) => m.nom))
  const personnes = personnesDu(reseau, p)
  const semaine = elementsDuMois(reseau, j, ajouterJours(j, 6)).filter((e) => {
    // Visites de la semaine : seulement celles à venir ; le Directeur garde les autres rubriques
    if (e.categorie === 'visite') return e.debut >= j && p.type !== 'reseau' && noms.has(e.magasin ?? '')
    if (p.type === 'reseau') return true
    if (e.categorie === 'ouverture') return noms.has(e.cle.slice(2))
    if (e.categorie === 'anniversaire') return [...personnes!].some((n) => e.cle.startsWith(`a-${n}-`))
    return true
  })
  if (!semaine.length && !compact) return null
  const lignes = semaine.slice(0, compact ? APERCU_COMPACT : 4).map((e) => <LigneCompacte key={e.cle} lien={e.lien} avatar={<Initiales nom={e.titre} icone={<CalendarMonthOutlined />} />} titre={e.titre} detail={[jourLong(e.debut < j ? j : e.debut), e.detail].filter(Boolean).join(' · ')} />)
  if (compact) {
    return (
      <Box component="section" aria-label="Cette semaine">
        <CarteLignes>
          {semaine.length ? lignes : <LigneCompacte avatar={<Initiales nom="semaine" icone={<CalendarMonthOutlined />} />} titre="Rien de prévu cette semaine" />}
          <ButtonBase component={RouterLink} to="/plus/agenda" sx={{ width: '100%', minHeight: 48, fontWeight: 600, fontSize: '0.875rem' }}>Ouvrir l’agenda</ButtonBase>
        </CarteLignes>
      </Box>
    )
  }
  return (
    <Box component="section" aria-label="Cette semaine" sx={{ mt: 2 }}>
      <TitreSection action={<Button component={RouterLink} to="/plus/agenda" endIcon={<ArrowForwardOutlined />} sx={{ minHeight: 40 }}>Agenda</Button>}>Cette semaine</TitreSection>
      <CarteLignes>{lignes}</CarteLignes>
    </Box>
  )
}

// Contrats (Joseph, 26/10/2026) : mandats des associés échus ou qui finissent dans les 6 mois, Directeur et RR
function contratsDu(reseau: Reseau, p: Perimetre) {
  return p.type === 'coach' ? [] : mandatsARenouveler(reseau, magasinsDu(reseau, p))
}

function BlocContrats({ reseau, contrats, compact = false }: { reseau: Reseau; contrats: ReturnType<typeof contratsDu>; compact?: boolean }) {
  const [tout, setTout] = useState(false)
  const apercu = compact ? APERCU_COMPACT : APERCU
  const vus = tout ? contrats : contrats.slice(0, apercu)
  const lignes = vus.map((x) => (
    <LigneCompacte key={`${x.m.nom}-${x.a.id}`} lien={lienFiche(x.m.nom)} avatar={<Initiales nom={x.m.nom} icone={<HandshakeOutlined />} />} titre={`${x.a.nom} · ${x.m.nom}`}
      detail={`Fin le ${dateCourte(x.mandat.fin)} · ${x.numero === 1 ? '1er' : `${x.numero}e`} mandat`}
      fin={x.etat === 'echu' ? <Pastille ton="rouge">{libellesEtatMandat.echu}</Pastille> : <Pastille ton="orange">{joursAvant(reseau.jour, x.mandat.fin)}</Pastille>} />
  ))
  if (!contrats.length && !compact) return null
  return (
    <Box component="section" aria-label="Contrats" sx={{ mt: compact ? 0 : 2 }}>
      {!compact && <TitreSection nombre={contrats.length}>Contrats</TitreSection>}
      <CarteLignes>
        {contrats.length ? lignes : <LigneCompacte avatar={<Initiales nom="contrats" icone={<HandshakeOutlined />} />} titre="Aucune fin de mandat dans les 6 mois" />}
        {contrats.length > apercu && (
          <ButtonBase onClick={() => setTout((v) => !v)} sx={{ width: '100%', minHeight: 48, fontWeight: 600, fontSize: '0.875rem' }}>{tout ? 'Afficher moins' : `Voir les ${contrats.length}`}</ButtonBase>
        )}
      </CarteLignes>
    </Box>
  )
}

// « Dans 3 mois », « Dans 12 jours »
function joursAvant(jour: string, fin: string) {
  const j = Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${jour}T00:00:00Z`)) / 86400000)
  return j > 45 ? `Dans ${Math.round(j / 30.4)} mois` : j > 1 ? `Dans ${j} jours` : j === 1 ? 'Demain' : 'Aujourd’hui'
}

// Mes tâches : celles dont je suis le porteur, les plus pressées d'abord
function mesTaches(reseau: Reseau, p: Perimetre, moi: string) {
  if (!moi) return []
  const noms = p.type === 'reseau' ? null : new Set(magasinsDu(reseau, p).map((m) => m.nom))
  return actionsDes(reseau, noms).filter((x) => !x.a.faite && portePar(x.a, moi))
    .sort((x, y) => (echeanceDate(x.a) || '9999').localeCompare(echeanceDate(y.a) || '9999'))
}

function BlocMesTaches({ reseau, taches, compact = false }: { reseau: Reseau; taches: ReturnType<typeof mesTaches>; compact?: boolean }) {
  const cocher = useCocherTache(reseau)
  const lignes = taches.slice(0, compact ? APERCU_COMPACT : 4).map((x) => (
    <LigneTache key={x.cle} x={x} cocher={cocher.cocher} lien={`${lienFiche(x.magasin)}?vue=actions`} titre={x.a.action}
      detail={[x.magasin, x.libre?.exterieur && `Marché extérieur : ${x.libre.exterieur.nom}`, echeanceDate(x.a) && `pour le ${dateCourte(echeanceDate(x.a))}`].filter(Boolean).join(' · ')}
      fin={enRetard(x.a, reseau.jour) ? <Pastille ton="rouge">En retard</Pastille> : undefined} />
  ))
  const vide = <LigneCompacte avatar={<Initiales nom="ok" icone={<TaskAltOutlined />} couleur={brand.vertFonce} />} titre="Liste vide" detail="Tout est fait, chapeau." />
  const toutes = '/taches'
  return (
    <Box component="section" aria-label="Mes tâches" sx={{ mt: compact ? 0 : 2 }}>
      {!compact && <TitreSection nombre={taches.length} action={<Button component={RouterLink} to={toutes} endIcon={<ArrowForwardOutlined />} sx={{ minHeight: 40 }}>Toutes</Button>}>Mes tâches</TitreSection>}
      <CarteLignes>
        {taches.length ? lignes : vide}
        {compact && taches.length > APERCU_COMPACT && <ButtonBase component={RouterLink} to={toutes} sx={{ width: '100%', minHeight: 48, fontWeight: 600, fontSize: '0.875rem' }}>{`Voir les ${taches.length}`}</ButtonBase>}
      </CarteLignes>
      {cocher.bandeau}
    </Box>
  )
}

// Quatre repères de pilotage, calculés sur le périmètre de la personne (Joseph, 22/10/2026)
// Refonte (Joseph, 09/11/2026, 6A) : la période (mois ou cumul de l'année) se choisit en haut de l'écran ;
// le CA s'affiche en montant, l'écart en pastille avec sa référence écrite (N-1)
export type Periode = 'mois' | 'cumul'
function Indicateurs({ reseau, p, periode = 'mois', colonne = false }: { reseau: Reseau; p: Perimetre; periode?: Periode; colonne?: boolean }) {
  const theme = useTheme()
  const j = reseau.jour
  const actifs = magasinsDu(reseau, p).filter((m) => m.statut !== 'avenir')
  const noms = new Set(actifs.map((m) => m.nom))
  const analysesParNom = actifs.map((m) => analyser(reseau, m.nom))
  const analyses = analysesParNom.filter((a) => !!a)
  // CA : le dernier mois connu, comparé sur les magasins qui ont les deux mois
  const mois = analyses.reduce((max, a) => (a.mois > max ? a.mois : max), '')
  const comparables = analyses.filter((a) => a.mois === mois && a.ca !== null && a.caReference)
  // Cumul : de janvier au dernier mois connu, face aux mêmes mois de l'an dernier, sur les mêmes magasins
  const cumul = (nom: string, fin: string) => {
    const debut = `${fin.slice(0, 4)}-01`
    return chiffresDuMagasin(reseau, nom).filter((c) => c.mois >= debut && c.mois <= fin).reduce((t, c) => t + (caDe(c) ?? 0), 0)
  }
  const nomsComparables = actifs.map((m) => m.nom).filter((_n, i) => { const a = analysesParNom[i]; return !!a && a.mois === mois && a.ca !== null && !!a.caReference })
  const ca = periode === 'cumul' ? nomsComparables.reduce((t, n) => t + cumul(n, mois), 0) : comparables.reduce((t, a) => t + a.ca!, 0)
  const caRef = periode === 'cumul' ? nomsComparables.reduce((t, n) => t + cumul(n, decalerMois(mois, -12)), 0) : comparables.reduce((t, a) => t + a.caReference!, 0)
  const ecart = caRef ? ((ca - caRef) / caRef) * 100 : null
  const reference = comparables[0]?.reference
  const decrochent = analyses.filter((a) => a.statut === 'decroche').length
  const surveiller = analyses.filter((a) => a.statut === 'surveiller').length
  const rythme = suiviRythme(reseau, anneeDe(j)).filter((l) => noms.has(l.magasin.nom))
  const refVisites = rythme.reduce((t, l) => t + l.reference, 0)
  const faites = rythme.reduce((t, l) => t + l.faites, 0)
  const tauxVisites = refVisites ? Math.round((faites / refVisites) * 100) : null
  const cases = actifs.map((m) => caseDe(reseau.evaluations[m.nom])).filter((c) => !!c)
  const prioritaires = cases.filter((c) => PRIORITAIRES.includes(c.id)).length
  const repartition = nineBox.map((c) => ({ c, n: cases.filter((x) => x.id === c.id).length })).filter((x) => x.n)
  // Choix 271 (Joseph, 17/11/2026) : chaque chiffre dit quelque chose. Mois en cours encore sans comparaison : le dernier
  // mois comparable à N-1 ; « Aucun » plutôt que « 0 » ; visites en avance ou en retard sur le repère ; parc pas encore classé
  let moisCa = mois
  let caAff = ca
  let ecartAff = ecart
  let incomplet = false
  if (ecart === null && mois) {
    for (let k = 1; k <= 12 && ecartAff === null; k++) {
      const m = decalerMois(mois, -k)
      let c = 0, r = 0
      for (const x of actifs) {
        const v = periode === 'cumul' ? cumul(x.nom, m) : caDe(chiffresDuMagasin(reseau, x.nom).find((y) => y.mois === m)) ?? 0
        const w = periode === 'cumul' ? cumul(x.nom, decalerMois(m, -12)) : caDe(chiffresDuMagasin(reseau, x.nom).find((y) => y.mois === decalerMois(m, -12))) ?? 0
        if (v > 0 && w > 0) { c += v; r += w }
      }
      if (r > 0) { moisCa = m; caAff = c; ecartAff = ((c - r) / r) * 100; incomplet = true }
    }
  }
  const avance = Math.round(faites - refVisites)
  const tuiles: { cle: string; libelle: string; valeur: string; detail: string; lien: string; couleur?: string; couleurDetail?: string; barre?: ReactNode }[] = [
    { cle: 'ca', libelle: moisCa ? (periode === 'cumul' ? `CA cumulé à fin ${libelleMoisCourt(moisCa)}` : `CA de ${libelleMoisCourt(moisCa)}`) : 'CA du mois', valeur: ecartAff === null ? '—' : formatKEuros(caAff),
      detail: ecartAff === null ? 'Pas encore de chiffres' : `${formatPourcent(ecartAff)} ${incomplet || reference === decalerMois(mois, -12) || periode === 'cumul' ? 'vs N-1' : `vs ${libelleMoisCourt(reference!)}`}${incomplet ? ` · ${libelleMoisCourt(mois)} incomplet` : ''}`, lien: '/performance',
      couleurDetail: ecartAff === null ? undefined : ecartAff < 0 ? theme.palette.error.main : theme.palette.success.dark },
    { cle: 'decroche', libelle: 'Décrochent', valeur: decrochent ? String(decrochent) : 'Aucun', detail: surveiller ? `${surveiller} à surveiller` : 'aucun à surveiller', lien: '/performance', couleur: decrochent ? theme.palette.error.main : theme.palette.success.dark },
    { cle: 'visites', libelle: 'Visites de l’année', valeur: refVisites ? `${faites} faites` : String(faites),
      detail: !refVisites ? 'pas de repère cette année' : avance >= 0 ? `${avance} d’avance sur le repère (${Math.round(refVisites)})` : `${-avance} de retard sur le repère (${Math.round(refVisites)})`, lien: '/visites?vue=rythme',
      couleurDetail: !refVisites ? undefined : avance >= 0 ? theme.palette.success.dark : theme.palette.error.main,
      barre: tauxVisites === null || colonne ? undefined : <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover', mt: 0.75 }}><Box sx={{ width: `${Math.min(100, tauxVisites)}%`, height: 6, borderRadius: 3, bgcolor: 'warning.main' }} /></Box> },
    cases.length
      ? { cle: 'sante', libelle: 'Santé du parc', valeur: prioritaires ? String(prioritaires) : 'Aucun', detail: `prioritaire${prioritaires > 1 ? 's' : ''} sur ${cases.length} classés`, lien: '/plus/sante', couleur: prioritaires ? theme.palette.warning.dark : theme.palette.success.dark,
        barre: repartition.length && !colonne ? <Box sx={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', mt: 0.75 }}>{repartition.map((x) => <Box key={x.c.id} sx={{ flex: x.n, bgcolor: x.c.couleur }} />)}</Box> : undefined }
      : { cle: 'sante', libelle: 'Santé du parc', valeur: 'À classer', detail: `aucun magasin classé sur ${actifs.length}`, lien: '/plus/sante' },
  ]
  // PC (choix 271) : « Le point » en quatre lignes dans la colonne de droite, libellé et détail à gauche, valeur à droite
  if (colonne) return (
    <Box component="section" aria-label="Pilotage" sx={{ mb: 3 }}>
      <TitreSection>Le point</TitreSection>
      <CarteLignes>
        {tuiles.map((t) => (
          <ButtonBase key={t.cle} component={RouterLink} to={t.lien} aria-label={`${t.libelle} : ${t.valeur}, ${t.detail}`}
            sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: 1.5, alignItems: 'baseline', width: '100%', textAlign: 'left', px: 2, py: 1.25, minHeight: 64, color: 'text.primary', '&:hover': { bgcolor: 'action.hover' } }}>
            <Typography sx={{ fontWeight: 600, minWidth: 0 }} noWrap>{t.libelle}</Typography>
            {/* Proportions (Joseph, 17/11/2026) : la valeur à la taille du libellé, en gras, plus en plus grand */}
            <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: t.couleur, whiteSpace: 'nowrap' }}>{t.valeur}</Typography>
            <Typography variant="body2" sx={{ gridColumn: '1 / -1', color: t.couleurDetail ?? 'text.secondary', fontWeight: t.couleurDetail ? 600 : 400 }}>{t.detail}</Typography>
          </ButtonBase>
        ))}
      </CarteLignes>
    </Box>
  )
  return (
    // Téléphone : quatre petites cartes égales en 2 × 2, sans défilement de côté (Joseph, 22/10/2026)
    <Box component="section" aria-label="Pilotage" sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: { xs: 1, md: 2 }, mb: { xs: 2, md: 3 } }}>
      {tuiles.map((t) => <Indicateur key={t.cle} libelle={t.libelle} valeur={t.valeur} detail={t.detail} lien={t.lien} couleur={t.couleur} couleurDetail={t.couleurDetail}>{t.barre}</Indicateur>)}
    </Box>
  )
}

// Téléphone : À traiter, tâches et semaine dans une seule carte à onglets, courte (Joseph, 22/10/2026)
type Onglet = 'traiter' | 'taches' | 'semaine' | 'contrats'
function PointCompact({ reseau, p, items, taches, contrats }: { reseau: Reseau; p: Perimetre; items: ATraiter[]; taches: ReturnType<typeof mesTaches>; contrats: ReturnType<typeof contratsDu> }) {
  const [onglet, setOnglet] = useState<Onglet>('traiter')
  const options: { v: Onglet; libelle: string }[] = [
    { v: 'traiter', libelle: items.length ? `À traiter · ${items.length}` : 'À traiter' },
    { v: 'taches', libelle: taches.length ? `Tâches · ${taches.length}` : 'Tâches' },
    { v: 'semaine', libelle: 'Semaine' },
    ...(p.type === 'coach' ? [] : [{ v: 'contrats' as const, libelle: contrats.length ? `Contrats · ${contrats.length}` : 'Contrats' }]),
  ]
  return (
    <Box sx={{ mb: 2, '& .MuiCard-root .MuiButtonBase-root': { minHeight: 56, py: 0.5 } }}>
      <Box role="tablist" aria-label="Mon point" sx={{ display: 'flex', p: 0.25, borderRadius: 999, bgcolor: 'action.hover', mb: 1 }}>
        {options.map((o) => (
          <ButtonBase key={o.v} role="tab" aria-selected={onglet === o.v} onClick={() => setOnglet(o.v)}
            sx={{ fontFamily: 'inherit', flex: 1, minHeight: 48, borderRadius: 999, fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', color: onglet === o.v ? 'text.primary' : 'text.secondary', ...(onglet === o.v ? { bgcolor: 'background.paper', boxShadow: 1 } : {}) }}>
            {o.libelle}
          </ButtonBase>
        ))}
      </Box>
      <Box role="tabpanel" aria-label={options.find((o) => o.v === onglet)!.libelle}>
        {onglet === 'traiter' && <BlocATraiter reseau={reseau} items={items} compact />}
        {onglet === 'taches' && <BlocMesTaches reseau={reseau} taches={taches} compact />}
        {onglet === 'semaine' && <BlocSemaine reseau={reseau} p={p} compact />}
        {onglet === 'contrats' && <BlocContrats reseau={reseau} contrats={contrats} compact />}
      </Box>
    </Box>
  )
}

type FiltreFil = 'tout' | GenreFil
const filtresFil: { v: FiltreFil; libelle: string }[] = [
  { v: 'tout', libelle: 'Tout' }, { v: 'visite', libelle: 'Visites' }, { v: 'tache', libelle: 'Tâches' },
  { v: 'message', libelle: 'Messages' }, { v: 'chiffres', libelle: 'Chiffres' }, { v: 'pratique', libelle: 'Bonnes pratiques' },
  { v: 'communication', libelle: 'Communications' }, { v: 'animation', libelle: 'Temps forts et campagnes' }, { v: 'journal', libelle: 'Journal' },
]
const PAS_FIL = 20
const AUCUNE: never[] = []

const iconeFil: Record<GenreFil, ReactNode> = { visite: <EventNoteOutlined />, tache: <TaskAltOutlined />, message: <ChatBubbleOutlineOutlined />, chiffres: <QueryStatsOutlined />, pratique: <TipsAndUpdatesOutlined />, communication: <CampaignOutlined />, journal: <HistoryOutlined />, animation: <CelebrationOutlined /> }

// Une publication du fil : qui, quoi, où, quand ; le texte et les photos en dessous
export function PublicationFil({ e, jour, sansMagasin = false, ouvrir }: { e: ElementFil; jour: string; sansMagasin?: boolean; ouvrir?: (e: ElementFil) => void }) {
  const qui = e.genre === 'chiffres' ? '' : e.auteur
  const action = qui ? e.action : e.action.charAt(0).toUpperCase() + e.action.slice(1)
  const ou = e.genre === 'communication' || e.genre === 'animation' ? e.cible : sansMagasin ? '' : e.magasin
  const tete = <>{qui && <><b>{qui}</b> · </>}{action}{ou ? <> · <b>{ou}</b></> : ''}</>
  // Compte rendu d'une visite : s'ouvre dans une fenêtre, le fil reste à sa place
  const ouvrirCR = useOuvrirCompteRendu()
  const cr = e.genre === 'visite' && e.visiteId ? () => ouvrirCR(e.visiteId!) : undefined
  return (
    <Box>
      <ButtonBase {...(ouvrir ? { onClick: () => ouvrir(e), 'aria-label': e.libelleOuvrir } : cr ? { onClick: cr } : { component: RouterLink, to: e.lien })} sx={{ display: 'block', textAlign: 'left', width: '100%', p: 2, color: 'text.primary', '&:hover': { bgcolor: 'action.hover' } }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Initiales nom={qui || e.magasin || e.genre} icone={qui && e.genre !== 'communication' ? undefined : iconeFil[e.genre]} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tete}</Typography>
            <Typography variant="body2" color="text.secondary">{quand(e.instant, jour)}</Typography>
          </Box>
          {e.valeur && (
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontWeight: 700 }}>{e.valeur}</Typography>
              {e.texte && <Typography variant="body2" sx={{ fontWeight: 600, color: e.ecart !== null && e.ecart !== undefined && e.ecart < 0 ? 'error.main' : 'text.secondary' }}>{e.texte}</Typography>}
            </Box>
          )}
        </Box>
        {e.visuel && <Box sx={{ mx: -2, mt: 1.5 }}><VisuelFil piece={e.visuel.piece} url={e.visuel.url} alt={e.titre ?? ''} /></Box>}
        {e.titre && <Typography sx={{ mt: 1.25, fontWeight: 600 }}>{e.titre}</Typography>}
        {e.texte && !e.valeur && <Typography {...(e.genre === 'visite' ? { variant: 'body2' as const, color: 'text.secondary' } : {})} sx={{ mt: e.titre ? 0.25 : 1.25, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-line' }}>{e.texte}</Typography>}
      </ButtonBase>
      {/* Les photos hors du lien : le toucher les ouvre en plein écran */}
      {(!!e.photos?.length || cr) && <Box sx={{ px: 2, pb: 2, mt: -0.75, display: 'flex', flexDirection: 'column', gap: 1 }}><GrillePhotos photos={e.photos} />
        {cr && <PieceJointe nom={`Compte rendu de ${e.magasin}`} libelle={`Ouvrir le compte rendu de ${e.magasin}`} onOuvrir={cr} />}</Box>}
    </Box>
  )
}

// Connaissances des communications, pour le geste « J'ai pris connaissance » du franchisé dans le fil
export interface ConnaissancesDuFil { carte: Map<number, Connaissance> | null; franchise: boolean; recharger: () => void }

export function FilActivite({ elements, jour, sansMagasin = false, sansFiltre = false, titre = 'Actualités', communications, reactionsPratiques, reactionsVisites, action, ouvrirJournal, limite, lienTout, social = false, partager, connaissances, telephone = false }: {
  elements: ElementFil[]; jour: string; sansMagasin?: boolean; sansFiltre?: boolean; titre?: string; communications?: CommunicationsDuFil; reactionsPratiques?: ReactionsPratiques | null
  // undefined : en cours de lecture (les deux écrans du fil les passent toujours)
  reactionsVisites?: ReactionsVisites | null
  action?: ReactNode; ouvrirJournal?: (e: ElementFil) => void
  // Vague 8 (Joseph, 11/11/2026, « les actus en premier plan, comme un réseau social ») : sur téléphone, l'accueil montre
  // les premières publications en tête, la suite dans Actualités
  limite?: number; lienTout?: string
  // social : fil d'actualité façon réseau social (Accueil, Actualités) : une carte par publication, repère « Nouveau »
  // depuis le dernier passage (211A) ; la fiche magasin garde son fil d'activité. 207A : « Partager » en tête ; 206A : prise de connaissance
  social?: boolean; partager?: ReactNode; connaissances?: ConnaissancesDuFil
  // Accueil téléphone (maquette 278, Joseph 17/11/2026) : pas de titre visible, Partager en un champ, filtres derrière un
  // picto, publications bord à bord séparées par un fin espace
  telephone?: boolean
}) {
  const { apercu, equipe } = useApercu()
  const [message, setMessage] = useState('')
  const [filtre, setFiltre] = useState<FiltreFil>('tout')
  const [nb, setNb] = useState(limite ?? PAS_FIL)
  const [ancreFiltre, setAncreFiltre] = useState<HTMLElement | null>(null)
  const vuAvant = useDernierPassage(social && !apercu)
  const vus = elements.filter((e) => filtre === 'tout' || e.genre === filtre)
  // Visite, photos, tâches et messages d'un même magasin le même jour : une seule carte (Joseph, 21/10/2026) ;
  // une publication garde toujours sa propre carte (204A, Joseph 15/11/2026)
  const groupes = useMemo(() => {
    const parCle = new Map<string, ElementFil[]>()
    for (const e of vus) {
      const cle = (social && estPublication(e)) || e.communication || e.pratique || e.journal || !e.magasin ? e.cle : `${e.magasin}|${e.instant.slice(0, 10)}`
      const g = parCle.get(cle)
      if (g) g.push(e); else parCle.set(cle, [e])
    }
    // Les communications à la une restent en tête
    const tous = [...parCle.values()]
    return [...tous.filter((g) => g[0].communication?.aLaUne), ...tous.filter((g) => !g[0].communication?.aLaUne)]
  }, [vus, social])
  const options = filtresFil.filter((f) => f.v === 'tout' || elements.some((e) => e.genre === f.v))
  const lectureSeule = !!apercu || !!equipe
  const plus = useCallback(() => setNb((n) => n + PAS_FIL), [])
  const suite = useSuiteAutomatique(plus, !lienTout && groupes.length > nb)
  const estNouveau = (e: ElementFil) => !!vuAvant && instantFil(e.instant) > vuAvant
  const affiches = groupes.slice(0, nb)
  // Le séparateur « Vous êtes à jour » suit la dernière nouveauté, s'il reste des publications plus anciennes
  const derniereNouvelle = affiches.reduce((d, g, i) => (estNouveau(g[0]) ? i : d), -1)
  const prendre = (id: number) => prendreConnaissance(id).then(() => { setMessage('C’est noté, merci.'); connaissances?.recharger() }, () => setMessage('La confirmation n’a pas pu partir. Réessayez dans un instant.'))
  const reactions = (e: ElementFil) => {
    if (e.communication && communications?.moi) {
      const k = connaissances?.franchise ? connaissances.carte?.get(e.communication.id) : undefined
      return <ReactionsCommunication c={e.communication} moi={communications.moi} jour={jour} lectureSeule={lectureSeule} apres={communications.recharger} signaler={setMessage}
        extra={k ? <BoutonConnaissance pris={!!k.moi} lectureSeule={lectureSeule} prendre={() => void prendre(e.communication!.id)} /> : undefined} />
    }
    if (e.pratique && reactionsPratiques) return <ReactionsPratique p={e.pratique} reactions={reactionsPratiques} lectureSeule={lectureSeule} signaler={setMessage} />
    if (e.visiteId && reactionsVisites) return (
      <Reactions titre={`le compte rendu de ${e.magasin}`} pouces={reactionsVisites.pouces[e.visiteId] ?? AUCUNE} commentaires={reactionsVisites.commentaires[e.visiteId] ?? AUCUNE}
        moi={reactionsVisites.moi} jour={jour} lectureSeule={lectureSeule} basculer={() => basculerPouceVisite(e.visiteId!)} commenter={(t) => commenterVisite(e.visiteId!, t)}
        supprimer={supprimerCommentaireVisite} message={messageReactionVisite} apres={reactionsVisites.recharger} signaler={setMessage} />
    )
    // Réactions encore en lecture : même barre, inactive, pour que la carte ne change pas de forme
    if ((e.visiteId && reactionsVisites === undefined) || (e.pratique && reactionsPratiques === undefined)) return <ReactionsEnAttente />
    return <ActionsSimples lien={e.lien} libelle={e.genre === 'visite' ? 'Voir le compte rendu' : 'Voir le détail'} />
  }
  return (
    <Box component="section" aria-label={titre}>
      {telephone ? <Typography component="h2" sx={visuellementCache}>{titre}</Typography> : <TitreSection action={action}>{titre}</TitreSection>}
      {telephone ? (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            {partager ?? <Box sx={{ flex: 1 }} />}
            {!sansFiltre && options.length > 2 && (
              <IconButton onClick={(ev) => setAncreFiltre(ev.currentTarget)} aria-label="Filtrer le fil" aria-haspopup="menu" sx={{ width: 48, height: 48, flexShrink: 0 }}>
                <Badge color="secondary" variant="dot" invisible={filtre === 'tout'}><FilterListOutlined /></Badge>
              </IconButton>
            )}
          </Box>
          <Menu anchorEl={ancreFiltre} open={!!ancreFiltre} onClose={() => setAncreFiltre(null)} slotProps={{ list: { 'aria-label': 'Filtrer le fil' } }}>
            {options.map((o) => <MenuItem key={o.v} selected={o.v === filtre} onClick={() => { setAncreFiltre(null); setFiltre(o.v); setNb(PAS_FIL) }} sx={{ minHeight: 48 }}>{o.libelle}</MenuItem>)}
          </Menu>
          {filtre !== 'tout' && <Box sx={{ mb: 1.5 }}><Button variant="outlined" color="inherit" endIcon={<CloseOutlined />} onClick={() => { setFiltre('tout'); setNb(PAS_FIL) }} aria-label={`Retirer le filtre ${options.find((o) => o.v === filtre)?.libelle ?? ''}`} sx={{ minHeight: 48, borderRadius: 999 }}>{options.find((o) => o.v === filtre)?.libelle}</Button></Box>}
        </>
      ) : <>
        {partager}
        {!sansFiltre && options.length > 2 && <BandeCollante><Puces valeur={filtre} options={options} onChange={(v) => { setFiltre(v); setNb(PAS_FIL) }} label="Filtrer le fil" /></BandeCollante>}
      </>}
      {!vus.length ? (
        <CarteLignes><LigneCompacte avatar={<Initiales nom="fil" icone={<HistoryOutlined />} />} titre="Rien de nouveau" detail="Les comptes rendus et les communications des dernières semaines s’afficheront ici." /></CarteLignes>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, ...(telephone ? { gap: 0.75, mx: -2, '& > .MuiCard-root': { borderRadius: 0, borderLeft: 0, borderRight: 0 }, '& > [role="separator"]': { px: 2 } } : {}) }}>
          {affiches.map(([e, ...reste], i) => {
            const carte = social && estPublication(e) ? (
              <CartePublication key={e.cle} e={e} jour={jour} sansMagasin={sansMagasin} nouveau={estNouveau(e)}
                entete={e.communication?.aLaUne && <Box sx={{ pt: 1.5 }}><MarqueUne jusquAu={e.communication.aLaUne} /></Box>}>
                {reactions(e)}
              </CartePublication>
            ) : (
              <Card key={e.cle} component={e.communication || e.pratique ? 'article' : 'div'}
                aria-label={e.communication?.titre ?? e.pratique?.titre} sx={{ border: 0, overflow: 'hidden', ...(reste.length ? { '& > * + *': { borderTop: '1px solid', borderColor: 'divider' } } : {}) }}>
                <PublicationFil e={e} jour={jour} sansMagasin={sansMagasin} ouvrir={e.libelleOuvrir && ouvrirJournal ? ouvrirJournal : undefined} />
                {reste.map((x) => <PublicationFil key={x.cle} e={x} jour={jour} sansMagasin={sansMagasin} ouvrir={x.libelleOuvrir && ouvrirJournal ? ouvrirJournal : undefined} />)}
              </Card>
            )
            return i === derniereNouvelle && i < affiches.length - 1 ? <Fragment key={e.cle}>{carte}<AJour /></Fragment> : carte
          })}
          {groupes.length > nb && (lienTout
            ? <Button component={RouterLink} to={lienTout} sx={{ alignSelf: 'center', minHeight: 48 }}>Voir toutes les actualités</Button>
            : <><Box ref={suite} aria-hidden /><Button onClick={plus} sx={{ alignSelf: 'center', minHeight: 48 }}>Voir plus</Button></>)}
        </Box>
      )}
      <FenetreCompteRendu />
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </Box>
  )
}

// Ma journée (refonte vague 4, 42A) : les visites prévues aujourd'hui, puis « Je suis au magasin »
function MaJournee({ reseau, p, moi }: { reseau: Reseau; p: Perimetre; moi: string }) {
  const noms = new Set(magasinsDu(reseau, p).map((m) => m.nom))
  const du = reseau.visites.filter((v) => v.date === reseau.jour && noms.has(v.magasin) && (!moi || !v.visiteurs.length || v.visiteurs.includes(moi)))

  return (
    <Box component="section" aria-label="Ma journée" sx={{ mb: 2 }}>
      <TitreSection nombre={du.length}>Ma journée</TitreSection>
      {du.length > 0 && (
        <CarteLignes>
          {du.map((v) => (
            <LigneCompacte key={v.id ?? v.magasin} lien={v.prevue ? `${lienFiche(v.magasin)}/visite` : lienFiche(v.magasin)} avatar={<Blason magasin={reseau.magasins.find((m) => m.nom === v.magasin)} nom={v.magasin} />}
              titre={v.magasin} detail={[libelleTypeVisite(v.type), v.prevue ? 'prévue' : 'faite'].join(' · ')} />
          ))}
        </CarteLignes>
      )}
      <Box sx={{ mt: du.length ? 1.5 : 0 }}><AuMagasin reseau={reseau} p={p} /></Box>
      {!du.length && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Aucune visite prévue aujourd’hui.</Typography>}
    </Box>
  )
}

// Choix 278 (Joseph, 17/11/2026) : sur téléphone, le fil seul, façon LinkedIn. Le point du jour passe dans la barre du
// haut, en picto avec le nombre à traiter (comme une notification) ; il ouvre une page pleine avec Le point et À traiter
function PointTelephone({ items, taches, children }: { items: ATraiter[]; taches: ReturnType<typeof mesTaches>; children: ReactNode }) {
  const [ouvert, setOuvert] = useState(false)
  const [cible, setCible] = useState<HTMLElement | null>(null)
  useEffect(() => { setCible(document.getElementById('entete-actions-page')) }, [])
  // Le nombre rouge ne compte que les urgences (pastille rouge) ; le reste attend dans la page (Joseph 17/11/2026)
  const urgences = items.filter((x) => x.pastille?.ton === 'rouge').length
  const resume = [items.length ? `${items.length} à traiter` : '', urgences ? `dont ${urgences} urgence${urgences > 1 ? 's' : ''}` : '', taches.length ? `${taches.length} tâche${taches.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ') || 'rien d’urgent'
  const bouton = (
    <Tooltip title="Mon point du jour">
      <IconButton onClick={() => setOuvert(true)} aria-label={`Mon point du jour, ${resume}`} aria-haspopup="dialog" aria-expanded={ouvert} sx={{ width: 48, height: 48, flexShrink: 0 }}>
        <Badge color="error" badgeContent={urgences} max={99}><TodayOutlined /></Badge>
      </IconButton>
    </Tooltip>
  )
  return (
    <>
      {cible ? createPortal(bouton, cible) : <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>{bouton}</Box>}
      <Drawer anchor="right" open={ouvert} onClose={() => setOuvert(false)} sx={{ zIndex: (t) => t.zIndex.modal }} slotProps={{ paper: { role: 'dialog', 'aria-label': 'Mon point du jour', sx: { width: '100%', bgcolor: 'background.default' } } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 'calc(8px + env(safe-area-inset-top))', pb: 1, position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
          <Typography component="h2" sx={{ fontWeight: 700, fontSize: '1.125rem', flex: 1 }}>Mon point du jour</Typography>
          <IconButton onClick={() => setOuvert(false)} aria-label="Fermer" sx={{ width: 48, height: 48 }}><CloseOutlined /></IconButton>
        </Box>
        <Box sx={{ px: 2, pt: 2, pb: 'calc(24px + env(safe-area-inset-bottom))' }}>{children}</Box>
      </Drawer>
    </>
  )
}

// Accueil (refonte vague 5, Joseph 10/11/2026, 43A) : l'actualité au centre. Les repères chiffrés en tête, puis À la une
// et le fil du réseau en colonne principale ; « Aujourd'hui » (ma journée, À traiter, mes tâches, la semaine, les contrats)
// en colonne compacte à droite. Sur téléphone : À la une, puis le point du jour, puis le fil.
function Tableau({ reseau, p, sansParametres = false, periode, barrePeriode }: { reseau: Reseau; p: Perimetre; sansParametres?: boolean; periode: Periode; barrePeriode?: ReactNode }) {
  const { profil } = useAuth()
  const { messagerie } = useMessagerie()
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const { liste: demandes } = useDemandes(profil?.role !== 'franchise')
  const { liste: entretiens } = useEntretiens()
  const communications = useCommunicationsDuFil()
  const { connaissances, recharger: rechargerConnaissances } = useConnaissances()
  const taches = mesTaches(reseau, p, monNomPorteur(reseau, profil))
  // 38B : une chose n'apparaît qu'une fois ; mes propres tâches vivent dans « Mes tâches »
  const items = useMemo(() => {
    const miennes = new Set(taches.map((x) => x.cle))
    return [...aTraiter(reseau, p, sansParametres, monNomPorteur(reseau, profil)).filter((i) => !i.tache || !miennes.has(i.tache.cle)), ...aTraiterAnimation(reseau, p, profil, demandes, entretiens),
      ...aTraiterVague5(reseau, p, communications.liste, connaissances)]
  }, [reseau, p, sansParametres, profil, demandes, entretiens, taches, communications.liste, connaissances])
  const contrats = useMemo(() => contratsDu(reseau, p), [reseau, p])
  const noms = useMemo(() => new Set(magasinsDu(reseau, p).map((m) => m.nom)), [reseau, p])
  const reactionsPratiques = useReactionsPratiques()
  const reactionsVisites = useReactionsVisites()
  // Les communications à la une sont dans le bandeau : le fil ne les répète pas
  const unes = useMemo(() => new Set(aLaUneDuJour(communications.liste, reseau.jour).map((c) => c.id)), [communications.liste, reseau.jour])
  const fil = useMemo(() => filDu(reseau, noms, messagerie, 120, communications.liste, true, true, true).filter((e) => !e.communication || !unes.has(e.communication.id)),
    [reseau, noms, messagerie, communications.liste, unes])
  const aLaUne = <ALaUne liste={communications.liste} jour={reseau.jour} connaissances={connaissances} franchise={false} lectureSeule apres={() => void rechargerConnaissances()}
    lien={(c) => `/infos?vue=communications&c=${c.id}`} />
  // Vague 8 (Joseph, 11/11/2026) : l'actualité d'abord, comme un réseau social. Sur téléphone, À la une puis les
  // dernières publications, ensuite le point du jour ; les indicateurs se déplient. Sur PC, le fil ouvre la page et les
  // indicateurs passent en tête de la colonne « Aujourd'hui ».
  // 15/11/2026 (204A à 211A) : le fil façon réseau social. « Partager » en tête du fil, une publication par carte, repère
  // « Nouveau » ; sur téléphone, le point du jour se replie en une bande au-dessus d'un fil qui défile sans fin.
  const peutPublier = profil?.role === 'directeur' || profil?.role === 'rr'
  const partager = <BarrePartager moi={monNomPorteur(reseau, profil) || profil?.nom || ''} franchise={false} communication={peutPublier} reseau={reseau} apres={communications.recharger} compact={!surPC} />
  // Choix 212 (15/11/2026) : l'Accueil porte seul le fil, avec ses filtres (l'onglet Fil d'Actualités est retiré)
  const filActu = <FilActivite elements={fil} jour={reseau.jour} titre="Actualités" social telephone={!surPC} partager={partager} communications={communications} reactionsPratiques={reactionsPratiques} reactionsVisites={reactionsVisites} />
  if (!surPC) return (
    <>
      {aLaUne}
      <PointTelephone items={items} taches={taches}>
        {profil?.role === 'coach' ? <MaJournee reseau={reseau} p={p} moi={monNomPorteur(reseau, profil)} /> : <AuMagasin reseau={reseau} p={p} />}
        {barrePeriode && <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>{barrePeriode}</Box>}
        <Indicateurs reseau={reseau} p={p} periode={periode} colonne />
        <SondagesARepondre equipe aFaire titre="Sondages à remplir" />
        <PointCompact reseau={reseau} p={p} items={items} taches={taches} contrats={contrats} />
      </PointTelephone>
      {filActu}
    </>
  )
  return (
    <>
      {aLaUne}
      {/* Choix 271 (Joseph, 17/11/2026) : le fil façon LinkedIn, la colonne « Aujourd'hui » à côté. 17/11 : aligné à gauche
          sous le titre, fil jusqu'à 760 px, la colonne de droite prend le reste (plus de vide sur les côtés) */}
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: 'minmax(0, 760px) minmax(360px, 1fr)', justifyContent: 'start', alignItems: 'start' }}>
        <Box sx={{ minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>{filActu}</Box>
        <Box component="aside" aria-label="Aujourd’hui" sx={{ minWidth: 0 }}>
          <Indicateurs reseau={reseau} p={p} periode={periode} colonne />
          {profil?.role === 'coach' && <MaJournee reseau={reseau} p={p} moi={monNomPorteur(reseau, profil)} />}
          <SondagesARepondre equipe aFaire titre="Sondages à remplir" />
          <BlocATraiter reseau={reseau} items={items} />
          <BlocMesTaches reseau={reseau} taches={taches} />
          <BlocSemaine reseau={reseau} p={p} />
          <BlocContrats reseau={reseau} contrats={contrats} />
        </Box>
      </Box>
    </>
  )
}

// Téléphone (209A) : une bande qui résume, le détail se déplie ; le fil passe juste dessous. Dépliée une fois, elle le
// reste sur l'appareil (confort de lecture, rien d'important n'y est rangé)
const cleBande = (titre: string) => `vandb-bande-${titre}`
export function BandeRepliable({ titre, resume, icone, children }: { titre: string; resume: string; icone: ReactNode; children: ReactNode }) {
  const [ouvert, setOuvertEtat] = useState(() => { try { return localStorage.getItem(cleBande(titre)) === '1' } catch { return false } })
  const setOuvert = (f: (o: boolean) => boolean) => setOuvertEtat((o) => {
    const v = f(o)
    try { localStorage.setItem(cleBande(titre), v ? '1' : '0') } catch { /* appareil sans stockage */ }
    return v
  })
  return (
    <Card component="section" aria-label={titre} sx={{ mb: 2 }}>
      <ButtonBase onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} sx={{ width: '100%', minHeight: 56, px: 2, py: 1, gap: 1.5, justifyContent: 'flex-start', textAlign: 'left', fontFamily: 'inherit' }}>
        <Box sx={{ color: 'secondary.main', display: 'flex' }}>{icone}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }}>{titre}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>{resume}</Typography>
        </Box>
        {ouvert ? <ExpandLessOutlined /> : <ExpandMoreOutlined />}
      </ButtonBase>
      <Collapse in={ouvert} unmountOnExit><Box sx={{ px: 2, pb: 2 }}>{children}</Box></Collapse>
    </Card>
  )
}

export function Accueil() {
  const { profil } = useAuth()
  // Le Directeur voit tout le réseau ; un Coach ou un RR, ses magasins
  const p = perimetreDuProfil(profil) ?? { type: 'reseau' as const }
  const [params, setParams] = useSearchParams()
  // Vague 8 (106A) : la période choisie suit d'un écran chiffré à l'autre ; l'adresse ?periode= reste prioritaire
  const [commune, setCommune] = usePeriodeCommune()
  const demandee = params.get('periode')
  const periode: Periode = demandee === 'cumul' || demandee === 'mois' ? demandee : commune
  const choisir = (v: Periode | null) => { if (!v) return; setCommune(v); const n = new URLSearchParams(params); if (v === 'mois') n.delete('periode'); else n.set('periode', v); setParams(n, { replace: true }) }
  // 278 : sur téléphone, la période suit Le point dans la page « Mon point du jour »
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const barre = <BarrePeriode valeur={periode} onChange={choisir} sx={{ ml: 'auto' }} />
  return (
    <>
      {/* 278 (Joseph 17/11/2026) : sur téléphone, pas de titre visible, le périmètre en puce, le fil tout de suite */}
      {surPC ? <PageHeader titre="Accueil" actions={barre} /> : <>
        <Typography variant="h1" sx={visuellementCache}>Accueil</Typography>
        {!!profil && profil.role !== 'franchise' && <Box sx={{ mb: 1, '&:empty': { display: 'none' } }}><SelecteurPerimetre compact /></Box>}
      </>}
      <AvecReseau>{(r) => <Tableau reseau={r} p={p} sansParametres={p.type !== 'reseau'} periode={periode} barrePeriode={surPC ? undefined : barre} />}</AvecReseau>
    </>
  )
}
