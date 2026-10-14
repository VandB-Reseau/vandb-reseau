import { Equipe } from './pages/Equipe'
import { FicheCoach } from './pages/FicheCoach'
import { FicheDirecteur, FicheFranchise, FicheRR } from './pages/FichePersonne'
import { Direction } from './pages/Direction'
import { Visites } from './pages/Visites'
import { CompteRendu } from './pages/CompteRendu'
import { Agenda } from './pages/Agenda'
import { SanteParc } from './pages/SanteParc'
import { Evolution } from './pages/Evolution'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { AppShell } from './layout/AppShell'
import { useAuth } from './auth/AuthContext'
import { secondaires } from './navigation/destinations'
import { Accueil } from './pages/Accueil'
import { Chantier } from './pages/Chantier'
import { Connexion } from './pages/Connexion'
import { Plus } from './pages/Plus'
import { Magasins } from './pages/Magasins'
import { FicheMagasin } from './pages/FicheMagasin'
import { ReseauProvider } from './data/ReseauContext'

function Routes_() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Accueil />} />
        <Route path="/magasins" element={<Magasins />} />
        <Route path="/magasins/:nom" element={<FicheMagasin />} />
        <Route path="/plus/carte" element={<Magasins vueInitiale="carte" />} />
        <Route path="/equipe" element={<Equipe />} />
        <Route path="/equipe/coach/:nom" element={<FicheCoach />} />
        <Route path="/equipe/rr/:id" element={<FicheRR />} />
        <Route path="/equipe/directeur" element={<FicheDirecteur />} />
        <Route path="/equipe/franchise/:nom" element={<FicheFranchise />} />
        <Route path="/plus/charge" element={<Navigate to="/equipe?vue=charge" replace />} />
        <Route path="/plus/direction" element={<Direction />} />
        <Route path="/visites" element={<Visites />} />
        <Route path="/visites/compte-rendu/:id" element={<CompteRendu />} />
        <Route path="/plus/agenda" element={<Agenda />} />
        <Route path="/plus/sante" element={<SanteParc />} />
        <Route path="/plus/evolution" element={<Evolution />} />
        <Route path="/plus" element={<Plus />} />
        {secondaires.slice(1).filter((d) => !['/plus/direction', '/plus/agenda', '/plus/sante', '/plus/evolution'].includes(d.chemin)).map((d) => <Route key={d.chemin} path={d.chemin} element={<Chantier destination={d} />} />)}
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
