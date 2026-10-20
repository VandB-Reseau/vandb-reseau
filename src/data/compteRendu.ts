import type { ActionPlan } from './modele'
import { normaliserPieces } from '../lib/pieces'

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
    ...(Array.isArray(a?.pieces) && a.pieces.length ? { pieces: normaliserPieces(a.pieces) } : {}),
  })).filter((a) => a.action.trim())
}

// Compte rendu en texte simple, pour un e-mail ou un partage depuis le téléphone : seules les parties remplies
export function texteCompteRendu(v: { magasin: string; date: string; parties: string[]; plan: ActionPlan[] }, dateLisible: string, visiteurs: string): string {
  const l = [`Compte rendu de visite · ${v.magasin} · ${dateLisible}`]
  if (visiteurs) l.push(`Visité par ${visiteurs}`)
  PARTIES.forEach((p, i) => { const t = v.parties[i]?.trim(); if (t) l.push('', p.titre.toUpperCase(), t) })
  const actions = v.plan.filter((a) => a.action.trim())
  if (actions.length) l.push('', "PLAN D'ACTION", ...actions.map((a) => `- ${a.action.trim()}${[a.porteur, a.echeance].filter(Boolean).length ? ` (${[a.porteur, a.echeance].filter(Boolean).join(', ')})` : ''}${a.faite ? ' : faite' : ''}`))
  return l.join('\n')
}
