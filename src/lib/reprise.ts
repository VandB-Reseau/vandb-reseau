import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// 234 (Joseph, 16/11/2026) : l'app rouvre là où on l'a quittée (dernier magasin, dernier onglet). Seulement à
// l'ouverture de l'app sur l'Accueil sans lien précis, une fois par onglet du navigateur, pour le même compte et si la
// dernière page a moins de trois jours. Mémoire du navigateur jamais indispensable : toute erreur est ignorée.
const CLE = 'vandb-derniere-page'
const CLE_ONGLET = 'vandb-app-ouverte'
const DUREE = 3 * 24 * 3600 * 1000
interface Derniere { compte: string; chemin: string; le: number }

export function useReprise(compte: string | undefined) {
  const { pathname, search } = useLocation()
  const naviguer = useNavigate()
  const lu = useRef(false)
  useEffect(() => {
    if (!compte || lu.current) return
    lu.current = true
    try {
      const dejaOuverte = sessionStorage.getItem(CLE_ONGLET)
      sessionStorage.setItem(CLE_ONGLET, '1')
      if (dejaOuverte || pathname !== '/' || search) return
      const d = JSON.parse(localStorage.getItem(CLE) ?? 'null') as Derniere | null
      if (d && d.compte === compte && d.chemin && d.chemin !== '/' && Date.now() - d.le < DUREE) naviguer(d.chemin, { replace: true })
    } catch { /* navigateur sans mémoire */ }
  }, [compte]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!compte || !lu.current) return
    try { localStorage.setItem(CLE, JSON.stringify({ compte, chemin: `${pathname}${search}`, le: Date.now() } satisfies Derniere)) } catch { /* idem */ }
  }, [compte, pathname, search])
}
