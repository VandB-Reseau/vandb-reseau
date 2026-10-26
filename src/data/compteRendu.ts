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
  if (actions.length) l.push('', "PLAN D'ACTION", ...actions.map((a) => `- ${a.action.trim()}${[a.porteur, a.echeance].filter(Boolean).length ? ` (${[a.porteur, a.echeance].filter(Boolean).join(' · ')})` : ''}${a.faite ? ' : faite' : ''}`))
  return l.join('\n')
}

// Recherche dans une visite (sprint 26, S1) : magasin, visiteurs, note, les six parties et le plan d'action, sans
// tenir compte des accents ni des majuscules. Rend le passage trouvé hors magasin et note, sinon null.
const pliage = (c: string) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const plier = (s: string) => [...s].map(pliage).join('')

function extrait(texte: string, q: string): string | null {
  // Position dans le texte d'origine : chaque caractère plié garde la place de celui dont il vient
  const places: number[] = []
  let plie = ''
  ;[...texte].forEach((c, i) => { const p = pliage(c); plie += p; for (let k = 0; k < p.length; k++) places.push(i) })
  const n = plie.indexOf(q)
  if (n < 0) return null
  const car = [...texte]
  const debut = places[n]
  const fin = places[n + q.length - 1] + 1
  const avant = Math.max(0, debut - 30)
  const apres = Math.min(car.length, fin + 50)
  return `${avant > 0 ? '…' : ''}${car.slice(avant, apres).join('').trim()}${apres < car.length ? '…' : ''}`
}

export interface Trouvaille { ou: string; passage: string }
export function chercherDansVisite(v: { magasin: string; visiteurs: string[]; notes: string; parties: string[]; plan: ActionPlan[] }, recherche: string): Trouvaille | null | false {
  const q = plier(recherche.trim())
  if (!q) return null
  if (plier(`${v.magasin} ${v.visiteurs.join(' ')} ${v.notes}`).includes(q)) return null
  for (let i = 0; i < PARTIES.length; i++) {
    const p = v.parties[i] ? extrait(v.parties[i], q) : null
    if (p) return { ou: PARTIES[i].titre, passage: p }
  }
  for (const a of v.plan) {
    const p = extrait(a.action, q)
    if (p) return { ou: 'Plan d’action', passage: p }
  }
  return false
}
