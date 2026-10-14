import { statutA } from './construction'
import type { Coach, Magasin, Reseau, Statut } from './modele'

// Règle réglable dans Direction (par défaut celle de l'ancienne app) : un magasin ouvert compte 1 unité,
// un magasin en pré-ouverture ou nouvellement ouvert en compte 2, un magasin à venir 0.
export function poids(reseau: Reseau, statut: Statut): number {
  if (statut === 'avenir') return 0
  return statut === 'ouvert' ? reseau.parametres.poidsOuvert : reseau.parametres.poidsRenforce
}

export function coachA(m: Magasin, jour: string): string {
  const h = m.historiqueCoach.filter((a) => a.date <= jour)
  return h.length ? h[h.length - 1].coach : ''
}

export function magasinsDuCoach(reseau: Reseau, coach: string, jour = reseau.jour): Magasin[] {
  return reseau.magasins.filter((m) => coachA(m, jour) === coach)
}

export function chargeA(reseau: Reseau, coach: string, jour = reseau.jour): number {
  return magasinsDuCoach(reseau, coach, jour).reduce((t, m) => t + poids(reseau, statutA(m.ouverture, jour, reseau.parametres)), 0)
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

export function distanceKm(a: { lat: number | null; lon: number | null }, b: { lat: number | null; lon: number | null }): number | null {
  if (a.lat === null || a.lon === null || b.lat === null || b.lon === null) return null
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export interface Suggestion { coach: Coach; distance: number | null; chargeAvant: number; chargeApres: number; depasse: boolean }

// Coachs candidats pour reprendre un magasin : ceux qui restent sous le maximum, les Coachs en poste,
// puis le plus proche et enfin le moins chargé
export function suggererCoachs(reseau: Reseau, m: Magasin, jour: string): Suggestion[] {
  const statut = statutA(m.ouverture, jour, reseau.parametres)
  return reseau.equipe
    .filter((c) => c.nom !== coachA(m, jour) && (!c.arrivee || c.arrivee <= jour || c.fictif))
    .map((c) => {
      const avant = chargeA(reseau, c.nom, jour)
      const apres = avant + poids(reseau, statut)
      return { coach: c, distance: distanceKm(c, m), chargeAvant: avant, chargeApres: apres, depasse: apres > reseau.parametres.maxUnits }
    })
    .sort((a, b) => Number(a.depasse) - Number(b.depasse) || Number(a.coach.fictif) - Number(b.coach.fictif) || (a.distance ?? 9999) - (b.distance ?? 9999) || a.chargeAvant - b.chargeAvant)
}
