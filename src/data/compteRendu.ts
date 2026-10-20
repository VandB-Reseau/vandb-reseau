import type { ActionPlan } from './modele'

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
  return v.map((a: Record<string, unknown>) => ({
    ...(a?.id ? { id: String(a.id) } : {}), action: String(a?.action ?? ''), porteur: String(a?.porteur ?? ''), echeance: String(a?.echeance ?? ''),
    ...(a?.faite ? { faite: String(a.faite) } : {}), ...(a?.faite && a?.faitePar ? { faitePar: String(a.faitePar) } : {}),
  })).filter((a) => a.action.trim())
}
