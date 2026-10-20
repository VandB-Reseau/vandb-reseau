import type { PreparationVisite, Reseau, Visite } from './modele'
import { anneeDe, suiviRythme, type LigneRythme } from './visites'
import { estVisite } from './chiffres'
import { matriceMinutes, ordre, tournee, type Tournee } from './tournee'
import { positionsCoachs } from './plan'

// Semaine d'un Coach : magasins dont la visite est due d'ici sept jours (retards compris) et visites déjà prévues,
// rangés dans l'ordre de tournée depuis son domicile
export interface LigneSemaine { l: LigneRythme; prevue: Visite | null }
export interface Semaine { debut: string; fin: string; lignes: LigneSemaine[]; aPlanifier: LigneSemaine[]; tournee: Tournee }

const jourNum = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86400000
const isoDe = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10)

export function semaineDu(reseau: Reseau, coach: string): Semaine {
  const debut = reseau.jour
  const fin = isoDe(jourNum(debut) + 6)
  const prevues = new Map<string, Visite>()
  for (const v of reseau.visites) {
    if (v.date < debut || v.date > fin || !estVisite(v)) continue
    // Visite prévue aujourd'hui : déjà comptée faite par le rythme, gardée ici comme prévue
    const p = prevues.get(v.magasin)
    if (!p || v.date < p.date) prevues.set(v.magasin, v)
  }
  const dues = suiviRythme(reseau, anneeDe(debut))
    .filter((l) => l.coach === coach && (l.retard > 0 || l.prochaine <= fin || prevues.has(l.magasin.nom)))
    .map((l) => ({ l, prevue: prevues.get(l.magasin.nom) ?? null }))
  const domicile = positionsCoachs(reseau, debut).get(coach) ?? null
  const places = dues.filter((x) => x.l.magasin.lat !== null && x.l.magasin.lon !== null)
  const sansPlace = dues.filter((x) => x.l.magasin.lat === null || x.l.magasin.lon === null)
  let rangees = places
  if (places.length > 1) {
    const points = [domicile ?? { lat: places[0].l.magasin.lat!, lon: places[0].l.magasin.lon! }, ...places.map((x) => ({ lat: x.l.magasin.lat!, lon: x.l.magasin.lon! }))]
    rangees = ordre(places.length, matriceMinutes(points)).filter((i) => i > 0).map((i) => places[i - 1])
  }
  const lignes = [...rangees, ...sansPlace]
  const aPlanifier = lignes.filter((x) => !x.prevue)
  return { debut, fin, lignes, aPlanifier, tournee: tournee(domicile, aPlanifier.map((x) => x.l.magasin)) }
}

// Jour proposé pour poser la visite : la date due si elle tombe dans la semaine, sinon dès que possible
export const jourPropose = (reseau: Reseau, l: LigneRythme) => (l.retard > 0 || l.prochaine <= reseau.jour ? reseau.jour : l.prochaine)

// Préparation encore valable : aucune visite faite depuis qu'elle a été écrite (celle du jour compte encore comme à venir)
export function preparationDe(reseau: Reseau, magasin: string): PreparationVisite | null {
  const p = reseau.preparations[magasin]
  if (!p) return null
  return reseau.visites.some((v) => v.magasin === magasin && estVisite(v) && v.date > p.maj && v.date < reseau.jour) ? null : p
}
