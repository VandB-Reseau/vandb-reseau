// Nombre sur l'onglet Tâches (Joseph, 22/10/2026) : mes tâches en retard et celles qu'on m'a confiées depuis
// ma dernière ouverture de l'onglet, chacune comptée une fois. Les tâches vues sont gardées sur l'appareil et,
// pour l'équipe, recopiées dans les préférences du compte (preferences.ts) pour suivre du PC au téléphone.
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { Reseau } from './modele'
import type { Profil } from '../auth/roles'
import { actionsDes, enRetard, monNomPorteur, portePar, type ActionSuivie } from './actions'
import { useReseau } from './ReseauContext'
import { useAuth } from '../auth/AuthContext'
import { brancher, preferenceChangee } from '../lib/preferences'

const CLE = 'vandb-taches-vues'
const abonnes = new Set<() => void>()
let actuel: string[] | null | undefined // undefined : pas encore lu ; null : jamais ouvert sur cet appareil

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
// Base et appareil se complètent : une tâche vue d'un côté l'est des deux
brancher('tachesVues', { lire: () => lire() ?? [], appliquer: (v) => {
  if (!Array.isArray(v)) return
  const l = lire() ?? []
  const ajout = v.filter((x): x is string => typeof x === 'string' && !l.includes(x))
  if (ajout.length || lire() === null) ecrireIci([...l, ...ajout])
} })
const abonner = (f: () => void) => {
  abonnes.add(f)
  const autreOnglet = (e: StorageEvent) => { if (e.key === CLE) { actuel = undefined; f() } }
  window.addEventListener('storage', autreOnglet)
  return () => { abonnes.delete(f); window.removeEventListener('storage', autreOnglet) }
}

const jourLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// Mes tâches à faire ; celles que j'ai créées moi-même (tâche libre ou plan d'une visite où j'étais) ne sont jamais « nouvelles »
function mesTaches(reseau: Reseau, profil: Profil | null): { moi: string; ouvertes: ActionSuivie[]; confiees: ActionSuivie[] } {
  const moi = monNomPorteur(reseau, profil)
  if (!moi) return { moi, ouvertes: [], confiees: [] }
  const ouvertes = actionsDes(reseau, null).filter((x) => !x.a.faite && portePar(x.a, moi))
  const confiees = ouvertes.filter((x) => (x.libre ? x.libre.auteur !== moi : !x.visite?.visiteurs.includes(moi)))
  return { moi, ouvertes, confiees }
}

export function compterTaches(ouvertes: ActionSuivie[], confiees: ActionSuivie[], vues: string[] | null, jour: string) {
  const nouvelles = new Set(vues ? confiees.filter((x) => !vues.includes(x.cle)).map((x) => x.cle) : [])
  return ouvertes.filter((x) => enRetard(x.a, jour) || nouvelles.has(x.cle)).length
}

// Ouverture de l'onglet : toutes mes tâches à faire deviennent vues (la liste ne garde que celles encore à faire)
export function noterTachesVues(cles: string[]) {
  const l = lire()
  if (l && cles.every((c) => l.includes(c)) && l.length === cles.length) return
  ecrireIci(cles)
  preferenceChangee()
}

// aucun : aperçu de l'espace d'un franchisé par le Directeur
export function useCompteurTaches(aucun = false): number {
  const { reseau } = useReseau()
  const { profil } = useAuth()
  const vues = useSyncExternalStore(abonner, lire, () => null)
  const t = useMemo(() => (reseau && !aucun ? mesTaches(reseau, profil) : null), [reseau, profil, aucun])
  // Première fois sur cet appareil : ce qui existe déjà n'est pas signalé comme nouveau
  useEffect(() => { if (t?.moi && vues === null) noterTachesVues(t.confiees.map((x) => x.cle)) }, [t, vues])
  return t ? compterTaches(t.ouvertes, t.confiees, vues, jourLocal()) : 0
}

// Appelé par la page Tâches de la personne connectée
export function useMarquerTachesVues(actif: boolean) {
  const { reseau } = useReseau()
  const { profil } = useAuth()
  const cles = useMemo(() => (reseau && actif ? mesTaches(reseau, profil).ouvertes.map((x) => x.cle) : null), [reseau, profil, actif])
  useEffect(() => { if (cles) noterTachesVues(cles) }, [cles])
}
