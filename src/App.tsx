import { Equipe } from './pages/Equipe'
import { FicheCoach } from './pages/FicheCoach'
import { PlanCharge } from './pages/PlanCharge'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { AppShell } from './layout/AppShell'
import { useAuth } from './auth/AuthContext'
import { principales, secondaires } from './navigation/destinations'
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
        <Route path="/plus/charge" element={<PlanCharge />} />
        {principales.slice(2, 3).map((d) => <Route key={d.chemin} path={d.chemin} element={<Chantier destination={d} />} />)}
        <Route path="/plus" element={<Plus />} />
        {secondaires.slice(1).filter((d) => d.chemin !== '/plus/charge').map((d) => <Route key={d.chemin} path={d.chemin} element={<Chantier destination={d} />} />)}
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
