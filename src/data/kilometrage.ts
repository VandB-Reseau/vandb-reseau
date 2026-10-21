import { statutA } from './construction'
import { caseDe, visitesParAn } from './sante'
import { trajetEntre } from './tournee'
import type { Magasin, Reseau } from './modele'
import type { Point } from './zones'

// Route d'un Coach sur l'année : chaque visite est un aller-retour par la route entre son domicile et le magasin,
// autant de fois que le rythme de la nine box le demande (2 à 8 visites par an). Trajets réels quand le service
// d'itinéraire les a donnés (voir routes.ts), sinon estimés et signalés.

export interface AccesMagasin { magasin: Magasin; km: number; minutes: number; visites: number; estime: boolean }
export interface RouteAnnuelle { km: number; minutes: number; visites: number; acces: AccesMagasin[]; estime: boolean; complete: boolean }

// Visites prévues sur un an pour un magasin : celles de sa case, aucune pour un magasin pas encore en préparation
export function visitesPrevues(reseau: Reseau, m: Magasin, jour = reseau.jour): number {
  if (statutA(m.ouverture, jour, reseau.parametres) === 'avenir') return 0
  return visitesParAn(caseDe(reseau.evaluations?.[m.nom]))
}

export function accesMagasin(reseau: Reseau, depart: Point | null, m: Magasin, jour = reseau.jour): AccesMagasin | null {
  if (!depart || m.lat === null || m.lon === null) return null
  const aller = trajetEntre(depart, { lat: m.lat, lon: m.lon }), retour = trajetEntre({ lat: m.lat, lon: m.lon }, depart)
  return { magasin: m, km: aller.km + retour.km, minutes: aller.minutes + retour.minutes, visites: visitesPrevues(reseau, m, jour), estime: aller.estime || retour.estime }
}

export function routeAnnuelle(reseau: Reseau, depart: Point | null, magasins: Magasin[], jour = reseau.jour): RouteAnnuelle {
  const acces = magasins.map((m) => accesMagasin(reseau, depart, m, jour)).filter((a): a is AccesMagasin => !!a)
    .sort((a, b) => b.minutes - a.minutes)
  return {
    km: acces.reduce((t, a) => t + a.km * a.visites, 0),
    minutes: acces.reduce((t, a) => t + a.minutes * a.visites, 0),
    visites: acces.reduce((t, a) => t + a.visites, 0),
    acces, estime: acces.some((a) => a.estime), complete: !!depart && acces.length === magasins.length,
  }
}

// Temps moyen d'un aller simple, par la route, entre un point et des magasins
export function minutesMoyennes(depart: Point | null, magasins: { lat: number | null; lon: number | null }[]): number | null {
  if (!depart) return null
  const places = magasins.filter((m): m is Point => m.lat !== null && m.lon !== null)
  if (!places.length) return null
  return places.reduce((t, m) => t + trajetEntre(depart, m).minutes, 0) / places.length
}

export const heures = (minutes: number) => `${Math.round(minutes / 60).toLocaleString('fr-FR')} h`
export const kilometres = (km: number) => `${Math.round(km).toLocaleString('fr-FR')} km`
