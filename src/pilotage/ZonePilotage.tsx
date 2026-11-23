import { useEffect, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import GlobalStyles from '@mui/material/GlobalStyles'
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
import type { Profil } from './auth/roles'
import { GardeSaisie } from './components/GardeSaisie'
import { chargerAnnees, ecouterAnnees } from './data/annees'
import { oublier } from './data/pilotage'
import { theme } from './theme/theme'

// Cadre commun des écrans du budget (thème, compte, années, aperçu « Voir comme »), séparé des pages (369, Joseph
// 23/11/2026) : Performance, Pilotage et Paramètres l'utilisent sans télécharger les pages du budget ni les simulateurs.

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

// Refonte vague 2 (17A) : pendant le chargement, la forme de la page en gris plutôt qu'un rond qui tourne
function SilhouetteBudget() {
  return (
    <Box role="progressbar" aria-label="Chargement du budget" sx={{ display: 'grid', gap: 1.5 }}>
      <Skeleton variant="rounded" height={88} />
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
        {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={140} />)}
      </Box>
      <Skeleton variant="rounded" height={220} />
    </Box>
  )
}

// Charge le profil du pilotage et ses années (0027) avant d'afficher ; quand le Directeur ouvre une campagne ou démarre
// un suivi, tout se redessine avec les nouvelles années. Les années se lisent en même temps que les droits du compte, et
// une fois lues, l'écran suivant s'affiche tout de suite pendant qu'elles sont relues (Joseph, 23/11/2026)
let anneesLuesPour: string | null = null
function Chargeur({ children }: { children: (p: Profil) => ReactNode }) {
  const { profil } = useAuth()
  const compte = useAuthSiDispo()?.profil?.id ?? profil?.id ?? null
  const [lu, setLu] = useState<string | null>(anneesLuesPour)
  const [, setVersion] = useState(0)
  useEffect(() => ecouterAnnees(() => { oublier(); setVersion((v) => v + 1) }), [])
  useEffect(() => {
    if (!compte) return
    let actif = true
    chargerAnnees().finally(() => { anneesLuesPour = compte; if (actif) setLu(compte) })
    return () => { actif = false }
  }, [compte])
  if (!profil || lu !== compte) return <SilhouetteBudget />
  return <>{children(profil)}</>
}

// « Voir comme » (Joseph, 04/11/2026) : le budget se lit avec les droits du Directeur, limité aux magasins de la personne
// vue (ceux du franchisé, ou le périmètre du Coach ou du RR) et en lecture seule (src/pilotage/lib/supabase.ts)
function PerimetreApercu({ children }: { children: ReactNode }) {
  const { apercu, equipe } = useApercu()
  const etat = useReseauSiDispo()
  const noms = apercu ? apercu.magasins : equipe ? etat?.reseau?.magasins.map((m) => m.nom) ?? null : null
  if (equipe && !noms) return <SilhouetteBudget />
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
