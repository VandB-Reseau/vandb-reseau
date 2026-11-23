import type { ReactNode } from 'react'
import { Link as RouterLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import { estDirecteur, estEquipe, voitParametres, type Profil } from './auth/roles'
import { anneeBudget } from './data/pilotage'
import { ZonePilotage } from './ZonePilotage'
import { Magasin } from './pages/Magasin'
import { Magasins } from './pages/Magasins'
import { Parametres } from './pages/Parametres'
import { SimulateursEquipe } from './pages/SimulateursEquipe'
export { ZonePilotage } from './ZonePilotage'

// Pilotage financier des magasins (budget, suivi, saisies), venu de l'app « V and B Pilotage » à la fusion
// (Joseph, 03/11/2026, option A) : une entrée « Budgets » dans le menu et un onglet « Budget » dans la fiche du magasin.
// Même compte, même rôle lu en base ; les données sont dans le schéma « pilotage » de la même base.

// Pages du réseau : budgets de l'année, suivi, hypothèses, imports, paramètres, en onglets sous l'entrée « Budgets »
function OngletsBudgets({ profil }: { profil: Profil }) {
  const { pathname } = useLocation()
  const pages = [
    { chemin: '/budgets', nom: `Budgets ${anneeBudget()}` },
    // Refonte vague 2 (14A) : le Directeur règle les budgets dans Paramètres ; le contrôle de gestion, qui n'a pas
    // Paramètres, garde ses paramètres ici
    ...(voitParametres(profil) && !estDirecteur(profil) ? [{ chemin: '/budgets/parametres', nom: 'Paramètres réseau' }] : []),
  ]
  if (pages.length < 2) return null
  const actif = pages.slice().reverse().find((p) => pathname === p.chemin || pathname.startsWith(`${p.chemin}/`))?.chemin ?? '/budgets'
  return (
    <Box component="nav" aria-label="Pages des budgets" className="pas-a-l-impression" sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
      <Tabs value={actif} variant="scrollable" scrollButtons={false} aria-label="Pages des budgets">
        {pages.map((p) => <Tab key={p.chemin} value={p.chemin} label={p.nom} component={RouterLink} to={p.chemin} sx={{ minHeight: 48 }} />)}
      </Tabs>
    </Box>
  )
}

export function PagesBudgets() {
  return (
    <ZonePilotage>
      {(profil) => (
        <>
          <OngletsBudgets profil={profil} />
          <Routes>
            <Route index element={<Magasins />} />
            {/* Refonte vague 2 (15A) : le suivi face au budget est dans Performance */}
            {estEquipe(profil) && <Route path="suivi" element={<Navigate to="/performance?vue=budget" replace />} />}
            {estDirecteur(profil) && <Route path="hypotheses" element={<Navigate to="/parametres/reglages?rubrique=hypotheses" replace />} />}
            {estDirecteur(profil) && <Route path="imports" element={<Navigate to="/parametres/reglages?rubrique=imports" replace />} />}
            {estDirecteur(profil) && <Route path="parametres" element={<Navigate to="/parametres/reglages?rubrique=budget" replace />} />}
            {voitParametres(profil) && !estDirecteur(profil) && <Route path="parametres" element={<Parametres />} />}
            <Route path="*" element={<Navigate to="/budgets" replace />} />
          </Routes>
        </>
      )}
    </ZonePilotage>
  )
}

// Simulateurs de l'équipe (choix 157, Joseph 14/11/2026) : entrée du menu sous le Budget prévisionnel
export function PageSimulateurs() {
  return <ZonePilotage>{() => <SimulateursEquipe />}</ZonePilotage>
}

// Onglet « Budget » de la fiche d'un magasin : suivi, budget et saisies du magasin
export function OngletBudget({ nom, mode, sante, santeLibelle }: { nom: string; mode?: 'chiffres' | 'budget' | 'simulateurs'; sante?: ReactNode; santeLibelle?: string }) {
  return <ZonePilotage>{() => <Magasin nom={nom} mode={mode} sante={sante} santeLibelle={santeLibelle} />}</ZonePilotage>
}
