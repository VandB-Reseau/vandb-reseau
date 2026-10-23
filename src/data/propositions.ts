// Bonnes pratiques proposées par les franchisés (sprint 22, A4 ; script supabase/migrations/0027_pratiques_proposees.sql) :
// le franchisé propose, l'équipe du magasin relit et publie dans les bonnes pratiques, ou ne retient pas.
import { supabase } from '../lib/supabase'

export type Statut = 'proposee' | 'publiee' | 'refusee'
export interface Proposition { id: number; franchise: string; magasin: string; titre: string; texte: string; proposeLe: string; statut: Statut }

type Ligne = Record<string, unknown>
const lignes = (v: unknown) => (Array.isArray(v) ? (v as Ligne[]).filter((x) => x && typeof x === 'object') : [])
const statut = (v: unknown): Statut => (v === 'publiee' || v === 'refusee' ? v : 'proposee')
const lire = (l: Ligne): Proposition => ({ id: Number(l.id), franchise: String(l.franchise ?? ''), magasin: String(l.magasin ?? ''), titre: String(l.titre ?? ''), texte: String(l.texte ?? ''), proposeLe: String(l.propose_le ?? ''), statut: statut(l.statut) })

export class ErreurProposition extends Error {}
const humain = (e: { message?: string }) => new ErreurProposition(/trop/.test(e.message ?? '') ? 'Tu as déjà dix propositions en attente de relecture.'
  : /acces_refuse/.test(e.message ?? '') ? 'Cette proposition n’est plus à traiter.' : 'L’enregistrement n’a pas abouti. Réessaie dans un instant.')

// null tant que la base ne connaît pas les propositions
export async function chargerPropositions(): Promise<Proposition[] | null> {
  const { data, error } = await supabase.rpc('propositions_pratiques')
  return error ? null : lignes(data).map(lire)
}
export async function chargerMesPropositions(): Promise<Proposition[] | null> {
  const { data, error } = await supabase.rpc('mes_propositions')
  return error ? null : lignes(data).map(lire)
}
export async function proposerPratique(magasin: string, titre: string, texte: string) {
  const { error } = await supabase.rpc('proposer_pratique', { p_magasin: magasin, p_titre: titre, p_texte: texte })
  if (error) throw humain(error)
}
export async function traiterProposition(id: number, s: 'publiee' | 'refusee', pratique?: string) {
  const { error } = await supabase.rpc('traiter_proposition', { p_id: id, p_statut: s, ...(pratique ? { p_pratique: pratique } : {}) })
  if (error) throw humain(error)
}
