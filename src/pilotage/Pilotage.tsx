import { useEffect, useState, type ReactNode } from 'react'
import { Link as RouterLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import GlobalStyles from '@mui/material/GlobalStyles'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import { ThemeProvider } from '@mui/material/styles'
import { useApercu } from '../auth/Apercu'
import { PilotageAuthProvider, useAuth } from './auth/AuthContext'
import { estDirecteur, estEquipe, voitParametres, type Profil } from './auth/roles'
import { GardeSaisie } from './components/GardeSaisie'
import { EtatVide } from './components/EtatVide'
import { anneeSuivi, chargerAnnees, ecouterAnnees } from './data/annees'
import { anneeBudget, oublier } from './data/pilotage'
import { Hypotheses } from './pages/Hypotheses'
import { Imports } from './pages/Imports'
import { Magasin } from './pages/Magasin'
import { Magasins } from './pages/Magasins'
import { Parametres } from './pages/Parametres'
import { Reseau } from './pages/Reseau'
import { theme } from './theme/theme'

// Pilotage financier des magasins (budget, suivi, saisies), venu de l'app « V and B Pilotage » à la fusion
// (Joseph, 03/11/2026, option A) : une entrée « Budgets » dans le menu et un onglet « Budget » dans la fiche du magasin.
// Même compte, même rôle lu en base ; les données sont dans le schéma « pilotage » de la même base.

// Page imprimée (budget, vue réseau) : A4 paysage, sans menus ni boutons, tableaux en entier, texte à 9 pt (12 px)
const impression = {
  ':root': { '--fond-ligne-cle': 'rgba(58, 143, 141, 0.10)' },
  '@media (prefers-color-scheme: dark)': { ':root': { '--fond-ligne-cle': 'rgba(95, 179, 176, 0.18)' } },
  '.impression-seule': { display: 'none' },
  '.partie-cachee': { display: 'none !important' },
  '.repli-ferme': { display: 'none' },
  '@page': { size: 'A4 landscape', margin: '10mm' },
  '@media print': {
    'body': { backgroundColor: '#ffffff !important' },
    '*': { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' },
    '.pas-a-l-impression, .MuiTabs-root, .MuiAlert-root, .MuiIconButton-root, .MuiTableSortLabel-icon, header.MuiAppBar-root, nav.MuiDrawer-root, .MuiDrawer-root, .MuiBottomNavigation-root': { display: 'none !important' },
    '.impression-seule': { display: 'inline' },
    '.partie-cachee': { display: 'block !important' },
    '.repli-ferme': { display: 'block !important' },
    main: { marginLeft: '0 !important', padding: '0 !important', maxWidth: 'none !important' },
    '.MuiCard-root': { boxShadow: 'none !important', border: '1px solid #d6d6d6', overflow: 'visible !important' },
    '.MuiTableContainer-root': { overflow: 'visible !important' },
    'table.colonne-fixe tr > *, table.deux-colonnes-fixes tr > *': { position: 'static !important', boxShadow: 'none !important' },
    'table td, table th': { fontSize: '9pt !important', paddingTop: '3px !important', paddingBottom: '3px !important', minHeight: '0 !important' },
    'table a, table .MuiButtonBase-root': { minHeight: '0 !important' },
    '.MuiOutlinedInput-notchedOutline': { border: 'none !important' },
    'input::placeholder': { color: 'inherit !important', opacity: '1 !important' },
    tr: { breakInside: 'avoid' },
  },
}

// Charge le profil du pilotage et ses années (0027) avant d'afficher ; quand le Directeur ouvre une campagne ou démarre
// un suivi, tout se redessine avec les nouvelles années
function Chargeur({ children }: { children: (p: Profil) => ReactNode }) {
  const { profil } = useAuth()
  const [lu, setLu] = useState<string | null>(null)
  const [, setVersion] = useState(0)
  const compte = profil ? `${profil.id}|${profil.role}` : null
  useEffect(() => ecouterAnnees(() => { oublier(); setVersion((v) => v + 1) }), [])
  useEffect(() => {
    if (!compte) return
    let actif = true
    chargerAnnees().finally(() => actif && setLu(compte))
    return () => { actif = false }
  }, [compte])
  if (!profil || lu !== compte) return <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}><CircularProgress aria-label="Chargement du budget" /></Box>
  return <>{children(profil)}</>
}

// Le budget se lit avec les droits du compte connecté : un aperçu « Voir comme » montrerait les chiffres du Directeur
// sous le profil d'un autre (Joseph, 03/11/2026 : « Voir comme » sur le budget viendra plus tard)
function SansApercu({ children }: { children: ReactNode }) {
  const { apercu, equipe } = useApercu()
  if (apercu || equipe) return <EtatVide titre="Le budget ne se voit pas en aperçu" texte="Quitte l’aperçu pour retrouver les budgets et le suivi avec ton propre compte." />
  return <>{children}</>
}

export function ZonePilotage({ children }: { children: (p: Profil) => ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles styles={impression} />
      <SansApercu>
        <PilotageAuthProvider>
          <GardeSaisie>
            <Chargeur>{children}</Chargeur>
          </GardeSaisie>
        </PilotageAuthProvider>
      </SansApercu>
    </ThemeProvider>
  )
}

// Pages du réseau : budgets de l'année, suivi, hypothèses, imports, paramètres, en onglets sous l'entrée « Budgets »
function OngletsBudgets({ profil }: { profil: Profil }) {
  const { pathname } = useLocation()
  const pages = [
    { chemin: '/budgets', nom: `Budgets ${anneeBudget()}` },
    ...(estEquipe(profil) ? [{ chemin: '/budgets/suivi', nom: `Suivi ${anneeSuivi()}` }] : []),
    ...(estDirecteur(profil) ? [{ chemin: '/budgets/hypotheses', nom: 'Hypothèses du réseau' }, { chemin: '/budgets/imports', nom: 'Imports de caisse' }] : []),
    ...(voitParametres(profil) ? [{ chemin: '/budgets/parametres', nom: 'Paramètres réseau' }] : []),
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
            {estEquipe(profil) && <Route path="suivi" element={<Reseau />} />}
            {estDirecteur(profil) && <Route path="hypotheses" element={<Hypotheses />} />}
            {estDirecteur(profil) && <Route path="imports" element={<Imports />} />}
            {voitParametres(profil) && <Route path="parametres" element={<Parametres />} />}
            <Route path="*" element={<Navigate to="/budgets" replace />} />
          </Routes>
        </>
      )}
    </ZonePilotage>
  )
}

// Onglet « Budget » de la fiche d'un magasin : suivi, budget et saisies du magasin
export function OngletBudget({ nom }: { nom: string }) {
  return <ZonePilotage>{() => <Magasin nom={nom} />}</ZonePilotage>
}
