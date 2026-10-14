import { supabase } from '../lib/supabase'
import type { ActionPlan, Visite } from './modele'

// Les 10 parties du compte rendu de visite (non officiel). Aucune n'est obligatoire.
export const PARTIES: { titre: string; guide: string }[] = [
  { titre: 'Chiffres clés et gestion', guide: "CA et évolution N-1, panier moyen, fréquentation, position réseau. Stocks, commandes, démarque, marge si abordée." },
  { titre: "Suivi du plan d'action précédent", guide: 'Actions réalisées, non réalisées, et pourquoi.' },
  { titre: 'Respect du concept : PPM', guide: 'Plein : rayons garnis, pas de ruptures. Propre : magasin, vitrine, réserve. Marchand : implantation, têtes de gondole, PLV, étiquetage prix. Normes d’enseigne.' },
  { titre: 'Offre et assortiment', guide: 'Assortiment cave et bière, référencements, nouveautés, adaptation à la clientèle locale.' },
  { titre: 'Expérience client', guide: 'Accueil, conseil, qualité du service.' },
  { titre: 'Animation commerciale', guide: 'Dégustations, événements, temps forts du calendrier, fidélité.' },
  { titre: 'Ancrage local et digital', guide: 'Avis Google, réseaux sociaux, clients pros et comités d’entreprise, partenariats.' },
  { titre: 'Espace bar et consommation sur place', guide: 'Fréquentation, créneaux, rentabilité, conformité (licence, mineurs, loi Évin).' },
  { titre: 'Équipe et management', guide: 'Effectif, plannings, formation, turnover, climat.' },
  { titre: 'Synthèse', guide: '3 points forts, 3 axes de progrès, engagements du franchisé.' },
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

export class ErreurRedaction extends Error {}

// La rédaction passe par une fonction Supabase qui garde la clé de l'IA côté serveur.
export async function redigerCompteRendu(entree: { magasin: string; notes: string; parties: string[]; planPrecedent: ActionPlan[] }): Promise<{ parties: string[]; plan: ActionPlan[] }> {
  const { data, error } = await supabase.functions.invoke('rediger-compte-rendu', { body: entree })
  if (error || !data || !Array.isArray(data.parties)) {
    throw new ErreurRedaction('La rédaction automatique n’a pas abouti. Tes notes sont conservées, tu peux réessayer ou remplir les parties toi-même.')
  }
  return { parties: normaliserParties(data.parties), plan: normaliserPlan(data.plan) }
}
