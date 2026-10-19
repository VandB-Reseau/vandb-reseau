import { Equipe } from './pages/Equipe'
import { FicheCoach } from './pages/FicheCoach'
import { FicheDirecteur, FicheFranchise, FicheRR } from './pages/FichePersonne'
import { Direction } from './pages/Direction'
import { Donnees } from './pages/Donnees'
import { Visites } from './pages/Visites'
import { CompteRendu } from './pages/CompteRendu'
import { Agenda } from './pages/Agenda'
import { SanteParc } from './pages/SanteParc'
import { Evolution } from './pages/Evolution'
import { Personnes } from './pages/VuePersonnes'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { AppShell } from './layout/AppShell'
import { useAuth } from './auth/AuthContext'
import { Accueil } from './pages/Accueil'
import { Connexion } from './pages/Connexion'
import { Plus } from './pages/Plus'
import { Magasins } from './pages/Magasins'
import { FicheMagasin } from './pages/FicheMagasin'
import { ReseauProvider } from './data/ReseauContext'
import { RetourEnHaut } from './navigation/RetourEnHaut'
import { ErreurEcran } from './components/ErreurEcran'
import { useCallback, useMemo } from 'react'
import { cleVue, lireVue, perimetreDuProfil } from './data/perimetre'
import Button from '@mui/material/Button'
import LockOutlined from '@mui/icons-material/LockOutlined'
import { EmptyState } from './components/EmptyState'
import { ApercuProvider, useApercu } from './auth/Apercu'
import { chargerEspaceFranchise } from './data/espaceFranchise'
import { espaceFranchise } from './navigation/destinations'
import { BandeauApercu, FicheMagasinFranchise, MagasinsFranchise, PratiquesFranchise, TableauFranchise } from './pages/EspaceFranchise'

// equipeSeule : Coach ou Responsable Régional, sans la partie Paramètres (les fiches des personnes restent ouvertes)
function Routes_({ equipeSeule = false }: { equipeSeule?: boolean }) {
  const { pathname } = useLocation()
  if (equipeSeule && (pathname === '/equipe' || pathname.startsWith('/parametres') || pathname === '/plus/direction' || pathname.startsWith('/plus/evolution') || pathname === '/plus/charge')) return <Navigate to="/" replace />
  return (
    <AppShell sansParametres={equipeSeule}>
      <RetourEnHaut />
      {/* Changer d'écran efface l'erreur de l'écran précédent */}
      <ErreurEcran key={pathname}>
      <Routes>
        <Route path="/" element={<Accueil />} />
        <Route path="/magasins" element={<Magasins />} />
        <Route path="/magasins/:nom" element={<FicheMagasin />} />
        <Route path="/plus/carte" element={<Navigate to="/magasins?vue=carte" replace />} />
        <Route path="/equipe" element={<Equipe />} />
        <Route path="/equipe/coach/:nom" element={<FicheCoach />} />
        <Route path="/equipe/rr/:id" element={<FicheRR />} />
        <Route path="/equipe/directeur" element={<FicheDirecteur />} />
        <Route path="/equipe/franchise/:nom" element={<FicheFranchise />} />
        <Route path="/plus/charge" element={<Navigate to="/equipe?vue=charge" replace />} />
        <Route path="/parametres/reglages" element={<Direction />} />
        <Route path="/parametres/donnees" element={<Donnees />} />
        <Route path="/plus/direction" element={<Navigate to="/parametres/reglages" replace />} />
        <Route path="/parametres/collaborateurs" element={<Personnes perimetre="collaborateurs" />} />
        <Route path="/parametres/franchises" element={<Personnes perimetre="franchises" />} />
        <Route path="/visites" element={<Visites />} />
        <Route path="/visites/compte-rendu/:id" element={<CompteRendu />} />
        <Route path="/plus/agenda" element={<Agenda />} />
        <Route path="/plus/sante" element={<SanteParc />} />
        <Route path="/parametres/evolution" element={<Evolution />} />
        <Route path="/plus/evolution" element={<Navigate to="/parametres/evolution" replace />} />
        <Route path="/plus" element={<Plus />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ErreurEcran>
    </AppShell>
  )
}

// Espace d'un franchisé (ou son aperçu par le Directeur de réseau) : ses magasins seulement
function RoutesFranchise({ apercu }: { apercu: boolean }) {
  const { pathname } = useLocation()
  return (
    <AppShell franchise={espaceFranchise} bandeau={apercu ? <BandeauApercu /> : undefined}>
      <RetourEnHaut />
      <ErreurEcran key={pathname}>
      <Routes>
        <Route path="/" element={<TableauFranchise />} />
        <Route path="/magasins" element={<MagasinsFranchise />} />
        <Route path="/magasins/:nom" element={<FicheMagasinFranchise />} />
        <Route path="/visites/compte-rendu/:id" element={<CompteRendu />} />
        <Route path="/bonnes-pratiques" element={<PratiquesFranchise />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
  const { apercu } = useApercu()
  const franchise = profil?.role === 'franchise'
  const directeur = profil?.role === 'directeur'
  const vueApercu = directeur && !!apercu
  const charger = useCallback(() => chargerEspaceFranchise(vueApercu ? apercu : null), [vueApercu, apercu])
  const impose = perimetreDuProfil(profil)
  const cle = impose ? cleVue(impose) : null
  const perimetre = useMemo(() => (cle ? lireVue(cle) : null), [cle])
  if (!profil || profil.role === 'aucun') return <AccesFerme />
  if (franchise || vueApercu) return <ReseauProvider key={apercu?.franchise ?? 'franchise'} charger={charger} lectureSeule><RoutesFranchise apercu={vueApercu} /></ReseauProvider>
  return <ReseauProvider accesFranchises={directeur} perimetre={perimetre}><Routes_ equipeSeule={!!perimetre} /></ReseauProvider>
}

export default function App() {
  const { session, chargement } = useAuth()
  if (chargement) {
    return <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}><CircularProgress color="secondary" aria-label="Chargement" /></Box>
  }
  return <HashRouter>{session ? <ApercuProvider><Espace /></ApercuProvider> : <Connexion />}</HashRouter>
}
