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

function Routes_() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Accueil />} />
        {principales.slice(1).map((d) => <Route key={d.chemin} path={d.chemin} element={<Chantier destination={d} />} />)}
        <Route path="/plus" element={<Plus />} />
        {secondaires.map((d) => <Route key={d.chemin} path={d.chemin} element={<Chantier destination={d} />} />)}
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
  return <HashRouter>{session ? <Routes_ /> : <Connexion />}</HashRouter>
}
