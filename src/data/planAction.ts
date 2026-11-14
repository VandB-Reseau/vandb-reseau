// Plan d'action d'un magasin (refonte vague 4, Joseph 10/11/2026, 31A) : 3 priorités au plus, chacune avec un objectif
// chiffré (26A) et ses tâches (champ « priorite » de la tâche). Revu à chaque visite. Rangé dans suivi_magasins, rubrique
// « plan » (migration 0043). Le franchisé voit les titres et les statuts (plans_franchise()), jamais l'objectif chiffré.
import type { ActionSuivie } from './actions'
import type { Reseau } from './modele'

// Joseph (14/11/2026) : 3 priorités au plus par objectif (et 3 sans objectif)
export const PRIORITES_MAX = 3
export type StatutPriorite = 'active' | 'atteinte' | 'abandonnee'
export interface Priorite {
  id: string
  titre: string
  objectif: string // id d'un objectif chiffré du magasin, ou vide
  statut: StatutPriorite
  bilan: string // une ligne, à la clôture
  creeLe: string // AAAA-MM-JJ
  par: string
  closLe: string // AAAA-MM-JJ
  revueLe: string // AAAA-MM-JJ : dernière revue (en visite)
}

export const libelleStatutPriorite: Record<StatutPriorite, string> = { active: 'En cours', atteinte: 'Atteinte', abandonnee: 'Abandonnée' }

const texte = (v: unknown) => (typeof v === 'string' ? v : '')
const jour = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '')

export function normaliserPriorites(liste: unknown): Priorite[] {
  if (!Array.isArray(liste)) return []
  return liste.flatMap((o): Priorite[] => {
    if (!o || typeof o !== 'object') return []
    const x = o as Record<string, unknown>
    const titre = texte(x.titre).trim()
    if (!titre || !texte(x.id)) return []
    const statut: StatutPriorite = x.statut === 'atteinte' || x.statut === 'abandonnee' ? x.statut : 'active'
    return [{ id: texte(x.id), titre: titre.slice(0, 200), objectif: texte(x.objectif), statut, bilan: texte(x.bilan).slice(0, 300), creeLe: jour(x.creeLe), par: texte(x.par), closLe: jour(x.closLe), revueLe: jour(x.revueLe) }]
  })
}

export function normaliserPlans(v: unknown): Record<string, Priorite[]> {
  const r: Record<string, Priorite[]> = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return r
  for (const [m, liste] of Object.entries(v as Record<string, unknown>)) {
    const l = normaliserPriorites(liste)
    if (l.length) r[m] = l
  }
  return r
}

export const prioritesDu = (reseau: Reseau, magasin: string) => reseau.plans?.[magasin] ?? []
export const prioritesActives = (reseau: Reseau, magasin: string) => prioritesDu(reseau, magasin).filter((p) => p.statut === 'active')
export const tachesDeLaPriorite = (actions: ActionSuivie[], p: Priorite) => actions.filter((x) => x.a.priorite === p.id)
export const nouvelIdPriorite = () => `p_${Math.random().toString(36).slice(2, 10)}`

// Plan à revoir : aucune revue depuis 60 jours alors qu'une priorité est en cours
export function planARevoir(reseau: Reseau, magasin: string): boolean {
  const actives = prioritesActives(reseau, magasin)
  if (!actives.length) return false
  const derniere = actives.map((p) => p.revueLe || p.creeLe).sort().at(-1) ?? ''
  if (!derniere) return true
  const ecart = (Date.parse(`${reseau.jour}T12:00:00Z`) - Date.parse(`${derniere}T12:00:00Z`)) / 86_400_000
  return ecart > 60
}
