import { HashRouter, Navigate, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { AppShell } from './layout/AppShell'
import { ProfilVu, useAuth } from './auth/AuthContext'
import type { Profil } from './auth/roles'
import { DroitsProvider } from './auth/Droits'
import { BandeauApercuEquipe } from './components/AccesEquipe'
import { Accueil } from './pages/Accueil'
import { Connexion } from './pages/Connexion'
import { Plus } from './pages/Plus'
import { ReseauProvider } from './data/ReseauContext'
import { MessagerieProvider } from './data/MessagerieContext'
import { RetourEnHaut } from './navigation/RetourEnHaut'
import { ErreurEcran } from './components/ErreurEcran'
import { useCallback, useMemo, type ReactNode } from 'react'
import { chargerPreferences } from './lib/preferences'
import { cleVue, lireVue, perimetreDuProfil } from './data/perimetre'
import Button from '@mui/material/Button'
import LockOutlined from '@mui/icons-material/LockOutlined'
import { EmptyState } from './components/EmptyState'
import { ApercuProvider, useApercu } from './auth/Apercu'
import { Suspense, useEffect } from 'react'
import Skeleton from '@mui/material/Skeleton'
import { chargementDiffere } from './lib/chargementDiffere'
import { chargerEspaceFranchise } from './data/espaceFranchise'
import { espaceFranchise } from './navigation/destinations'

// Écrans plus rares chargés à la demande : l'ouverture de l'app télécharge moins (Joseph, 21/10/2026).
// Ils sont préchargés en tâche de fond une fois l'accueil affiché, pour s'ouvrir sans attente.
const chargeurs = {
  direction: () => import('./pages/Direction').then((m) => ({ default: m.Direction })),
  charge: () => import('./pages/ChargeCoachs').then((m) => ({ default: m.ChargeCoachs })),
  donnees: () => import('./pages/Donnees').then((m) => ({ default: m.Donnees })),
  compteRendu: () => import('./pages/CompteRendu').then((m) => ({ default: m.CompteRendu })),
  evolution: () => import('./pages/Evolution').then((m) => ({ default: m.Evolution })),
  // Sprint 22 (F1) : chaque grand écran a son fichier, seul l'accueil part avec l'app
  magasins: () => import('./pages/Magasins').then((m) => ({ default: m.Magasins })),
  ficheMagasin: () => import('./pages/FicheMagasin').then((m) => ({ default: m.FicheMagasin })),
  preparation: () => import('./pages/PreparationVisite').then((m) => ({ default: m.PreparationVisite })),
  equipe: () => import('./pages/Equipe').then((m) => ({ default: m.Equipe })),
  ficheCoach: () => import('./pages/FicheCoach').then((m) => ({ default: m.FicheCoach })),
  personnes: () => import('./pages/FichePersonne'),
  visites: () => import('./pages/Visites').then((m) => ({ default: m.Visites })),
  agenda: () => import('./pages/Agenda').then((m) => ({ default: m.Agenda })),
  sante: () => import('./pages/SanteParc').then((m) => ({ default: m.SanteParc })),
  echanges: () => import('./pages/Echanges'),
  taches: () => import('./pages/Taches').then((m) => ({ default: m.PageTaches })),
  infos: () => import('./pages/InfosReseau').then((m) => ({ default: m.InfosReseau })),
}
// Espace franchisé : un seul fichier, jamais préchargé pour l'équipe
const espace = () => import('./pages/EspaceFranchise')
const Direction = chargementDiffere(chargeurs.direction)
const ChargeCoachs = chargementDiffere(chargeurs.charge)
const Donnees = chargementDiffere(chargeurs.donnees)
const CompteRendu = chargementDiffere(chargeurs.compteRendu)
const Evolution = chargementDiffere(chargeurs.evolution)
const Magasins = chargementDiffere(chargeurs.magasins)
const FicheMagasin = chargementDiffere(chargeurs.ficheMagasin)
const PreparationVisite = chargementDiffere(chargeurs.preparation)
const Equipe = chargementDiffere(chargeurs.equipe)
const FicheCoach = chargementDiffere(chargeurs.ficheCoach)
const FicheRR = chargementDiffere(() => chargeurs.personnes().then((m) => ({ default: m.FicheRR })))
const FicheDirecteur = chargementDiffere(() => chargeurs.personnes().then((m) => ({ default: m.FicheDirecteur })))
const FicheFranchise = chargementDiffere(() => chargeurs.personnes().then((m) => ({ default: m.FicheFranchise })))
const Visites = chargementDiffere(chargeurs.visites)
const Agenda = chargementDiffere(chargeurs.agenda)
const SanteParc = chargementDiffere(chargeurs.sante)
const Echanges = chargementDiffere(() => chargeurs.echanges().then((m) => ({ default: m.Echanges })))
const PageTaches = chargementDiffere(chargeurs.taches)
const InfosReseau = chargementDiffere(chargeurs.infos)
const BandeauApercu = chargementDiffere(() => espace().then((m) => ({ default: m.BandeauApercu })))
const TableauFranchise = chargementDiffere(() => espace().then((m) => ({ default: m.TableauFranchise })))
const MagasinsFranchise = chargementDiffere(() => espace().then((m) => ({ default: m.MagasinsFranchise })))
const FicheMagasinFranchise = chargementDiffere(() => espace().then((m) => ({ default: m.FicheMagasinFranchise })))

function usePrechargement() {
  useEffect(() => {
    const lancer = () => { for (const c of Object.values(chargeurs)) void c().catch(() => undefined) }
    const w = window as Window & { requestIdleCallback?: (f: () => void) => number }
    const id = w.requestIdleCallback ? w.requestIdleCallback(lancer) : window.setTimeout(lancer, 1500)
    return () => { if (!w.requestIdleCallback) window.clearTimeout(id) }
  }, [])
}

// Silhouette grise pendant le chargement d'un écran
function SilhouetteEcran() {
  return (
    <Box aria-busy="true" aria-label="Chargement" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Skeleton variant="text" width="40%" height={44} />
      <Skeleton variant="rounded" height={72} />
      <Skeleton variant="rounded" height={72} />
      <Skeleton variant="rounded" height={72} />
    </Box>
  )
}

// Anciennes adresses (Messages, Tâches, Communications, Notifications) : vers les onglets Messages et Tâches
function Vers({ cible }: { cible: (p: Record<string, string | undefined>, recherche: URLSearchParams) => string }) {
  const p = useParams()
  const [recherche] = useSearchParams()
  return <Navigate to={cible(p, recherche)} replace />
}
const avec = (chemin: string, r: URLSearchParams, ajout: Record<string, string> = {}) => {
  const n = new URLSearchParams(r)
  for (const [k, v] of Object.entries(ajout)) n.set(k, v)
  const q = n.toString()
  return q ? `${chemin}?${q}` : chemin
}
const anciensLiens = [
  <Route key="a" path="/actions" element={<Vers cible={(_p, r) => avec('/taches', r)} />} />,
  <Route key="c" path="/communications" element={<Vers cible={(_p, r) => avec('/infos', r)} />} />,
  <Route key="m" path="/messages" element={<Navigate to="/echanges" replace />} />,
  <Route key="mp" path="/messages/personne/:cle" element={<Vers cible={(p) => `/echanges/personne/${encodeURIComponent(p.cle ?? '')}`} />} />,
  <Route key="mm" path="/messages/:nom" element={<Vers cible={(p) => `/echanges/magasin/${encodeURIComponent(p.nom ?? '')}`} />} />,
  <Route key="n" path="/notifications" element={<Navigate to="/echanges" replace />} />,
]

// equipeSeule : Coach ou Responsable Régional, sans la partie Paramètres (les fiches des personnes restent ouvertes)
function Routes_({ equipeSeule = false, bandeau }: { equipeSeule?: boolean; bandeau?: ReactNode }) {
  const { pathname } = useLocation()
  usePrechargement()
  if (equipeSeule && (pathname === '/equipe' || pathname.startsWith('/parametres') || pathname === '/plus/direction' || pathname.startsWith('/plus/evolution') || pathname === '/plus/charge')) return <Navigate to="/" replace />
  return (
    <AppShell sansParametres={equipeSeule} bandeau={bandeau}>
      <RetourEnHaut />
      {/* Changer d'écran efface l'erreur de l'écran précédent */}
      <ErreurEcran key={pathname}>
      <Suspense fallback={<SilhouetteEcran />}>
      <Routes>
        <Route path="/" element={<Accueil />} />
        <Route path="/magasins" element={<Magasins />} />
        <Route path="/magasins/:nom" element={<FicheMagasin />} />
        <Route path="/magasins/:nom/preparer" element={<PreparationVisite />} />
        <Route path="/plus/carte" element={<Navigate to="/magasins?vue=carte" replace />} />
        <Route path="/equipe" element={<Equipe />} />
        <Route path="/equipe/coach/:nom" element={<FicheCoach />} />
        <Route path="/equipe/rr/:id" element={<FicheRR />} />
        <Route path="/equipe/directeur" element={<FicheDirecteur />} />
        <Route path="/equipe/franchise/:nom" element={<FicheFranchise />} />
        <Route path="/plus/charge" element={<Navigate to="/parametres/charge" replace />} />
        <Route path="/parametres/charge" element={<ChargeCoachs />} />
        <Route path="/parametres/reglages" element={<Direction />} />
        <Route path="/parametres/donnees" element={<Donnees />} />
        <Route path="/plus/direction" element={<Navigate to="/parametres/reglages" replace />} />
        <Route path="/parametres/collaborateurs" element={<Navigate to="/equipe?vue=collaborateurs" replace />} />
        <Route path="/parametres/franchises" element={<Navigate to="/equipe?vue=franchises" replace />} />
        <Route path="/visites" element={<Visites />} />
        <Route path="/echanges" element={<Echanges />} />
        <Route path="/taches" element={<PageTaches />} />
        <Route path="/infos" element={<InfosReseau />} />
        {/* Communications et bonnes pratiques : Infos réseau seulement, pour l'équipe (sprint 22, S1) comme pour le franchisé */}
        <Route path="/echanges/reseau" element={<Vers cible={(_p, r) => avec('/infos', r)} />} />
        <Route path="/echanges/pratiques" element={<Navigate to="/infos?vue=pratiques" replace />} />
        <Route path="/echanges/:genre/:valeur" element={<Echanges />} />
        {anciensLiens}
        <Route path="/visites/compte-rendu/:id" element={<CompteRendu />} />
        <Route path="/plus/agenda" element={<Agenda />} />
        <Route path="/plus/sante" element={<SanteParc />} />
        <Route path="/parametres/evolution" element={<Evolution />} />
        <Route path="/plus/evolution" element={<Navigate to="/parametres/evolution" replace />} />
        <Route path="/plus" element={<Plus />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </ErreurEcran>
    </AppShell>
  )
}

// Espace d'un franchisé (ou son aperçu par le Directeur de réseau) : ses magasins seulement
function RoutesFranchise({ apercu }: { apercu: boolean }) {
  const { pathname } = useLocation()
  return (
    <AppShell franchise={espaceFranchise} bandeau={apercu ? <Suspense fallback={null}><BandeauApercu /></Suspense> : undefined} sansCompteur={apercu}>
      <RetourEnHaut />
      <ErreurEcran key={pathname}>
      <Suspense fallback={<SilhouetteEcran />}>
      <Routes>
        <Route path="/" element={<TableauFranchise />} />
        <Route path="/magasins" element={<MagasinsFranchise />} />
        <Route path="/magasins/:nom" element={<FicheMagasinFranchise />} />
        <Route path="/visites/compte-rendu/:id" element={<CompteRendu />} />
        <Route path="/infos" element={<InfosReseau />} />
        <Route path="/bonnes-pratiques" element={<Navigate to="/infos?vue=pratiques" replace />} />
        <Route path="/echanges" element={<Echanges lectureSeule={apercu} />} />
        <Route path="/taches" element={<PageTaches />} />
        <Route path="/echanges/reseau" element={<Vers cible={(_p, r) => avec('/infos', r)} />} />
        <Route path="/echanges/:genre/:valeur" element={<Echanges lectureSeule={apercu} />} />
        {anciensLiens}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </ErreurEcran>
    </AppShell>
  )
}

function AccesFerme() {
  const { deconnexion } = useAuth()
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', px: 2 }}>
      <EmptyState icone={<LockOutlined />} titre="Ton accès n’est pas encore ouvert" texte="Ton compte existe, mais il n’est rattaché à aucun magasin. Contacte ton Coach ou la direction du réseau."
        action={<Button variant="contained" onClick={() => void deconnexion()} sx={{ minHeight: 48 }}>Se déconnecter</Button>} />
    </Box>
  )
}

function Espace() {
  const { profil } = useAuth()
  const { apercu, equipe } = useApercu()
  const directeur = profil?.role === 'directeur'
  // « Voir comme » un Coach ou un RR : l'app se construit avec son profil et sans droit sur les référentiels
  if (profil && directeur && !apercu && equipe) {
    const vu: Profil = { ...profil, nom: equipe.nom.split(' ')[0], role: equipe.role, perimetre: equipe.role === 'coach' ? { coachs: [equipe.cle] } : { rr: [equipe.cle] } }
    return <ProfilVu profil={vu}><DroitsProvider referentiels={false}><EspaceDe bandeau={<BandeauApercuEquipe />} /></DroitsProvider></ProfilVu>
  }
  return <DroitsProvider referentiels={directeur}><EspaceDe /></DroitsProvider>
}

function EspaceDe({ bandeau }: { bandeau?: ReactNode }) {
  const { profil } = useAuth()
  const { apercu } = useApercu()
  const franchise = profil?.role === 'franchise'
  const directeur = profil?.role === 'directeur'
  const vueApercu = directeur && !!apercu
  const charger = useCallback(() => chargerEspaceFranchise(vueApercu ? apercu : null), [vueApercu, apercu])
  const impose = perimetreDuProfil(profil)
  const cle = impose ? cleVue(impose) : null
  const perimetre = useMemo(() => (cle ? lireVue(cle) : null), [cle])
  // Favoris, vues et canal Réseau du compte de l'équipe connecté, repris de la base (migration 0021)
  const equipe = !!profil && profil.role !== 'franchise' && profil.role !== 'aucun'
  useEffect(() => { if (equipe) chargerPreferences().catch(() => { /* table absente : l'appareil suffit */ }) }, [equipe])
  if (!profil || profil.role === 'aucun') return <AccesFerme />
  if (franchise || vueApercu) return <MessagerieProvider><ReseauProvider key={apercu?.franchise ?? 'franchise'} charger={charger} lectureSeule cache={vueApercu ? undefined : `${profil.id}:franchise`}><RoutesFranchise apercu={vueApercu} /></ReseauProvider></MessagerieProvider>
  return <MessagerieProvider><ReseauProvider key={cle ?? 'reseau'} accesFranchises={directeur} lectureSeule={!directeur} perimetre={perimetre} cache={`${profil.id}:reseau`}><Routes_ equipeSeule={!!perimetre} bandeau={bandeau} /></ReseauProvider></MessagerieProvider>
}

export default function App() {
  const { session, chargement } = useAuth()
  if (chargement) {
    return <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}><CircularProgress color="secondary" aria-label="Chargement" /></Box>
  }
  return <HashRouter>{session ? <ApercuProvider><Espace /></ApercuProvider> : <Connexion />}</HashRouter>
}
