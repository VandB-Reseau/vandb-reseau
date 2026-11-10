// Rituels d'animation (refonte vague 4, Joseph 10/11/2026, 33A) : réglés par le Directeur dans Paramètres (clé
// « rituels » d'app_config), suivis par un taux de tenue (Équipe › Rituels, rapport du mois). Trois rituels mesurés :
// la visite au rythme de la nine box (Coach), l'entretien mensuel du RR avec chaque Coach, la réunion régionale.
import type { Entretien } from './entretiens'
import { typeEvenement, type Reseau } from './modele'
import { anneeDe, suiviRythme } from './visites'
import { magasinsDuCoach } from './charge'

export type TypeRituel = 'visite' | 'entretien' | 'reunion'
export interface Rituel { type: TypeRituel; actif: boolean; libelle: string }
export const rituelsParDefaut: Rituel[] = [
  { type: 'visite', actif: true, libelle: 'Visite de chaque magasin au rythme de sa case nine box' },
  { type: 'entretien', actif: true, libelle: 'Entretien mensuel du Responsable Régional avec chaque Coach' },
  { type: 'reunion', actif: true, libelle: 'Réunion régionale des franchisés chaque trimestre' },
]
export const quiRituel: Record<TypeRituel, string> = { visite: 'Coach', entretien: 'Responsable Régional', reunion: 'Responsable Régional' }

export function normaliserRituels(v: unknown): Rituel[] {
  const lus = Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []
  return rituelsParDefaut.map((d) => {
    const l = lus.find((x) => x.type === d.type)
    return l ? { type: d.type, actif: l.actif !== false, libelle: typeof l.libelle === 'string' && l.libelle.trim() ? l.libelle.trim().slice(0, 120) : d.libelle } : d
  })
}

export interface Tenue { personne: string; role: 'coach' | 'rr'; faits: number; attendus: number; detail: string }
export interface TauxRituel { rituel: Rituel; faits: number; attendus: number; taux: number | null; lignes: Tenue[] }

const pct = (f: number, a: number) => (a ? Math.round((f / a) * 100) : null)
const trimestreDe = (jour: string) => { const m = Number(jour.slice(5, 7)); const debut = Math.floor((m - 1) / 3) * 3 + 1; return { debut: `${jour.slice(0, 4)}-${String(debut).padStart(2, '0')}-01`, fin: `${jour.slice(0, 4)}-${String(debut + 2).padStart(2, '0')}-31` } }

// Taux de tenue au jour du réseau. entretiens : null tant que la base ne les connaît pas (le rituel est alors sans mesure)
export function tauxRituels(reseau: Reseau, entretiens: Entretien[] | null, rrs = reseau.rrs.filter((r) => !r.integres)): TauxRituel[] {
  const rituels = (reseau.rituels ?? rituelsParDefaut).filter((r) => r.actif)
  const mois = reseau.jour.slice(0, 7)
  const coachs = reseau.equipe.filter((c) => !c.fictif)
  return rituels.map((rituel) => {
    let lignes: Tenue[] = []
    if (rituel.type === 'visite') {
      const rythme = suiviRythme(reseau, anneeDe(reseau.jour))
      lignes = coachs.map((c) => {
        const siens = rythme.filter((l) => l.coach === c.nom)
        const aJour = siens.filter((l) => !l.alerte).length
        return { personne: c.nom, role: 'coach' as const, faits: aJour, attendus: siens.length, detail: `${aJour} magasin${aJour > 1 ? 's' : ''} à jour sur ${siens.length}` }
      }).filter((l) => l.attendus)
    } else if (rituel.type === 'entretien' && entretiens) {
      lignes = rrs.map((r) => {
        const siens = coachs.filter((c) => c.rr?.id === r.id)
        const faits = siens.filter((c) => entretiens.some((e) => e.coach === c.nom && e.mois === mois && e.faitLe)).length
        return { personne: r.nom, role: 'rr' as const, faits, attendus: siens.length, detail: `${faits} entretien${faits > 1 ? 's' : ''} fait${faits > 1 ? 's' : ''} sur ${siens.length} Coach${siens.length > 1 ? 's' : ''}` }
      }).filter((l) => l.attendus)
    } else if (rituel.type === 'reunion') {
      const { debut, fin } = trimestreDe(reseau.jour)
      const reunions = reseau.evenements.filter((e) => typeEvenement(e) === 'reunion' && e.debut >= debut && e.debut <= fin && (e.invites?.length ?? 0) > 0)
      lignes = rrs.map((r) => {
        const magasins = new Set(coachs.filter((c) => c.rr?.id === r.id).flatMap((c) => magasinsDuCoach(reseau, c.nom).map((m) => m.nom)))
        const tenue = reunions.some((e) => e.invites!.some((m) => magasins.has(m)))
        return { personne: r.nom, role: 'rr' as const, faits: tenue ? 1 : 0, attendus: 1, detail: tenue ? 'Réunion du trimestre programmée' : 'Aucune réunion ce trimestre' }
      }).filter(() => true)
    }
    const faits = lignes.reduce((t, l) => t + l.faits, 0), attendus = lignes.reduce((t, l) => t + l.attendus, 0)
    return { rituel, faits, attendus, taux: rituel.type === 'entretien' && !entretiens ? null : pct(faits, attendus), lignes }
  })
}
