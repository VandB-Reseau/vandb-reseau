import { Equipe } from './pages/Equipe'
import { FicheCoach } from './pages/FicheCoach'
import { FicheDirecteur, FicheFranchise, FicheRR } from './pages/FichePersonne'
import { Direction } from './pages/Direction'
import { Visites } from './pages/Visites'
import { CompteRendu } from './pages/CompteRendu'
import { Agenda } from './pages/Agenda'
import { SanteParc } from './pages/SanteParc'
import { Evolution } from './pages/Evolution'
import { Personnes } from './pages/VuePersonnes'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
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

function Routes_() {
  return (
    <AppShell>
      <RetourEnHaut />
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
    </AppShell>
  )
}

export default function App() {
  const { session, chargement } = useAuth()
  if (chargement) {
    return <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}><CircularProgress color="secondary" aria-label="Chargement" /></Box>
  }
  return <HashRouter>{session ? <ReseauProvider><Routes_ /></ReseauProvider> : <Connexion />}</HashRouter>
}
