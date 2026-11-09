import { useEffect, useState, type ReactNode } from 'react'
import { Link as RouterLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import GlobalStyles from '@mui/material/GlobalStyles'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import { ThemeProvider } from '@mui/material/styles'
import { useApercu } from '../auth/Apercu'
import { useAuthSiDispo } from '../auth/AuthContext'
import { useReseauSiDispo } from '../data/ReseauContext'
import { monNomPorteur } from '../data/actions'
import { mesCles } from '../data/messagerie'
import { pont } from './data/taches'
import { apercuPilotage } from './lib/apercu'
import { installerChampSuivant } from './lib/champSuivant'
import { PilotageAuthProvider, useAuth } from './auth/AuthContext'
import { estDirecteur, estEquipe, voitParametres, type Profil } from './auth/roles'
import { GardeSaisie } from './components/GardeSaisie'
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

// « Voir comme » (Joseph, 04/11/2026) : le budget se lit avec les droits du Directeur, limité aux magasins de la personne
// vue (ceux du franchisé, ou le périmètre du Coach ou du RR) et en lecture seule (src/pilotage/lib/supabase.ts)
function PerimetreApercu({ children }: { children: ReactNode }) {
  const { apercu, equipe } = useApercu()
  const etat = useReseauSiDispo()
  const noms = apercu ? apercu.magasins : equipe ? etat?.reseau?.magasins.map((m) => m.nom) ?? null : null
  if (equipe && !noms) return <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}><CircularProgress aria-label="Chargement du budget" /></Box>
  const cle = apercu ? `franchise|${apercu.franchise}|${noms!.join(',')}` : equipe ? `equipe|${equipe.cle}|${noms!.join(',')}` : ''
  // Changement de personne vue : les lectures gardées en mémoire étaient celles d'un autre périmètre
  if (cle !== apercuPilotage.cle) { apercuPilotage.cle = cle; apercuPilotage.magasins = cle ? new Set(noms) : null; oublier() }
  return <>{children}</>
}

// Le budget crée et lit ses tâches dans la liste du réseau : réseau et compte de l'app posés avant les écrans
// (posés pendant le rendu, car les écrans enfants chargent leurs données avant les effets du parent)
function usePontReseau() {
  const etat = useReseauSiDispo()
  const auth = useAuthSiDispo()
  const profil = auth?.profil ?? null
  pont.courant = {
    reseau: etat?.complet ?? etat?.reseau ?? null, franchise: profil?.role === 'franchise', mesCles: mesCles(profil),
    nom: etat?.reseau ? monNomPorteur(etat.reseau, profil) || profil?.nom || '' : profil?.nom ?? '', recharger: etat?.recharger ?? null,
  }
}

export function ZonePilotage({ children }: { children: (p: Profil) => ReactNode }) {
  usePontReseau()
  // Entrée dans un montant : champ suivant (saisie rapide de l'ancien pilotage, perdue à la fusion)
  useEffect(installerChampSuivant, [])
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles styles={impression} />
      <PerimetreApercu>
        <PilotageAuthProvider>
          <GardeSaisie>
            <Chargeur>{children}</Chargeur>
          </GardeSaisie>
        </PilotageAuthProvider>
      </PerimetreApercu>
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
