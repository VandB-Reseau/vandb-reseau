import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import LogoutOutlined from '@mui/icons-material/LogoutOutlined'
import { useAuth } from '../auth/AuthContext'
import { Logo } from '../components/Logo'
import { lireDroits } from './auth/AuthContext'
import { OngletBudget, PagesBudgets } from './Pilotage'

// Contrôle de gestion (Joseph, 03/11/2026) : un compte sans rôle dans le réseau, désigné par le Directeur dans les
// paramètres des budgets. Il n'a que les budgets : paramètres du réseau et chiffres de tous les magasins, en lecture.
export function EspaceControleGestion() {
  const { deconnexion } = useAuth()
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" className="pas-a-l-impression" sx={{ bgcolor: '#000000', color: '#ffffff' }}>
        <Toolbar sx={{ gap: 2, minHeight: 72 }}>
          <Logo />
          <Typography variant="subtitle1" component="span" sx={{ fontWeight: 600, flex: 1 }}>Contrôle de gestion</Typography>
          <Button color="inherit" startIcon={<LogoutOutlined />} onClick={() => void deconnexion()} sx={{ minHeight: 48 }}>Se déconnecter</Button>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ px: { xs: 2, md: 4 }, py: 3, maxWidth: 1600, mx: 'auto' }}>
        <Routes>
          <Route path="/budgets/*" element={<PagesBudgets />} />
          <Route path="/magasins/:nom" element={<BudgetMagasin />} />
          <Route path="*" element={<Navigate to="/budgets" replace />} />
        </Routes>
      </Box>
    </Box>
  )
}

// Budget d'un magasin, en lecture : le contrôle de gestion n'a pas la fiche du magasin de l'app réseau
function BudgetMagasin() {
  const { nom = '' } = useParams()
  return (
    <>
      <Typography variant="h1" sx={{ mb: 2 }}>{nom}</Typography>
      <OngletBudget nom={nom} />
    </>
  )
}

// Compte sans rôle dans le réseau : espace du contrôle de gestion s'il est désigné, sinon l'accès fermé
export function SelonControleGestion({ sinon }: { sinon: ReactNode }) {
  const [controle, setControle] = useState<boolean | null>(null)
  useEffect(() => {
    let actif = true
    lireDroits().then((d) => { if (actif) setControle(d.parametreur) })
    return () => { actif = false }
  }, [])
  if (controle === null) return <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}><CircularProgress color="secondary" aria-label="Chargement" /></Box>
  return controle ? <EspaceControleGestion /> : <>{sinon}</>
}
