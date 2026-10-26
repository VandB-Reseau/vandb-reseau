import { statutA } from './construction'
import type { Magasin, Reseau, Statut } from './modele'

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

// Magasin sans Coach géré en direct par son Responsable Régional : un choix d'organisation, pas un manque.
// Le RR y tient le rôle du Coach. `coach` = le Coach à la date voulue (par défaut celui du jour).
export function enDirect(m: Magasin, coach = m.coach): boolean {
  return !coach && m.rrEnDirect && !!m.rr
}

export const EN_DIRECT = 'Géré en direct · '

// Qui suit le magasin : son Coach, « Géré en direct · RR », ou vide s'il n'a vraiment personne
export function suivi(m: Magasin, coach = m.coach): string {
  return coach || (enDirect(m, coach) ? `${EN_DIRECT}${m.rr!.nom}` : '')
}

export function libelleSuivi(m: Magasin, coach = m.coach): string {
  return suivi(m, coach) || 'Sans Coach'
}

// « Coach · RR », « Géré en direct · RR » ou « Sans Coach · RR »
export function suiviEtRR(m: Magasin, coach = m.coach): string {
  return (enDirect(m, coach) ? [suivi(m, coach)] : [libelleSuivi(m, coach), m.rr?.nom]).filter(Boolean).join(' · ')
}

// Clé de filtre « Coach » : le Coach, « __direct__ » (géré en direct) ou « __aucun__ »
export function cleFiltreCoach(m: Magasin, coach = m.coach): string {
  return coach || (enDirect(m, coach) ? '__direct__' : '__aucun__')
}

export const libelleCleCoach = (c: string): string => (c === '__aucun__' ? 'Sans Coach' : c === '__direct__' ? 'Géré en direct' : c)

// Options du filtre « Coach » à partir des clés des magasins : les Coachs, « Géré en direct » s'il y en a, « Sans Coach »
export function optionsFiltreCoach<D>(cles: string[], detail: (n: number) => D): { valeur: string; libelle: string; detail: D }[] {
  const n = (c: string) => cles.filter((x) => x === c).length
  const coachs = [...new Set(cles)].filter((c) => !c.startsWith('__')).sort((a, b) => a.localeCompare(b, 'fr'))
  return [...coachs, ...(n('__direct__') ? ['__direct__'] : []), '__aucun__'].map((c) => ({ valeur: c, libelle: libelleCleCoach(c), detail: detail(n(c)) }))
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
