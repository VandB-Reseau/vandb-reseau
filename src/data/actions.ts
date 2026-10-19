// Actions suivies sur un magasin : celles des plans de visite et celles ajoutées hors visite.
// Elles s'accumulent de visite en visite, jusqu'à être faites.
import type { ActionLibre, ActionPlan, Reseau, Visite } from './modele'

export interface ActionSuivie { visite: Visite | null; libre: ActionLibre | null; magasin: string; date: string; index: number; a: ActionPlan; cle: string }

export const cleAction = (visiteId: number | null, index: number) => `${visiteId ?? 'x'}:${index}`
export const cleLibre = (id: string) => `l:${id}`
export const echeanceDate = (a: ActionPlan) => (/^\d{4}-\d{2}-\d{2}$/.test(a.echeance) ? a.echeance : '')
export const enRetard = (a: ActionPlan, jour: string) => !a.faite && !!echeanceDate(a) && echeanceDate(a) < jour

// Relit les actions hors visite enregistrées (une liste par magasin)
export function normaliserActionsLibres(v: unknown): Record<string, ActionLibre[]> {
  const r: Record<string, ActionLibre[]> = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return r
  for (const [magasin, l] of Object.entries(v as Record<string, unknown>)) {
    if (!Array.isArray(l)) continue
    const liste = l.filter((a) => a && typeof a === 'object' && (a as ActionLibre).id && String((a as ActionLibre).action ?? '').trim()).map((x) => {
      const a = x as Record<string, unknown>
      return { id: String(a.id), action: String(a.action), porteur: String(a.porteur ?? ''), echeance: String(a.echeance ?? ''), creeLe: String(a.creeLe ?? ''),
        ...(a.faite ? { faite: String(a.faite) } : {}), ...(a.auteur ? { auteur: String(a.auteur) } : {}) }
    })
    if (liste.length) r[magasin] = liste
  }
  return r
}

// Toutes les actions d'un ensemble de magasins ; en cours d'abord, échéance la plus proche en tête
export function actionsDes(reseau: Reseau, magasins: Set<string> | null): ActionSuivie[] {
  const l: ActionSuivie[] = []
  for (const v of reseau.visites) {
    if (magasins && !magasins.has(v.magasin)) continue
    v.plan.forEach((a, index) => l.push({ visite: v, libre: null, magasin: v.magasin, date: v.date, index, a, cle: cleAction(v.id, index) }))
  }
  for (const [magasin, liste] of Object.entries(reseau.actionsLibres ?? {})) {
    if (magasins && !magasins.has(magasin)) continue
    for (const a of liste) l.push({ visite: null, libre: a, magasin, date: a.creeLe, index: -1, a, cle: cleLibre(a.id) })
  }
  const fin = '9999-12-31'
  return l.sort((x, y) => Number(!!x.a.faite) - Number(!!y.a.faite)
    || (x.a.faite ? (y.a.faite ?? '').localeCompare(x.a.faite) : (echeanceDate(x.a) || fin).localeCompare(echeanceDate(y.a) || fin))
    || x.date.localeCompare(y.date))
}

export const actionsDuMagasin = (reseau: Reseau, magasin: string) => actionsDes(reseau, new Set([magasin]))
export const actionsEnCours = (reseau: Reseau, magasins: Set<string> | null) => actionsDes(reseau, magasins).filter((x) => !x.a.faite)
