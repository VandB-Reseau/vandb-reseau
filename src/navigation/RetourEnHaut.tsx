import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Paramètres d'adresse qui changent d'écran (onglets, formes d'affichage) ; les filtres gardent la position
const PARAMETRES_ECRAN = ['vue', 'forme']

function cleEcran(pathname: string, search: string): string {
  const params = new URLSearchParams(search)
  return [pathname, ...PARAMETRES_ECRAN.map((p) => params.get(p) ?? '')].join('|')
}

// Chaque nouvel écran, onglet ou fiche s'ouvre en haut ; le retour arrière retrouve la position quittée
export function RetourEnHaut() {
  const { pathname, search, key } = useLocation()
  const navigation = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const ecran = cleEcran(pathname, search)
  const precedent = useRef(ecran)

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  }, [])

  // Mémorise la position de l'écran affiché, pour le retour arrière
  useEffect(() => {
    const noter = () => positions.current.set(key, window.scrollY)
    window.addEventListener('scroll', noter, { passive: true })
    return () => window.removeEventListener('scroll', noter)
  }, [key])

  useLayoutEffect(() => {
    if (precedent.current === ecran) return
    precedent.current = ecran
    // « default » : entrée sans clé (premier chargement, adresse tapée), partagée par plusieurs écrans
    const memorisee = navigation === 'POP' && key !== 'default' ? positions.current.get(key) : undefined
    window.scrollTo({ top: memorisee ?? 0, left: 0, behavior: 'instant' })
  }, [ecran, key, navigation])

  return null
}
