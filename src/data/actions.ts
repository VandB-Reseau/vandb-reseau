// Actions suivies sur un magasin : celles des plans de visite et celles ajoutées hors visite.
// Elles s'accumulent de visite en visite, jusqu'à être faites.
import { libelleResponsable, type ActionLibre, type ActionPlan, type Reseau, type Visite } from './modele'
import type { Profil } from '../auth/roles'
import { normaliserPieces } from '../lib/pieces'
import { associesEnPlace } from './associes'
import { coachA } from './charge'

export interface ActionSuivie { visite: Visite | null; libre: ActionLibre | null; magasin: string; date: string; index: number; a: ActionPlan; cle: string }

export const cleAction = (visiteId: number | null, index: number) => `${visiteId ?? 'x'}:${index}`
export const cleLibre = (id: string) => `l:${id}`
export const echeanceDate = (a: ActionPlan) => (/^\d{4}-\d{2}-\d{2}$/.test(a.echeance) ? a.echeance : '')
export const enRetard = (a: ActionPlan, jour: string) => !a.faite && !!echeanceDate(a) && echeanceDate(a) < jour

// Porteurs d'une tâche : un ou plusieurs noms, rangés dans « porteur » séparés par des virgules
// (comme les participants d'une visite), pour que les tâches déjà enregistrées restent lisibles
export const porteursDe = (a: Pick<ActionPlan, 'porteur'>) => [...new Set(String(a.porteur ?? '').split(',').map((n) => n.trim()).filter(Boolean))]
export const joindrePorteurs = (noms: string[]) => [...new Set(noms.map((n) => n.trim()).filter(Boolean))].join(', ')
export const portePar = (a: Pick<ActionPlan, 'porteur'>, nom: string) => !!nom && porteursDe(a).includes(nom)

// Relit les actions hors visite enregistrées (une liste par magasin)
export function normaliserActionsLibres(v: unknown): Record<string, ActionLibre[]> {
  const r: Record<string, ActionLibre[]> = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return r
  for (const [magasin, l] of Object.entries(v as Record<string, unknown>)) {
    if (!Array.isArray(l)) continue
    const liste = l.filter((a) => a && typeof a === 'object' && (a as ActionLibre).id && String((a as ActionLibre).action ?? '').trim()).map((x) => {
      const a = x as Record<string, unknown>
      return { id: String(a.id), action: String(a.action), porteur: String(a.porteur ?? ''), echeance: String(a.echeance ?? ''), creeLe: String(a.creeLe ?? ''),
        ...(a.faite ? { faite: String(a.faite) } : {}), ...(a.faite && a.faitePar ? { faitePar: String(a.faitePar) } : {}), ...(Array.isArray(a.pieces) && a.pieces.length ? { pieces: normaliserPieces(a.pieces) } : {}), ...(a.auteur ? { auteur: String(a.auteur) } : {}), ...(a.fil === 'equipe' ? { fil: 'equipe' as const } : {}), ...(Number(a.message) > 0 ? { message: Number(a.message) } : {}) }
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

// Porteurs possibles d'une action sur un magasin : son franchisé (ou responsable), son Coach,
// son Responsable Régional (et celui des intégrés), le Directeur de réseau
export interface Porteur { nom: string; role: string }
export function porteursDu(reseau: Reseau, magasin: string): Porteur[] {
  const m = reseau.magasins.find((x) => x.nom === magasin)
  const l: Porteur[] = []
  if (m) {
    for (const a of associesEnPlace(reseau, m)) l.push({ nom: a.nom, role: libelleResponsable(m) })
    if (m.responsable && !/recrutement/i.test(m.responsable.nom)) l.push({ nom: m.responsable.nom, role: libelleResponsable(m) })
    const coach = coachA(m, reseau.jour)
    if (coach) l.push({ nom: coach, role: 'Coach' })
    if (m.rr) l.push({ nom: m.rr.nom, role: 'Responsable Régional' })
    if (!m.franchise) for (const r of reseau.rrs.filter((x) => x.integres)) l.push({ nom: r.nom, role: 'Responsable des magasins intégrés' })
  }
  if (reseau.directeur.nom) l.push({ nom: reseau.directeur.nom, role: 'Directeur de réseau' })
  return l.filter((p, i) => p.nom && l.findIndex((x) => x.nom === p.nom) === i)
}

// Clés des porteurs choisis (directeur, rr:<id>, coach:<nom>, franchise:<nom>), pour leur envoyer la notification
export function clesDesPorteurs(reseau: Reseau, magasin: string, noms: string[]): string[] {
  const liste = porteursDu(reseau, magasin)
  const cles = noms.flatMap((nom) => {
    const p = liste.find((x) => x.nom === nom)
    if (!p) return []
    if (p.role === 'Coach') return [`coach:${nom}`]
    if (p.role === 'Directeur de réseau') return ['directeur']
    if (/^Responsable (Régional|des magasins intégrés)$/.test(p.role)) return reseau.rrs.filter((r) => r.nom === nom).map((r) => `rr:${r.id}`)
    return [`franchise:${nom}`]
  })
  return [...new Set(cles)]
}

// Nom de la personne connectée, tel qu'il apparaît comme porteur
export function monNomPorteur(reseau: Reseau, profil: Profil | null): string {
  if (!profil) return ''
  if (reseau.espace) return profil.role === 'franchise' ? reseau.espace.franchise : ''
  if (profil.role === 'coach') return profil.perimetre.coachs?.[0] ?? ''
  if (profil.role === 'rr') return reseau.rrs.find((r) => r.id === profil.perimetre.rr?.[0])?.nom ?? ''
  if (profil.role === 'directeur') return reseau.directeur.nom
  return ''
}
