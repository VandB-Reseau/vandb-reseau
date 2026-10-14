import type { ActionPlan, Visite } from './modele'

// Parties du compte rendu de visite (non officiel). Aucune n'est obligatoire.
export const PARTIES: { titre: string }[] = [
  { titre: 'Chiffres et gestion' },
  { titre: "Suivi du plan d'action précédent" },
  { titre: 'Magasin et offre' },
  { titre: 'Clients et animation' },
  { titre: 'Équipe' },
  { titre: 'Synthèse' },
]

export const partiesVides = () => PARTIES.map(() => '')

export function normaliserParties(v: unknown): string[] {
  const t = Array.isArray(v) ? v : []
  return PARTIES.map((_p, i) => (typeof t[i] === 'string' ? t[i] : ''))
}

export function normaliserPlan(v: unknown): ActionPlan[] {
  if (!Array.isArray(v)) return []
  return v.map((a: Record<string, unknown>) => ({ action: String(a?.action ?? ''), porteur: String(a?.porteur ?? ''), echeance: String(a?.echeance ?? '') })).filter((a) => a.action.trim())
}

// Plan d'action de la visite précédente du même magasin (repris à la visite suivante)
export function visitePrecedenteAvecPlan(visites: Visite[], magasin: string, date: string, id: number | null): Visite | null {
  return visites
    .filter((v) => v.magasin === magasin && v.id !== id && v.date < date && v.plan.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
}
