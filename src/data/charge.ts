import { statutA } from './construction'
import type { Magasin, Reseau, Statut } from './modele'

// Règle de l'ancienne app : un magasin ouvert compte 1 unité,
// un magasin en pré-ouverture ou nouvellement ouvert en compte 2, un magasin à venir 0.
export const poidsStatut: Record<Statut, number> = { ouvert: 1, nouveau: 2, preouverture: 2, avenir: 0 }

export function coachA(m: Magasin, jour: string): string {
  const h = m.historiqueCoach.filter((a) => a.date <= jour)
  return h.length ? h[h.length - 1].coach : ''
}

export function magasinsDuCoach(reseau: Reseau, coach: string, jour = reseau.jour): Magasin[] {
  return reseau.magasins.filter((m) => coachA(m, jour) === coach)
}

export function chargeA(reseau: Reseau, coach: string, jour = reseau.jour): number {
  return magasinsDuCoach(reseau, coach, jour).reduce((t, m) => t + poidsStatut[statutA(m.ouverture, jour, reseau.parametres)], 0)
}

export type NiveauCharge = 'vide' | 'ok' | 'attention' | 'complet' | 'depassement'

export const niveauLibelle: Record<NiveauCharge, string> = {
  vide: 'Sans magasin', ok: 'Charge correcte', attention: 'À surveiller', complet: 'Au maximum', depassement: 'Dépassement',
}

export function niveauCharge(reseau: Reseau, charge: number): NiveauCharge {
  const { maxUnits, alertThreshold } = reseau.parametres
  if (charge === 0) return 'vide'
  if (charge > maxUnits) return 'depassement'
  if (charge === maxUnits) return 'complet'
  if (charge >= alertThreshold) return 'attention'
  return 'ok'
}

// Premier jour des N prochains mois (mois courant inclus)
export function moisAVenir(jour: string, n: number): string[] {
  const [a, m] = jour.split('-').map(Number)
  return Array.from({ length: n }, (_v, i) => new Date(Date.UTC(a, m - 1 + i, 1)).toISOString().slice(0, 10))
}

export function libelleMois(iso: string, court = false): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return d.toLocaleDateString('fr-FR', { month: court ? 'short' : 'long', year: court ? '2-digit' : 'numeric', timeZone: 'UTC' })
}
