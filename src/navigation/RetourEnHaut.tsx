import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Paramètres d'adresse qui changent d'écran (onglets, formes d'affichage) ; les filtres gardent la position
const PARAMETRES_ECRAN = ['vue', 'forme']

function cleEcran(pathname: string, search: string): string {
  const params = new URLSearchParams(search)
  return [pathname, ...PARAMETRES_ECRAN.map((p) => params.get(p) ?? '')].join('|')
}

// Tableaux qui défilent dans leur carte (ligne des titres fixe) : leur position est retrouvée aussi
interface Position { y: number; tableaux: number[] }
const tableaux = () => [...document.querySelectorAll<HTMLElement>('.MuiTableContainer-root')]

// Onglets d'une fiche (Onglets fiche) : position où la bande touche la barre du haut
function hauteurOnglets(): number | null {
  const repere = document.querySelector('.onglets-repere'), bande = document.querySelector('.onglets-fiche')
  if (!repere || !bande) return null
  return Math.max(0, repere.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(bande).top) || 0))
}

// Chaque nouvel écran, onglet ou fiche s'ouvre en haut ; le retour arrière retrouve la position quittée.
// Dans une fiche à onglets, changer d'onglet garde la position, au plus les onglets en haut de l'écran.
export function RetourEnHaut() {
  const { pathname, search, key } = useLocation()
  const navigation = useNavigationType()
  const positions = useRef(new Map<string, Position>())
  const ecran = cleEcran(pathname, search)
  const precedent = useRef(ecran)
  const chemin = useRef(pathname)
  const derniereY = useRef(0)

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  }, [])

  // Mémorise la position de l'écran affiché, pour le retour arrière ; la clé « default »
  // (premier chargement, adresse tapée) est partagée par plusieurs écrans, d'où l'écran dans la clé
  useEffect(() => {
    const noter = () => {
      derniereY.current = window.scrollY
      positions.current.set(`${key}|${ecran}`, { y: window.scrollY, tableaux: tableaux().map((t) => t.scrollTop) })
    }
    // Capture : le défilement d'un tableau dans sa carte ne remonte pas jusqu'à la fenêtre
    window.addEventListener('scroll', noter, { passive: true, capture: true })
    return () => window.removeEventListener('scroll', noter, { capture: true })
  }, [key, ecran])

  useLayoutEffect(() => {
    if (precedent.current === ecran) return
    precedent.current = ecran
    const memeFiche = chemin.current === pathname
    chemin.current = pathname
    const memorisee = navigation === 'POP' ? positions.current.get(`${key}|${ecran}`) : undefined
    const onglets = memeFiche && !memorisee ? hauteurOnglets() : null
    const y = memorisee?.y ?? (onglets === null ? 0 : Math.min(derniereY.current, onglets))
    window.scrollTo({ top: y, left: 0, behavior: 'instant' })
    derniereY.current = window.scrollY
    if (memorisee?.tableaux.some(Boolean)) tableaux().forEach((t, i) => { t.scrollTop = memorisee.tableaux[i] ?? 0 })
  }, [ecran, key, navigation])

  return null
}
