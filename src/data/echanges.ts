// Onglet Échanges (Joseph, 21/10/2026) : magasins dont le compte voit les groupes, canal « Réseau V and B »
// (communications) et nombre de nouveautés affiché sur l'onglet.
import { useMemo, useSyncExternalStore } from 'react'
import type { Profil } from '../auth/roles'
import type { Magasin, Reseau } from './modele'
import { magasinsDu, perimetreDuProfil } from './perimetre'
import { totalALire } from './messagerie'
import { useMessagerie } from './MessagerieContext'
import { useReseau } from './ReseauContext'
import { useAuth } from '../auth/AuthContext'
import type { Communication } from './communications'

// Directeur : tout le réseau ; Coach et RR : leurs magasins ; franchisé : les siens (déjà seuls dans son espace)
export function magasinsDesEchanges(reseau: Reseau, profil: Profil | null): Magasin[] {
  const p = perimetreDuProfil(profil)
  return p ? magasinsDu(reseau, p) : reseau.magasins
}

// Dernière ouverture du canal Réseau, gardée sur l'appareil. Première fois : rien d'ancien n'est signalé.
const CLE = 'vandb-reseau-vu'
const abonnes = new Set<() => void>()
function lireVu(): string {
  try {
    const v = localStorage.getItem(CLE)
    if (v) return v
    const maintenant = new Date().toISOString()
    localStorage.setItem(CLE, maintenant)
    return maintenant
  } catch { return '' }
}
export function noterReseauVu() {
  try { localStorage.setItem(CLE, new Date().toISOString()) } catch { /* appareil sans stockage */ }
  abonnes.forEach((f) => f())
}
const sAbonner = (f: () => void) => { abonnes.add(f); return () => { abonnes.delete(f) } }
export const useReseauVu = () => useSyncExternalStore(sAbonner, lireVu, () => '')

// Canal jamais ouvert sur cet appareil : les communications des 14 derniers jours
export function communicationsNonVues(liste: Communication[], moi: string, vu: string): number {
  const depuis = vu || new Date(Date.now() - 14 * 86_400_000).toISOString()
  return liste.filter((c) => c.auteur !== moi && c.creeLe > depuis).length
}

// Nombre sur l'onglet Échanges : messages qui me concernent et nouveaux comptes rendus (franchisé)
// aucun : aperçu de l'espace d'un franchisé par le Directeur
export function useTotalEchanges(aucun = false): number {
  const { reseau } = useReseau()
  const { profil } = useAuth()
  const { messagerie } = useMessagerie()
  return useMemo(() => (aucun ? 0 : totalALire(reseau, profil, messagerie)), [aucun, reseau, profil, messagerie])
}
