// Nombre sur l'icône Infos réseau de l'en-tête (Joseph, 22/10/2026) : communications et bonnes pratiques pas encore vues.
// Communications : dernière ouverture du canal Réseau (echanges.ts). Bonnes pratiques : identifiants déjà vus, gardés
// sur l'appareil et, pour l'équipe, recopiés dans les préférences du compte ; première fois, rien d'ancien n'est signalé.
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useReseau } from './ReseauContext'
import { useAuth } from '../auth/AuthContext'
import { useCommunicationsDuFil } from './communications'
import { communicationsNonVues, useReseauVu } from './echanges'
import { monNomPorteur } from './actions'
import { brancher, preferenceChangee } from '../lib/preferences'

const CLE = 'vandb-pratiques-vues'
const abonnes = new Set<() => void>()
let actuel: string[] | null | undefined

function lire(): string[] | null {
  if (actuel !== undefined) return actuel
  try {
    const v = JSON.parse(localStorage.getItem(CLE) ?? 'null') as unknown
    actuel = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null
  } catch { actuel = null }
  return actuel
}
function ecrireIci(l: string[]) {
  actuel = l
  try { localStorage.setItem(CLE, JSON.stringify(l)) } catch { /* stockage indisponible : gardé pour la session */ }
  abonnes.forEach((f) => f())
}
brancher('pratiquesVues', { lire: () => lire() ?? [], appliquer: (v) => {
  if (!Array.isArray(v)) return
  const l = lire() ?? []
  const ajout = v.filter((x): x is string => typeof x === 'string' && !l.includes(x))
  if (ajout.length || lire() === null) ecrireIci([...l, ...ajout])
} })
const abonner = (f: () => void) => { abonnes.add(f); return () => { abonnes.delete(f) } }

export function noterPratiquesVues(ids: string[]) {
  const l = lire()
  if (l && ids.every((i) => l.includes(i))) return
  ecrireIci([...new Set([...(l ?? []), ...ids])])
  preferenceChangee()
}

export function useNouveautesInfos(aucun = false): number {
  const { reseau } = useReseau()
  const { profil } = useAuth()
  const communications = useCommunicationsDuFil()
  const vu = useReseauVu()
  const vues = useSyncExternalStore(abonner, lire, () => null)
  const ids = useMemo(() => (reseau?.pratiques ?? []).map((p) => p.id), [reseau])
  // Première fois sur cet appareil : les bonnes pratiques déjà là ne sont pas nouvelles
  useEffect(() => { if (reseau && !aucun && vues === null) noterPratiquesVues(ids) }, [reseau, aucun, vues, ids])
  if (aucun || !reseau) return 0
  const moi = monNomPorteur(reseau, profil)
  const pratiques = vues ? reseau.pratiques.filter((p) => !vues.includes(p.id) && p.par !== moi).length : 0
  return communicationsNonVues(communications.liste, communications.moi, vu) + pratiques
}
