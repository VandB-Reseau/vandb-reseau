// Actions des plans d'action : elles s'accumulent sur le magasin de visite en visite, jusqu'à être faites.
import type { ActionPlan, Reseau, Visite } from './modele'

export interface ActionSuivie { visite: Visite; index: number; a: ActionPlan; cle: string }

export const cleAction = (visiteId: number | null, index: number) => `${visiteId ?? 'x'}:${index}`
export const echeanceDate = (a: ActionPlan) => (/^\d{4}-\d{2}-\d{2}$/.test(a.echeance) ? a.echeance : '')
export const enRetard = (a: ActionPlan, jour: string) => !a.faite && !!echeanceDate(a) && echeanceDate(a) < jour

// Toutes les actions des visites d'un ensemble de magasins ; en cours d'abord, échéance la plus proche en tête
export function actionsDes(reseau: Reseau, magasins: Set<string> | null): ActionSuivie[] {
  const l: ActionSuivie[] = []
  for (const v of reseau.visites) {
    if (magasins && !magasins.has(v.magasin)) continue
    v.plan.forEach((a, index) => l.push({ visite: v, index, a, cle: cleAction(v.id, index) }))
  }
  const fin = '9999-12-31'
  return l.sort((x, y) => Number(!!x.a.faite) - Number(!!y.a.faite)
    || (x.a.faite ? (y.a.faite ?? '').localeCompare(x.a.faite) : (echeanceDate(x.a) || fin).localeCompare(echeanceDate(y.a) || fin))
    || x.visite.date.localeCompare(y.visite.date))
}

export const actionsDuMagasin = (reseau: Reseau, magasin: string) => actionsDes(reseau, new Set([magasin]))
export const actionsEnCours = (reseau: Reseau, magasins: Set<string> | null) => actionsDes(reseau, magasins).filter((x) => !x.a.faite)
