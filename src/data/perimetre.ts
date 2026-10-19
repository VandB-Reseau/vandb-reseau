// Périmètre d'une vue : tout le réseau (Directeur), les magasins d'un Responsable Régional ou ceux d'un Coach
import type { Profil } from '../auth/roles'
import { coachA } from './charge'
import type { Magasin, Reseau } from './modele'

export type Perimetre = { type: 'reseau' } | { type: 'rr'; id: string } | { type: 'coach'; nom: string }

export const cleVue = (p: Perimetre) => (p.type === 'reseau' ? 'reseau' : p.type === 'rr' ? `rr:${p.id}` : `coach:${p.nom}`)
export function lireVue(cle: string | null): Perimetre {
  if (cle?.startsWith('rr:')) return { type: 'rr', id: cle.slice(3) }
  if (cle?.startsWith('coach:')) return { type: 'coach', nom: cle.slice(6) }
  return { type: 'reseau' }
}

// Périmètre imposé par le compte ; null pour le Directeur, qui choisit sa vue
export function perimetreDuProfil(p: Profil | null): Perimetre | null {
  if (p?.role === 'coach' && p.perimetre.coachs?.[0]) return { type: 'coach', nom: p.perimetre.coachs[0] }
  if (p?.role === 'rr' && p.perimetre.rr?.[0]) return { type: 'rr', id: p.perimetre.rr[0] }
  return null
}

export function magasinsDu(reseau: Reseau, p: Perimetre): Magasin[] {
  if (p.type === 'coach') return reseau.magasins.filter((m) => coachA(m, reseau.jour) === p.nom)
  if (p.type === 'rr') {
    const rr = reseau.rrs.find((r) => r.id === p.id)
    return reseau.magasins.filter((m) => m.rr?.id === p.id || (rr?.integres && !m.franchise))
  }
  return reseau.magasins
}

// Personnes du périmètre (pour les absences et anniversaires de l'agenda)
export function personnesDu(reseau: Reseau, p: Perimetre): Set<string> | null {
  if (p.type === 'coach') return new Set([p.nom])
  if (p.type === 'rr') {
    const rr = reseau.rrs.find((r) => r.id === p.id)
    return new Set([...(rr ? [rr.nom] : []), ...reseau.equipe.filter((c) => c.rr?.id === p.id).map((c) => c.nom)])
  }
  return null
}

export function libelleVue(reseau: Reseau, p: Perimetre): string {
  if (p.type === 'coach') return p.nom
  if (p.type === 'rr') return reseau.rrs.find((r) => r.id === p.id)?.nom ?? 'Responsable Régional'
  return 'Tout le réseau'
}
